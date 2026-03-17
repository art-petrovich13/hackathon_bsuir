FROM python:3.12-slim

WORKDIR /app

# Системные зависимости для asyncpg и компиляции C-расширений
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Сначала копируем только requirements — этот слой кешируется Docker
# Пересборка образа будет быстрее если код изменился, но не зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь остальной код
COPY . .

EXPOSE 8000

# Команда по умолчанию (переопределяется в docker-compose.yml)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]