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

## Быстрый запуск на этом MacBook

Docker Desktop должен быть открыт. Зависимости, `back/.env` и Python-окружение на этом MacBook уже подготовлены. Откройте четыре окна Терминала и выполняйте команды по порядку.

**1. База данных:**

```bash
docker start medrese-postgres
```

**2. Backend журнала:**

```bash
cd /Users/ruman/Documents/agre/Mederes/back
go run ./cmd/server
```

**3. AI-сервис:**

```bash
cd /Users/ruman/Documents/agre/Mederes/ai-service
.venv/bin/python server.py
```

**4. Сайт:**

```bash
cd /Users/ruman/Documents/agre/Mederes/app
npm run dev -- --host 127.0.0.1
```

Откройте адрес, который напечатает Vite, обычно `http://127.0.0.1:5173`. Журнал находится на `/groups`, практика чтения — на `/ai-test`. Проверить сервисы можно командами `curl http://127.0.0.1:8000/health` и `curl http://127.0.0.1:8001/ai-api/health`.

Для просмотра **только интерфейса** достаточно пункта 4; данные журнала и распознавание без остальных сервисов работать не будут. Для просмотра с телефона в той же Wi-Fi сети запустите Vite с `--host 0.0.0.0 --port 5176` и откройте `http://<локальный-IP-Mac>:5176`. Через HTTP по локальному IP микрофон и установка PWA могут быть недоступны; для их проверки нужен HTTPS.

**Остановка:** в окнах сайта, AI и backend нажмите `Ctrl+C`, затем остановите только базу этого проекта:

```bash
docker stop medrese-postgres
```

Другие контейнеры Docker при этом не затрагиваются. На другом компьютере или после удаления локальных зависимостей следуйте полным инструкциям ниже и в [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Единая админка школ

Владелец платформы входит на `/login` и попадает на `/platform`. Там можно видеть все школы и их численность, создавать школу с отдельным администратором, переименовывать школу и выдавать новый пароль школьному администратору или преподавателю. Пароли генерируются сервером, сохраняются только в виде bcrypt-хеша и показываются один раз. Создание через прежний `/api/admin/schools` с общим API-ключом удалено.

На новой базе сначала запустите backend, чтобы применились миграции, затем **один раз** из папки `back/` выполните:

```bash
go run ./cmd/bootstrap-platform-admin
```

Команда создаст владельца платформы и один раз покажет логин и случайный пароль. Сохраните их в менеджере паролей. Для тестов используйте отдельную школу; не меняйте доступ реальной школы без договорённости с ней. Новая админка проверена локально и ещё не развёрнута на публичном сервере.

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
- Для продакшена задать случайный `JWT_SECRET` длиной не менее 32 символов, а также сменить `DB_PASSWORD`, `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET`.
- `ai-service/server.py` предназначен только для локальной разработки и не должен публиковаться напрямую в интернет.
