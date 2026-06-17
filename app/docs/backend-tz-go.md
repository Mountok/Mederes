# ТЗ на Backend MVP

## 1. Цель

Нужно разработать backend для веб-приложения электронного журнала медресе.

Backend должен обслуживать текущий frontend MVP:

- вход в систему
- список групп
- страница группы
- страница урока
- роли `teacher` и `parent`
- чтение и изменение данных в зависимости от роли

Backend должен быть готов к дальнейшему развитию под несколько школ.

## 2. Стек

- Go
- Gin
- PostgreSQL
- `github.com/jmoiron/sqlx`
- `github.com/sirupsen/logrus`

Дополнительно рекомендуется:

- `golang-migrate` или аналог для миграций
- `github.com/google/uuid` для UUID
- `github.com/golang-jwt/jwt/v5` для JWT
- `bcrypt` для паролей

## 3. Архитектура

Нужна чистая структура:

- `handlers`
- `services`
- `repository`
- `models`

Дополнительно:

- `config`
- `middleware`
- `pkg/logger`
- `pkg/db`
- `routes`
- `migrations`

Пример структуры:

```text
cmd/server/main.go

internal/
  config/
  handlers/
  middleware/
  models/
  repository/
  services/
  routes/

pkg/
  db/
  logger/
  auth/

migrations/
docs/
```

## 4. Общие архитектурные требования

- Handler отвечает только за HTTP-уровень.
- Service отвечает за бизнес-логику.
- Repository отвечает за SQL и работу с PostgreSQL через `sqlx`.
- Нельзя смешивать SQL в handlers.
- Все зависимости должны внедряться через конструкторы.
- Ошибки должны быть типизированы и нормально маппиться в HTTP-коды.
- Логи должны писаться и в stdout, и в файл.

## 5. Роли

Нужны 2 роли:

- `teacher`
- `parent`

Поведение:

- `teacher`: может создавать группы, учеников, уроки, менять заметки ученика, посещаемость и оценки, удалять группу
- `parent`: только просмотр

Для MVP допускается упрощение:

- `parent` имеет read-only доступ к данным своей школы
- привязка родителя к конкретным детям может быть добавлена позже

## 6. Multi-tenant логика

Сразу закладываем модель нескольких школ.

Каждая запись должна принадлежать школе:

- `schools`
- `users`
- `groups`
- `students`
- `lessons`
- `attendance`

Во всех основных таблицах нужен `school_id`.

Все запросы должны фильтроваться по `school_id` из текущего пользователя.

## 7. Аутентификация

Для MVP использовать JWT access token.

### Login

Пользователь отправляет:

```json
{
  "login": "teacher",
  "password": "12345678@"
}
```

Сервер возвращает:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "login": "teacher",
    "role": "teacher",
    "label": "Учитель"
  }
}
```

JWT должен содержать минимум:

- `user_id`
- `school_id`
- `role`
- `exp`

Пароли хранить только в виде hash (`bcrypt`).

## 8. Middleware

Нужны middleware:

- request logger
- recover panic
- auth middleware
- role middleware
- tenant middleware или извлечение `school_id` из auth context

## 9. База данных

Ниже минимальная схема для MVP.

### 9.1 `schools`

Поля:

- `id`
- `name`
- `created_at`
- `updated_at`

### 9.2 `users`

Поля:

- `id`
- `school_id`
- `login`
- `password_hash`
- `role`
- `label`
- `created_at`
- `updated_at`

Ограничения:

- `role in ('teacher', 'parent')`
- `login` уникален в пределах системы или школы

### 9.3 `groups`

Поля:

- `id`
- `school_id`
- `name`
- `description`
- `created_at`
- `updated_at`

### 9.4 `students`

Поля:

- `id`
- `school_id`
- `group_id`
- `name`
- `note`
- `created_at`
- `updated_at`

### 9.5 `lessons`

Поля:

- `id`
- `school_id`
- `group_id`
- `topic`
- `date`
- `created_at`
- `updated_at`

### 9.6 `attendance`

Поля:

- `id`
- `school_id`
- `lesson_id`
- `student_id`
- `attended`
- `grade`
- `created_at`
- `updated_at`

Ограничения:

- уникальная пара `lesson_id + student_id`
- `grade` может быть `NULL`
- `grade` от `1` до `5`

## 10. Модели

Минимальные доменные модели:

- `School`
- `User`
- `Group`
- `Student`
- `Lesson`
- `Attendance`

DTO/response модели можно выделить отдельно:

- `LoginRequest`
- `LoginResponse`
- `CreateGroupRequest`
- `CreateStudentRequest`
- `UpdateStudentRequest`
- `CreateLessonRequest`
- `UpdateAttendanceRequest`

## 11. API для MVP

Базовый префикс:

```text
/api
```

### 11.1 Auth

#### `POST /api/auth/login`

Назначение:

- вход пользователя

### 11.2 Groups

#### `GET /api/groups`

Доступ:

- `teacher`
- `parent`

Возвращает список групп школы:

- `id`
- `name`
- `description`
- `studentCount`
- `lessonCount`
- `latestLessonDate`

#### `POST /api/groups`

Доступ:

- только `teacher`

#### `GET /api/groups/:id`

Доступ:

- `teacher`
- `parent`

Возвращает:

- `group`
- `students`
- `lessons`

#### `DELETE /api/groups/:id`

Доступ:

- только `teacher`

Удаляет группу, учеников, уроки и attendance.

### 11.3 Students

#### `POST /api/students`

Доступ:

- только `teacher`

#### `PUT /api/students/:id`

Доступ:

- только `teacher`

Используется для изменения:

- имени
- заметки

### 11.4 Lessons

#### `POST /api/lessons`

Доступ:

- только `teacher`

#### `GET /api/lessons/:id`

Доступ:

- `teacher`
- `parent`

Возвращает:

- `lesson`
- `group`
- `attendanceRows`

### 11.5 Attendance

#### `PUT /api/attendance`

Доступ:

- только `teacher`

Поддерживает:

- обновление посещаемости
- обновление оценки
- частичное обновление

#### `PUT /api/lessons/:id/attendance/all`

Доступ:

- только `teacher`

Используется для массовой отметки:

- все были
- все отсутствовали

## 12. Формат ошибок

Единый формат:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Введите название группы"
  }
}
```

Коды:

- `validation_error`
- `unauthorized`
- `forbidden`
- `not_found`
- `internal_error`

## 13. HTTP-коды

- `200 OK`
- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`

## 14. Валидация

Обязательная серверная валидация:

- группа: `name` не пустое
- ученик: `name` не пустое
- урок: `topic` не пустое
- урок: `date` обязательно
- роль пользователя только из допустимого списка
- оценка только `1..5` или `NULL`

## 15. Repository layer

Каждый repository должен быть интерфейсом.

Пример:

- `AuthRepository`
- `GroupRepository`
- `StudentRepository`
- `LessonRepository`
- `AttendanceRepository`

Repository должен:

- работать через `sqlx`
- не содержать бизнес-логики
- уметь работать в транзакциях там, где это нужно

Транзакции нужны минимум для:

- удаления группы со связанными сущностями
- массового обновления attendance

## 16. Service layer

Каждый service должен быть отдельным модулем.

Пример:

- `AuthService`
- `GroupService`
- `StudentService`
- `LessonService`
- `AttendanceService`

Service отвечает за:

- проверку ролей
- валидацию бизнес-правил
- проверку принадлежности сущностей школе
- orchestration нескольких repository

## 17. Handlers

Handlers должны:

- принимать request
- валидировать базовый JSON/body/query/path
- вызывать service
- возвращать response/json

Нужны handler-файлы:

- `auth_handler.go`
- `group_handler.go`
- `student_handler.go`
- `lesson_handler.go`
- `attendance_handler.go`

## 18. Логирование

Использовать `logrus`.

Требования:

- лог в stdout
- лог в файл
- формат JSON или text, но единообразно
- логировать:
  - старт сервера
  - ошибки БД
  - ошибки auth
  - panic recovery
  - входящие запросы

Минимальные поля request log:

- method
- path
- status
- duration
- user_id
- school_id
- role

## 19. Конфигурация

Через env или config-файл.

Минимум:

- `APP_PORT`
- `APP_ENV`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `LOG_FILE_PATH`

## 20. Миграции

Нужны SQL миграции:

1. create schools
2. create users
3. create groups
4. create students
5. create lessons
6. create attendance
7. add indexes

Индексы нужны минимум на:

- `users.school_id`
- `groups.school_id`
- `students.group_id`
- `students.school_id`
- `lessons.group_id`
- `lessons.school_id`
- `attendance.lesson_id`
- `attendance.student_id`
- `attendance.school_id`

## 21. Seed данные для локальной разработки

Нужны тестовые данные:

- 1 школа
- 1 teacher
- 1 parent
- несколько групп
- несколько учеников
- несколько уроков
- несколько attendance записей

Обязательные логины:

- `teacher / 12345678@`
- `parent / 12345678@`

## 22. Безопасность

Минимум:

- bcrypt для паролей
- JWT secret из env
- tenant isolation по `school_id`
- role checks на write endpoints
- валидация входного JSON

## 23. Что НЕ делаем в MVP

Не включать сейчас:

- аудит кто и когда менял оценку
- восстановление пароля
- refresh tokens
- привязку parent к конкретным детям
- админ-панель
- сложную аналитику
- экспорт в PDF/Excel

## 24. Definition of Done

Backend считается готовым для MVP, если:

- работает login
- teacher может:
  - видеть группы
  - создавать группы
  - открывать группу
  - добавлять ученика
  - менять заметку ученика
  - создавать урок
  - ставить посещаемость
  - ставить оценки
  - удалять группу
- parent может:
  - войти
  - видеть группы
  - открыть группу
  - открыть урок
  - видеть только read-only данные
- все маршруты проверяют auth и role
- данные изолированы по `school_id`
- миграции поднимаются
- seed данные создаются
- frontend можно переключить с mock API на реальный API без ломки контрактов
