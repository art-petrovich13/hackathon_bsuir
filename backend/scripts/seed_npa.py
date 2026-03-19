# backend/scripts/seed_npa.py
"""
Заполняет таблицу npa_embeddings из app/data/npa_knowledge_base.json.
Эмбеддинги — нулевые векторы (768 нулей).
Текстовый поиск работает без векторов через ILIKE.
"""
import asyncio
import json
import sys
import os

# Добавить /app в path чтобы импортировать app.*
sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text as sql_text
from app.core.config import settings
from app.models.npa_embedding import NpaEmbedding


async def seed():
    data_path = "/app/app/data/npa_knowledge_base.json"

    if not os.path.exists(data_path):
        print(f"Файл не найден: {data_path}")
        sys.exit(1)

    with open(data_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    print(f"Загружаю {len(articles)} статей из JSON...")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Очистить старые записи
        await db.execute(sql_text("DELETE FROM npa_embeddings"))
        await db.flush()

        count = 0
        for article in articles:
            # JSON использует ключ "text", колонка называется article_text
            article_text = article.get("article_text") or article.get("text", "")
            if not article_text:
                print(f"  ПРОПУСК (нет текста): {article.get('article_number')}")
                continue

            npa = NpaEmbedding(
                law_name=article["law_name"],
                article_number=article.get("article_number"),
                article_text=article_text,
                hierarchy_level=article.get("hierarchy_level", 7),
                pravo_by_guid=article.get("pravo_by_guid"),
                embedding=[0.0] * 768,  # нулевой вектор — текстовый поиск работает без него
            )
            db.add(npa)
            count += 1

        await db.commit()
        print(f"✅ Загружено {count} статей НПА в базу данных")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())