# backend/app/models/npa_embedding.py
"""
NpaEmbedding — векторная база знаний по НПА Беларуси.
Каждая запись = одна статья закона + её 768-мерный вектор (Gemini Embedding).
Заполняется скриптом embed_npa.py в День 3.
Используется для семантического поиска через pgvector cosine similarity.
"""
import uuid

from sqlalchemy import String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class NpaEmbedding(Base):
    __tablename__ = "npa_embeddings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # "Трудовой кодекс РБ", "Конституция РБ", "КоАП РБ" и т.д.
    law_name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    # "Статья 110", "П. 3.1" и т.д.
    article_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Полный текст статьи
    article_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Уровень в иерархии НПА Беларуси: 1=Конституция ... 7=ЛНА организаций
    hierarchy_level: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    # GUID для ссылки на pravo.by → https://pravo.by/document/?guid={pravo_by_guid}
    pravo_by_guid: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # 768-мерный вектор — NULL до запуска скрипта embed_npa.py (День 3)
    embedding: Mapped[list | None] = mapped_column(Vector(768), nullable=True)