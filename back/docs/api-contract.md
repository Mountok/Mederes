# API Contract

Базовый URL:

```text
/api
```

## Auth

### `POST /auth/login`

Request:

```json
{
  "login": "teacher",
  "password": "12345678@"
}
```

Response:

```json
{
  "token": "jwt-or-session-token",
  "user": {
    "id": "u1",
    "login": "teacher",
    "role": "teacher",
    "label": "Учитель"
  }
}
```

## Groups

### `GET /groups`

Response:

```json
[
  {
    "id": "1",
    "name": "Сура Аль-Бакара",
    "description": "Группа чтения и тафсира",
    "studentCount": 3,
    "lessonCount": 2,
    "latestLessonDate": "2026-04-07"
  }
]
```

### `POST /groups`

Request:

```json
{
  "name": "Хифз",
  "description": "Короткое описание"
}
```

Response:

```json
{
  "id": "10",
  "name": "Хифз",
  "description": "Короткое описание"
}
```

### `GET /groups/:id`

Response:

```json
{
  "group": {
    "id": "1",
    "name": "Сура Аль-Бакара",
    "description": "Группа чтения и тафсира"
  },
  "students": [
    {
      "id": "1",
      "groupId": "1",
      "name": "Ахмад",
      "note": "Сильное чтение"
    }
  ],
  "lessons": [
    {
      "id": "1",
      "groupId": "1",
      "date": "2026-04-07",
      "topic": "Сура Аль-Бакара (1-5)",
      "presentCount": 2
    }
  ]
}
```

### `DELETE /groups/:id`

Response:

```json
{
  "success": true
}
```

## Students

### `POST /students`

Request:

```json
{
  "groupId": "1",
  "name": "Ахмад",
  "note": "Короткая заметка"
}
```

Response:

```json
{
  "id": "12",
  "groupId": "1",
  "name": "Ахмад",
  "note": "Короткая заметка"
}
```

### `PUT /students/:id`

Request:

```json
{
  "name": "Ахмад",
  "note": "Обновлённая заметка"
}
```

Response:

```json
{
  "id": "12",
  "groupId": "1",
  "name": "Ахмад",
  "note": "Обновлённая заметка"
}
```

## Lessons

### `POST /lessons`

Request:

```json
{
  "groupId": "1",
  "topic": "Сура Аль-Бакара",
  "date": "2026-04-10"
}
```

Response:

```json
{
  "id": "15",
  "groupId": "1",
  "topic": "Сура Аль-Бакара",
  "date": "2026-04-10"
}
```

### `GET /lessons/:id`

Response:

```json
{
  "lesson": {
    "id": "1",
    "groupId": "1",
    "date": "2026-04-07",
    "topic": "Сура Аль-Бакара (1-5)"
  },
  "group": {
    "id": "1",
    "name": "Сура Аль-Бакара",
    "description": "Группа чтения и тафсира"
  },
  "attendanceRows": [
    {
      "studentId": "1",
      "studentName": "Ахмад",
      "note": "Сильное чтение",
      "attended": true,
      "grade": 5
    }
  ]
}
```

## Attendance

### `PUT /attendance`

Request:

```json
{
  "lessonId": "1",
  "studentId": "1",
  "attended": true,
  "grade": 5
}
```

Допускается частичное обновление:

```json
{
  "lessonId": "1",
  "studentId": "1",
  "attended": false
}
```

или

```json
{
  "lessonId": "1",
  "studentId": "1",
  "grade": 4
}
```

Response:

```json
{
  "lesson": {
    "id": "1",
    "groupId": "1",
    "date": "2026-04-07",
    "topic": "Сура Аль-Бакара (1-5)"
  },
  "group": {
    "id": "1",
    "name": "Сура Аль-Бакара",
    "description": "Группа чтения и тафсира"
  },
  "attendanceRows": [
    {
      "studentId": "1",
      "studentName": "Ахмад",
      "note": "Сильное чтение",
      "attended": true,
      "grade": 5
    }
  ]
}
```

### `PUT /lessons/:id/attendance/all`

Request:

```json
{
  "attended": true
}
```

Response:

```json
{
  "lesson": {
    "id": "1",
    "groupId": "1",
    "date": "2026-04-07",
    "topic": "Сура Аль-Бакара (1-5)"
  },
  "group": {
    "id": "1",
    "name": "Сура Аль-Бакара",
    "description": "Группа чтения и тафсира"
  },
  "attendanceRows": [
    {
      "studentId": "1",
      "studentName": "Ахмад",
      "note": "Сильное чтение",
      "attended": true,
      "grade": 5
    }
  ]
}
```

## Errors

Общий формат ошибок:

```json
{
  "error": {
    "code": "not_found",
    "message": "Группа не найдена"
  }
}
```

Коды:

- `validation_error`
- `unauthorized`
- `forbidden`
- `not_found`
