# backend/app/tasks/celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "npa_assistant",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.analysis",   # analyze_comparison, run_prosecutor_analysis,
                                # analyze_compliance, analyze_audit — все в одном файле
    ],  # ← это главное, без этого таски не видны
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Minsk",
    enable_utc=True,
    result_expires=3600,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)