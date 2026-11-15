import { FiArrowRight, FiHeadphones, FiLogIn, FiMic, FiUser, FiVolume2 } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'
import { MobileMenuButton } from '../components/MobileNavigation.jsx'
import PublicFooter from '../components/PublicFooter.jsx'

export default function LandingPage() {
  const { user } = useAuth()
  const href = user?.role === 'platform_admin' ? '/platform' : user && user.role !== 'reader' ? '/groups' : '/login'
  const journalLabel = user && user.role !== 'reader' ? 'Открыть журнал' : 'Вход в журнал'
  return <div className="landing-shell">
    <header className="landing-header">
      <Link className="brand-block" to="/"><div className="brand-mark"><img src="/logo_al-qalam.png" alt="" /></div><div className="brand-copy"><h1>Al-Qalam</h1><p>Практика чтения Корана</p></div></Link>
      <nav className="landing-nav" aria-label="Основная навигация"><Link className="nav-link" to="/practice">Практика</Link>{user?.role === 'reader' && <Link className="nav-link" to="/account"><FiUser />Профиль</Link>}<Link className="button button-secondary" to={href}><FiLogIn />{journalLabel}</Link></nav><MobileMenuButton />
    </header>
    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-copy"><h2>Читайте Коран<br />в своём ритме.</h2><p className="landing-lead">Выберите суру, послушайте аят и прочитайте вслух. Во время чтения Al-Qalam подсветит слова, которые удалось распознать, и места для повторной проверки.</p><div className="hero-actions"><Link className="button button-primary" to="/practice">Начать практику<FiArrowRight /></Link></div><p className="landing-honesty">Подсветка предварительная: произношение и таджвид она пока не оценивает.</p></div>
        <Link className="ai-preview landing-reading-preview" to="/practice" aria-label="Открыть практику чтения суры Аль-Ихляс"><div className="ai-preview-head"><div><span className="eyebrow">Попробуйте прочитать</span><strong>Аль-Ихляс</strong></div><span className="landing-surah-index">112</span></div><p className="landing-preview-arabic" lang="ar" dir="rtl">قُلْ هُوَ اللَّهُ أَحَدٌ</p><div className="landing-preview-bottom"><span><FiHeadphones />Послушать аят</span><span>Открыть <FiArrowRight /></span></div></Link>
      </section>
      <section className="landing-section landing-practice-steps" aria-label="Как проходит практика"><div><FiVolume2 /><span>Слушайте аят</span></div><div><FiMic /><span>Читайте вслух</span></div><div><FiArrowRight /><span>Смотрите подсветку</span></div></section>
      <section className="landing-cta landing-school-entry"><div><h3>Для школ и преподавателей</h3><p>Группы, занятия, домашние задания и журнал — в учебном кабинете Al-Qalam. Обсудим, как подключить вашу школу.</p></div><Link className="button button-ghost" to="/for-schools">Оставить заявку<FiArrowRight /></Link></section>
    </main>
    <PublicFooter />
  </div>
}
