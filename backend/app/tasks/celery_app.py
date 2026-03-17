# backend/app/tasks/celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "npa_assistant",
    broker=settings.redis_url,       # Redis принимает задачи
    backend=settings.redis_url,      # Redis хранит результаты
    include=["app.tasks.analysis"],  # модули с тасками
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Minsk",
    enable_utc=True,
    result_expires=3600,             # результаты хранятся 1 час
    task_acks_late=True,             # при краше воркера задача вернётся в очередь
)