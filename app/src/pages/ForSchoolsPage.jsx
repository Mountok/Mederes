import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import PublicFooter from '../components/PublicFooter.jsx'

export default function ForSchoolsPage() {
  const [form, setForm] = useState({ schoolName: '', contactName: '', city: '', phone: '', email: '', message: '', consent: false, website: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const change = (field, value) => setForm(previous => ({ ...previous, [field]: value }))

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { await api.post('/school-inquiries', form); setSent(true) }
    catch (err) { setError(err?.response?.data?.error?.message || 'Не удалось отправить заявку. Напишите нам на dashuev@internet.ru.') }
    finally { setBusy(false) }
  }

  return <div className="schools-page"><header className="legal-header"><Link to="/" className="legal-brand"><img src="/logo_al-qalam.png" alt="" />Al-Qalam</Link><Link to="/">На главную</Link></header>
    <main className="schools-main"><div className="schools-intro"><h1>Al-Qalam для вашей школы</h1><p>Электронный журнал, занятия и домашние задания в одном месте. Расскажите о школе — мы свяжемся, обсудим процессы и предложим формат подключения.</p><div className="schools-steps"><span>Обсудим задачи</span><span>Покажем журнал</span><span>Согласуем запуск</span></div></div>
      <section className="schools-form-card" aria-label="Заявка школы"><h2>Оставить заявку</h2>{sent ? <div className="schools-success" role="status"><strong>Заявка отправлена</strong><p>Мы получили ваши контакты и свяжемся с вами, чтобы обсудить следующий шаг.</p><Link to="/">На главную</Link></div> : <form onSubmit={submit}>
        <label>Название школы или медресе<input required maxLength="120" value={form.schoolName} onChange={event => change('schoolName', event.target.value)} /></label>
        <label>Как к вам обращаться<input required maxLength="80" autoComplete="name" value={form.contactName} onChange={event => change('contactName', event.target.value)} /></label>
        <label>Город<input maxLength="120" value={form.city} onChange={event => change('city', event.target.value)} /></label>
        <div className="schools-form-row"><label>Телефон<input type="tel" maxLength="40" autoComplete="tel" value={form.phone} onChange={event => change('phone', event.target.value)} /></label><label>Email<input type="email" maxLength="254" autoComplete="email" value={form.email} onChange={event => change('email', event.target.value)} /></label></div>
        <p className="schools-form-hint">Укажите хотя бы телефон или email.</p>
        <label>Что хотите улучшить в работе школы?<textarea maxLength="1000" rows="4" value={form.message} onChange={event => change('message', event.target.value)} /></label>
        <label className="schools-consent"><input type="checkbox" required checked={form.consent} onChange={event => change('consent', event.target.checked)} /><span>Даю <Link to="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</Link> для ответа на заявку. С <Link to="/privacy" target="_blank" rel="noopener noreferrer">политикой</Link> ознакомлен(а).</span></label>
        <label className="schools-trap" aria-hidden="true">Ваш сайт<input tabIndex="-1" autoComplete="off" value={form.website} onChange={event => change('website', event.target.value)} /></label>
        {error && <p className="schools-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button>
      </form>}</section>
    </main><PublicFooter /></div>
}
