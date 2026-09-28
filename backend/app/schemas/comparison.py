# backend/app/schemas/comparison.py
from datetime import datetime
from pydantic import BaseModel
from app.schemas.diff_result import DiffResultSchema


class ComparisonCreateSchema(BaseModel):
    """Тело запроса POST /api/compare (Режим 1)."""
    doc_old_id: str
    doc_new_id: str


class ComplianceCheckSchema(BaseModel):
    """Тело запроса POST /api/compare/compliance (Режим 3)."""
    parent_doc_id: str   # родительский НПА
    child_doc_id: str    # дочерний ЛНА для проверки


class AuditSchema(BaseModel):
    """Тело запроса POST /api/compare/audit (Режим 4)."""
    doc_id: str          # единственный документ для аудита


class ComparisonResponseSchema(BaseModel):
    """Ответ GET /api/compare/{id} — используется для всех режимов."""
    id: str
    doc_old_id: str
    doc_new_id: str
    status: str                           # PENDING|PARSING|ANALYZING|DONE|ERROR
    mode: str = "pair"                    # pair|chain|compliance|audit
    task_id: str | None = None
    total_risk_score: float | None = None
    summary_json: dict | None = None
    diff_results: list[DiffResultSchema] = []
    created_at: datetime

    model_config = {"from_attributes": True}