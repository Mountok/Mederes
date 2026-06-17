import { useState } from 'react'
import { FiLogIn } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { joinLiveRoom } from '../api/liveApi.js'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'

function saveLiveSession(roomId, session) {
  window.sessionStorage.setItem(`live-session:${roomId}`, JSON.stringify(session))
}

function LiveJoinPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    const nextJoinCode = joinCode.trim().toUpperCase()
    const nextDisplayName = displayName.trim()

    if (nextJoinCode.length < 6) {
      setError('Введите код трансляции')
      return
    }

    if (nextDisplayName.length < 2) {
      setError('Введите имя участника')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const session = await joinLiveRoom({
        join_code: nextJoinCode,
        display_name: nextDisplayName,
      })

      saveLiveSession(session.room.id, session)
      navigate(`/live/${session.room.id}`)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message ?? 'Не удалось подключиться к трансляции',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="landing-shell live-public-shell">
      <header className="landing-header">
        <Link className="brand-block" to="/">
          <div className="brand-mark">
            <img src="/logo_al-qalam.png" alt="" aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <h1>Al-Qalam</h1>
            <p>Онлайн урок</p>
          </div>
        </Link>
        <Link className="button button-secondary" to="/login">
          Войти как учитель
        </Link>
      </header>

      <main className="live-public-main">
        <section className="surface live-join-card">
          <div className="panel-headline">
            <div>
              <h3>Вход в трансляцию</h3>
              <p>Введите код, который дал преподаватель, и своё имя.</p>
            </div>
          </div>

          <form className="live-create-form" onSubmit={handleSubmit}>
            <Input
              label="Код"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="A7K92Q"
            />
            <Input
              label="Имя"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ахмад"
            />
            {error ? <div className="form-error">{error}</div> : null}
            <Button type="submit" disabled={submitting}>
              <FiLogIn />
              {submitting ? 'Подключаю...' : 'Войти'}
            </Button>
          </form>
        </section>
      </main>
    </div>
  )
}

export default LiveJoinPage
