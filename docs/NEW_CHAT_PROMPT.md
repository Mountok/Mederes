# Как начать новый чат по проекту

Создайте чат из папки:

```text
/Users/ruman/Documents/agre/Mederes
```

И отправьте сообщение:

> Работаем с проектом Al-Qalam AI в текущей папке. Сначала полностью прочитай `AGENTS.md` и `docs/START_HERE.md`, затем нужные документы из `docs/`. Проверь `git status --short` и не затирай мои незакоммиченные изменения. Используй код как источник истины, а `docs/FACTS_AND_HYPOTHESES.md` — чтобы не выдавать цели за достигнутые результаты. Моя задача: [впишите задачу].

Для AI-задачи добавьте:

> Обязательно прочитай `docs/AI_DATA_AND_SURA_EXPANSION.md`, `ai-service/README.md`, `ai-service/RESULTS.md` и `ai-service/TRAINING.md`. Текущий прототип не проверяет таджвид, а экспериментальный LoRA-адаптер не подключён к сайту.

Для backend-задачи добавьте:

> Прочитай `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `back/docs/api-contract.md` и миграции. Сохрани мультитенантность по `school_id` и существующее разделение handler/service/repository.

Для frontend-задачи добавьте:

> Прочитай `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, текущий `app/src/App.jsx` и связанные страницы. После изменений запусти `node --test tests/recitation.test.mjs` и `npm run build`.

## Какие документы обновлять после работы

- изменилось текущее состояние — `START_HERE.md`;
- появилась подтверждённая метрика — `FACTS_AND_HYPOTHESES.md`;
- принято архитектурное решение — `DECISIONS.md` и `ARCHITECTURE.md`;
- выполнен этап — `PROJECT_HISTORY.md` и `ROADMAP.md`;
- изменилась команда запуска — `DEVELOPMENT.md` и корневой `README.md`;
- изменились данные или логика сур — `AI_DATA_AND_SURA_EXPANSION.md`.

