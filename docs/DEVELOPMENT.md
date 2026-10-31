# Разработка и запуск

Обновлено: 20 октября 2026 года.

Все команды ниже выполняются из `/Users/ruman/Documents/agre/Mederes`, если не указан другой путь.

## Требования

- Node.js и npm;
- Go 1.25+;
- PostgreSQL 16, удобнее через Docker;
- Python 3 с отдельным окружением для AI;
- Docker Compose для LiveKit, если требуется онлайн-занятие.

## Быстрый запуск AI-демо

Этому режиму не нужны PostgreSQL и Go backend.

Терминал 1:

```bash
cd ai-service
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

При первом запуске на новом компьютере заранее скачайте веса:

```bash
.venv/bin/python -c 'from faster_whisper import WhisperModel; WhisperModel("small", device="cpu", compute_type="int8", download_root="models")'
```

На текущем MacBook сервис автоматически выбирает локально конвертированную модель Tarteel из `ai-service/models/tarteel-faster-whisper-base/`, если там есть `model.bin` и `tokenizer.json`. На новом компьютере без этой папки используется `small`; для одинакового поведения перенесите модель отдельно от Git или повторите конвертацию по `ai-service/README.md`. Параметр `--model small` принудительно выбирает прежний вариант.

Терминал 2:

```bash
cd app
npm install
npm run dev -- --host 127.0.0.1
```

Открыть: `http://127.0.0.1:5173/ai-test`.

Веса должны быть локальными. `server.py` запускает распознаватель с `local_files_only=True` и сам ничего не скачивает.
Для выбора любой суры, кроме встроенного fallback «Аль-Ихляс», frontend и AI-сервису нужен доступ к Quran API. Полученный текст и аудиосписок кэшируются в памяти на время работы страницы/сервиса.

## Запуск электронного журнала

Создать backend-конфигурацию:

```bash
cd back
cp .env.example .env
```

Запустить PostgreSQL:

```bash
docker run --name medrese-postgres \
  -e POSTGRES_DB=medrese \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

Если контейнер уже существует:

```bash
docker start medrese-postgres
```

Запустить backend:

```bash
cd back
go run ./cmd/server
```

Проверка:

```bash
curl http://localhost:8000/health
```

Запустить frontend:

```bash
cd app
npm install
npm run dev
```

Vite обычно открывается на `http://localhost:5173` и проксирует `/api` к `http://localhost:8000`.

Go API по умолчанию слушает только `127.0.0.1:8000`. Для публичного развёртывания его не нужно открывать наружу: Nginx принимает HTTPS-трафик и проксирует внутренние `/api`-запросы к этому адресу.

## LiveKit

Для локального онлайн-занятия:

```bash
cd back
docker compose -f docker-compose.livekit.yml up -d
```

Dev-ключи из `.env.example` нельзя использовать в production.

## Тестовые данные журнала

Миграция `009_seed_mvp.up.sql` создаёт демонстрационную школу, группы, учеников и уроки. Seed-логины описаны в `back/docs/runbook.md`. Эти данные предназначены только для локальной разработки.

## Проверки перед передачей изменений

Frontend:

```bash
cd app
node --test tests/recitation.test.mjs
npm run build
```

Backend:

```bash
cd back
GOCACHE=/tmp/al-qalam-go-cache go test ./...
```

AI:

```bash
cd ai-service
.venv/bin/python -m unittest -v
```

HTTP-тесты AI поднимают локальный сервер на случайном порту. В некоторых sandbox-средах это запрещено. Ошибка привязки порта не заменяет реальный прогон на локальной машине.

Для повтора live-сценария на пятой записи сначала запустите AI-сервис, затем:

```bash
cd ai-service
.venv/bin/python verify_live.py
```

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

Production-сборка frontend не включает Vite proxy. На сервере reverse proxy должен отдельно направлять `/api` в Go backend, а внутренний AI-маршрут — через защищённый backend/worker-контур.
Python-сервис не открывается напрямую: он слушает `127.0.0.1`. Для временного демонстрационного
доступа через конкретный HTTPS-домен добавьте в его systemd `ExecStart` параметр
`--allowed-origin https://<домен>`; нельзя разрешать произвольные origins.

## Локальные файлы, которые не коммитятся

- `samples/`;
- `ai-service/models/`;
- `ai-service/results/`;
- `ai-service/training-runs/`;
- `ai-service/.venv*`;
- `.env`, логи, `node_modules`, `dist`.

При переносе на новый компьютер или сервер эти материалы нужно переносить отдельно и безопасно. Git содержит код, но не содержит весов и исходных аудиозаписей.

## Типовые проблемы

### `npm: command not found`

Установите Node.js через `nvm` или официальный установщик. Глобально обновлять системный npm через `sudo` для запуска проекта не требуется.

### AI-страница пишет, что сервис недоступен

Проверьте:

```bash
curl http://127.0.0.1:8001/ai-api/health
```

Если Python-код менялся, перезапустите `server.py`. Если менялся `vite.config.js`, перезапустите Vite.

### Живая подсветка и задержка

Микрофон отправляет перекрывающиеся окна не длиннее 12 секунд примерно раз в 4 секунды.
Python-сервис хранит промежуточную расшифровку в памяти по случайному идентификатору сессии;
завершённая сессия удаляется сразу, а устаревшие очищаются при следующем промежуточном запросе
после 180 секунд бездействия. При остановке браузер сразу отправляет
полную запись для финальной проверки и отменяет ожидающие промежуточные запросы.
Сервер пропускает новые промежуточные запросы, пока финальный ждёт модель; уже начатый
вызов CTranslate2 не прерывается. CPU остаётся рабочим устройством. Замерьте задержку
и качество подсветки после установки на целевой сервер перед выводами об ускорении.

### Микрофон не работает

Используйте localhost или HTTPS, разрешите микрофон в браузере и откройте страницу в браузере с AudioWorklet. В качестве обходного пути загрузите аудиофайл.

### Go не может писать в системный cache

Используйте writable cache:

```bash
GOCACHE=/tmp/al-qalam-go-cache go test ./...
```

