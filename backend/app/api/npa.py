# backend/app/api/npa.py
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.npa_checker import find_relevant_npa, count_npa_embeddings

router = APIRouter(prefix="/api", tags=["NPA"])


@router.get("/npa/search", summary="Семантический поиск по базе НПА")
async def search_npa(
    q: str = Query(..., min_length=3, description="Текст для семантического поиска"),
    top_k: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """
    Семантический поиск по базе НПА через pgvector.
    Возвращает top_k наиболее релевантных статей.
    """
    # Проверить что база заполнена
    count = await count_npa_embeddings(db)
    if count == 0:
        raise HTTPException(
            status_code=503,
            detail="Векторная база НПА пуста. Запустите: docker compose exec backend python scripts/embed_npa.py",
        )

    # Создать эмбеддинг запроса
    from app.services.ai_analyzer import GeminiAnalyzer
    analyzer = GeminiAnalyzer()

    try:
        embedding = await analyzer.create_embedding(q)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка создания эмбеддинга: {str(e)}",
        )

    # Найти похожие статьи
    results = await find_relevant_npa(db, q, embedding, top_k)
    return results


@router.get("/npa/stats", summary="Статистика базы НПА")
async def npa_stats(db: AsyncSession = Depends(get_db)):
    count = await count_npa_embeddings(db)
    return {"total_articles": count, "has_embeddings": count > 0}