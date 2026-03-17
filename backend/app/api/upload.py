# backend/app/api/upload.py
import hashlib

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.crud import create_document, get_document_by_hash
from app.models.document import Document
from app.schemas import DocumentSchema
from app.services.parser import DocumentParser

router = APIRouter(prefix="/api", tags=["Upload"])

# Разрешённые расширения
ALLOWED_EXTENSIONS = {"docx", "pdf"}
# Максимальный размер файла: 50 МБ
MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post("/upload", response_model=DocumentSchema, status_code=201,
             summary="Загрузить документ (.docx или .pdf)")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Загружает .docx или .pdf, парсит структуру, сохраняет в БД.
    Возвращает DocumentSchema с id — используй его в POST /api/compare.
    При загрузке дубликата (одинаковый SHA-256) возвращает существующий документ.
    """
    # 1. Проверить расширение файла
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемое расширение '.{ext}'. Разрешены: .docx, .pdf",
        )

    # 2. Прочитать байты файла
    content = await file.read()

    # 3. Проверить размер
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой: {len(content) // 1024 // 1024}МБ. Максимум: 50МБ",
        )

    # 4. Проверить на дубликат по SHA-256 хешу
    file_hash = hashlib.sha256(content).hexdigest()
    existing = await get_document_by_hash(db, file_hash)
    if existing:
        # Возвращаем существующий документ — не парсим повторно
        return DocumentSchema.model_validate(existing)

    # 5. Парсить структуру документа
    parser = DocumentParser()
    try:
        structure = parser.parse(content, ext)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Не удалось распарсить файл: {str(e)}",
        )

    # 6. Создать запись в БД
    doc = Document(
        name=filename,
        original_name=filename,
        file_type=ext,
        content_text=structure.full_text[:50000],  # обрезаем до 50к символов
        structure_json=structure.to_dict(),
        file_hash=file_hash,
    )
    saved = await create_document(db, doc)
    return DocumentSchema.model_validate(saved)