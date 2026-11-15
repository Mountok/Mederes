import { useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiUsers } from 'react-icons/fi'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'
import PublicFooter from '../components/PublicFooter.jsx'

export default function ReaderAuthPage() {
  const { user, readerAuth } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('choose')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [adultConfirmed, setAdultConfirmed] = useState(false)

  if (user) return <Navigate to={user.role === 'platform_admin' ? '/platform' : user.role === 'reader' ? '/practice' : '/groups'} replace />

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const result = await readerAuth(mode, { name, email, password, privacyConsent, termsAccepted, adultConfirmed })
    setBusy(false)
    if (!result.ok) { setError(result.message); return }
    navigate('/practice', { replace: true })
  }

  return <div className="reader-auth-page">
    <header className="reader-auth-header"><Link className="reader-auth-brand" to="/"><img src="/logo_al-qalam.png" alt="" />Al-Qalam</Link><Link to="/login">Вход в журнал</Link></header>
    <main className="reader-auth-main">
      <div className="reader-auth-intro"><p lang="ar" dir="rtl">اقْرَأْ</p><h1>Время читать.</h1><span>Выберите суру, слушайте по аятам и читайте вслух. Слова подсветятся по мере распознавания.</span></div>
      <section className="reader-auth-card" aria-label="Регистрация и вход">
        <div className="reader-auth-switch" role="group" aria-label="Регистрация или вход">
          <button type="button" className={mode !== 'login' ? 'is-active' : ''} aria-pressed={mode !== 'login'} disabled={busy} onClick={() => { setMode('choose'); setError('') }}>Регистрация</button>
          <button type="button" className={mode === 'login' ? 'is-active' : ''} aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setError('') }}>Вход</button>
        </div>
        {mode === 'choose' ? <>
          <h2>Выберите профиль</h2>
          <div className="reader-profile-choices">
            <button type="button" onClick={() => setMode('register')}>
              <FiBookOpen aria-hidden="true" /><span><strong>Личный</strong><small>Практика чтения · 3 бесплатные проверки</small></span><FiArrowRight aria-hidden="true" />
            </button>
            <Link to="/for-schools">
              <FiUsers aria-hidden="true" /><span><strong>Организация</strong><small>Подать заявку на журнал для школы или медресе</small></span><FiArrowRight aria-hidden="true" />
            </Link>
          </div>
        </> : <>
          {mode === 'register' && <button type="button" className="reader-profile-back" disabled={busy} onClick={() => setMode('choose')}><FiArrowLeft aria-hidden="true" />Тип профиля</button>}
          <h2>{mode === 'register' ? 'Личный профиль' : 'Вход в личный профиль'}</h2>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Как к вам обращаться<input autoComplete="name" required maxLength="80" value={name} onChange={event => setName(event.target.value)} /></label>}
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>Пароль<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 12 : undefined} required value={password} onChange={event => setPassword(event.target.value)} /></label>
          {mode === 'register' && <p className="reader-auth-hint">Не меньше 12 символов.</p>}
          {mode === 'register' && <div className="reader-auth-consents"><label><input type="checkbox" checked={privacyConsent} onChange={event => setPrivacyConsent(event.target.checked)} required /><span>Даю <Link to="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</Link>. С <Link to="/privacy" target="_blank" rel="noopener noreferrer">политикой обработки данных</Link> ознакомлен(а).</span></label><label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required /><span>Принимаю <Link to="/terms" target="_blank" rel="noopener noreferrer">условия использования</Link>.</span></label><label><input type="checkbox" checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} required /><span>Мне исполнилось 18 лет. Для детей доступ к практике предоставляет школа.</span></label></div>}
          {error && <p className="reader-auth-error" role="alert">{error}</p>}
          <button className="reader-auth-submit" type="submit" disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт' : 'Войти в практику'}</button>
        </form>
        </>}
      </section>
    </main>
    <PublicFooter />
  </div>
}
