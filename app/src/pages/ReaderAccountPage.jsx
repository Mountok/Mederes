import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheck, FiCreditCard, FiLogOut, FiUser, FiX } from 'react-icons/fi'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'
import { MobileMenuButton } from '../components/MobileNavigation.jsx'
import PublicFooter from '../components/PublicFooter.jsx'

const PLANS = [
  { id: 'month', name: '1 месяц', price: 499, monthly: '499 ₽ в месяц' },
  { id: 'half-year', name: '6 месяцев', price: 2490, monthly: '415 ₽ в месяц' },
  { id: 'year', name: '12 месяцев', price: 3990, monthly: '332,50 ₽ в месяц' },
]

const rubles = amount => `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`

function PlanDialog({ open, onClose, email }) {
  const dialog = useRef(null)
  const [selectedId, setSelectedId] = useState('half-year')
  const [renewal, setRenewal] = useState('manual')
  const [step, setStep] = useState('plans')
  const selected = PLANS.find(plan => plan.id === selectedId)

  useEffect(() => {
    if (!dialog.current) return
    if (open && !dialog.current.open) dialog.current.showModal()
    if (!open && dialog.current.open) dialog.current.close()
  }, [open])

  function close() {
    onClose()
    setStep('plans')
  }

  return <dialog ref={dialog} className="reader-plan-dialog" aria-labelledby="reader-plan-title" onClose={close}>
    <div className="reader-plan-top">
      {step === 'checkout' ? <button className="reader-plan-back" type="button" onClick={() => setStep('plans')} aria-label="Вернуться к тарифам"><FiArrowLeft /></button> : <span className="reader-plan-brand">Al-Qalam</span>}
      <button className="reader-plan-close" type="button" onClick={close} aria-label="Закрыть окно"><FiX /></button>
    </div>
    {step === 'plans' ? <>
      <div className="reader-plan-heading"><h2 id="reader-plan-title">Выберите срок доступа</h2><p>Практика чтения в личном аккаунте. Цены предварительные, приём оплаты ещё не открыт.</p></div>
      <div className="reader-plan-options" role="radiogroup" aria-label="Срок подписки">
        {PLANS.map(plan => <label key={plan.id} className={`reader-plan-option ${selectedId === plan.id ? 'is-selected' : ''}`}>
          <input type="radio" name="reader-plan" value={plan.id} checked={selectedId === plan.id} onChange={() => setSelectedId(plan.id)} />
          <span className="reader-plan-option-check" aria-hidden="true">{selectedId === plan.id && <FiCheck />}</span>
          <span className="reader-plan-option-copy"><strong>{plan.name}</strong><small>{plan.monthly}</small></span>
          <b>{rubles(plan.price)}</b>
        </label>)}
      </div>
      <div className="reader-plan-renewal"><h3>Продление</h3><label><input type="radio" name="reader-renewal" checked={renewal === 'manual'} onChange={() => setRenewal('manual')} />Оплачу следующий срок сам</label><label><input type="radio" name="reader-renewal" checked={renewal === 'auto'} onChange={() => setRenewal('auto')} />Продлевать автоматически</label><p>Автопродление будет включаться только после отдельного согласия при оплате.</p></div>
      <button className="reader-plan-continue" type="button" onClick={() => setStep('checkout')}>Посмотреть оформление <FiArrowRight /></button>
    </> : <>
      <div className="reader-plan-heading"><h2 id="reader-plan-title">Оформление доступа</h2><p>Так будет выглядеть шаг перед оплатой после подключения платёжного сервиса.</p></div>
      <div className="reader-checkout-summary"><div><span>Тариф</span><strong>{selected.name}</strong></div><div><span>Продление</span><strong>{renewal === 'manual' ? 'Вручную' : 'Автоматически'}</strong></div><div><span>Аккаунт</span><strong>{email}</strong></div><div className="reader-checkout-total"><span>К оплате</span><strong>{rubles(selected.price)}</strong></div></div>
      <div className="reader-checkout-notice"><FiCreditCard aria-hidden="true" /><p>Покупка пока недоступна. Деньги не списываются, тариф не активируется.</p></div>
      <button className="reader-plan-continue" type="button" disabled>Оплата пока недоступна</button>
      <Link className="reader-plan-terms" to="/terms" onClick={close}>Условия использования</Link>
    </>}
  </dialog>
}

export default function ReaderAccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [plansOpen, setPlansOpen] = useState(false)
  const name = user?.label || 'Читатель'
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase('ru-RU') || 'А'

  function signOut() {
    logout()
    navigate('/', { replace: true })
  }

  return <div className="reader-account-shell">
    <aside className="reader-account-sidebar" aria-label="Личная навигация">
      <Link className="reader-account-brand" to="/"><img src="/logo_al-qalam.png" alt="" />Al-Qalam</Link>
      <nav><NavLink to="/practice"><FiBookOpen />Практика чтения</NavLink><NavLink to="/account"><FiUser />Мой профиль</NavLink></nav>
      <div className="reader-account-sidebar-foot"><span>{name}</span><button type="button" onClick={signOut}><FiLogOut />Выйти</button></div>
    </aside>
    <div className="reader-account-workspace">
      <header className="reader-account-header"><Link to="/" className="reader-account-mobile-brand"><img src="/logo_al-qalam.png" alt="" />Al-Qalam</Link><span>Личный кабинет</span><MobileMenuButton /></header>
      <main className="reader-account-main">
        <div className="reader-account-title"><div><h1>Мой профиль</h1><p>Ваш аккаунт и доступ к практике чтения.</p></div><Link to="/practice" className="reader-account-practice-link">Открыть практику <FiArrowRight /></Link></div>
        <div className="reader-account-grid">
          <section className="reader-account-identity" aria-label="Данные аккаунта"><div className="reader-account-avatar" aria-hidden="true">{initial}</div><h2>{name}</h2><p>{user?.login}</p><div className="reader-account-identity-detail"><span>Тип аккаунта</span><strong>Личный</strong></div><button type="button" onClick={signOut}><FiLogOut />Выйти из аккаунта</button></section>
          <section className="reader-account-access" aria-label="Подписка"><div className="reader-account-access-top"><span>Ваш доступ</span><span className="reader-account-access-mark" aria-hidden="true">اقرأ</span></div><div><span className="reader-account-status">Без подписки</span><h2>Бесплатный доступ</h2><p>Платная подписка пока не оформлена. После запуска оплаты здесь появятся срок действия и управление продлением.</p></div><button type="button" onClick={() => setPlansOpen(true)}>Посмотреть тарифы <FiArrowRight /></button></section>
        </div>
        <section className="reader-account-next"><div className="reader-account-next-icon"><FiBookOpen /></div><div><h2>Продолжить чтение</h2><p>Выберите суру и вернитесь к практике.</p></div><Link to="/practice" aria-label="Перейти к практике чтения"><FiArrowRight /></Link></section>
        <div className="reader-account-links"><Link to="/privacy">Обработка данных</Link><Link to="/terms">Условия использования</Link><a href="mailto:dashuev@internet.ru">Связаться с нами</a></div>
      </main>
      <PublicFooter />
    </div>
    <PlanDialog open={plansOpen} onClose={() => setPlansOpen(false)} email={user?.login || ''} />
  </div>
}
