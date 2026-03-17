# backend/app/api/report.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/api", tags=["Report"])


@router.post("/report/{comparison_id}", status_code=202,
             summary="Запустить генерацию .docx отчёта")
async def generate_report(
    comparison_id: str,
    db: AsyncSession = Depends(get_db),
):
    """**TODO День 4:** реализовать через exporter.py."""
    raise HTTPException(status_code=501, detail="Будет реализовано в День 4")


@router.get("/report/{comparison_id}/download",
            summary="Скачать сгенерированный .docx отчёт")
async def download_report(comparison_id: str):
    """**TODO День 4:** отдать файл через FileResponse."""
    raise HTTPException(status_code=501, detail="Будет реализовано в День 4")