# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import upload_router, compare_router, report_router, npa_router, ws_router

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.logging import setup_logging
setup_logging(debug=settings.debug)

# ← сначала создать app
app = FastAPI(
    title="NPA Assistant API",
    description="AI-ассистент сравнения НПА/ЛНА с модулем ПРОКУРОР",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ← только потом подключать limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(compare_router)
app.include_router(report_router)
app.include_router(npa_router)
app.include_router(ws_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.app_version}