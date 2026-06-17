import { FiArrowRight, FiCalendar, FiCheckSquare } from 'react-icons/fi'
import { Link } from 'react-router-dom'

function LessonCard({ lesson, compact = false }) {
  const statusLabel = lesson.presentCount > 0 ? `${lesson.presentCount} отмечено` : 'Запланирован'

  if (compact) {
    return (
      <Link className="lesson-card lesson-card-compact pulse-in" to={`/lesson/${lesson.id}`}>
        <div className="lesson-card-compact-row">
          <h3>{lesson.topic}</h3>
          <FiArrowRight />
        </div>
      </Link>
    )
  }

  return (
    <article className="lesson-card pulse-in">
      <div className="lesson-card-header">
        <div>
          <h3>{lesson.topic}</h3>
          <p>{lesson.date}</p>
        </div>
        <span className="status-chip">
          <FiCheckSquare />
          {statusLabel}
        </span>
      </div>

      <div className="lesson-card-topics">
        <span className="tag">
          <FiCalendar />
          {lesson.date}
        </span>
      </div>

      <Link className="page-link" to={`/lesson/${lesson.id}`}>
        Открыть урок
        <FiArrowRight />
      </Link>
    </article>
  )
}

export default LessonCard
