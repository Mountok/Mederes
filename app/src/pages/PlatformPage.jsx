import { useEffect, useMemo, useState } from 'react'
import { FiArrowRight, FiCheck, FiCopy, FiLogOut, FiPlus, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth.jsx'
import { createPlatformSchool, getPlatformSchool, listPlatformSchools, renamePlatformSchool, resetPlatformAccess } from '../api/platformApi.js'
import './PlatformPage.css'

function errorText(error) {
  return error?.response?.data?.error?.message || 'Не удалось выполнить действие. Попробуйте ещё раз.'
}

function Credentials({ account, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!account) return null
  async function copy() {
    await navigator.clipboard.writeText(`Логин: ${account.login}\nПароль: ${account.password}`)
    setCopied(true)
  }
  return <div className="platform-secret" role="dialog" aria-modal="true" aria-label="Новые данные для входа">
    <div className="platform-secret-card">
      <button className="platform-icon-button platform-secret-close" type="button" onClick={onClose} aria-label="Закрыть"><FiX /></button>
      <span className="platform-kicker">ДОСТУП СОЗДАН</span>
      <h2>Сохраните данные для входа</h2>
      <p>Пароль показывается только сейчас. Передайте его пользователю лично.</p>
      <dl><dt>Логин</dt><dd>{account.login}</dd><dt>Пароль</dt><dd>{account.password}</dd></dl>
      <button type="button" className="platform-button" onClick={copy}>{copied ? <FiCheck /> : <FiCopy />}{copied ? 'Скопировано' : 'Скопировать'}</button>
    </div>
  </div>
}

export default function PlatformPage() {
  const { user, logout } = useAuth()
  const [schools, setSchools] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', adminLogin: '', adminLabel: '' })
  const [rename, setRename] = useState('')
  const [secret, setSecret] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listPlatformSchools().then(items => { if (active) setSchools(items) }).catch(err => { if (active) setError(errorText(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedId) return undefined
    let active = true
    getPlatformSchool(selectedId).then(item => { if (active) { setDetail(item); setRename(item.school.name) } }).catch(err => { if (active) setError(errorText(err)) })
    return () => { active = false }
  }, [selectedId])

  const filtered = useMemo(() => schools.filter(school => school.name.toLowerCase().includes(query.toLowerCase().trim())), [schools, query])
  const totals = useMemo(() => schools.reduce((sum, school) => ({ students: sum.students + school.studentCount, groups: sum.groups + school.groupCount }), { students: 0, groups: 0 }), [schools])

  async function create(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await createPlatformSchool(form)
      setSchools(previous => [result.school, ...previous])
      setShowCreate(false)
      setForm({ name: '', adminLogin: '', adminLabel: '' })
      setSelectedId(result.school.id)
      setSecret(result.account)
    } catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  async function saveName(event) {
    event.preventDefault()
    if (!detail) return
    setBusy(true); setError('')
    try {
      const updated = await renamePlatformSchool(detail.school.id, rename)
      setSchools(previous => previous.map(item => item.id === updated.id ? updated : item))
      setDetail(previous => ({ ...previous, school: updated }))
    } catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  async function reset(userId, label) {
    if (!window.confirm(`Создать новый пароль для «${label}»? Прежний пароль перестанет работать.`)) return
    setBusy(true); setError('')
    try { setSecret(await resetPlatformAccess(detail.school.id, userId)) }
    catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  return <div className="platform-page">
    <header className="platform-topbar"><a href="/platform" className="platform-brand"><img src="/logo_al-qalam.png" alt="" />Al-Qalam <span>Управление</span></a><div><span>{user?.label}</span><button type="button" onClick={logout}><FiLogOut /> Выйти</button></div></header>
    <main className="platform-main">
      <div className="platform-title"><div><span className="platform-kicker">ПАНЕЛЬ ПЛАТФОРМЫ</span><h1>Школы</h1><p>Учётные записи, состав и доступ в одном месте.</p></div><button type="button" className="platform-button" onClick={() => { setShowCreate(true); setSelectedId(''); setDetail(null); setError('') }}><FiPlus /> Добавить школу</button></div>
      <div className="platform-stats"><div><strong>{schools.length}</strong><span>Школ</span></div><div><strong>{totals.groups}</strong><span>Групп</span></div><div><strong>{totals.students}</strong><span>Учеников</span></div></div>
      {error && <div className="platform-error" role="alert">{error}</div>}
      <div className="platform-content"><section className="platform-list" aria-label="Список школ"><div className="platform-list-head"><h2>Все школы</h2><label><FiSearch /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти школу" aria-label="Найти школу" /></label></div>
        {loading ? <p className="platform-empty">Загружаем школы…</p> : filtered.length ? filtered.map(school => <button key={school.id} type="button" className={`platform-school-row ${selectedId === school.id ? 'is-selected' : ''}`} onClick={() => { setSelectedId(school.id); setShowCreate(false); setError('') }}><span className="platform-school-avatar">{school.name.slice(0, 1).toUpperCase()}</span><span className="platform-school-main"><strong>{school.name}</strong><small>{school.groupCount} групп · {school.studentCount} учеников · {school.staffCount} преподавателей</small></span><FiArrowRight /></button>) : <p className="platform-empty">Школы не найдены</p>}
      </section>
      <aside className="platform-side">
        {showCreate ? <section className="platform-panel"><div className="platform-panel-head"><span className="platform-kicker">НОВАЯ ШКОЛА</span><button className="platform-icon-button" type="button" onClick={() => setShowCreate(false)} aria-label="Закрыть"><FiX /></button></div><h2>Добавить школу</h2><p>Администратор школы получит доступ к группам и сможет создавать преподавателей.</p><form onSubmit={create} className="platform-form"><label>Название школы<input required maxLength="120" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Логин администратора<input required minLength="4" maxLength="40" pattern="[A-Za-z0-9._-]+" autoCapitalize="none" value={form.adminLogin} onChange={event => setForm({ ...form, adminLogin: event.target.value })} /></label><label>Имя администратора<input maxLength="80" value={form.adminLabel} onChange={event => setForm({ ...form, adminLabel: event.target.value })} placeholder="Администратор школы" /></label><p className="platform-note">Надёжный пароль сгенерируется автоматически и будет показан один раз.</p><button className="platform-button" disabled={busy} type="submit">{busy ? 'Создаём…' : 'Создать школу'}</button></form></section>
        : detail ? <section className="platform-panel"><div className="platform-panel-head"><span className="platform-kicker">ШКОЛА</span><button className="platform-icon-button" type="button" onClick={() => { setSelectedId(''); setDetail(null) }} aria-label="Закрыть"><FiX /></button></div><h2>{detail.school.name}</h2><p>{detail.school.groupCount} групп · {detail.school.studentCount} учеников</p><form className="platform-form platform-rename" onSubmit={saveName}><label>Название школы<input required maxLength="120" value={rename} onChange={event => setRename(event.target.value)} /></label><button type="submit" disabled={busy || rename.trim() === detail.school.name}>Сохранить название</button></form><div className="platform-users"><h3>Администраторы и преподаватели</h3>{detail.users.map(item => <div className="platform-user" key={item.id}><div><strong>{item.label}</strong><span>{item.role === 'teacher' ? 'Администратор школы' : 'Преподаватель'} · {item.login}</span></div><button type="button" disabled={busy} onClick={() => reset(item.id, item.label)} title="Сбросить пароль"><FiRefreshCw /><span>Новый пароль</span></button></div>)}</div><p className="platform-note">Учениками и занятиями управляет администратор своей школы. Пароли здесь не хранятся в открытом виде.</p></section>
        : <section className="platform-panel platform-placeholder"><span className="platform-kicker">ОБЗОР</span><h2>Выберите школу</h2><p>Откройте её состав и настройки доступа.</p></section>}
      </aside></div>
    </main>
    <Credentials account={secret} onClose={() => setSecret(null)} />
  </div>
}
