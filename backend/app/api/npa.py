# backend/app/api/npa.py
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/api", tags=["NPA"])


@router.get("/npa/search", summary="Семантический поиск по базе НПА")
async def search_npa(
    q: str = Query(..., description="Текст запроса"),
    top_k: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """
    Семантический поиск через pgvector cosine similarity.
    **TODO День 3:** реализовать после создания векторной базы НПА.
    """
    raise HTTPException(status_code=501, detail="Будет реализовано в День 3")