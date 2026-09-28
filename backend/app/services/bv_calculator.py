# backend/app/services/bv_calculator.py
"""
Калькулятор базовых величин и штрафов по КоАП РБ.
БВ = 40 BYN (Постановление Совмина РБ №27 от 31.01.2025).
"""
import json
import os

# Текущий размер базовой величины в BYN
BV_BYN = 40.0
# Курс USD/BYN — приблизительный, для информационных целей
USD_RATE = 3.27

_FINES_CACHE: dict | None = None


def _load_fines() -> dict:
    global _FINES_CACHE
    if _FINES_CACHE is not None:
        return _FINES_CACHE
    data_path = os.path.join(os.path.dirname(__file__), "../data/fines.json")
    with open(data_path, "r", encoding="utf-8") as f:
        _FINES_CACHE = json.load(f)
    return _FINES_CACHE


def get_fine_range(article: str, entity_type: str = "legal") -> dict | None:
    """
    Получить диапазон штрафа по статье КоАП.
    entity_type: "individual" (физлицо/должностное) или "legal" (юрлицо/организация)
    """
    fines = _load_fines()
    if article not in fines:
        return None

    fine_data = fines[article]
    key = f"fine_{entity_type}_bv"
    bv_range = fine_data.get(key, [2, 20])

    return {
        "article":       article,
        "description":   fine_data["description"],
        "fine_min_bv":   bv_range[0],
        "fine_max_bv":   bv_range[1],
        "fine_min_byn":  round(bv_range[0] * BV_BYN, 2),
        "fine_max_byn":  round(bv_range[1] * BV_BYN, 2),
        "fine_min_usd":  round(bv_range[0] * BV_BYN / USD_RATE, 2),
        "fine_max_usd":  round(bv_range[1] * BV_BYN / USD_RATE, 2),
    }


# Маппинг semantic_type → наиболее подходящая статья КоАП
SEMANTIC_TO_KOAP = {
    "OBLIGATION_CHANGE": "КоАП 9.19",
    "DEADLINE_CHANGE":   "КоАП 9.19",
    "SCOPE_CHANGE":      "КоАП 9.19",
    "SUBJECT_CHANGE":    "КоАП 9.19",
    "SANCTION_CHANGE":   "КоАП 23.1",
    "COSMETIC":          None,
}

# Маппинг semantic_type → основной регулятор
SEMANTIC_TO_REGULATOR = {
    "OBLIGATION_CHANGE": "Департамент инспекции труда",
    "DEADLINE_CHANGE":   "Департамент инспекции труда",
    "SCOPE_CHANGE":      "Министерство труда и соцзащиты",
    "SUBJECT_CHANGE":    "Прокуратура",
    "SANCTION_CHANGE":   "Прокуратура",
    "COSMETIC":          None,
}