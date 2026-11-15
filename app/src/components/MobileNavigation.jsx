import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import { FiBookOpen, FiClipboard, FiGrid, FiHome, FiLogIn, FiMenu, FiMic, FiShare, FiUser, FiUserPlus, FiX } from 'react-icons/fi'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'

const MenuContext = createContext(null)

function installed() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function MobileNavigationProvider({ children }) {
  const [openRouteKey, setOpenRouteKey] = useState(null)
  const trigger = useRef(null)
  const location = useLocation()
  const open = openRouteKey === location.key
  const openMenu = event => { trigger.current = event.currentTarget; setOpenRouteKey(location.key) }
  const closeMenu = () => setOpenRouteKey(null)

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    const opener = trigger.current
    document.body.style.overflow = 'hidden'
    const onKeyDown = event => { if (event.key === 'Escape') closeMenu() }
    const onResize = () => { if (window.innerWidth > 720) closeMenu() }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      opener?.focus()
    }
  }, [open])

  return <MenuContext.Provider value={{ open, openMenu, closeMenu }}>{children}</MenuContext.Provider>
}

export function MobileMenuButton() {
  const menu = useContext(MenuContext)
  return <button type="button" className="mobile-menu-trigger" aria-label="Открыть меню" aria-expanded={menu.open} aria-controls="mobile-navigation-drawer" onClick={menu.openMenu}><FiMenu aria-hidden="true" /></button>
}

export default function MobileNavigation() {
  const { user, school, isTeacher, logout } = useAuth()
  const { open, closeMenu } = useContext(MenuContext)
  const closeButton = useRef(null)
  const [installEvent, setInstallEvent] = useState(null)
  const [isInstalled, setIsInstalled] = useState(installed)
  const close = closeMenu
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => { if (open) closeButton.current?.focus() }, [open])

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

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    setInstallEvent(null)
  }

  const links = user?.role === 'platform_admin' ? [
    { to: '/platform', label: 'Школы', icon: FiGrid },
    { to: '/practice', label: 'Практика чтения', icon: FiMic },
  ] : user?.role === 'reader' ? [
    { to: '/', label: 'Главная', icon: FiHome },
    { to: '/practice', label: 'Практика чтения', icon: FiMic },
    { to: '/account', label: 'Мой профиль', icon: FiUser },
  ] : user ? [
    { to: '/groups', label: 'Группы', icon: FiGrid },
    ...(user.role === 'parent' ? [] : [{ to: '/homework', label: 'Задания', icon: FiClipboard }]),
    { to: '/quran', label: 'Коран', icon: FiBookOpen },
    { to: '/practice', label: 'Практика чтения', icon: FiMic },
    ...(isTeacher ? [{ to: '/staff', label: 'Преподаватели', icon: FiUserPlus }] : []),
  ] : [
    { to: '/', label: 'Главная', icon: FiHome },
    { to: '/practice', label: 'Практика чтения', icon: FiMic },
    { to: '/login', label: 'Вход в журнал', icon: FiLogIn },
  ]

  if (!open) return null
  return <div className="mobile-drawer-layer">
    <button type="button" className="mobile-drawer-backdrop" aria-label="Закрыть меню" onClick={close} />
    <aside className="mobile-drawer" id="mobile-navigation-drawer" role="dialog" aria-modal="true" aria-label="Меню Al-Qalam">
      <div className="mobile-drawer-head"><div><strong>Al-Qalam</strong><small>{school?.name || (user ? 'Личный кабинет' : 'Чтение и обучение')}</small></div><button ref={closeButton} type="button" onClick={close} aria-label="Закрыть меню"><FiX aria-hidden="true" /></button></div>
      <nav aria-label="Разделы Al-Qalam">{links.map(({ to, label, icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={close}>{createElement(icon, { 'aria-hidden': true })}<span>{label}</span></NavLink>)}</nav>
      <div className="mobile-drawer-foot">
        {!isInstalled && installEvent && <button type="button" onClick={install}><FiShare aria-hidden="true" />Добавить на главный экран</button>}
        {!isInstalled && isAppleMobile && !installEvent && <p className="mobile-install-hint">Чтобы установить приложение, нажмите «Поделиться» в Safari и выберите «На экран Домой».</p>}
        {!isInstalled && !isAppleMobile && !installEvent && <p className="mobile-install-hint">Добавить приложение можно через меню браузера.</p>}
        {user && <button type="button" onClick={() => { close(); logout() }}><FiLogIn aria-hidden="true" />Выйти</button>}
      </div>
    </aside>
  </div>
}
