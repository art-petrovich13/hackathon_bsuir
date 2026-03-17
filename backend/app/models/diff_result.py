# backend/app/models/diff_result.py
"""
DiffResult — одно конкретное изменение в документе.
Одно Comparison → много DiffResult (по одной записи на каждое изменение).
"""
import uuid

from sqlalchemy import String, Text, Float, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DiffResult(Base):
    __tablename__ = "diff_results"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    comparison_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("comparisons.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # Путь в структуре: "1.3.2" = глава 1, раздел 3, пункт 2
    section_path: Mapped[str] = mapped_column(String(200), nullable=False)
    # ADDED | DELETED | MODIFIED | MOVED
    change_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # LOW | MEDIUM | HIGH | CRITICAL — заполняется AI в День 3
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Тексты до и после изменения
    old_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # OBLIGATION_CHANGE | SCOPE_CHANGE | DEADLINE_CHANGE | SUBJECT_CHANGE | SANCTION_CHANGE | COSMETIC
    semantic_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "ст. 110 Трудового кодекса РБ" — заполняется AI
    law_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON данные модуля ПРОКУРОР — заполняется в День 5
    prosecutor_analysis_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Уверенность AI: 0.0 - 1.0
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)