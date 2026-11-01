import { createElement, useEffect, useState } from 'react'
import { FiBookOpen, FiClipboard, FiGrid, FiHome, FiLogIn, FiMic, FiMoreHorizontal, FiShare, FiUserPlus, FiX } from 'react-icons/fi'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'

function installed() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function MobileTabBar() {
  const { user, school, isTeacher, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)
  const [isInstalled, setIsInstalled] = useState(installed)
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = event => { event.preventDefault(); setInstallEvent(event) }
    const onInstalled = () => { setIsInstalled(true); setInstallEvent(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    setInstallEvent(null)
  }

  const tabs = user ? [
    { to: '/groups', label: 'Группы', icon: FiGrid, active: /^\/(groups|group|lesson)(\/|$)/ },
    ...(user.role === 'parent' ? [] : [{ to: '/homework', label: 'Задания', icon: FiClipboard, active: /^\/homework(\/|$)/ }]),
    { to: '/quran', label: 'Коран', icon: FiBookOpen, active: /^\/quran(\/|$)/ },
    { to: '/ai-test', label: 'Чтение', icon: FiMic, active: /^\/ai-test(\/|$)/ },
  ] : [
    { to: '/', label: 'Главная', icon: FiHome, active: /^\/$/ },
    { to: '/ai-test', label: 'Чтение', icon: FiMic, active: /^\/ai-test(\/|$)/ },
    { to: '/login', label: 'Войти', icon: FiLogIn, active: /^\/login(\/|$)/ },
  ]

  return <>
    <nav className="mobile-tab-bar" aria-label="Навигация приложения">
      {tabs.map(({ to, label, icon, active }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={`mobile-tab ${active.test(location.pathname) ? 'is-active' : ''}`} aria-current={active.test(location.pathname) ? 'page' : undefined}>{createElement(icon, { 'aria-hidden': true })}<span>{label}</span></NavLink>)}
      <button type="button" className={`mobile-tab ${open ? 'is-active' : ''}`} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="mobile-more-sheet"><FiMoreHorizontal aria-hidden="true" /><span>Ещё</span></button>
    </nav>
    {open && <div className="mobile-more-layer" id="mobile-more-sheet">
      <button type="button" className="mobile-more-backdrop" aria-label="Закрыть меню" onClick={() => setOpen(false)} />
      <section className="mobile-more-sheet" aria-label="Дополнительно">
        <div className="mobile-more-heading"><div><strong>Al-Qalam</strong>{user && <small>{school?.name || user.label}</small>}</div><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><FiX /></button></div>
        {isTeacher && <NavLink to="/staff"><FiUserPlus /> Преподаватели</NavLink>}
        {!isInstalled && installEvent && <button type="button" onClick={install}><FiShare /> Добавить на главный экран</button>}
        {!isInstalled && isAppleMobile && !installEvent && <p className="mobile-install-hint">Чтобы установить приложение, нажмите «Поделиться» в Safari и выберите «На экран Домой».</p>}
        {!isInstalled && !isAppleMobile && !installEvent && <p className="mobile-install-hint">Добавить приложение можно через меню браузера «Установить приложение» или «Добавить на главный экран».</p>}
        {user ? <button type="button" onClick={() => { setOpen(false); logout() }}><FiLogIn /> Выйти</button> : <NavLink to="/login"><FiLogIn /> Войти</NavLink>}
      </section>
    </div>}
  </>
}
