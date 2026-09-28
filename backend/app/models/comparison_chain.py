# backend/app/models/comparison_chain.py
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
import uuid
from app.core.database import Base


class ComparisonChain(Base):
    __tablename__ = "comparison_chains"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # ID документов в порядке версий: [v1_id, v2_id, v3_id]
    document_ids = Column(JSON, nullable=False)
    # ID созданных попарных сравнений: [comp_1_2_id, comp_2_3_id, ...]
    comparison_ids = Column(JSON, nullable=False, default=list)
    status = Column(String, default="PENDING")  # PENDING | ANALYZING | DONE | ERROR
    created_at = Column(DateTime, default=datetime.utcnow)