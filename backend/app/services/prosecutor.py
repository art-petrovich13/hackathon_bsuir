# backend/app/services/prosecutor.py
"""
Модуль ПРОКУРОР — анализ правовых и финансовых рисков изменений в НПА.
Вызывается автоматически для diff_results с risk_level HIGH или CRITICAL.
"""
import asyncio
import json
import re
from dataclasses import dataclass, field

from openai import AsyncOpenAI

from app.core.config import settings
from app.services.bv_calculator import (
    BV_BYN, USD_RATE,
    get_fine_range,
    SEMANTIC_TO_KOAP,
    SEMANTIC_TO_REGULATOR,
)


@dataclass
class SimilarCase:
    description: str
    year: int
    outcome: str
    outcome_type: str   # FINE | PRESCRIPTION | COURT | WARNING


@dataclass
class FinancialRisks:
    fine_min_byn: float
    fine_max_byn: float
    fine_basis: str
    compensation_risk_byn: float | None = None
    legal_costs_estimate_byn: float | None = None


@dataclass
class RegulatoryRisks:
    primary_regulator: str
    prescription_probability: float
    inspection_trigger_risk: float
    suspension_risk: bool = False


@dataclass
class ProsecutorReport:
    risk_score: float
    violation_probability: float
    financial_risks: FinancialRisks
    regulatory_risks: RegulatoryRisks
    similar_cases: list[SimilarCase] = field(default_factory=list)
    urgency: str = "WITHIN_30_DAYS"   # IMMEDIATE | WITHIN_30_DAYS | RECOMMENDED
    recommended_fix: str = ""
    fix_rationale: str = ""


PROSECUTOR_SYSTEM = """Ты — юрист-аналитик по правовым рискам в Республике Беларусь.
Оцени реальные финансовые и правовые последствия нарушения в НПА/ЛНА.
Используй конкретные данные КоАП РБ. Отвечай ТОЛЬКО JSON без markdown."""

PROSECUTOR_USER = """Обнаружено изменение высокого риска в нормативном акте:

Раздел документа: {section_path}
Тип нарушения: {semantic_type}
Старая редакция: {old_text}
Новая редакция: {new_text}
Нарушаемая норма: {law_reference}

Применимая статья КоАП РБ: {koap_article}
Диапазон штрафа для организации: от {fine_min} BYN до {fine_max} BYN
(от {fine_min_bv} до {fine_max_bv} базовых величин, 1 БВ = {bv} BYN)

Верни JSON (только JSON, без markdown):
{{
  "risk_score": <число 0-100>,
  "violation_probability": <число 0.0-1.0>,
  "financial_risks": {{
    "fine_min_byn": <число>,
    "fine_max_byn": <число>,
    "fine_basis": "Статья X КоАП РБ — краткое описание",
    "compensation_risk_byn": <число или null>,
    "legal_costs_estimate_byn": <число или null>
  }},
  "regulatory_risks": {{
    "primary_regulator": "Департамент инспекции труда|Прокуратура|Минтруда",
    "prescription_probability": <число 0.0-1.0>,
    "inspection_trigger_risk": <число 0.0-1.0>,
    "suspension_risk": false
  }},
  "similar_cases": [
    {{
      "description": "Краткое описание аналогичного нарушения",
      "year": 2023,
      "outcome": "Предписание + штраф X BYN",
      "outcome_type": "FINE|PRESCRIPTION|COURT|WARNING"
    }}
  ],
  "urgency": "IMMEDIATE|WITHIN_30_DAYS|RECOMMENDED",
  "recommended_fix": "Конкретная безопасная формулировка пункта",
  "fix_rationale": "Почему эта формулировка соответствует закону"
}}"""


class ProsecutorAnalyzer:

    def __init__(self):
        # Используем ту же модель что и основной анализатор
        self.model = getattr(settings, "openrouter_model", "arcee-ai/trinity-large-preview:free")
        self._api_key = settings.openrouter_api_key

    def _make_client(self) -> AsyncOpenAI:
        return AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self._api_key,
            max_retries=0,
        )

    async def analyze(
        self,
        section_path: str,
        semantic_type: str | None,
        old_text: str | None,
        new_text: str | None,
        law_reference: str | None,
        risk_level: str,
    ) -> ProsecutorReport:
        """Полный анализ одного HIGH/CRITICAL изменения."""

        koap_article = SEMANTIC_TO_KOAP.get(semantic_type or "", "КоАП 9.19")
        regulator    = SEMANTIC_TO_REGULATOR.get(semantic_type or "", "Департамент инспекции труда")
        fine_data    = get_fine_range(koap_article or "КоАП 9.19", "legal")

        if not self._api_key:
            return self._calc_fallback(koap_article, fine_data, regulator, risk_level)

        prompt = PROSECUTOR_USER.format(
            section_path=section_path,
            semantic_type=semantic_type or "OBLIGATION_CHANGE",
            old_text=(old_text or "(отсутствует)")[:400],
            new_text=(new_text or "(удалено)")[:400],
            law_reference=law_reference or "не определена",
            koap_article=koap_article or "КоАП 9.19",
            fine_min=fine_data["fine_min_byn"] if fine_data else 400,
            fine_max=fine_data["fine_max_byn"] if fine_data else 4000,
            fine_min_bv=fine_data["fine_min_bv"] if fine_data else 10,
            fine_max_bv=fine_data["fine_max_bv"] if fine_data else 100,
            bv=BV_BYN,
        )

        full_prompt = PROSECUTOR_SYSTEM + "\n\n" + prompt
        client = self._make_client()
        try:
            response = await client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "NPA Assistant",
                },
                model=self.model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.15,
                max_tokens=800,
            )
        finally:
            await client.close()

        raw = response.choices[0].message.content or ""
        return self._parse_report(raw, fine_data, regulator)

    def _parse_report(
        self,
        text: str,
        fine_data: dict | None,
        default_regulator: str,
    ) -> ProsecutorReport:
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            data = json.loads(match.group()) if match else {}

        fin   = data.get("financial_risks", {}) or {}
        reg   = data.get("regulatory_risks", {}) or {}
        cases = data.get("similar_cases", []) or []

        similar_cases = [
            SimilarCase(
                description=str(c.get("description", ""))[:200],
                year=int(c.get("year", 2023)),
                outcome=str(c.get("outcome", ""))[:200],
                outcome_type=str(c.get("outcome_type", "FINE")),
            )
            for c in cases[:3]
        ]

        return ProsecutorReport(
            risk_score=max(0.0, min(100.0, float(data.get("risk_score", 70)))),
            violation_probability=max(0.0, min(1.0, float(data.get("violation_probability", 0.7)))),
            financial_risks=FinancialRisks(
                fine_min_byn=float(fin.get("fine_min_byn", fine_data["fine_min_byn"] if fine_data else 400)),
                fine_max_byn=float(fin.get("fine_max_byn", fine_data["fine_max_byn"] if fine_data else 4000)),
                fine_basis=str(fin.get("fine_basis", "КоАП РБ"))[:300],
                compensation_risk_byn=float(fin["compensation_risk_byn"]) if fin.get("compensation_risk_byn") else None,
                legal_costs_estimate_byn=float(fin["legal_costs_estimate_byn"]) if fin.get("legal_costs_estimate_byn") else None,
            ),
            regulatory_risks=RegulatoryRisks(
                primary_regulator=str(reg.get("primary_regulator", default_regulator))[:200],
                prescription_probability=max(0.0, min(1.0, float(reg.get("prescription_probability", 0.6)))),
                inspection_trigger_risk=max(0.0, min(1.0, float(reg.get("inspection_trigger_risk", 0.5)))),
                suspension_risk=bool(reg.get("suspension_risk", False)),
            ),
            similar_cases=similar_cases,
            urgency=str(data.get("urgency", "WITHIN_30_DAYS")),
            recommended_fix=str(data.get("recommended_fix", ""))[:1000],
            fix_rationale=str(data.get("fix_rationale", ""))[:500],
        )

    def _calc_fallback(
        self,
        koap_article: str | None,
        fine_data: dict | None,
        regulator: str,
        risk_level: str,
    ) -> ProsecutorReport:
        """Расчётный ответ без AI — только на основе таблицы КоАП."""
        fine_min = fine_data["fine_min_byn"] if fine_data else 400.0
        fine_max = fine_data["fine_max_byn"] if fine_data else 4000.0

        return ProsecutorReport(
            risk_score=85.0 if risk_level == "CRITICAL" else 70.0,
            violation_probability=0.85 if risk_level == "CRITICAL" else 0.65,
            financial_risks=FinancialRisks(
                fine_min_byn=fine_min,
                fine_max_byn=fine_max,
                fine_basis=f"{koap_article or 'КоАП 9.19'} — нарушение трудового законодательства",
            ),
            regulatory_risks=RegulatoryRisks(
                primary_regulator=regulator,
                prescription_probability=0.65,
                inspection_trigger_risk=0.50,
            ),
            similar_cases=[
                SimilarCase(
                    description="Аналогичное нарушение трудового законодательства",
                    year=2023,
                    outcome=f"Предписание + штраф {fine_min:.0f} BYN",
                    outcome_type="PRESCRIPTION",
                )
            ],
            urgency="WITHIN_30_DAYS",
            recommended_fix="Привести формулировку в соответствие с действующим законодательством РБ.",
            fix_rationale="Соответствует требованиям Трудового кодекса Республики Беларусь.",
        )