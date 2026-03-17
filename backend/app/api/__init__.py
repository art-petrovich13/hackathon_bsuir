# backend/app/api/__init__.py
from .upload import router as upload_router
from .compare import router as compare_router
from .report import router as report_router
from .npa import router as npa_router

# WebSocket роутер без /api prefix
from .compare import ws_router  # добавить это

__all__ = ["upload_router", "compare_router", "report_router", "npa_router", "ws_router"]