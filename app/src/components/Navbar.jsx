import { FiArrowLeft, FiBookOpen, FiUserPlus, FiClipboard } from 'react-icons/fi'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'

function Navbar() {
  const location = useLocation()
  const { user, school, logout, isTeacher } = useAuth()

  return (
    <header className="navbar">
      <div className="navbar-row">
        <NavLink className="brand-block" to="/groups">
          <div className="brand-mark">
            <img src="/logo_al-qalam.png" alt="" aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <h1>Al-Qalam</h1>
            <p>{school?.name ?? 'Учебные группы'}</p>
          </div>
        </NavLink>

        <div className="navbar-account">
          <span className="nav-role">{user?.label}</span>
          <button type="button" className="nav-link nav-logout" onClick={logout}>Выйти</button>
        </div>
      </div>

      <nav className="nav-links" aria-label="Основная навигация">
        <NavLink className="nav-link" to="/ai-test">Практика чтения</NavLink>
        <NavLink className="nav-link" to="/groups">Группы</NavLink>
        {user?.role !== 'parent' && <NavLink className="nav-link" to="/homework"><FiClipboard /> Задания</NavLink>}
        <NavLink className="nav-link nav-link-quran" to="/quran"><FiBookOpen />Коран</NavLink>
        {isTeacher && <NavLink className="nav-link" to="/staff"><FiUserPlus />Преподаватели</NavLink>}
      </nav>

      {location.pathname !== '/groups' ? (
        <div className="filter-row navbar-back-row">
          <NavLink className="button button-secondary navbar-back-button" to="/groups">
            <FiArrowLeft />
            Вернуться к группам
          </NavLink>
        </div>
      ) : null}
    </header>
  )
}

export default Navbar
