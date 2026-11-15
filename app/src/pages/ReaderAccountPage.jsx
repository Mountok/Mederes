import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheck, FiCreditCard, FiLogOut, FiUser, FiX } from 'react-icons/fi'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.jsx'
import { useReaderAccess } from '../auth/useReaderAccess.js'
import { MobileMenuButton } from '../components/MobileNavigation.jsx'
import api from '../api/client.js'
import PublicFooter from '../components/PublicFooter.jsx'

const PLANS = [
  { id: 'month', name: '1 месяц', price: 499, monthly: '499 ₽ в месяц' },
  { id: 'half-year', name: '6 месяцев', price: 2490, monthly: '415 ₽ в месяц' },
  { id: 'year', name: '12 месяцев', price: 3990, monthly: '332,50 ₽ в месяц' },
]

const rubles = amount => `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`

function PlanDialog({ open, onClose, email, readerId }) {
  const dialog = useRef(null)
  const [selectedId, setSelectedId] = useState('half-year')
  const [step, setStep] = useState('plans')
  const selected = PLANS.find(plan => plan.id === selectedId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const orderRef = useRef(null)

  async function checkout() {
    if (busy) return
    setBusy(true)
    setError('')
    if (orderRef.current?.plan !== selectedId) {
      orderRef.current = { plan: selectedId, requestId: crypto.randomUUID() }
    }
    try {
      const { data } = await api.post('/readers/payments', orderRef.current)
      localStorage.setItem('al-qalam-payment-' + readerId, data.id)
      window.location.assign(data.confirmationUrl)
    } catch (err) {
      if (err.response?.status === 409) orderRef.current = null
      setError(err.response?.data?.error?.message || 'Не удалось открыть оплату. Попробуйте ещё раз.')
      setBusy(false)
    }
  }

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
      <div className="reader-plan-heading"><h2 id="reader-plan-title">Выберите срок доступа</h2><p>Тестовый магазин ЮKassa. Используйте тестовую карту. Реальных списаний нет.</p></div>
      <div className="reader-plan-options" role="radiogroup" aria-label="Срок подписки">
        {PLANS.map(plan => <label key={plan.id} className={`reader-plan-option ${selectedId === plan.id ? 'is-selected' : ''}`}>
          <input type="radio" name="reader-plan" value={plan.id} checked={selectedId === plan.id} onChange={() => setSelectedId(plan.id)} />
          <span className="reader-plan-option-check" aria-hidden="true">{selectedId === plan.id && <FiCheck />}</span>
          <span className="reader-plan-option-copy"><strong>{plan.name}</strong><small>{plan.monthly}</small></span>
          <b>{rubles(plan.price)}</b>
        </label>)}
      </div>
      <button className="reader-plan-continue" type="button" onClick={() => setStep('checkout')}>Продолжить <FiArrowRight /></button>
    </> : <>
      <div className="reader-plan-heading"><h2 id="reader-plan-title">Тестовая оплата</h2><p>Подписка откроется после подтверждения ЮKassa. Оплата однократная.</p></div>
      <div className="reader-checkout-summary"><div><span>Тариф</span><strong>{selected.name}</strong></div><div><span>Аккаунт</span><strong>{email}</strong></div><div className="reader-checkout-total"><span>Стоимость за срок</span><strong>{rubles(selected.price)}</strong></div></div>
      {error && <p role="alert">{error}</p>}
      <button className="reader-plan-continue" type="button" disabled={busy} onClick={checkout}><FiCreditCard />{busy ? 'Открываем ЮKassa…' : 'Перейти к тестовой оплате'}</button>
      <Link className="reader-plan-terms" to="/terms" onClick={close}>Условия использования</Link>
    </>}
  </dialog>
}

export default function ReaderAccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { access, exhausted, error, refresh } = useReaderAccess(user)
  const [params, setParams] = useSearchParams()
  const storageKey = 'al-qalam-payment-' + user.id
  const paymentId = params.get('payment') || localStorage.getItem(storageKey)
  const [paymentState, setPaymentState] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!paymentId) return
    let active = true
    api.post('/readers/payments/' + encodeURIComponent(paymentId) + '/check').then(({data}) => {
      if (!active) return
      setPaymentState(data.status)
      if (data.status === 'succeeded' || data.status === 'canceled') {
        localStorage.removeItem(storageKey)
        if (data.status === 'succeeded') void refresh()
      }
    }).catch(() => { if (active) setPaymentState('error') })
    return () => { active = false }
  }, [paymentId, storageKey, refresh, retry])
  const plansOpen = params.get('plans') === '1'
  function setPlansOpen(open) {
    setParams(previous => {
      const next = new URLSearchParams(previous)
      if (open) next.set('plans', '1')
      else next.delete('plans')
      return next
    }, { replace: true })
  }
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
        {paymentState && <section className="reader-payment-status" role="status">
          {paymentState === 'succeeded' ? 'ЮKassa подтвердила тестовую оплату. Подписка активирована.' : paymentState === 'canceled' ? 'Платёж отменён. Вы можете выбрать тариф ещё раз.' : paymentState === 'pending' ? 'ЮKassa ожидает завершения оплаты.' : 'Не удалось проверить платёж.'}
          {paymentId && ['pending','error'].includes(paymentState) && <button type="button" onClick={() => setRetry(n => n+1)}>Проверить статус</button>}
        </section>}
        <div className="reader-account-grid">
          <section className="reader-account-identity" aria-label="Данные аккаунта"><div className="reader-account-avatar" aria-hidden="true">{initial}</div><h2>{name}</h2><p>{user?.login}</p><div className="reader-account-identity-detail"><span>Тип аккаунта</span><strong>Личный</strong></div><button type="button" onClick={signOut}><FiLogOut />Выйти из аккаунта</button></section>
          <section className="reader-account-access" aria-label="Подписка">
            <div className="reader-account-access-top"><span>Ваш доступ</span><span className="reader-account-access-mark" aria-hidden="true">اقرأ</span></div>
            <div aria-live="polite">
              {error ? <p>{error}</p> : !access ? <p>Загружаем данные…</p> : access.subscribed ? <>
                <h2>Подписка активна</h2>
                <p>Доступ до {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(access.subscriptionUntil))}.</p>
              </> : <>
                <span className="reader-account-status">Бесплатные проверки</span>
                <h2>Осталось {access.remaining} из {access.trialLimit}</h2>
                <p>{exhausted ? 'Чтобы продолжить практику с проверкой, нужна подписка.' : 'Одна запись с ответом сервиса считается одной проверкой.'}</p>
              </>}
            </div>
            {error ? <button type="button" onClick={refresh}>Обновить данные</button> : access && <button type="button" onClick={() => setPlansOpen(true)}>{access.subscribed ? 'Продлить доступ' : 'Посмотреть тарифы'} <FiArrowRight /></button>}
          </section>
        </div>
        <section className="reader-account-next"><div className="reader-account-next-icon"><FiBookOpen /></div><div><h2>{exhausted ? 'Послушать аяты' : 'Продолжить чтение'}</h2><p>{exhausted ? 'Прослушивание аятов остаётся доступным.' : 'Выберите суру и вернитесь к практике.'}</p></div><Link to="/practice" aria-label="Перейти к практике чтения"><FiArrowRight /></Link></section>
        <div className="reader-account-links"><Link to="/privacy">Обработка данных</Link><Link to="/terms">Условия использования</Link><a href="mailto:dashuev@internet.ru">Связаться с нами</a></div>
      </main>
      <PublicFooter />
    </div>
    <PlanDialog open={plansOpen} onClose={() => setPlansOpen(false)} readerId={user.id} email={user?.login || ''} />
  </div>
}
