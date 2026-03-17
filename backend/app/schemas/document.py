# backend/app/schemas/document.py
from datetime import datetime
from pydantic import BaseModel


class DocumentSchema(BaseModel):
    """Ответ при загрузке или запросе документа."""
    id: str
    name: str
    original_name: str
    file_type: str           # 'docx' или 'pdf'
    file_hash: str | None = None
    created_at: datetime

    # from_attributes=True: создавать схему из SQLAlchemy объекта:
    # DocumentSchema.model_validate(db_document_object)
    model_config = {"from_attributes": True}