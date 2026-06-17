import {
  FiArrowRight,
  FiBookOpen,
  FiCheckSquare,
  FiHome,
  FiLogIn,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'

const BENEFITS = [
  {
    icon: FiBookOpen,
    title: 'Для учителей',
    description: 'Ведите группы, уроки, посещаемость и баллы в одном рабочем месте.',
  },
  {
    icon: FiUsers,
    title: 'Для родителей',
    description: 'Смотрите только важное: посещаемость, баллы и прогресс ребёнка.',
  },
  {
    icon: FiHome,
    title: 'Для медресе',
    description: 'Держите учебный процесс в порядке без сложных таблиц и лишней рутины.',
  },
]

const STEPS = [
  'Создайте группы и добавьте учеников.',
  'Проводите уроки и отмечайте посещаемость.',
  'Родители видят результаты без лишних действий.',
]

function LandingPage() {
  const { user } = useAuth()
  const primaryHref = user ? '/groups' : '/login'
  const primaryLabel = user ? 'Открыть журнал' : 'Войти'

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <Link className="brand-block" to="/">
          <div className="brand-mark">
            <img src="/logo_al-qalam.png" alt="" aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <h1>Al-Qalam</h1>
            <p>Электронный журнал для медресе</p>
          </div>
        </Link>

        <nav className="landing-nav" aria-label="Навигация по странице">
          <a className="nav-link" href="#benefits">
            Возможности
          </a>
          <a className="nav-link" href="#workflow">
            Как это работает
          </a>
          <Link className="button button-secondary" to={primaryHref}>
            <FiLogIn />
            {primaryLabel}
          </Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-kicker">Простой журнал для учителей и родителей</span>
            <h2>Электронный журнал для медресе</h2>
            <p>
              Al-Qalam помогает быстро вести занятия, отмечать посещаемость и
              открывать родителям только нужную информацию.
            </p>

            <div className="hero-actions">
              <Link className="button button-primary" to={primaryHref}>
                {primaryLabel}
              </Link>
              <a className="button button-ghost" href="#benefits">
                Узнать больше
                <FiArrowRight />
              </a>
            </div>

            <div className="landing-points">
              <span>
                <FiShield />
                Быстро и понятно
              </span>
              <span>
                <FiCheckSquare />
                Учёт за один экран
              </span>
              <span>
                <FiUsers />
                Отдельный режим для родителей
              </span>
            </div>
          </div>

          <div className="preview-card" aria-hidden="true">
            <div className="preview-topbar">
              <div className="preview-brand">
                <div className="preview-dot" />
                <strong>Журнал</strong>
              </div>
              <span className="preview-badge">Сегодня</span>
            </div>

            <div className="preview-columns">
              <div className="preview-panel">
                <h3>Группы</h3>
                <div className="preview-item">
                  <strong>Тафсир</strong>
                  <span>18 учеников</span>
                </div>
                <div className="preview-item">
                  <strong>Хифз</strong>
                  <span>14 учеников</span>
                </div>
                <div className="preview-item">
                  <strong>Фикх</strong>
                  <span>11 учеников</span>
                </div>
              </div>

              <div className="preview-panel">
                <h3>Урок</h3>
                <div className="preview-row">
                  <span>Ахмад</span>
                  <span className="preview-status success">Был</span>
                  <span>5</span>
                </div>
                <div className="preview-row">
                  <span>Иса</span>
                  <span className="preview-status danger">Не был</span>
                  <span>4</span>
                </div>
                <div className="preview-row">
                  <span>Юсуф</span>
                  <span className="preview-status success">Был</span>
                  <span>5</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="benefits">
          <div className="landing-section-head">
            <h3>Зачем нужен журнал</h3>
            <p>Только те функции, которые действительно помогают в ежедневной работе.</p>
          </div>

          <div className="benefit-grid">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title} className="benefit-card">
                <div className="benefit-icon">
                  <benefit.icon />
                </div>
                <h4>{benefit.title}</h4>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" id="workflow">
          <div className="landing-section-head">
            <h3>Как это работает</h3>
            <p>Сценарий построен так, чтобы преподаватель тратил минимум времени.</p>
          </div>

          <div className="steps-grid">
            {STEPS.map((step, index) => (
              <article key={step} className="step-card">
                <span className="step-index">0{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <h3>Готово для повседневной работы медресе</h3>
            <p>Учитель быстро отмечает урок, а родитель видит результат без лишних действий.</p>
          </div>
          <Link className="button button-primary" to={primaryHref}>
            {primaryLabel}
          </Link>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
