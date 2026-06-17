import { FiArrowLeft } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import GroupJournalPanel from '../components/GroupJournalPanel.jsx'
import { useAuth } from '../auth/useAuth.jsx'

function GroupJournalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canManageAssignedGroups } = useAuth()

  function handleGoBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(`/group/${id}`)
  }

  return (
    <div className="page-grid">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <button className="back-link back-link-button" type="button" onClick={handleGoBack}>
            <FiArrowLeft />
            Назад
          </button>
          <h2>Журнал группы</h2>
        </div>
        <div className="page-header-actions">
          <Link className="button button-secondary" to={`/group/${id}`}>
            К группе
          </Link>
        </div>
      </section>

      <section className="surface pulse-in">
        <GroupJournalPanel groupId={id} canManage={canManageAssignedGroups} />
      </section>
    </div>
  )
}

export default GroupJournalPage
