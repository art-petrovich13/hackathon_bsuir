# backend/app/models/document.py
"""
Document — загруженный пользователем файл (.docx или .pdf).
Создаётся через POST /api/upload.
structure_json хранит иерархическое дерево разделов после парсинга.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="Отображаемое имя файла"
    )
    original_name: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="Оригинальное имя при загрузке"
    )
    # 'docx' или 'pdf'
    file_type: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="Тип файла: docx или pdf"
    )
    # Весь текст документа — для full-text поиска
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Дерево разделов: { "nodes": [{ "path": "1.1", "type": "heading", "text": "..." }] }
    structure_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # SHA-256 хеш — для обнаружения дубликатов при загрузке
    file_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )