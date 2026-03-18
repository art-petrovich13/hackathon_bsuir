# backend/app/services/ai_analyzer.py
"""
AI анализатор изменений через OpenRouter API.
Использует модель google/gemma-3-27b-it:free — бесплатно, без дневных лимитов.
"""
import asyncio
import json
import re
from dataclasses import dataclass

from openai import AsyncOpenAI

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
Всегда отвечай ТОЛЬКО валидным JSON без markdown-обёрток и без пояснений вне JSON."""

ANALYSIS_PROMPT = """Проанализируй это изменение в нормативном акте:

Путь в документе: {section_path}
Тип изменения: {change_type}
СТАРАЯ редакция: {old_text}
НОВАЯ редакция: {new_text}

Верни JSON (строго только JSON, без markdown):
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
- OBLIGATION_CHANGE + HIGH: "имеет право" -> "обязан"
- DEADLINE_CHANGE + MEDIUM: изменение сроков ("5 дней" -> "3 дня")
- SCOPE_CHANGE + MEDIUM/HIGH: изменение круга лиц или случаев применения
- SUBJECT_CHANGE + MEDIUM: изменение субъекта нормы
- SANCTION_CHANGE + HIGH/CRITICAL: изменение ответственности
- COSMETIC + LOW: исправление опечаток, пунктуации без смысловых изменений"""


class GeminiAnalyzer:
    """AI анализатор через OpenRouter. Имя класса сохранено для совместимости."""

    def __init__(self):
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
            max_retries=0,  # отключаем встроенные ретраи — управляем сами
        )
        self.model = "arcee-ai/trinity-large-preview:free"

    async def analyze_batch(self, changes: list[RawChange]) -> list[AIAnalysis]:
        """Строго последовательный анализ — rate limit 16 req/min на бесплатном тарифе."""
        if not changes:
            return []
        final = []
        for change in changes:
            try:
                result = await self._analyze_single(change)
                final.append(result)
            except Exception as e:
                print(f"AI analysis failed for {change.section_path}: {e}")
                final.append(self._fallback_analysis(change))
        return final

    async def _analyze_single(self, change: RawChange) -> AIAnalysis:
        prompt = ANALYSIS_PROMPT.format(
            section_path=change.section_path,
            change_type=change.change_type,
            old_text=change.old_text or "(отсутствует)",
            new_text=change.new_text or "(удалено)",
        )
        return await self._call_with_retry(prompt)

    async def _call_with_retry(self, prompt: str, retries: int = 5) -> AIAnalysis:
        """Вызов с повторными попытками. При 429 — большая пауза."""
        last_error = None
        for attempt in range(retries):
            try:
                result = await self._call_openrouter(prompt)
                return result
            except Exception as e:
                last_error = e
                if "429" in str(e):
                    wait = 20 * (attempt + 1)  # 20с, 40с, 60с...
                    print(f"Rate limit, waiting {wait}s (attempt {attempt+1}/{retries})...")
                    await asyncio.sleep(wait)
                else:
                    if attempt < retries - 1:
                        await asyncio.sleep(5)
                    else:
                        raise
        raise last_error

    async def _call_openrouter(self, prompt: str) -> AIAnalysis:
        # Gemma не поддерживает role=system — объединяем в одно user-сообщение
        full_prompt = SYSTEM_PROMPT + "\n\n" + prompt
        response = await self.client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://npa-assistant.local",
                "X-Title": "NPA Assistant",
            },
            model=self.model,
            messages=[{"role": "user", "content": full_prompt}],
            temperature=0.1,
            max_tokens=600,
        )
        text = response.choices[0].message.content or ""
        return self._parse_response(text)

    def _parse_response(self, text: str) -> AIAnalysis:
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text)
        text = text.strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Не удалось распарсить JSON: {text[:200]}")

        valid_semantic = {
            "OBLIGATION_CHANGE", "SCOPE_CHANGE", "DEADLINE_CHANGE",
            "SUBJECT_CHANGE", "SANCTION_CHANGE", "COSMETIC"
        }
        valid_risk = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

        semantic_type = str(data.get("semantic_type", "COSMETIC")).upper()
        if semantic_type not in valid_semantic:
            semantic_type = "COSMETIC"

        risk_level = str(data.get("risk_level", "LOW")).upper()
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
            return AIAnalysis("SCOPE_CHANGE", "MEDIUM", 40.0,
                "New paragraph added. Requires compliance check.", None,
                "Verify the added paragraph complies with applicable regulations.", 0.3)
        elif change.change_type == "DELETED":
            return AIAnalysis("SCOPE_CHANGE", "MEDIUM", 50.0,
                "Paragraph removed. Possible loss of mandatory provisions.", None,
                "Ensure the deleted paragraph was not mandatory under current law.", 0.3)
        else:
            return AIAnalysis("COSMETIC", "LOW", 10.0,
                "Change detected. Manual review recommended.", None,
                "Review this change manually.", 0.3)

    async def create_embedding(self, text: str) -> list[float]:
        return [0.0] * 768