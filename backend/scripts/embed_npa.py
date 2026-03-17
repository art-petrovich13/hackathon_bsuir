#!/usr/bin/env python3
# backend/scripts/embed_npa.py
"""
Скрипт заполнения векторной базы НПА.
Читает npa_knowledge_base.json, создаёт эмбеддинги через Gemini, сохраняет в БД.

Запуск:
    docker compose exec backend python scripts/embed_npa.py
"""
import asyncio
import json
import os
import sys
import time

# Добавить путь к приложению
sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import select, text
import httpx


async def main():
    from app.core.config import settings
    from app.models.npa_embedding import NpaEmbedding

    print("=== Скрипт заполнения векторной базы НПА ===\n")

    if not settings.gemini_api_key:
        print("ОШИБКА: GEMINI_API_KEY не установлен в .env!")
        sys.exit(1)

    # Подключиться к БД
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    # Загрузить данные
    data_path = "/app/app/data/npa_knowledge_base.json"
    with open(data_path, encoding="utf-8") as f:
        articles = json.load(f)

    print(f"Загружено {len(articles)} статей для обработки\n")

    # Создать эмбеддинги и сохранить в БД
    embed_url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
    success = 0
    errors = 0

    async with SessionLocal() as db:
        # Проверить сколько уже есть
        count_result = await db.execute(
            text("SELECT COUNT(*) FROM npa_embeddings WHERE embedding IS NOT NULL")
        )
        existing = count_result.scalar() or 0
        print(f"Уже есть в базе: {existing} статей с эмбеддингами\n")

        for i, article in enumerate(articles):
            text_to_embed = f"{article['law_name']} {article['article_number']}. {article['text']}"

            # Проверить есть ли уже эта статья
            existing_check = await db.execute(
                select(NpaEmbedding).where(
                    NpaEmbedding.law_name == article["law_name"],
                    NpaEmbedding.article_number == article["article_number"],
                )
            )
            if existing_check.scalar_one_or_none():
                print(f"[{i+1}/{len(articles)}] ПРОПУСК (уже есть): {article['article_number']}")
                continue

            # Создать эмбеддинг через Gemini
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.post(
                        embed_url,
                        params={"key": settings.gemini_api_key},
                        json={
                            "model": "models/text-embedding-004",
                            "content": {"parts": [{"text": text_to_embed}]},
                        },
                    )
                    response.raise_for_status()
                    embedding = response.json()["embedding"]["values"]

                # Сохранить в БД
                npa = NpaEmbedding(
                    law_name=article["law_name"],
                    article_number=article["article_number"],
                    article_text=article["text"],
                    hierarchy_level=article.get("hierarchy_level", 7),
                    pravo_by_guid=article.get("pravo_by_guid"),
                    embedding=embedding,
                )
                db.add(npa)
                await db.flush()

                print(f"[{i+1}/{len(articles)}] ✅ {article['law_name']} — {article['article_number']}")
                success += 1

                # Пауза между запросами (rate limiting)
                await asyncio.sleep(0.3)

            except Exception as e:
                print(f"[{i+1}/{len(articles)}] ❌ ОШИБКА: {article['article_number']} — {e}")
                errors += 1
                await asyncio.sleep(1.0)

        await db.commit()

    await engine.dispose()

    print(f"\n=== Готово ===")
    print(f"Успешно: {success}")
    print(f"Ошибок:  {errors}")
    print(f"Всего статей в базе: {existing + success}")


if __name__ == "__main__":
    asyncio.run(main())