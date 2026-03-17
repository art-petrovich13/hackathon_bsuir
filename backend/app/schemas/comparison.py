# backend/app/schemas/comparison.py
from datetime import datetime
from pydantic import BaseModel
from app.schemas.diff_result import DiffResultSchema


class ComparisonCreateSchema(BaseModel):
    """Тело запроса POST /api/compare."""
    doc_old_id: str
    doc_new_id: str


class ComparisonResponseSchema(BaseModel):
    """Ответ GET /api/compare/{id}."""
    id: str
    doc_old_id: str
    doc_new_id: str
    status: str                           # PENDING|PARSING|ANALYZING|DONE|ERROR
    task_id: str | None = None
    total_risk_score: float | None = None
    summary_json: dict | None = None
    diff_results: list[DiffResultSchema] = []
    created_at: datetime

    model_config = {"from_attributes": True}