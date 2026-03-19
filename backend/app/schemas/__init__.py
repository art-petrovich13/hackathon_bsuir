# backend/app/schemas/__init__.py
from .document import DocumentSchema
from .comparison import (
    ComparisonCreateSchema,
    ComparisonResponseSchema,
    ComplianceCheckSchema,
    AuditSchema,
)
from .diff_result import DiffResultSchema

__all__ = [
    "DocumentSchema",
    "ComparisonCreateSchema",
    "ComparisonResponseSchema",
    "ComplianceCheckSchema",
    "AuditSchema",
    "DiffResultSchema",
]