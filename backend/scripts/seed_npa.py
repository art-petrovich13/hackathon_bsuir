#!/usr/bin/env python3
"""
Заполняет таблицу npa_embeddings из data/npa_knowledge_base.json.
Поддерживает поле 'category' и корректно маппит 'text' → article_text.

Запуск:
    docker compose exec backend python scripts/seed_npa.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings
from app.models.npa_embedding import NpaEmbedding


async def seed():
    data_path = "/app/app/data/npa_knowledge_base.json"

    if not os.path.exists(data_path):
        print(f"ERROR: {data_path} не найден")
        sys.exit(1)

    with open(data_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    print(f"Загрузка {len(articles)} статей НПА...")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Очистить старые записи
        await db.execute(text("DELETE FROM npa_embeddings"))
        await db.flush()

        for i, article in enumerate(articles):
            # Поддержка обоих форматов: "text" и "article_text"
            article_text = article.get("article_text") or article.get("text", "")
            if not article_text:
                print(f"  SKIP [{i}]: нет текста статьи")
                continue

            npa = NpaEmbedding(
                law_name=article["law_name"],
                article_number=article.get("article_number"),
                article_text=article_text,
                hierarchy_level=article.get("hierarchy_level", 7),
                pravo_by_guid=article.get("pravo_by_guid"),
                category=article.get("category"),       # ← новое поле
                embedding=[0.0] * 768,                  # нулевой вектор — text-поиск работает
            )
            db.add(npa)

        await db.commit()

    # Статистика
    async with Session() as db:
        total = (await db.execute(text("SELECT COUNT(*) FROM npa_embeddings"))).scalar()
        cats = (await db.execute(text(
            "SELECT category, COUNT(*) FROM npa_embeddings GROUP BY category ORDER BY COUNT(*) DESC"
        ))).fetchall()

    print(f"\n✅ Загружено {total} статей НПА\n")
    print("По категориям:")
    for cat, count in cats:
        print(f"  {cat or '(без категории)'}: {count}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())