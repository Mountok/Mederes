# Al-Qalam AI

Электронный журнал для медресе и школ Корана с экспериментальным модулем анализа чтения.

Новый чат или разработчик должен начать с [AGENTS.md](AGENTS.md) и [docs/START_HERE.md](docs/START_HERE.md). Полный индекс находится в [docs/README.md](docs/README.md).

## Структура

- `app/` - frontend.
- `back/` - backend, миграции, конфиг и документация.
- `ai-service/` - локальный Python-прототип распознавания и сравнения чтения.
- `docs/` - контекст, история, архитектура, дорожная карта и инструкции.
- `back/migrations/` - SQL-миграции базы.
- `back/docs/runbook.md` - подробная инструкция по запуску и деплою.

## Требования

- Go `1.25+`.
- Node.js и npm.
- Docker для PostgreSQL и LiveKit.
- Python 3 для локального AI-прототипа.

## Локальная AI-демонстрация

AI-страница технически поддерживает все 114 сур через Quran API и диапазон до 10 аятов. Реальными локальными записями проверялась только сура 112 «Аль-Ихляс». Система сравнивает распознанные слова с текстом, но не проверяет таджвид или произношение.

На этом MacBook локальное демо использует предобученную Tarteel Whisper base, конвертированную в CTranslate2/int8. Если её файлы не перенесены на другой компьютер, сервис использует `faster-whisper small`. Выбор модели предварительный: без учительской разметки качество обнаружения ошибок не подтверждено.

Первый терминал:

```bash
cd ai-service
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

Второй терминал:

```bash
cd app
npm install
npm run dev -- --host 127.0.0.1
```

Открыть: `http://127.0.0.1:5173/ai-test`.

Полная инструкция, включая скачивание весов: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

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
- Аудиозаписи, веса моделей, результаты экспериментов и виртуальные окружения также не коммитятся.
- Для продакшена поменять `JWT_SECRET`, `ADMIN_API_KEY`, `DB_PASSWORD`, `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET`.
- `ai-service/server.py` предназначен только для локальной разработки и не должен публиковаться напрямую в интернет.
