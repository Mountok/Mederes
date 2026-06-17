# Mederes

Электронный журнал медресе: frontend на React/Vite и backend на Go.

## Структура

- `app/` - frontend.
- `back/` - backend, миграции, конфиг и документация.
- `back/migrations/` - SQL-миграции базы.
- `back/docs/runbook.md` - подробная инструкция по запуску и деплою.

## Требования

- Go `1.25+`.
- Node.js и npm.
- Docker для PostgreSQL и LiveKit.

## Backend

1. Перейти в папку backend:

```bash
cd back
```

2. Создать локальный env-файл:

```bash
cp .env.example .env
```

3. Запустить PostgreSQL:

```bash
docker run --name medrese-postgres \
  -e POSTGRES_DB=medrese \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

Если контейнер уже создан:

```bash
docker start medrese-postgres
```

4. При необходимости запустить LiveKit:

```bash
docker compose -f docker-compose.livekit.yml up -d
```

5. Запустить backend:

```bash
go run ./cmd/server
```

Backend поднимается на `http://localhost:8000`. Миграции применяются автоматически при старте.

Проверка:

```bash
curl http://localhost:8000/health
```

## Frontend

1. Перейти в папку frontend:

```bash
cd app
```

2. Установить зависимости:

```bash
npm install
```

3. Запустить dev-сервер:

```bash
npm run dev
```

Frontend открывается через адрес, который покажет Vite, обычно `http://localhost:5173`.

## Сборка

Frontend:

```bash
cd app
npm run build
```

Backend:

```bash
cd back
go build -o bin/medrese-back ./cmd/server
```

## Важно

- Реальный `.env`, логи, `node_modules/`, `dist/` и системные файлы не коммитятся.
- Для продакшена поменять `JWT_SECRET`, `ADMIN_API_KEY`, `DB_PASSWORD`, `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET`.
