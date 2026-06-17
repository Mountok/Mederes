import {
  FiArrowRight,
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiBookmark,
  FiCalendar,
  FiClock,
  FiEdit2,
  FiStar,
  FiUsers,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'

const GROUP_ACCENTS = [
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#ea580c',
  '#16a34a',
  '#db2777',
  '#0891b2',
]

const GROUP_ICONS = [FiBookOpen, FiStar, FiAward, FiBookmark, FiEdit2, FiBarChart2, FiBookOpen]

function paletteIndex(id, length) {
  const key = String(id)
  let sum = 0

  for (let i = 0; i < key.length; i += 1) {
    sum += key.charCodeAt(i)
  }

  return sum % length
}

function formatLessonDate(value) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }

  return `${day}.${month}.${year}`
}

function GroupCard({ group }) {
  const accent = GROUP_ACCENTS[paletteIndex(group.id, GROUP_ACCENTS.length)]
  const Icon = GROUP_ICONS[paletteIndex(group.id, GROUP_ICONS.length)]
  const lastLessonLabel = group.latestLessonDate
    ? formatLessonDate(group.latestLessonDate)
    : null

  return (
    <article
      className="group-card pulse-in"
      style={{
        '--group-accent': accent,
        '--group-accent-soft': `${accent}18`,
      }}
    >
      <div className="group-card-topline" aria-hidden="true" />

      <div className="group-card-head">
        <div className="group-card-icon" aria-hidden="true">
          <Icon />
        </div>
        <div className="group-card-titles">
          <h3>{group.name}</h3>
          {group.description ? <p>{group.description}</p> : null}
        </div>
      </div>

      <div className="group-card-stats">
        <span className="group-card-badge">
          <FiUsers />
          {group.studentCount} учеников
        </span>
        <span className="group-card-badge">
          <FiCalendar />
          {group.lessonCount} уроков
        </span>
      </div>

      <p className="group-card-last-lesson">
        {lastLessonLabel ? (
          <>
            <span>Последний урок</span>
            <span className="group-card-last-lesson-date">
              <FiCalendar />
              {lastLessonLabel}
            </span>
          </>
        ) : (
          <>
            <FiClock />
            Уроков ещё нет
          </>
        )}
      </p>

      <Link className="group-card-link" to={`/group/${group.id}`}>
        Открыть группу
        <FiArrowRight />
      </Link>
    </article>
  )
}

export default GroupCard
