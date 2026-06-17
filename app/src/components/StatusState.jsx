import { Link } from 'react-router-dom'
import Button from './Button.jsx'

function StatusState({
  title,
  description,
  actionLabel,
  actionTo,
  actionOnClick,
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {actionLabel && actionTo ? (
        <Link className="page-link" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && actionOnClick ? (
        <Button variant="secondary" onClick={actionOnClick}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default StatusState
