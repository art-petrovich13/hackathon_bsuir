# backend/app/services/npa_checker.py
"""
Поиск релевантных статей НПА по тексту (ILIKE) и по категории.
Векторный поиск (pgvector) — для будущих доработок, пока нулевые векторы.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def find_relevant_npa(
    db: AsyncSession,
    query_text: str,
    embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    """Векторный поиск (используется когда embedding не нулевой)."""
    query = text("""
        SELECT id, law_name, article_number, article_text,
               hierarchy_level, pravo_by_guid, category,
               1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM npa_embeddings
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """)
    vector_str = "[" + ",".join(str(x) for x in embedding) + "]"
    result = await db.execute(query, {"embedding": vector_str, "top_k": top_k})
    rows = result.fetchall()
    return [_row_to_dict(row) for row in rows]


async def count_npa_embeddings(db: AsyncSession) -> int:
    result = await db.execute(
        text("SELECT COUNT(*) FROM npa_embeddings WHERE embedding IS NOT NULL")
    )
    return result.scalar() or 0


async def find_relevant_npa_by_text(
    db: AsyncSession,
    query_text: str,
    top_k: int = 5,
    category: str | None = None,
) -> list[dict]:
    """
    Поиск по ключевым словам через ILIKE.
    Всегда добавляет конституционные нормы к результатам.
    Если category задана — приоритизирует статьи этой категории.
    """
    stop_words = {
        "и", "в", "на", "с", "для", "по", "от", "до", "за", "к", "о", "а",
        "или", "не", "но", "как", "что", "это", "из", "об", "при", "без",
        "все", "всех", "всем", "его", "её", "их", "он", "она"
    }
    words = [
        w.strip(".,;:()\"'«»—")
        for w in query_text.lower().split()
        if len(w) > 3 and w.strip(".,;:()\"'«»—") not in stop_words
    ]

    results: list[dict] = []

    # 1. Если задана категория — сначала ищем в ней (до top_k // 2 статей)
    if category:
        cat_params: dict = {"category": category, "top_k_cat": max(2, top_k // 2)}
        if words:
            search_words = words[:3]
            conditions = " OR ".join([
                f"(article_text ILIKE :kw{i} OR law_name ILIKE :kw{i})"
                for i in range(len(search_words))
            ])
            cat_params.update({f"kw{i}": f"%{w}%" for i, w in enumerate(search_words)})
            cat_query = text(f"""
                SELECT * FROM npa_embeddings
                WHERE category = :category AND ({conditions})
                ORDER BY hierarchy_level ASC
                LIMIT :top_k_cat
            """)
        else:
            cat_query = text("""
                SELECT * FROM npa_embeddings
                WHERE category = :category
                ORDER BY hierarchy_level ASC
                LIMIT :top_k_cat
            """)
        cat_rows = (await db.execute(cat_query, cat_params)).fetchall()
        results.extend(_row_to_dict(r) for r in cat_rows)

    # 2. Текстовый поиск по всей базе (исключая уже найденные)
    remaining = top_k - len(results)
    if remaining > 0 and words:
        existing_ids = {r["id"] for r in results}
        search_words = words[:4]
        conditions = " OR ".join([
            f"(article_text ILIKE :kw{i} OR law_name ILIKE :kw{i} OR article_number ILIKE :kw{i})"
            for i in range(len(search_words))
        ])
        params: dict = {f"kw{i}": f"%{w}%" for i, w in enumerate(search_words)}
        params["top_k"] = remaining + 5  # берём с запасом

        rows = (await db.execute(
            text(f"SELECT * FROM npa_embeddings WHERE {conditions} ORDER BY hierarchy_level ASC LIMIT :top_k"),
            params,
        )).fetchall()

        for row in rows:
            d = _row_to_dict(row)
            if d["id"] not in existing_ids and len(results) < top_k:
                results.append(d)
                existing_ids.add(d["id"])

    # 3. Добавить конституционные нормы если их ещё нет (всегда полезны)
    constitutional_ids = {r["id"] for r in results if r.get("category") == "CONSTITUTIONAL"}
    if not constitutional_ids:
        const_rows = (await db.execute(
            text("SELECT * FROM npa_embeddings WHERE category = 'CONSTITUTIONAL' LIMIT 2")
        )).fetchall()
        for row in const_rows:
            d = _row_to_dict(row)
            if d["id"] not in {r["id"] for r in results}:
                results.append(d)

    # 4. Fallback — если ничего не нашли
    if not results:
        rows = (await db.execute(
            text("SELECT * FROM npa_embeddings ORDER BY hierarchy_level ASC LIMIT :top_k"),
            {"top_k": top_k},
        )).fetchall()
        results = [_row_to_dict(r) for r in rows]

    return results[:top_k + 2]  # небольшой запас


def _row_to_dict(row) -> dict:
    return {
        "id":            row.id,
        "law_name":      row.law_name,
        "article_number": row.article_number,
        "article_text":  row.article_text,
        "hierarchy_level": row.hierarchy_level,
        "pravo_by_guid": row.pravo_by_guid,
        "category":      getattr(row, "category", None),
        "pravo_by_url":  (
            f"https://pravo.by/document/?guid={row.pravo_by_guid}"
            if row.pravo_by_guid else None
        ),
    }