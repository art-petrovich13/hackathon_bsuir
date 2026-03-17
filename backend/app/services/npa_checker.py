# backend/app/services/npa_checker.py
"""
Поиск релевантных статей НПА через pgvector cosine similarity.
Используется для обогащения AI анализа контекстом конкретных законов.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def find_relevant_npa(
    db: AsyncSession,
    query_text: str,
    embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    """
    Найти наиболее релевантные статьи НПА для заданного текста.

    Args:
        db: сессия БД
        query_text: текст запроса (для логирования)
        embedding: 768-мерный вектор запроса
        top_k: количество результатов

    Returns:
        Список словарей с полями: law_name, article_number, article_text,
        hierarchy_level, pravo_by_guid, similarity
    """
    # pgvector оператор <=> = cosine distance (меньше = ближе)
    # Преобразуем в similarity: similarity = 1 - distance
    query = text("""
        SELECT
            id,
            law_name,
            article_number,
            article_text,
            hierarchy_level,
            pravo_by_guid,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM npa_embeddings
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """)

    vector_str = "[" + ",".join(str(x) for x in embedding) + "]"

    result = await db.execute(
        query,
        {"embedding": vector_str, "top_k": top_k},
    )
    rows = result.fetchall()

    return [
        {
            "id": row.id,
            "law_name": row.law_name,
            "article_number": row.article_number,
            "article_text": row.article_text,
            "hierarchy_level": row.hierarchy_level,
            "pravo_by_guid": row.pravo_by_guid,
            "similarity": float(row.similarity),
            "pravo_by_url": (
                f"https://pravo.by/document/?guid={row.pravo_by_guid}"
                if row.pravo_by_guid else None
            ),
        }
        for row in rows
    ]


async def count_npa_embeddings(db: AsyncSession) -> int:
    """Сколько статей уже есть в векторной базе."""
    result = await db.execute(
        text("SELECT COUNT(*) FROM npa_embeddings WHERE embedding IS NOT NULL")
    )
    return result.scalar() or 0