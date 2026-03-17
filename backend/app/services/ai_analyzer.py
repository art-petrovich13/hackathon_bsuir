# backend/app/services/ai_analyzer.py
"""
AI анализатор изменений через Google Gemini.
Классифицирует каждое изменение: тип, риск, объяснение, ссылка на НПА.
"""
import asyncio
import json
import re
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.services.differ import RawChange


@dataclass
class AIAnalysis:
    """Результат AI анализа одного изменения."""
    semantic_type: str        # OBLIGATION_CHANGE | SCOPE_CHANGE | DEADLINE_CHANGE | SUBJECT_CHANGE | SANCTION_CHANGE | COSMETIC
    risk_level: str           # LOW | MEDIUM | HIGH | CRITICAL
    risk_score: float         # 0-100
    explanation: str          # Юридическое объяснение
    law_reference: str | None # "Статья X Закона Y" или None
    recommendation: str       # Рекомендация юристу
    confidence: float         # 0.0-1.0


# Системный промпт — общий контекст для Gemini
SYSTEM_PROMPT = """Ты — эксперт по законодательству Республики Беларусь.
Анализируй изменения в нормативных правовых актах (НПА) и локальных нормативных актах (ЛНА).
Всегда отвечай ТОЛЬКО валидным JSON, без markdown-обёрток, без пояснений вне JSON."""

# Шаблон промпта для анализа одного изменения
ANALYSIS_PROMPT = """Проанализируй это изменение в нормативном акте:

Путь в документе: {section_path}
Тип изменения: {change_type}
СТАРАЯ редакция: {old_text}
НОВАЯ редакция: {new_text}

Определи и верни JSON (строго без markdown, только JSON):
{{
  "semantic_type": "OBLIGATION_CHANGE|SCOPE_CHANGE|DEADLINE_CHANGE|SUBJECT_CHANGE|SANCTION_CHANGE|COSMETIC",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <число 0-100>,
  "explanation": "Краткое юридическое объяснение изменения (2-3 предложения)",
  "law_reference": "Статья X Закона Y" или null,
  "recommendation": "Конкретная рекомендация юристу что нужно сделать",
  "confidence": <число 0.0-1.0>
}}

Правила классификации:
- OBLIGATION_CHANGE + HIGH: "имеет право" → "обязан", изменение обязательности нормы
- DEADLINE_CHANGE + MEDIUM: изменение любых сроков ("5 дней" → "3 дня")
- SCOPE_CHANGE + MEDIUM/HIGH: расширение или сужение круга лиц или случаев применения
- SUBJECT_CHANGE + MEDIUM: изменение субъекта действия нормы
- SANCTION_CHANGE + HIGH/CRITICAL: изменение ответственности или санкций
- COSMETIC + LOW: исправление опечаток, пунктуации, форматирования без смысловых изменений
"""


class GeminiAnalyzer:
    """
    Клиент для анализа изменений через Gemini API.
    Использует батчинг и параллельные запросы для скорости.
    """

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = "gemini-1.5-flash"   # flash быстрее и дешевле для батч-обработки
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        # Ограничение параллельных запросов (rate limiting)
        self._semaphore = asyncio.Semaphore(5)

    async def analyze_batch(self, changes: list[RawChange]) -> list[AIAnalysis]:
        """
        Проанализировать список изменений параллельно.
        Батчинг по 10 штук + семафор на 5 одновременных запросов.
        """
        if not changes:
            return []

        # Фильтруем: COSMETIC изменения с одним словом не стоит отправлять в Gemini
        tasks = [self._analyze_single(change) for change in changes]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        final = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # Фолбэк при ошибке — базовый анализ без AI
                print(f"AI analysis failed for change {changes[i].section_path}: {result}")
                final.append(self._fallback_analysis(changes[i]))
            else:
                final.append(result)

        return final

    async def _analyze_single(self, change: RawChange) -> AIAnalysis:
        """Отправить один запрос к Gemini для анализа изменения."""
        async with self._semaphore:
            prompt = ANALYSIS_PROMPT.format(
                section_path=change.section_path,
                change_type=change.change_type,
                old_text=change.old_text or "(отсутствует)",
                new_text=change.new_text or "(удалено)",
            )
            return await self._call_gemini_with_retry(prompt)

    async def _call_gemini_with_retry(self, prompt: str, retries: int = 3) -> AIAnalysis:
        """Вызов Gemini с повторными попытками при ошибке."""
        last_error = None

        for attempt in range(retries):
            try:
                result = await self._call_gemini(prompt)
                return result
            except Exception as e:
                last_error = e
                if attempt < retries - 1:
                    # Экспоненциальная задержка: 1с, 2с, 4с
                    await asyncio.sleep(2 ** attempt)

        # Все попытки исчерпаны
        raise last_error

    async def _call_gemini(self, prompt: str) -> AIAnalysis:
        """Один HTTP запрос к Gemini API."""
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": SYSTEM_PROMPT + "\n\n" + prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,       # низкая температура = детерминированные ответы
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

        # Извлечь текст ответа
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ValueError(f"Неожиданный формат ответа Gemini: {data}") from e

        return self._parse_gemini_response(text)

    def _parse_gemini_response(self, text: str) -> AIAnalysis:
        """Распарсить JSON ответ Gemini в объект AIAnalysis."""
        # Убираем markdown-обёртки если они есть (на всякий случай)
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text)
        text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            # Попытка исправить: извлечь JSON из текста
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Не удалось распарсить JSON ответ Gemini: {text[:200]}") from e

        # Валидация и нормализация полей
        valid_semantic_types = {
            "OBLIGATION_CHANGE", "SCOPE_CHANGE", "DEADLINE_CHANGE",
            "SUBJECT_CHANGE", "SANCTION_CHANGE", "COSMETIC"
        }
        valid_risk_levels = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

        semantic_type = data.get("semantic_type", "COSMETIC").upper()
        if semantic_type not in valid_semantic_types:
            semantic_type = "COSMETIC"

        risk_level = data.get("risk_level", "LOW").upper()
        if risk_level not in valid_risk_levels:
            risk_level = "LOW"

        risk_score = float(data.get("risk_score", 10))
        risk_score = max(0.0, min(100.0, risk_score))

        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        return AIAnalysis(
            semantic_type=semantic_type,
            risk_level=risk_level,
            risk_score=risk_score,
            explanation=str(data.get("explanation", ""))[:1000],
            law_reference=data.get("law_reference"),
            recommendation=str(data.get("recommendation", ""))[:500],
            confidence=confidence,
        )

    def _fallback_analysis(self, change: RawChange) -> AIAnalysis:
        """
        Базовый анализ без AI — когда Gemini недоступен или вернул ошибку.
        Простая эвристика по типу изменения.
        """
        if change.change_type == "ADDED":
        return AIAnalysis(
            semantic_type="SCOPE_CHANGE",
            risk_level="MEDIUM",
            risk_score=40.0,
            explanation="New paragraph added. Requires compliance check.",
            law_reference=None,
            recommendation="Verify the added paragraph complies with applicable regulations.",
            confidence=0.3,
        )
    elif change.change_type == "DELETED":
        return AIAnalysis(
            semantic_type="SCOPE_CHANGE",
            risk_level="MEDIUM",
            risk_score=50.0,
            explanation="Paragraph removed. Possible loss of mandatory provisions.",
            law_reference=None,
            recommendation="Ensure the deleted paragraph was not mandatory under current law.",
            confidence=0.3,
        )
    else:
        return AIAnalysis(
            semantic_type="COSMETIC",
            risk_level="LOW",
            risk_score=10.0,
            explanation="Change detected. Manual review recommended.",
            law_reference=None,
            recommendation="Review this change manually.",
            confidence=0.3,
        )

    async def create_embedding(self, text: str) -> list[float]:
        """
        Создать векторный эмбеддинг текста через Gemini Embedding API.
        Используется для заполнения векторной базы НПА.
        """
        url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]},
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                url,
                params={"key": self.api_key},
                json=payload,
            )
            response.raise_for_status()

        data = response.json()
        return data["embedding"]["values"]