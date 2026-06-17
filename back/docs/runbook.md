# Medrese Backend Runbook

## Что это

Короткая памятка, как:

- запускать backend локально;
- запускать Postgres в Docker;
- запускать LiveKit;
- выкатывать новые изменения на сервер;
- пересобирать backend после обновления файлов;
- проверять, что всё поднялось.

---

## 1. Актуальные требования

- Go: `1.25+`
- PostgreSQL: в Docker
- LiveKit: в Docker
- Backend: Go binary

После добавления live-функционала и роли `staff` сервер лучше собирать на `Go 1.25+`.

Проверка:

```bash
go version
```

---

## 2. Основные пути

### Локально

Backend:

```bash
/Users/dashuev/Desktop/Медресе/back
```

Frontend:

```bash
/Users/dashuev/Desktop/Медресе/app
```

### На сервере

Backend:

```bash
/srv/medrese/back
```

Binary:

```bash
/srv/medrese/back/bin/medrese-back
```

---

## 3. .env для backend

Файл:

```bash
/srv/medrese/back/.env
```

Пример:

```env
APP_PORT=8000
APP_ENV=production
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=medrese
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSLMODE=disable
JWT_SECRET=super-secret-key
ADMIN_API_KEY=very-strong-admin-key
LOG_FILE_PATH=/srv/medrese/back/logs/app.log

LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

Если LiveKit будет проксироваться через отдельный домен, то:

```env
LIVEKIT_URL=wss://live.al-qalam.ru
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

---

## 4. PostgreSQL в Docker

Если контейнер ещё не создан:

```bash
docker run --name medrese-postgres \
  -e POSTGRES_DB=medrese \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

Если уже создан, просто запуск:

```bash
docker start medrese-postgres
```

Проверить:

```bash
docker ps
```

Подключиться к базе:

```bash
docker exec -it medrese-postgres psql -U postgres -d medrese
```

Посмотреть таблицы:

```sql
\dt
```

---

## 5. LiveKit в Docker

Файл compose:

```bash
/srv/medrese/back/docker-compose.livekit.yml
```

Запуск:

```bash
cd /srv/medrese/back
docker compose -f docker-compose.livekit.yml up -d
```

Проверка:

```bash
docker ps
```

В compose сейчас dev-конфигурация:

- URL: `ws://localhost:7880`
- API key: `devkey`
- API secret: `secret`

Важно:

- это не "логин и пароль пользователя";
- это ключи backend -> LiveKit;
- teacher/student/parent входят в эфир через токены, которые выдаёт backend.

---

## 6. Локальный запуск backend

Из папки backend:

```bash
cd /Users/dashuev/Desktop/Медресе/back
go run ./cmd/server
```

Что произойдёт:

- backend прочитает `.env`;
- подключится к Postgres;
- применит миграции автоматически;
- поднимется на `http://localhost:8000`.

Проверка:

```bash
curl http://localhost:8000/health
```

---

## 7. Локальный запуск frontend

Из папки frontend:

```bash
cd /Users/dashuev/Desktop/Медресе/app
npm run dev
```

Обычно frontend:

```bash
http://localhost:5173
```

---

## 8. Тестовые логины

Базовые seed-логины:

- teacher: `teacher / 12345678@`
- parent: `parent / 12345678@`

Дополнительно:

- `student` создаётся при создании ученика;
- `staff` создаётся через `POST /api/staff`.

---

## 9. Как обновлять сервер после того, как закинул новые файлы

### Шаг 1. Подключиться к серверу

```bash
ssh root@YOUR_SERVER_IP
```

### Шаг 2. Перейти в backend

```bash
cd /srv/medrese/back
```

### Шаг 3. Сделать backup базы

Перед обновлением очень желательно:

```bash
docker exec -t medrese-postgres pg_dump -U postgres -d medrese > /root/medrese_backup_before_update.sql
```

### Шаг 4. Проверить Go

```bash
go version
```

Если версия ниже `1.25`, надо обновить Go.

### Шаг 5. Убедиться, что приехали все файлы

Проверь, что доехали:

- `go.mod`
- `go.sum`
- `docker-compose.livekit.yml`
- новые файлы в `internal/handlers`, `internal/services`, `internal/repository`
- новые миграции `012` и `013`

Быстрая проверка:

```bash
ls migrations
grep -E "gorilla/websocket|livekit" go.mod
```

### Шаг 6. Поднять LiveKit

Если ещё не поднят:

```bash
docker compose -f /srv/medrese/back/docker-compose.livekit.yml up -d
```

### Шаг 7. Подтянуть зависимости

Если после выкладки новых файлов менялся `go.mod`, выполни:

```bash
/usr/local/go/bin/go mod tidy
```

### Шаг 8. Пересобрать backend

```bash
mkdir -p /srv/medrese/back/bin
mkdir -p /srv/medrese/back/logs
/usr/local/go/bin/go build -o /srv/medrese/back/bin/medrese-back ./cmd/server
```

### Шаг 9. Перезапустить backend

Если используется `systemd`:

```bash
sudo systemctl restart medrese-back
sudo systemctl status medrese-back
```

Логи:

```bash
journalctl -u medrese-back -n 100 --no-pager
```

---

## 10. Полный короткий сценарий обновления на сервере

Если код уже залит в `/srv/medrese/back`:

```bash
cd /srv/medrese/back
docker exec -t medrese-postgres pg_dump -U postgres -d medrese > /root/medrese_backup_before_update.sql
docker compose -f docker-compose.livekit.yml up -d
/usr/local/go/bin/go mod tidy
mkdir -p /srv/medrese/back/bin /srv/medrese/back/logs
/usr/local/go/bin/go build -o /srv/medrese/back/bin/medrese-back ./cmd/server
sudo systemctl restart medrese-back
sudo systemctl status medrese-back
```

---

## 11. Что проверять после деплоя

Backend health:

```bash
curl http://127.0.0.1:8000/health
```

LiveKit:

```bash
curl http://127.0.0.1:7880
```

Контейнеры:

```bash
docker ps
```

Проверка новых таблиц:

```bash
docker exec -it medrese-postgres psql -U postgres -d medrese
```

И внутри:

```sql
\dt
```

После live/staff обновлений должны быть таблицы:

- `live_rooms`
- `live_participants`
- `live_chat_messages`
- `staff_profiles`
- `staff_group_assignments`

---

## 12. Важно не сломать текущую базу

Нельзя делать:

- `docker rm -v medrese-postgres`
- удаление Docker volume Postgres
- ручное удаление таблиц
- правку старых миграций `001...013`

Можно делать:

- заливать новый код;
- добавлять новые миграции;
- пересобирать backend;
- перезапускать backend;
- поднимать новые контейнеры рядом, например LiveKit.

Если не трогать volume Postgres, текущая база сохранится.

---

## 13. Если сборка падает на сервере

### Ошибка `no required module provides package ...`

Обычно значит:

- не доехали `go.mod` / `go.sum`;
- не выполнен `go mod tidy`;
- залит не весь backend.

Что делать:

```bash
cd /srv/medrese/back
grep -E "gorilla/websocket|livekit" go.mod
/usr/local/go/bin/go mod tidy
/usr/local/go/bin/go build -o /srv/medrese/back/bin/medrese-back ./cmd/server
```

### Ошибка по Go version

Проверь:

```bash
go version
```

Нужен `Go 1.25+`.

---

## 14. Где что лежит

### Backend source

```bash
/srv/medrese/back
```

### Backend binary

```bash
/srv/medrese/back/bin/medrese-back
```

### Backend env

```bash
/srv/medrese/back/.env
```

### LiveKit compose

```bash
/srv/medrese/back/docker-compose.livekit.yml
```

### Логи backend

```bash
/srv/medrese/back/logs/app.log
```

### Postgres контейнер

```bash
medrese-postgres
```
