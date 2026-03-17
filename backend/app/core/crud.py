# backend/app/core/crud.py
"""Базовые CRUD операции — вызываются из роутеров и Celery тасков."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models import Document, Comparison, DiffResult


# ─── Document ──────────────────────────────────────────────────────────────────

async def create_document(db: AsyncSession, doc: Document) -> Document:
    db.add(doc)
    await db.flush()       # flush = отправить SQL в транзакцию (без commit)
    await db.refresh(doc)  # получить сгенерированные значения (id, created_at)
    return doc


async def get_document(db: AsyncSession, document_id: str) -> Document | None:
    result = await db.execute(select(Document).where(Document.id == document_id))
    return result.scalar_one_or_none()


async def get_document_by_hash(db: AsyncSession, file_hash: str) -> Document | None:
    """Поиск дубликата по SHA-256 хешу файла."""
    result = await db.execute(select(Document).where(Document.file_hash == file_hash))
    return result.scalar_one_or_none()


# ─── Comparison ────────────────────────────────────────────────────────────────

async def create_comparison(db: AsyncSession, comparison: Comparison) -> Comparison:
    db.add(comparison)
    await db.flush()
    await db.refresh(comparison)
    return comparison


async def get_comparison(db: AsyncSession, comparison_id: str) -> Comparison | None:
    result = await db.execute(
        select(Comparison).where(Comparison.id == comparison_id)
    )
    return result.scalar_one_or_none()


async def update_comparison_status(
    db: AsyncSession,
    comparison_id: str,
    status: str,
    task_id: str | None = None,
) -> None:
    values: dict = {"status": status}
    if task_id is not None:
        values["task_id"] = task_id
    await db.execute(
        update(Comparison).where(Comparison.id == comparison_id).values(**values)
    )
    await db.flush()


# ─── DiffResult ────────────────────────────────────────────────────────────────

async def get_diff_results(db: AsyncSession, comparison_id: str) -> list[DiffResult]:
    result = await db.execute(
        select(DiffResult)
        .where(DiffResult.comparison_id == comparison_id)
        .order_by(DiffResult.section_path)
    )
    return list(result.scalars().all())


async def create_diff_results_bulk(db: AsyncSession, results: list[DiffResult]) -> None:
    """Сохранить список изменений одним запросом (быстрее чем по одному)."""
    db.add_all(results)
    await db.flush()