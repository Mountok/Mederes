import { useEffect, useMemo, useState } from 'react'
import { FiBookOpen, FiCalendar, FiClock, FiGrid, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { getGroupJournal, getGroups } from '../api/mockApi.js'
import GroupCard from '../components/GroupCard.jsx'
import StatusState from '../components/StatusState.jsx'

const WEEK_DAYS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
]

function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date) {
  const nextDate = new Date(date)
  const day = nextDate.getDay() || 7
  nextDate.setHours(0, 0, 0, 0)
  nextDate.setDate(nextDate.getDate() - day + 1)
  return nextDate
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatShortDate(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  })
}

function buildWeekDays(today = new Date()) {
  const monday = startOfWeek(today)

  return WEEK_DAYS.map((label, index) => {
    const date = addDays(monday, index)
    return {
      label,
      date,
      iso: toISODate(date),
    }
  })
}

function HomeworkList({ lessons, emptyMessage }) {
  if (!lessons.length) {
    return <p className="schedule-empty">{emptyMessage}</p>
  }

  return (
    <div className="student-homework-list">
      {lessons.map((lesson) => (
        <article key={lesson.id} className="student-homework-item">
          <strong>{lesson.topic}</strong>
          <p>{lesson.homework}</p>
        </article>
      ))}
    </div>
  )
}

function StudentHomePage() {
  const [group, setGroup] = useState(null)
  const [journal, setJournal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const weekDays = useMemo(() => buildWeekDays(), [])
  const todayISO = toISODate(new Date())
  const yesterdayISO = toISODate(addDays(new Date(), -1))
  const journalStartISO = yesterdayISO < weekDays[0].iso ? yesterdayISO : weekDays[0].iso

  useEffect(() => {
    async function loadStudentSchedule() {
      setLoading(true)
      setError('')

      try {
        const groups = await getGroups()
        const studentGroup = groups[0]

        if (!studentGroup) {
          setGroup(null)
          setJournal(null)
          return
        }

        const nextJournal = await getGroupJournal(studentGroup.id, {
          from: journalStartISO,
          to: weekDays[6].iso,
        })

        setGroup(studentGroup)
        setJournal(nextJournal)
      } catch {
        setError('Не удалось загрузить расписание')
      } finally {
        setLoading(false)
      }
    }

    loadStudentSchedule()
  }, [journalStartISO, weekDays])

  const lessonsByDate = useMemo(() => {
    const lessons = journal?.lessons ?? []

    return lessons.reduce((accumulator, lesson) => {
      if (!accumulator[lesson.date]) {
        accumulator[lesson.date] = []
      }

      accumulator[lesson.date].push(lesson)
      return accumulator
    }, {})
  }, [journal])

  const todayHomework = (lessonsByDate[todayISO] ?? []).filter((lesson) =>
    lesson.homework?.trim(),
  )
  const yesterdayHomework = (lessonsByDate[yesterdayISO] ?? []).filter((lesson) =>
    lesson.homework?.trim(),
  )

  if (loading) {
    return <StatusState title="Загрузка" description="Загружаю расписание на неделю..." />
  }

  if (error) {
    return (
      <StatusState
        title="Не удалось загрузить"
        description={error}
        actionLabel="Повторить"
        actionOnClick={() => window.location.reload()}
      />
    )
  }

  if (!group) {
    return (
      <StatusState
        title="Группа не найдена"
        description="Пока ученик не привязан к учебной группе."
      />
    )
  }

  return (
    <div className="page-grid student-home">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <h2>{group.name}</h2>
          <p>Расписание на текущую неделю</p>
        </div>
        <div className="page-header-actions">
          <Link className="button button-secondary" to={`/group/${group.id}`}>
            <FiUsers />
            Группа и ученики
          </Link>
          <Link className="button button-secondary" to={`/group/${group.id}/journal`}>
            <FiGrid />
            Оценки
          </Link>
        </div>
      </section>

      <section className="surface student-homework-card">
        <div className="section-header">
          <div>
            <h3>Актуальное ДЗ</h3>
            <p>Текущие задания и ДЗ с прошедшего урока</p>
          </div>
          <span className="student-homework-icon">
            <FiBookOpen />
          </span>
        </div>

        <div className="student-homework-columns">
          <div className="student-homework-section">
            <h4>На сегодня, {formatShortDate(todayISO)}</h4>
            <HomeworkList
              lessons={todayHomework}
              emptyMessage="На сегодня домашнее задание не указано."
            />
          </div>
          <div className="student-homework-section">
            <h4>За прошедший урок, {formatShortDate(yesterdayISO)}</h4>
            <HomeworkList
              lessons={yesterdayHomework}
              emptyMessage="За прошедший день домашнее задание не указано."
            />
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="section-header">
          <div>
            <h3>Неделя</h3>
            <p>Уроки сгруппированы по дням.</p>
          </div>
        </div>

        <div className="student-week-grid">
          {weekDays.map((day) => {
            const lessons = lessonsByDate[day.iso] ?? []
            const isToday = day.iso === todayISO

            return (
              <article
                key={day.iso}
                className={`student-day-card ${isToday ? 'student-day-card-today' : ''}`}
              >
                <div className="student-day-head">
                  <div>
                    <strong>{day.label}</strong>
                    <span>{formatShortDate(day.iso)}</span>
                  </div>
                  {isToday ? <span className="student-today-pill">Сегодня</span> : null}
                </div>

                {lessons.length ? (
                  <div className="student-day-lessons">
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className="student-day-lesson">
                        <FiCalendar />
                        <div>
                          <strong>{lesson.topic}</strong>
                          {lesson.homework ? <p>ДЗ: {lesson.homework}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="student-day-empty">
                    <FiClock />
                    Нет уроков
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="surface">
        <div className="section-header">
          <div>
            <h3>Моя группа</h3>
            <p>Можно открыть группу, посмотреть учеников и журнал оценок.</p>
          </div>
        </div>
        <div className="student-group-card-wrap">
          <GroupCard group={group} />
        </div>
      </section>
    </div>
  )
}

export default StudentHomePage
