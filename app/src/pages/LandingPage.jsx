import { FiArrowRight, FiBookOpen, FiCheckCircle, FiHeadphones, FiHome, FiLogIn, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'

const FEATURES = [
  { icon: FiUsers, title: 'Группы и ученики', description: 'Занятия, преподаватели и учебные группы в одном месте.' },
  { icon: FiCheckCircle, title: 'Электронный журнал', description: 'Посещаемость, оценки и домашние задания.' },
  { icon: FiBookOpen, title: 'Коран', description: '114 сур, перевод и прослушивание по аятам.' },
  { icon: FiHome, title: 'Личный кабинет', description: 'Всё нужное для преподавателя, ученика и родителя.' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const href = user ? '/groups' : '/login'
  const label = user ? 'Открыть журнал' : 'Войти'
  return <div className="landing-shell">
    <header className="landing-header">
      <Link className="brand-block" to="/"><div className="brand-mark"><img src="/logo_al-qalam.png" alt="" /></div><div className="brand-copy"><h1>Al-Qalam</h1><p>Учиться. Читать. Развиваться.</p></div></Link>
      <nav className="landing-nav" aria-label="Основная навигация"><a className="nav-link" href="#product">Возможности</a><Link className="nav-link" to="/ai-test">Практика чтения</Link><Link className="button button-secondary" to={href}><FiLogIn />{label}</Link></nav>
    </header>
    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-copy"><h2>Ближе к знаниям.<br />Аят за аятом.</h2><p className="landing-lead">Коран, практика чтения и учебный журнал — в одном пространстве Al-Qalam.</p><div className="hero-actions"><Link className="button button-primary" to="/ai-test">Начать чтение<FiArrowRight /></Link><Link className="button button-ghost" to={href}>Учебный кабинет<FiArrowRight /></Link></div></div>
        <Link className="ai-preview landing-reading-preview" to="/ai-test" aria-label="Открыть практику чтения суры Аль-Ихляс"><div className="ai-preview-head"><div><span className="eyebrow">Практика чтения</span><strong>Аль-Ихляс</strong></div><span className="landing-surah-index">112</span></div><p className="landing-preview-arabic" lang="ar" dir="rtl">قُلْ هُوَ اللَّهُ أَحَدٌ</p><div className="landing-preview-bottom"><span><FiHeadphones />Слушайте и читайте</span><FiArrowRight /></div></Link>
      </section>
      <section className="landing-section" id="product"><div className="landing-section-head"><h3>Всё для ваших занятий</h3></div><div className="benefit-grid product-grid">{FEATURES.map(feature => <article key={feature.title} className="benefit-card"><div className="benefit-icon"><feature.icon /></div><h4>{feature.title}</h4><p>{feature.description}</p></article>)}</div></section>
      <section className="landing-cta" id="pilot"><div><h3>Время для чтения</h3><p>Послушайте аят и попробуйте прочитать самостоятельно.</p></div><Link className="button button-primary" to="/ai-test">Открыть практику<FiArrowRight /></Link></section>
    </main>
  </div>
}
