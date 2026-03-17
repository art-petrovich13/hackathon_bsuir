# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import upload_router, compare_router, report_router, npa_router, ws_router
from app.api.compare import router as compare_ws_router

app = FastAPI(
    title="NPA Assistant API",
    description="AI-ассистент сравнения НПА/ЛНА с модулем ПРОКУРОР",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "System",   "description": "Системные эндпоинты"},
        {"name": "Upload",   "description": "Загрузка документов"},
        {"name": "Compare",  "description": "Сравнение и AI анализ"},
        {"name": "Report",   "description": "Генерация отчётов"},
        {"name": "NPA",      "description": "База знаний НПА Беларуси"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем все роутеры
app.include_router(upload_router)
app.include_router(compare_router)
app.include_router(report_router)
app.include_router(npa_router)
app.include_router(ws_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.app_version}