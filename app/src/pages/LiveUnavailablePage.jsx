import { Link } from 'react-router-dom'
import StatusState from '../components/StatusState.jsx'

function LiveUnavailablePage() {
  return (
    <div className="live-unavailable-shell">
      <section className="surface">
        <StatusState
          title="Эфир в разработке"
          description="Онлайн-трансляции пока отключены. Мы вернём этот раздел, когда он будет готов к нормальной работе."
        />
        <div className="modal-actions">
          <Link className="button button-secondary" to="/groups">
            Вернуться к группам
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LiveUnavailablePage
