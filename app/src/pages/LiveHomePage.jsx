import { useState } from 'react'
import { FiCopy, FiRadio, FiUsers } from 'react-icons/fi'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { createLiveRoom } from '../api/liveApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'

function saveLiveSession(roomId, session) {
  window.sessionStorage.setItem(`live-session:${roomId}`, JSON.stringify(session))
}

function LiveHomePage() {
  const navigate = useNavigate()
  const { isTeacher } = useAuth()
  const [title, setTitle] = useState('Онлайн урок')
  const [createdRoom, setCreatedRoom] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isTeacher) {
    return <Navigate to="/forbidden" replace />
  }

  async function handleCreateRoom(event) {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Введите название трансляции')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const room = await createLiveRoom({
        title: trimmedTitle,
        group_id: null,
      })
      const liveSession = {
        room: {
          id: room.id,
          title: room.title,
          status: room.status,
          join_code: room.join_code,
        },
        participant: room.participant,
        livekit_url: room.livekit_url,
        token: room.token,
      }

      saveLiveSession(room.id, liveSession)
      setCreatedRoom(room)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message ?? 'Не удалось создать трансляцию',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyCode() {
    if (!createdRoom?.join_code) {
      return
    }

    await navigator.clipboard?.writeText(createdRoom.join_code)
  }

  function handleOpenRoom() {
    if (!createdRoom) {
      return
    }

    navigate(`/live/${createdRoom.id}`)
  }

  return (
    <div className="page-grid">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <h2>Трансляции</h2>
          <p>Создайте комнату, включите камеру или демонстрацию экрана и дайте код ученикам.</p>
        </div>
        <div className="page-header-actions">
          <Link className="button button-secondary" to="/live/join">
            <FiUsers />
            Войти по коду
          </Link>
        </div>
      </section>

      <section className="surface live-create-card">
        <div className="panel-headline">
          <div>
            <h3>Новая трансляция</h3>
            <p>Для MVP комната создаётся вручную и живёт до завершения учителем.</p>
          </div>
          <span className="live-status-pill">
            <FiRadio />
            LiveKit
          </span>
        </div>

        <form className="live-create-form" onSubmit={handleCreateRoom}>
          <Input
            label="Название"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Урок по таджвиду"
          />
          {error ? <div className="form-error">{error}</div> : null}
          <Button type="submit" disabled={submitting}>
            <FiRadio />
            {submitting ? 'Создаю...' : 'Создать трансляцию'}
          </Button>
        </form>

        {createdRoom ? (
          <div className="live-room-created">
            <span>Код для учеников</span>
            <strong>{createdRoom.join_code}</strong>
            <div className="inline-actions">
              <Button variant="secondary" onClick={handleCopyCode}>
                <FiCopy />
                Скопировать код
              </Button>
              <Button onClick={handleOpenRoom}>Открыть трансляцию</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default LiveHomePage
