# backend/app/core/database.py
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# ─── Асинхронный движок ──────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,      # echo=True — все SQL запросы пишутся в лог (удобно для отладки)
    pool_size=10,             # постоянных соединений в пуле
    max_overflow=20,          # доп. соединений сверх pool_size
    pool_pre_ping=True,       # проверять соединение перед использованием (защита от обрыва)
)

# ─── Фабрика сессий ──────────────────────────────────────────────────────────────
# Каждый HTTP запрос получит свою сессию через Depends(get_db)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,   # объекты не "протухают" после commit — удобно возвращать из роутера
    autocommit=False,
    autoflush=False,
)


# ─── Базовый класс для всех SQLAlchemy моделей ───────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── FastAPI Dependency ──────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency для FastAPI роутеров.
    
    Пример использования в роутере:
        @router.get("/something")
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Document))
    
    Автоматически: коммитит при успехе, откатывает при исключении, закрывает сессию.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()