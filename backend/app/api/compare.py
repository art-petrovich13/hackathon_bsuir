# backend/app/api/compare.py
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.crud import (
    create_comparison,
    get_comparison,
    get_diff_results,
)
from app.models.comparison import Comparison
from app.schemas import ComparisonCreateSchema, ComparisonResponseSchema
from app.schemas.diff_result import DiffResultSchema
from app.tasks.analysis import analyze_comparison
from app.models.comparison_chain import ComparisonChain

router = APIRouter(prefix="/api", tags=["Compare"])

# Простой in-memory менеджер WebSocket соединений
# Ключ: comparison_id, значение: список активных соединений
_ws_connections: dict[str, list[WebSocket]] = {}


async def broadcast_status(comparison_id: str, data: dict):
    """Отправить статус всем подключённым WebSocket клиентам."""
    connections = _ws_connections.get(comparison_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)


@router.post("/compare", status_code=202, summary="Создать задачу сравнения")
async def create_comparison_endpoint(
    payload: ComparisonCreateSchema,
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает два doc_id, создаёт Comparison в БД и запускает Celery таск.
    Возвращает { id, task_id, status: "PENDING" }.
    """
    # Создать запись сравнения в БД
    comparison = Comparison(
        doc_old_id=payload.doc_old_id,
        doc_new_id=payload.doc_new_id,
        status="PENDING",
    )
    saved = await create_comparison(db, comparison)

    # Запустить Celery таск асинхронно
    task = analyze_comparison.delay(saved.id)

    # Сохранить task_id в БД
    saved.task_id = task.id
    await db.flush()

    return {
        "id": saved.id,
        "task_id": task.id,
        "status": "PENDING",
    }


@router.get(
    "/compare/{comparison_id}",
    response_model=ComparisonResponseSchema,
    summary="Получить результат сравнения",
)
async def get_comparison_result(
    comparison_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает Comparison с полным списком diff_results.
    Если status != DONE — возвращает текущий статус без результатов.
    """
    comparison = await get_comparison(db, comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="Сравнение не найдено")

    diff_results = []
    if comparison.status == "DONE":
        diff_results = await get_diff_results(db, comparison_id)

    return ComparisonResponseSchema(
        id=comparison.id,
        doc_old_id=comparison.doc_old_id,
        doc_new_id=comparison.doc_new_id,
        status=comparison.status,
        task_id=comparison.task_id,
        total_risk_score=comparison.total_risk_score,
        summary_json=comparison.summary_json,
        diff_results=[DiffResultSchema.model_validate(r) for r in diff_results],
        created_at=comparison.created_at,
    )


@router.get("/compare/{comparison_id}/prosecutor", summary="Данные модуля ПРОКУРОР")
async def get_prosecutor_data(
    comparison_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает прокурорский анализ для всех HIGH/CRITICAL изменений.
    Если анализ ещё выполняется — возвращает результаты которые уже есть.
    """
    comparison = await get_comparison(db, comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="Сравнение не найдено")

    # Получить все diff_results
    all_results = await get_diff_results(db, comparison_id)

    prosecutor_results = []
    total_fine_max = 0.0

    for dr in all_results:
        if dr.risk_level not in ("HIGH", "CRITICAL"):
            continue

        if dr.prosecutor_analysis_json:
            fin = dr.prosecutor_analysis_json.get("financial_risks") or {}
            total_fine_max += float(fin.get("fine_max_byn", 0))

        prosecutor_results.append({
            "diff_id":          dr.id,
            "section_path":     dr.section_path,
            "risk_level":       dr.risk_level,
            "change_type":      dr.change_type,
            "semantic_type":    dr.semantic_type,
            "old_text":         dr.old_text,
            "new_text":         dr.new_text,
            "law_reference":    dr.law_reference,
            "prosecutor_report": dr.prosecutor_analysis_json,
        })

    # Сортировать по risk_score (если есть), самые опасные сверху
    prosecutor_results.sort(
        key=lambda x: (x["prosecutor_report"] or {}).get("risk_score", 0),
        reverse=True,
    )

    return {
        "comparison_id":               comparison_id,
        "total_financial_exposure_byn": round(total_fine_max, 2),
        "total_financial_exposure_usd": round(total_fine_max / 3.27, 2),
        "has_prosecutor_data":          any(r["prosecutor_report"] for r in prosecutor_results),
        "results":                      prosecutor_results,
    }


@router.websocket("/ws/compare/{comparison_id}")
async def websocket_status(websocket: WebSocket, comparison_id: str):
    """
    WebSocket эндпоинт — клиент подключается и получает обновления статуса.
    Формат сообщений: { status, progress, message }
    """
    await websocket.accept()

    # Зарегистрировать соединение
    if comparison_id not in _ws_connections:
        _ws_connections[comparison_id] = []
    _ws_connections[comparison_id].append(websocket)

    try:
        # Держать соединение открытым
        while True:
            # Ждём любое сообщение от клиента (ping/pong или закрытие)
            data = await websocket.receive_text()
            # Можно добавить обработку команд от клиента
    except WebSocketDisconnect:
        if comparison_id in _ws_connections:
            _ws_connections[comparison_id].remove(websocket)

# В конец backend/app/api/compare.py добавь:

# Отдельный роутер для WebSocket (без prefix /api)
ws_router = APIRouter(tags=["Compare"])

@ws_router.websocket("/ws/compare/{comparison_id}")
async def websocket_status_v2(websocket: WebSocket, comparison_id: str):
    await websocket.accept()
    if comparison_id not in _ws_connections:
        _ws_connections[comparison_id] = []
    _ws_connections[comparison_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if comparison_id in _ws_connections:
            try:
                _ws_connections[comparison_id].remove(websocket)
            except ValueError:
                pass

@router.post("/compare/chain", status_code=202, summary="Сравнить цепочку версий документов")
async def create_chain_comparison(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает список из 2–5 document_id в хронологическом порядке.
    Создаёт N-1 попарных сравнений и объединяет их в цепочку.
    
    Пример тела: {"document_ids": ["id_v1", "id_v2", "id_v3"]}
    """
    doc_ids = payload.get("document_ids", [])
    if len(doc_ids) < 2:
        raise HTTPException(status_code=400, detail="Нужно минимум 2 документа")
    if len(doc_ids) > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 документов в цепочке")

    # Создать запись цепочки
    chain = ComparisonChain(
        document_ids=doc_ids,
        comparison_ids=[],
        status="ANALYZING",
    )
    db.add(chain)
    await db.flush()
    await db.refresh(chain)

    # Создать N-1 попарных сравнений
    comparison_ids = []
    for i in range(len(doc_ids) - 1):
        comp = Comparison(
            doc_old_id=doc_ids[i],
            doc_new_id=doc_ids[i + 1],
            status="PENDING",
        )
        saved = await create_comparison(db, comp)
        task = analyze_comparison.delay(saved.id)
        saved.task_id = task.id
        await db.flush()
        comparison_ids.append(saved.id)

    # Обновить цепочку со списком сравнений
    chain.comparison_ids = comparison_ids
    await db.flush()
    await db.commit()

    return {
        "id": chain.id,
        "comparison_ids": comparison_ids,
        "document_count": len(doc_ids),
        "status": "ANALYZING",
    }


@router.get("/compare/chain/{chain_id}", summary="Получить результаты цепочки")
async def get_chain_result(
    chain_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает агрегированные результаты по всем сравнениям в цепочке.
    Включает тренд риска: INCREASING / DECREASING / STABLE.
    """
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(ComparisonChain).where(ComparisonChain.id == chain_id)
    )
    chain = result.scalar_one_or_none()
    if not chain:
        raise HTTPException(status_code=404, detail="Цепочка не найдена")

    comparison_ids = chain.comparison_ids or []
    versions = []
    total_scores = []

    for i, comp_id in enumerate(comparison_ids):
        comp = await get_comparison(db, comp_id)
        if not comp:
            continue

        risk_score = comp.total_risk_score or 0
        total_scores.append(risk_score)
        summary = comp.summary_json or {}

        versions.append({
            "version_pair": f"v{i+1} → v{i+2}",
            "comparison_id": comp_id,
            "status": comp.status,
            "risk_score": risk_score,
            "changes_count": summary.get("total", 0),
            "high_critical": summary.get("high", 0) + summary.get("critical", 0),
        })

    # Определить тренд
    trend = "STABLE"
    if len(total_scores) >= 2:
        if total_scores[-1] > total_scores[0] + 10:
            trend = "INCREASING_RISK"
        elif total_scores[-1] < total_scores[0] - 10:
            trend = "DECREASING_RISK"

    # Статус цепочки: DONE если все сравнения DONE
    all_done = all(v["status"] == "DONE" for v in versions)
    any_error = any(v["status"] == "ERROR" for v in versions)
    chain_status = "DONE" if all_done else ("ERROR" if any_error else "ANALYZING")

    return {
        "id": chain_id,
        "status": chain_status,
        "document_count": len(comparison_ids) + 1,
        "versions": versions,
        "trend": trend,
        "avg_risk_score": sum(total_scores) / len(total_scores) if total_scores else 0,
    }

