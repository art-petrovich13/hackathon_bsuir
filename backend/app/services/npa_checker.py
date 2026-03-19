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

async def find_relevant_npa_by_text(
    db: AsyncSession,
    query_text: str,
    top_k: int = 3,
) -> list[dict]:
    """
    Поиск по ключевым словам через PostgreSQL ILIKE.
    Работает без векторных эмбеддингов — достаточно для хакатона.
    """
    # Стоп-слова для фильтрации коротких/незначимых слов
    stop_words = {
        "и", "в", "на", "с", "для", "по", "от", "до", "за", "к", "о", "а",
        "или", "не", "но", "как", "что", "это", "из", "об", "при", "без"
    }
    words = [
        w.strip(".,;:()\"'")
        for w in query_text.lower().split()
        if len(w) > 3 and w.strip(".,;:()\"'") not in stop_words
    ]

    if not words:
        # Возвращаем первые N статей как fallback
        result = await db.execute(
            text("SELECT * FROM npa_embeddings LIMIT :top_k"),
            {"top_k": top_k}
        )
        rows = result.fetchall()
    else:
        # Ищем по первым 4 словам — ILIKE по article_text и law_name
        search_words = words[:4]
        conditions = " OR ".join([
            f"(article_text ILIKE :kw{i} OR law_name ILIKE :kw{i} OR article_number ILIKE :kw{i})"
            for i in range(len(search_words))
        ])
        params: dict = {f"kw{i}": f"%{w}%" for i, w in enumerate(search_words)}
        params["top_k"] = top_k

        result = await db.execute(
            text(f"SELECT * FROM npa_embeddings WHERE {conditions} LIMIT :top_k"),
            params
        )
        rows = result.fetchall()

    if not rows:
        # Fallback — просто первые N записей
        result = await db.execute(
            text("SELECT * FROM npa_embeddings ORDER BY hierarchy_level ASC LIMIT :top_k"),
            {"top_k": top_k}
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
            "pravo_by_url": (
                f"https://pravo.by/document/?guid={row.pravo_by_guid}"
                if row.pravo_by_guid else None
            ),
        }
        for row in rows
    ]