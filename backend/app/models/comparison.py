# backend/app/models/comparison.py
"""
Comparison — задача сравнения двух документов.
Создаётся через POST /api/compare, обрабатывается Celery async.
Жизненный цикл: PENDING → PARSING → ANALYZING → DONE (или ERROR)
"""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, JSON, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # Ссылки на оба документа
    doc_old_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False, index=True, comment="ID старой редакции"
    )
    doc_new_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False, index=True, comment="ID новой редакции"
    )
    # PENDING | PARSING | ANALYZING | DONE | ERROR
    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False
    )
    # ID Celery задачи для трекинга прогресса
    task_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Итоговый балл риска (0-100), вычисляется как среднее по всем DiffResult
    total_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Краткая статистика: { "total": 15, "critical": 2, "high": 3, "medium": 5, "low": 5 }
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )