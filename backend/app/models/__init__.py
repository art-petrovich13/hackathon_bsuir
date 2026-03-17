# backend/app/models/__init__.py
# Экспортируем все модели — Alembic обнаружит их через Base.metadata
from .document import Document
from .comparison import Comparison
from .diff_result import DiffResult
from .npa_embedding import NpaEmbedding

__all__ = ["Document", "Comparison", "DiffResult", "NpaEmbedding"]