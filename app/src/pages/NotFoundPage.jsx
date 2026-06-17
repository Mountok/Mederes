import StatusState from '../components/StatusState.jsx'

function NotFoundPage() {
  return (
    <div className="page-grid">
      <StatusState
        title="Страница не найдена"
        description="Проверьте адрес или вернитесь на главную."
        actionLabel="К группам"
        actionTo="/"
      />
    </div>
  )
}

export default NotFoundPage
