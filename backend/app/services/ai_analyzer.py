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

from dataclasses import dataclass

@dataclass
class ComplianceResult:
    has_contradiction: bool
    contradiction_level: str
    violated_norm: str | None = None
    contradiction_description: str | None = None
    pravo_by_url: str | None = None
    fix_suggestion: str | None = None


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

ИЕРАРХИЯ НПА БЕЛАРУСИ (от высшего к низшему):
1. Конституция Республики Беларусь
2. Законы РБ (Трудовой кодекс, КоАП, ГК, Кодекс об образовании, Закон о персональных данных...)
3. Декреты и Указы Президента
4. Постановления Совета Министров
5. Акты министерств и ведомств (Постановления Минтруда и т.д.)
6. Решения местных органов
7. ЛНА организаций (ПВТР, Положения, Инструкции, Должностные инструкции...)

КАТЕГОРИИ ДОКУМЕНТОВ И ПРИМЕНИМЫЕ ЗАКОНЫ:
- Трудовые отношения, ПВТР, трудовые договоры → Трудовой кодекс РБ, Закон «Об охране труда»
- Оплата труда, премирование, материальная ответственность → ТК РБ ст.41, 63, 69, 155, 161
- Образование, учебные заведения → Кодекс об образовании РБ
- Здравоохранение, медицинские организации → Закон «О здравоохранении»
- Персональные данные, их обработка → Закон «О персональных данных и их защите»
- Хозяйственная деятельность, ООО, АО → ГК РБ, Закон «О хозяйственных обществах»
- Антикоррупционные нормы → Закон «О противодействии коррупции РБ»
- Информационные системы, данные → Закон «Об информации, информатизации и защите информации»
- Административная ответственность, штрафы → КоАП РБ

ВАЖНЫЕ ПРАВИЛА:
1. Определяй категорию документа по его содержанию
2. Ссылайся на ВСЕ применимые НПА данной категории, не только на Трудовой кодекс
3. Конституция РБ имеет высшую юридическую силу — проверяй соответствие ей в первую очередь
4. При анализе трудовых документов учитывай КоАП РБ для оценки штрафов
5. Всегда отвечай ТОЛЬКО валидным JSON без markdown-обёрток и без пояснений вне JSON"""

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

COMPLIANCE_PROMPT = """Проверь, не противоречит ли новая редакция нормативным актам Беларуси.

Изменённый пункт ЛНА:
{text}

Релевантные нормы вышестоящих актов:
{npa_context}

Верни JSON (только JSON, без markdown):
{{
  "has_contradiction": true,
  "contradiction_level": "DIRECT|INDIRECT|NONE",
  "violated_norm": "Статья X Закона Y" или null,
  "contradiction_description": "Описание" или null,
  "pravo_by_url": "https://pravo.by/document/?guid=..." или null,
  "fix_suggestion": "Предлагаемая безопасная формулировка" или null
}}"""

# Промпт для Режима 3: проверка дочернего ЛНА на соответствие родительскому НПА
PARENT_CHILD_COMPLIANCE_PROMPT = """Ты — эксперт по законодательству Республики Беларусь.

РОДИТЕЛЬСКИЙ НПА (вышестоящий документ организации):
{parent_context}

ГОСУДАРСТВЕННЫЕ НОРМЫ РБ по данной теме:
{npa_context}

ПРОВЕРЯЕМЫЙ РАЗДЕЛ ДОЧЕРНЕГО ЛНА:
Путь: {section_path}
Текст: {child_text}

Проверь:
1. Не противоречит ли данный пункт родительскому НПА
2. Не противоречит ли данный пункт государственному законодательству РБ
3. Если противоречит — что именно нарушено и как исправить

Верни ТОЛЬКО JSON (без markdown):
{{
  "status": "COMPLIANT|VIOLATION|WARNING",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <число 0-100>,
  "violation_source": "PARENT|STATE_LAW|BOTH|NONE",
  "violated_norm": "Статья X Закона Y или Пункт Z родительского НПА или null",
  "violation_description": "Описание нарушения или null",
  "recommendation": "Как исправить формулировку",
  "confidence": <число 0.0-1.0>
}}

Правила классификации:
- COMPLIANT + LOW: соответствует и родительскому, и государственному законодательству
- WARNING + MEDIUM: незначительное отклонение, требует уточнения
- VIOLATION + HIGH: явное противоречие родительскому НПА или закону
- VIOLATION + CRITICAL: грубое нарушение с высоким риском санкций"""


# Промпт для Режима 4: аудит одного документа по госзаконодательству РБ
AUDIT_PROMPT = """Ты — эксперт по законодательству Республики Беларусь.
Твоя задача — найти нарушения в тексте НПА/ЛНА организации.

ИЕРАРХИЯ НПА БЕЛАРУСИ (от высшего к низшему):
1. Конституция Республики Беларусь
2. Законы РБ (Трудовой кодекс, КоАП, ГК, Кодекс об образовании...)
3. Декреты и Указы Президента
4. Постановления Совета Министров
5. Акты министерств и ведомств
6. ЛНА организаций

КАТЕГОРИИ ДОКУМЕНТОВ И ПРИМЕНИМОЕ ЗАКОНОДАТЕЛЬСТВО:
- Трудовые отношения, ПВТР, должностные инструкции → Трудовой кодекс РБ
- Образование → Кодекс об образовании РБ
- Здравоохранение, медицина → Закон о здравоохранении РБ
- Персональные данные → Закон о персональных данных и их защите
- Хозяйственная деятельность → ГК РБ, Закон о хозяйственных обществах
- Антикоррупционные нормы → Закон о противодействии коррупции РБ

ПРОВЕРЯЕМЫЙ РАЗДЕЛ ДОКУМЕНТА:
Путь в документе: {section_path}
Текст: {section_text}

ГОСУДАРСТВЕННЫЕ НОРМЫ ПО ДАННОЙ ТЕМЕ:
{npa_context}

Определи категорию и найди нарушения. Верни ТОЛЬКО JSON (без markdown):
{{
  "has_violation": true/false,
  "category": "LABOR|EDUCATION|HEALTH|PERSONAL_DATA|COMMERCIAL|ANTICORRUPTION|OTHER",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <число 0-100>,
  "violation_description": "Описание нарушения или null",
  "violated_norm": "Статья X Закона Y или null",
  "recommendation": "Конкретная рекомендация по исправлению",
  "confidence": <число 0.0-1.0>
}}

Правила:
- Если нарушений нет — has_violation: false, risk_level: LOW, risk_score < 20
- CRITICAL: прямое нарушение Конституции или основных законов
- HIGH: нарушение обязательных норм (Трудовой кодекс, КоАП и т.д.)
- MEDIUM: нарушение рекомендательных норм или неточности
- LOW: соответствует законодательству"""


class GeminiAnalyzer:
    """AI анализатор через OpenRouter. Имя класса сохранено для совместимости."""

    def __init__(self):
        self.model = settings.openrouter_model
        self._api_key = settings.openrouter_api_key

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

    def _make_client(self) -> AsyncOpenAI:
        """Создать новый клиент. Вызывающий код обязан вызвать await client.close()."""
        return AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self._api_key,
            max_retries=0,
        )

    async def _call_openrouter(self, prompt: str) -> AIAnalysis:
        full_prompt = SYSTEM_PROMPT + "\n\n" + prompt
        client = self._make_client()
        try:
            response = await client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "NPA Assistant",
                },
                model=self.model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.1,
                max_tokens=600,
            )
        finally:
            await client.close()   # явно закрываем ДО того как loop закроется

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

    async def check_compliance(
        self,
        text: str,
        npa_articles: list[dict],
    ) -> ComplianceResult:
        """Проверить соответствие текста нормам НПА. Вызывается для MEDIUM/HIGH/CRITICAL."""
        if not npa_articles or not self._api_key:
            # Нет данных или нет ключа — возвращаем нейтральный результат
            # Но pravo_by_url можно взять из первой найденной статьи
            url = None
            if npa_articles and npa_articles[0].get("pravo_by_url"):
                url = npa_articles[0]["pravo_by_url"]
            return ComplianceResult(
                has_contradiction=False,
                contradiction_level="NONE",
                violated_norm=None,
                pravo_by_url=url,
                fix_suggestion=None,
            )

        # Формируем контекст из найденных статей (берём топ-3)
        npa_context = "\n\n".join([
            f"[{a['law_name']}, {a['article_number']}]\n{a['article_text'][:400]}"
            for a in npa_articles[:3]
        ])

        prompt = COMPLIANCE_PROMPT.format(
            text=text[:800],      # обрезаем длинные тексты
            npa_context=npa_context,
        )
        full_prompt = SYSTEM_PROMPT + "\n\n" + prompt

        client = self._make_client()
        try:
            response = await client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "NPA Assistant",
                },
                model=self.model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.1,
                max_tokens=300,
            )
        finally:
            await client.close()

        raw = response.choices[0].message.content or ""
        return self._parse_compliance(raw, npa_articles)

    async def check_parent_child_compliance(
        self,
        section_path: str,
        child_text: str,
        parent_context: str,
        npa_articles: list[dict],
    ) -> dict:
        """
        Режим 3: Проверить раздел дочернего ЛНА на соответствие
        родительскому НПА и государственному законодательству.
        """
        npa_context = "\n\n".join([
            f"[{a['law_name']}, {a['article_number']}]\n{a['article_text'][:400]}"
            for a in npa_articles[:3]
        ]) if npa_articles else "Релевантных норм в базе не найдено."

        prompt = PARENT_CHILD_COMPLIANCE_PROMPT.format(
            parent_context=parent_context[:1000],
            npa_context=npa_context,
            section_path=section_path,
            child_text=child_text[:600],
        )
        full_prompt = SYSTEM_PROMPT + "\n\n" + prompt

        client = self._make_client()
        try:
            response = await client.chat.completions.create(
                extra_headers={"HTTP-Referer": "http://localhost:5173", "X-Title": "NPA Assistant"},
                model=self.model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.1,
                max_tokens=400,
            )
        finally:
            await client.close()

        raw = response.choices[0].message.content or ""
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw).strip()

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(match.group()) if match else {}

        return {
            "status":                str(data.get("status", "WARNING")),
            "risk_level":            str(data.get("risk_level", "MEDIUM")).upper(),
            "risk_score":            max(0.0, min(100.0, float(data.get("risk_score", 40)))),
            "violation_source":      str(data.get("violation_source", "NONE")),
            "violated_norm":         data.get("violated_norm"),
            "violation_description": data.get("violation_description"),
            "recommendation":        str(data.get("recommendation", ""))[:500],
            "confidence":            max(0.0, min(1.0, float(data.get("confidence", 0.5)))),
        }

    async def audit_section(
        self,
        section_path: str,
        section_text: str,
        npa_articles: list[dict],
    ) -> dict:
        """
        Режим 4: Проверить один раздел документа на соответствие
        государственному законодательству РБ.
        """
        npa_context = "\n\n".join([
            f"[{a['law_name']}, {a['article_number']}]\n{a['article_text'][:400]}"
            for a in npa_articles[:4]
        ]) if npa_articles else "Релевантных норм в базе не найдено."

        prompt = AUDIT_PROMPT.format(
            section_path=section_path,
            section_text=section_text[:800],
            npa_context=npa_context,
        )
        full_prompt = SYSTEM_PROMPT + "\n\n" + prompt

        client = self._make_client()
        try:
            response = await client.chat.completions.create(
                extra_headers={"HTTP-Referer": "http://localhost:5173", "X-Title": "NPA Assistant"},
                model=self.model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.1,
                max_tokens=400,
            )
        finally:
            await client.close()

        raw = response.choices[0].message.content or ""
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw).strip()

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            data = json.loads(match.group()) if match else {}

        return {
            "has_violation":       bool(data.get("has_violation", False)),
            "category":            str(data.get("category", "OTHER")),
            "risk_level":          str(data.get("risk_level", "LOW")).upper(),
            "risk_score":          max(0.0, min(100.0, float(data.get("risk_score", 10)))),
            "violation_description": data.get("violation_description"),
            "violated_norm":       data.get("violated_norm"),
            "recommendation":      str(data.get("recommendation", ""))[:500],
            "confidence":          max(0.0, min(1.0, float(data.get("confidence", 0.5)))),
        }

    def _parse_compliance(self, text: str, npa_articles: list[dict]) -> ComplianceResult:
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            data = json.loads(match.group()) if match else {}

        # Если AI не вернул pravo_by_url — берём из первой статьи
        pravo_url = data.get("pravo_by_url")
        if not pravo_url and npa_articles:
            pravo_url = npa_articles[0].get("pravo_by_url")

        return ComplianceResult(
            has_contradiction=bool(data.get("has_contradiction", False)),
            contradiction_level=str(data.get("contradiction_level", "NONE")).upper(),
            violated_norm=data.get("violated_norm"),
            pravo_by_url=pravo_url,
            fix_suggestion=data.get("fix_suggestion"),
        )