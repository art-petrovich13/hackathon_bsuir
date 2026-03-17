# backend/app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Все настройки приложения через pydantic-settings.
    Значения читаются из .env файла автоматически.
    """
    model_config = SettingsConfigDict(
        env_file=".env",             # читать .env из текущей рабочей директории
        env_file_encoding="utf-8",
        extra="ignore",              # не падать если в .env есть лишние переменные
    )

    # База данных
    database_url: str = "postgresql+asyncpg://npa_user:npa_pass@postgres:5432/npa_db"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Google Gemini API
    gemini_api_key: str = ""

    # Безопасность
    secret_key: str = "change_me"

    # Режим отладки (true = логировать все SQL запросы)
    debug: bool = True

    # Версия приложения
    app_version: str = "0.1.0"


# Глобальный экземпляр — импортируй его везде:
# from app.core.config import settings
settings = Settings()