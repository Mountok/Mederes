import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiCamera,
  FiCopy,
  FiMic,
  FiMonitor,
  FiSend,
  FiStopCircle,
  FiVolume2,
} from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import {
  buildLiveWebSocketURL,
  endLiveRoom,
  getLiveMessages,
  getLiveToken,
  sendLiveMessage,
} from '../api/liveApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import StatusState from '../components/StatusState.jsx'

function readLiveSession(roomId) {
  const raw = window.sessionStorage.getItem(`live-session:${roomId}`)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    window.sessionStorage.removeItem(`live-session:${roomId}`)
    return null
  }
}

function saveLiveSession(roomId, session) {
  window.sessionStorage.setItem(`live-session:${roomId}`, JSON.stringify(session))
}

function addTrackItem(track, publication, participant, owner = 'remote') {
  return {
    id: publication?.trackSid ?? track.sid ?? `${owner}-${participant.identity}-${track.source}`,
    owner,
    track,
    kind: track.kind,
    source: publication?.source ?? track.source,
    participantName: participant.name || participant.identity,
  }
}

function MediaTile({ item }) {
  const mediaRef = useRef(null)

  useEffect(() => {
    const element = item.track.attach()
    element.className = item.kind === Track.Kind.Video ? 'live-video-element' : 'live-audio-element'
    element.autoplay = true
    element.playsInline = true
    element.controls = item.kind === Track.Kind.Audio

    if (mediaRef.current) {
      mediaRef.current.replaceChildren(element)
    }

    return () => {
      item.track.detach(element)
      element.remove()
    }
  }, [item.track, item.kind])

  return (
    <article className={`live-media-tile live-media-${item.kind}`}>
      <div ref={mediaRef} className="live-media-frame" />
      <div className="live-media-caption">
        <strong>{item.participantName}</strong>
        <span>{item.source === Track.Source.ScreenShare ? 'Экран' : item.kind === 'audio' ? 'Звук' : 'Камера'}</span>
      </div>
    </article>
  )
}

function normalizeMessage(event) {
  if (event.type === 'chat_message') {
    return { type: 'chat', ...event.payload }
  }

  if (event.type === 'participant_joined') {
    return {
      id: `${event.type}-${event.payload?.participant_id}-${Date.now()}`,
      type: 'system',
      message: `${event.payload?.display_name ?? 'Участник'} подключился`,
    }
  }

  if (event.type === 'participant_left') {
    return {
      id: `${event.type}-${event.payload?.participant_id}-${Date.now()}`,
      type: 'system',
      message: `${event.payload?.display_name ?? 'Участник'} вышел`,
    }
  }

  if (event.type === 'room_ended') {
    return {
      id: `room-ended-${Date.now()}`,
      type: 'system',
      message: 'Трансляция завершена',
    }
  }

  if (event.type === 'error') {
    return {
      id: `error-${Date.now()}`,
      type: 'system',
      message: event.payload?.message ?? 'Ошибка трансляции',
    }
  }

  return null
}

function LiveRoomPage() {
  const { id: roomId } = useParams()
  const navigate = useNavigate()
  const { isTeacher } = useAuth()
  const [session, setSession] = useState(() => readLiveSession(roomId))
  const [connectionState, setConnectionState] = useState('idle')
  const [remoteTracks, setRemoteTracks] = useState([])
  const [localTracks, setLocalTracks] = useState([])
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)
  const [screenEnabled, setScreenEnabled] = useState(false)
  const [error, setError] = useState('')
  const roomRef = useRef(null)
  const wsRef = useRef(null)

  const participantId = session?.participant?.id
  const canPublish = session?.participant?.role === 'teacher' || isTeacher
  const roomTitle = session?.room?.title ?? 'Трансляция'
  const joinCode = session?.room?.join_code
  const mediaTracks = useMemo(() => [...localTracks, ...remoteTracks], [localTracks, remoteTracks])

  useEffect(() => {
    let ignore = false

    async function ensureSessionToken() {
      if (!roomId || !session) {
        return
      }

      if (session.livekit_url && session.token) {
        return
      }

      try {
        const tokenResponse = await getLiveToken(roomId, participantId)
        if (ignore) {
          return
        }
        const nextSession = {
          ...session,
          livekit_url: tokenResponse.livekit_url,
          token: tokenResponse.token,
        }
        saveLiveSession(roomId, nextSession)
        setSession(nextSession)
      } catch (requestError) {
        if (!ignore) {
          setError(
            requestError?.response?.data?.error?.message ??
              'Не удалось получить доступ к трансляции',
          )
        }
      }
    }

    ensureSessionToken()

    return () => {
      ignore = true
    }
  }, [participantId, roomId, session])

  useEffect(() => {
    if (!session?.livekit_url || !session?.token) {
      return undefined
    }

    let cancelled = false
    const nextRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    function handleTrackSubscribed(track, publication, participant) {
      setRemoteTracks((currentTracks) => [
        ...currentTracks.filter((item) => item.id !== publication.trackSid),
        addTrackItem(track, publication, participant),
      ])
    }

    function handleTrackUnsubscribed(track, publication) {
      setRemoteTracks((currentTracks) =>
        currentTracks.filter((item) => item.id !== publication.trackSid),
      )
      track.detach()
    }

    function handleLocalTrackPublished(publication, participant) {
      if (!publication.track) {
        return
      }
      setLocalTracks((currentTracks) => [
        ...currentTracks.filter((item) => item.id !== publication.trackSid),
        addTrackItem(publication.track, publication, participant, 'local'),
      ])
    }

    function handleLocalTrackUnpublished(publication) {
      setLocalTracks((currentTracks) =>
        currentTracks.filter((item) => item.id !== publication.trackSid),
      )
      publication.track?.detach()
    }

    nextRoom
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished)
      .on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished)
      .on(RoomEvent.ConnectionStateChanged, (state) => setConnectionState(state))
      .on(RoomEvent.Disconnected, () => {
        setConnectionState('disconnected')
        setCameraEnabled(false)
        setMicrophoneEnabled(false)
        setScreenEnabled(false)
      })

    roomRef.current = nextRoom

    nextRoom
      .connect(session.livekit_url, session.token)
      .then(() => {
        if (!cancelled) {
          setConnectionState('connected')
        }
      })
      .catch((connectError) => {
        if (!cancelled) {
          setConnectionState('failed')
          setError(connectError?.message ?? 'Не удалось подключиться к LiveKit')
        }
      })

    return () => {
      cancelled = true
      nextRoom.disconnect()
      nextRoom.removeAllListeners()
      setRemoteTracks([])
      setLocalTracks([])
    }
  }, [session?.livekit_url, session?.token])

  useEffect(() => {
    if (!roomId || !participantId) {
      return undefined
    }

    let ignore = false

    async function loadMessages() {
      try {
        const nextMessages = await getLiveMessages(roomId, participantId)
        if (!ignore) {
          setMessages(nextMessages.map((message) => ({ type: 'chat', ...message })))
        }
      } catch {
        if (!ignore) {
          setMessages([])
        }
      }
    }

    loadMessages()

    const socket = new WebSocket(buildLiveWebSocketURL(roomId, participantId))
    wsRef.current = socket

    socket.onmessage = (event) => {
      try {
        const parsedEvent = JSON.parse(event.data)
        const normalized = normalizeMessage(parsedEvent)
        if (normalized) {
          setMessages((currentMessages) => [...currentMessages, normalized])
        }
        if (parsedEvent.type === 'room_ended') {
          roomRef.current?.disconnect()
          setConnectionState('disconnected')
          setError('Трансляция завершена')
        }
      } catch {
        // Ignore malformed realtime events; HTTP fallback still works for chat.
      }
    }

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null
      }
    }

    return () => {
      ignore = true
      socket.close()
    }
  }, [participantId, roomId])

  async function handleCopyCode() {
    if (!joinCode) {
      return
    }
    await navigator.clipboard?.writeText(joinCode)
  }

  async function toggleCamera() {
    if (!roomRef.current || !canPublish) {
      return
    }

    try {
      await roomRef.current.localParticipant.setCameraEnabled(!cameraEnabled)
      setCameraEnabled(!cameraEnabled)
    } catch {
      setError('Не удалось включить камеру')
    }
  }

  async function toggleMicrophone() {
    if (!roomRef.current || !canPublish) {
      return
    }

    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!microphoneEnabled)
      setMicrophoneEnabled(!microphoneEnabled)
    } catch {
      setError('Не удалось включить микрофон')
    }
  }

  async function toggleScreen() {
    if (!roomRef.current || !canPublish) {
      return
    }

    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(!screenEnabled, {
        audio: true,
      })
      setScreenEnabled(!screenEnabled)
    } catch {
      setError('Не удалось включить демонстрацию экрана')
    }
  }

  async function handleStartAudio() {
    if (!roomRef.current) {
      return
    }

    try {
      await roomRef.current.startAudio()
    } catch {
      setError('Нажмите ещё раз, чтобы разрешить звук в браузере')
    }
  }

  async function handleEndRoom() {
    if (!roomId || !canPublish) {
      return
    }

    try {
      await endLiveRoom(roomId)
      roomRef.current?.disconnect()
      window.sessionStorage.removeItem(`live-session:${roomId}`)
      navigate('/live')
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message ?? 'Не удалось завершить трансляцию',
      )
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const nextMessage = messageText.trim()
    if (!nextMessage || !participantId) {
      return
    }

    setMessageText('')

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          message: nextMessage,
        }),
      )
      return
    }

    try {
      const message = await sendLiveMessage(roomId, participantId, nextMessage)
      setMessages((currentMessages) => [...currentMessages, { type: 'chat', ...message }])
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message ?? 'Не удалось отправить сообщение',
      )
    }
  }

  if (!session) {
    return (
      <div className="landing-shell live-public-shell">
        <section className="surface live-missing-session">
          <StatusState
            title="Нужно подключиться заново"
            description="Откройте трансляцию по коду, чтобы получить доступ к видео и чату."
            actionLabel="Войти по коду"
            actionOnClick={() => navigate('/live/join')}
          />
        </section>
      </div>
    )
  }

  return (
    <div className="landing-shell live-room-shell">
      <header className="landing-header">
        <Link className="brand-block" to="/">
          <div className="brand-mark">
            <img src="/logo_al-qalam.png" alt="" aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <h1>Al-Qalam</h1>
            <p>{roomTitle}</p>
          </div>
        </Link>
        <div className="live-room-status">
          <span className={`live-status-dot live-status-${connectionState}`} />
          {connectionState === 'connected' ? 'В эфире' : 'Подключение'}
        </div>
      </header>

      <main className="live-room-grid">
        <section className="surface live-stage">
          <div className="live-stage-head">
            <div>
              <h2>{roomTitle}</h2>
              <p>
                {joinCode ? `Код для входа: ${joinCode}` : 'Участник трансляции'}
              </p>
            </div>
            {joinCode ? (
              <Button variant="secondary" onClick={handleCopyCode}>
                <FiCopy />
                Код
              </Button>
            ) : null}
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          {canPublish ? (
            <div className="live-controls">
              <Button variant={cameraEnabled ? 'primary' : 'secondary'} onClick={toggleCamera}>
                <FiCamera />
                {cameraEnabled ? 'Камера вкл.' : 'Камера'}
              </Button>
              <Button
                variant={microphoneEnabled ? 'primary' : 'secondary'}
                onClick={toggleMicrophone}
              >
                <FiMic />
                {microphoneEnabled ? 'Микрофон вкл.' : 'Микрофон'}
              </Button>
              <Button variant={screenEnabled ? 'primary' : 'secondary'} onClick={toggleScreen}>
                <FiMonitor />
                {screenEnabled ? 'Экран вкл.' : 'Экран + звук'}
              </Button>
              <Button variant="danger" onClick={handleEndRoom}>
                <FiStopCircle />
                Завершить
              </Button>
            </div>
          ) : (
            <div className="live-controls">
              <Button variant="secondary" onClick={handleStartAudio}>
                <FiVolume2 />
                Разрешить звук
              </Button>
            </div>
          )}

          <div className="live-media-grid">
            {mediaTracks.length ? (
              mediaTracks.map((item) => <MediaTile key={item.id} item={item} />)
            ) : (
              <div className="live-empty-stage">
                <strong>Видео пока нет</strong>
                <p>
                  {canPublish
                    ? 'Включите камеру или демонстрацию экрана.'
                    : 'Дождитесь, пока преподаватель начнёт трансляцию.'}
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="surface live-chat">
          <div className="panel-headline">
            <div>
              <h3>Чат</h3>
              <p>Сообщения видны участникам этой трансляции.</p>
            </div>
          </div>

          <div className="live-chat-messages">
            {messages.length ? (
              messages.map((message) =>
                message.type === 'system' ? (
                  <div key={message.id} className="live-chat-system">
                    {message.message}
                  </div>
                ) : (
                  <article key={message.id} className="live-chat-message">
                    <div>
                      <strong>{message.display_name}</strong>
                      <span>{message.role}</span>
                    </div>
                    <p>{message.message}</p>
                  </article>
                ),
              )
            ) : (
              <p className="schedule-empty">Пока сообщений нет.</p>
            )}
          </div>

          <form className="live-chat-form" onSubmit={handleSendMessage}>
            <Input
              label="Сообщение"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Написать в чат"
            />
            <Button type="submit" disabled={!messageText.trim()}>
              <FiSend />
            </Button>
          </form>
        </aside>
      </main>
    </div>
  )
}

export default LiveRoomPage
