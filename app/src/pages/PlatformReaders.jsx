import { useEffect, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { listPlatformReaders, resetReaderTrial, setReaderSubscription } from '../api/platformApi.js'

function readerStatus(reader) {
  if (!reader.subscriptionUntil) return 'Пробный доступ'
  const end = new Date(reader.subscriptionUntil)
  return end > new Date() ? `Подписка до ${end.toLocaleDateString('ru-RU')}` : 'Подписка закончилась'
}

function ReaderDetails({ reader, limit, onUpdate, onBack }) {
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const active = Date.parse(reader.subscriptionUntil) > Date.now()

  async function update(label, action, success) {
    if (!window.confirm(`${label} для ${reader.email}?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      onUpdate(await action())
      setMessage(success)
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Не удалось изменить доступ')
    } finally {
      setBusy(false)
    }
  }

  const subscription = (period) => setReaderSubscription(reader.id, period, reader.subscriptionUntil)
  return <section className="platform-panel platform-reader-panel" aria-label="Доступ пользователя">
    <button type="button" className="platform-reader-back" onClick={onBack}><FiArrowLeft /> К пользователям</button>
    <h2>{reader.name}</h2>
    <p>{reader.email}</p>
    <dl>
      <dt>Бесплатных проверок осталось</dt><dd>{limit - reader.trialUsed} из {limit}</dd>
      <dt>Доступ</dt><dd>{readerStatus(reader)}</dd>
    </dl>
    <button className="platform-reader-secondary" type="button" disabled={busy || !reader.trialUsed}
      onClick={() => update('Сбросить лимит', () => resetReaderTrial(reader.id), 'Бесплатные проверки восстановлены.')}><FiRefreshCw /> Сбросить лимит</button>
    <form className="platform-form" onSubmit={e => {
      e.preventDefault()
      update(`${active ? 'Продлить' : 'Активировать'} подписку на ${months} мес.`,
        () => subscription(months), 'Срок подписки обновлён.')
    }}>
      <label>Срок подписки
        <select value={months} onChange={e => setMonths(Number(e.target.value))}>
          <option value={1}>1 месяц</option><option value={6}>6 месяцев</option><option value={12}>12 месяцев</option>
        </select>
      </label>
      <button type="submit" className="platform-button" disabled={busy}>{active ? 'Продлить подписку' : 'Активировать подписку'}</button>
    </form>
    {active && <button type="button" className="platform-reader-revoke" disabled={busy}
      onClick={() => update('Завершить подписку сейчас', () => subscription(0), 'Подписка завершена.')}>Завершить подписку</button>}
    {error && <div className="platform-error" role="alert">{error}</div>}
    {message && <p className="platform-reader-feedback" role="status">{message}</p>}
  </section>
}

export function PlatformReaders() {
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      listPlatformReaders(query.trim(), offset, controller.signal).then(data => {
        if (!controller.signal.aborted) setPage({ ...data, query, offset, revision })
      }).catch(e => {
        if (!controller.signal.aborted) setPage({ error: e.response?.data?.error?.message || 'Не удалось загрузить пользователей', query, offset, revision })
      })
    }, query ? 180 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, offset, revision])
  const current = page?.query === query && page.offset === offset && page.revision === revision ? page : null
  const reader = current?.readers?.find(item => item.id === selectedId)
  return <>
    <div className="platform-title"><h1>Личные пользователи</h1></div>
    <div className={`platform-content platform-readers ${reader ? 'has-detail' : ''}`}>
      <section className="platform-list" aria-label="Список личных пользователей">
        <div className="platform-list-head">
          <label><FiSearch /><input type="search" maxLength={320} aria-label="Поиск по имени или почте"
            placeholder="Имя или почта" value={query}
            onChange={e => { setQuery(e.target.value); setOffset(0); setSelectedId('') }} /></label>
          <button className="platform-icon-button" type="button" aria-label="Обновить список" onClick={() => setRevision(value => value + 1)}><FiRefreshCw /></button>
        </div>
        {!current ? <p className="platform-empty" role="status">Загружаем пользователей…</p> : current.error ? <p className="platform-error" role="alert">{current.error}</p>
          : current.readers.length ? current.readers.map(item =>
            <button className={`platform-school-row ${item.id === selectedId ? 'is-selected' : ''}`} key={item.id} type="button"
              aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
              <span className="platform-school-avatar">{item.name.slice(0, 1)}</span>
              <span className="platform-school-main"><strong>{item.name}</strong><small>{item.email}</small>
                <small>{readerStatus(item)} · Проверок осталось {current.trialLimit - item.trialUsed} из {current.trialLimit}</small>
              </span><FiArrowRight />
            </button>) : <p className="platform-empty">{query ? 'По вашему запросу никто не найден' : 'Личных пользователей пока нет'}</p>}
        {current?.readers && (offset > 0 || current.hasMore) && <div className="platform-reader-pages">
          <button type="button" disabled={!offset} onClick={() => { setOffset(Math.max(0, offset - current.pageSize)); setSelectedId('') }}>Назад</button>
          {current.hasMore && <button type="button" onClick={() => { setOffset(offset + current.readers.length); setSelectedId('') }}>Следующие</button>}
        </div>}
      </section>
      <aside className="platform-side">{reader ? <ReaderDetails key={reader.id} onBack={() => setSelectedId('')} reader={reader} limit={current.trialLimit}
        onUpdate={changed => setPage(p => !p?.readers ? p : { ...p, readers: p.readers.map(item => item.id === changed.id ? changed : item) })} />
        : <section className="platform-panel platform-placeholder"><h2>Выберите пользователя</h2><p>Здесь можно восстановить бесплатные проверки и изменить срок подписки.</p></section>}
      </aside>
    </div>
  </>
}
