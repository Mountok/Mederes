import StatusState from '../components/StatusState.jsx'

function ForbiddenPage() {
  return (
    <div className="page-grid">
      <StatusState
        title="Доступ запрещён"
        description="У вас нет прав для открытия этой страницы."
        actionLabel="К группам"
        actionTo="/"
      />
    </div>
  )
}

export default ForbiddenPage
