# backend/app/api/report.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.crud import get_comparison, get_diff_results
from app.services.exporter import generate_docx_report

router = APIRouter(prefix="/api", tags=["Report"])


@router.post(
    "/report/{comparison_id}",
    summary="Сгенерировать и скачать DOCX отчёт",
    response_class=Response,
)
async def generate_report(
    comparison_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Генерирует DOCX отчёт по результатам сравнения.
    Возвращает файл напрямую как attachment.
    """
    comparison = await get_comparison(db, comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="Сравнение не найдено")
    if comparison.status != "DONE":
        raise HTTPException(
            status_code=400,
            detail=f"Анализ ещё не завершён (статус: {comparison.status})"
        )

    diff_results = await get_diff_results(db, comparison_id)

    try:
        docx_bytes = generate_docx_report(comparison, diff_results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации отчёта: {e}")

    filename = f"npa_report_{comparison_id[:8]}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/report/{comparison_id}/download",
    summary="Скачать DOCX отчёт (алиас для POST)",
    response_class=Response,
)
async def download_report(
    comparison_id: str,
    db: AsyncSession = Depends(get_db),
):
    """GET-алиас — фронт вызывает его как ссылку для скачивания."""
    return await generate_report(comparison_id, db)