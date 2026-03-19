# NPA Assistant — AI-ассистент сравнения НПА/ЛНА

## Быстрый старт

### Требования
- Docker Desktop
- Git

### Запуск
```bash
git clone <repo_url>
cd hackathon_bsuir
cp .env.example .env
# Заполнить OPENROUTER_API_KEY в .env
docker compose up -d --build
```

### Проверка
```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

Фронт: http://localhost:5173
Swagger: http://localhost:8000/docs

### Переменные окружения (.env)
| Переменная | Описание |
|------------|----------|
| OPENROUTER_API_KEY | Ключ OpenRouter (бесплатный) |
| OPENROUTER_MODEL | Модель (arcee-ai/trinity-large-preview:free) |
| DATABASE_URL | PostgreSQL (автоматически в docker compose) |

### Технологии
- Backend: Python 3.12 + FastAPI + Celery + PostgreSQL
- Frontend: React 18 + TypeScript + Tailwind CSS
- AI: OpenRouter API (arcee-ai/trinity-large-preview:free)