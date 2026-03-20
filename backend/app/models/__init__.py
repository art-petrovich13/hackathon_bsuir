# backend/app/models/__init__.py
from .document import Document
from .comparison import Comparison
from .diff_result import DiffResult
from .npa_embedding import NpaEmbedding
from .comparison_chain import ComparisonChain   # ← добавить

__all__ = ["Document", "Comparison", "DiffResult", "NpaEmbedding", "ComparisonChain"]