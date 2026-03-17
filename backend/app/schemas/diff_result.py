# backend/app/schemas/diff_result.py
from pydantic import BaseModel


class DiffResultSchema(BaseModel):
    id: str
    comparison_id: str
    section_path: str
    change_type: str                     # ADDED|DELETED|MODIFIED|MOVED
    risk_level: str | None = None        # LOW|MEDIUM|HIGH|CRITICAL
    risk_score: float | None = None      # 0-100
    old_text: str | None = None
    new_text: str | None = None
    semantic_type: str | None = None
    law_reference: str | None = None
    recommendation: str | None = None
    prosecutor_analysis_json: dict | None = None
    ai_confidence: float | None = None   # 0.0-1.0

    model_config = {"from_attributes": True}