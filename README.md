# Hackathon BSUIR

Проект, разработанный в рамках хакатона БГУИР.

## 📌 О проекте

Веб-приложение с разделением на frontend и backend, использующее AI-функциональность для работы с данными проекта.

Проект построен как клиент-серверное приложение и включает отдельный backend, базу данных PostgreSQL, Redis для фоновых задач и Celery worker.

## 🏗️ Архитектура

```text
┌───────────────┐
│      UI       │
│   Frontend    │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│    FastAPI    │
│    Backend    │
└───────┬───────┘
        │
   ┌────┴─────┐
   ▼          ▼
┌───────┐  ┌───────┐
│PostgreSQL│ │ Redis │
│+ pgvector│ │       │
└───────┘  └───┬───┘
               │
               ▼
        ┌─────────────┐
        │    Celery   │
        │    Worker   │
        └─────────────┘
```

## 🛠️ Технологии

### Backend

- Python
- FastAPI
- Uvicorn
- PostgreSQL
- `pgvector`
- Redis
- Celery

### AI

- Google Gemini API
- PostgreSQL + `pgvector` для работы с векторными данными

### Infrastructure

- Docker
- Docker Compose

## 📂 Структура проекта

```text
hackathon_bsuir/
├── UI/                  # Frontend
├── backend/             # Backend на FastAPI
│
├── .env.example         # Пример конфигурации окружения
├── docker-compose.yml   # Docker Compose конфигурация
├── .gitignore
└── README.md
```

## 🚀 Запуск проекта

### 1. Клонирование репозитория

```bash
git clone https://github.com/art-petrovich13/hackathon_bsuir.git
cd hackathon_bsuir
```

### 2. Настройка переменных окружения

Создайте `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните необходимые переменные:

```env
POSTGRES_DB=npa_db
POSTGRES_USER=npa_user
POSTGRES_PASSWORD=npa_pass

DATABASE_URL=postgresql+asyncpg://npa_user:npa_pass@postgres:5432/npa_db

REDIS_URL=redis://redis:6379/0

GEMINI_API_KEY=your_api_key

SECRET_KEY=your_secret_key

DEBUG=true
```

> Не добавляйте реальные API-ключи и секретные значения в Git.

### 3. Запуск через Docker Compose

```bash
docker compose up --build
```

После запуска основные сервисы будут доступны по следующим адресам:

- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Для остановки:

```bash
docker compose down
```

Чтобы удалить также сохранённые данные PostgreSQL:

```bash
docker compose down -v
```

## 🔧 Сервисы Docker Compose

Проект состоит из нескольких контейнеров:

| Сервис | Назначение |
|---|---|
| `postgres` | PostgreSQL с расширением `pgvector` |
| `redis` | Брокер для фоновых задач |
| `backend` | FastAPI-приложение |
| `celery_worker` | Асинхронная обработка задач |

PostgreSQL использует именованный Docker volume, поэтому данные сохраняются между перезапусками контейнеров.

## 🤖 AI

Для AI-функциональности используется Google Gemini API.

API-ключ передаётся через переменную окружения:

```env
GEMINI_API_KEY=your_api_key
```

В проекте также используется `pgvector`, что позволяет хранить и обрабатывать векторные представления данных непосредственно в PostgreSQL.

## 🔌 Backend API

Backend реализован на FastAPI.

После запуска приложения документацию API можно открыть по адресу:

```text
http://localhost:8000/docs
```

Также FastAPI предоставляет альтернативную документацию:

```text
http://localhost:8000/redoc
```

## 🧩 Разработка

Backend запускается через Uvicorn с включённым hot reload, поэтому изменения в коде автоматически применяются во время разработки.

Celery worker запускается отдельно и обрабатывает фоновые задачи через Redis.

## 👥 Команда

Проект разработан в рамках хакатона БГУИР.

---

## 📄 Лицензия

Проект создан в образовательных и хакатонных целях.
