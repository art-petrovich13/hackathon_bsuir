# backend/app/services/ai_analyzer.py
import asyncio
import json
import re
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.services.differ import RawChange


@dataclass
class AIAnalysis:
    semantic_type: str
    risk_level: str
    risk_score: float
    explanation: str
    law_reference: str | None
    recommendation: str
    confidence: float


SYSTEM_PROMPT = """Ты — эксперт по законодательству Республики Беларусь.
Анализируй изменения в нормативных правовых актах (НПА) и локальных нормативных актах (ЛНА).
Всегда отвечай ТОЛЬКО валидным JSON, без markdown-обёрток, без пояснений вне JSON."""

ANALYSIS_PROMPT = """Проанализируй это изменение в нормативном акте:

Путь в документе: {section_path}
Тип изменения: {change_type}
СТАРАЯ редакция: {old_text}
НОВАЯ редакция: {new_text}

Верни JSON:
{{
  "semantic_type": "OBLIGATION_CHANGE|SCOPE_CHANGE|DEADLINE_CHANGE|SUBJECT_CHANGE|SANCTION_CHANGE|COSMETIC",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <число 0-100>,
  "explanation": "Краткое юридическое объяснение (2-3 предложения)",
  "law_reference": "Статья X Закона Y" или null,
  "recommendation": "Конкретная рекомендация юристу",
  "confidence": <число 0.0-1.0>
}}

Правила:
- OBLIGATION_CHANGE + HIGH: "имеет право" → "обязан"
- DEADLINE_CHANGE + MEDIUM: изменение сроков
- SCOPE_CHANGE + MEDIUM/HIGH: изменение круга лиц
- SANCTION_CHANGE + HIGH/CRITICAL: изменение ответственности
- COSMETIC + LOW: опечатки, пунктуация без смысловых изменений"""


class GeminiAnalyzer:

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = "gemini-2.5-flash"
        self.base_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent"
        )
        self._semaphore = asyncio.Semaphore(3)

    async def analyze_batch(self, changes: list[RawChange]) -> list[AIAnalysis]:
        if not changes:
            return []
        tasks = [self._analyze_single(change) for change in changes]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        final = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"AI analysis failed for change {changes[i].section_path}: {result}")
                final.append(self._fallback_analysis(changes[i]))
            else:
                final.append(result)
        return final

    async def _analyze_single(self, change: RawChange) -> AIAnalysis:
        async with self._semaphore:
            prompt = ANALYSIS_PROMPT.format(
                section_path=change.section_path,
                change_type=change.change_type,
                old_text=change.old_text or "(отсутствует)",
                new_text=change.new_text or "(удалено)",
            )
            return await self._call_gemini_with_retry(prompt)

    async def _call_gemini_with_retry(self, prompt: str, retries: int = 3) -> AIAnalysis:
        last_error = None
        for attempt in range(retries):
            try:
                return await self._call_gemini(prompt)
            except Exception as e:
                last_error = e
                if attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)
        raise last_error

    async def _call_gemini(self, prompt: str) -> AIAnalysis:
        payload = {
            "contents": [
                {"parts": [{"text": SYSTEM_PROMPT + "\n\n" + prompt}]}
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 500,
                "responseMimeType": "application/json",
            },
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.base_url,
                params={"key": self.api_key},
                json=payload,
            )
            response.raise_for_status()
        data = response.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ValueError(f"Неожиданный формат ответа Gemini: {data}") from e
        return self._parse_gemini_response(text)

    def _parse_gemini_response(self, text: str) -> AIAnalysis:
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text)
        text = text.strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Не удалось распарсить JSON: {text[:200]}") from e

        valid_semantic = {
            "OBLIGATION_CHANGE", "SCOPE_CHANGE", "DEADLINE_CHANGE",
            "SUBJECT_CHANGE", "SANCTION_CHANGE", "COSMETIC"
        }
        valid_risk = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

        semantic_type = data.get("semantic_type", "COSMETIC").upper()
        if semantic_type not in valid_semantic:
            semantic_type = "COSMETIC"

        risk_level = data.get("risk_level", "LOW").upper()
        if risk_level not in valid_risk:
            risk_level = "LOW"

        return AIAnalysis(
            semantic_type=semantic_type,
            risk_level=risk_level,
            risk_score=max(0.0, min(100.0, float(data.get("risk_score", 10)))),
            explanation=str(data.get("explanation", ""))[:1000],
            law_reference=data.get("law_reference"),
            recommendation=str(data.get("recommendation", ""))[:500],
            confidence=max(0.0, min(1.0, float(data.get("confidence", 0.5)))),
        )

    def _fallback_analysis(self, change: RawChange) -> AIAnalysis:
        if change.change_type == "ADDED":
            return AIAnalysis(
                semantic_type="SCOPE_CHANGE", risk_level="MEDIUM", risk_score=40.0,
                explanation="New paragraph added. Requires compliance check.",
                law_reference=None,
                recommendation="Verify the added paragraph complies with applicable regulations.",
                confidence=0.3,
            )
        elif change.change_type == "DELETED":
            return AIAnalysis(
                semantic_type="SCOPE_CHANGE", risk_level="MEDIUM", risk_score=50.0,
                explanation="Paragraph removed. Possible loss of mandatory provisions.",
                law_reference=None,
                recommendation="Ensure the deleted paragraph was not mandatory under current law.",
                confidence=0.3,
            )
        else:
            return AIAnalysis(
                semantic_type="COSMETIC", risk_level="LOW", risk_score=10.0,
                explanation="Change detected. Manual review recommended.",
                law_reference=None,
                recommendation="Review this change manually.",
                confidence=0.3,
            )

    async def create_embedding(self, text: str) -> list[float]:
        try:
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
            payload = {
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": text}]},
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    url, params={"key": self.api_key}, json=payload,
                )
                response.raise_for_status()
            return response.json()["embedding"]["values"]
        except Exception:
            return [0.0] * 768