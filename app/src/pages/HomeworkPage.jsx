import { createElement, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheck, FiHeadphones, FiMic, FiPlus } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth.jsx'
import { completeHomework, createHomework, getGroups, getHomework, getHomeworkAudio, getHomeworkById, reviewHomework } from '../api/mockApi.js'
import { getSurahs } from '../api/quranApi.js'
import './HomeworkPage.css'

const KINDS = { read: { label: 'Прочитать', Icon: FiBookOpen }, listen: { label: 'Прослушать', Icon: FiHeadphones }, recite: { label: 'Отправить чтение', Icon: FiMic } }
const STATUS = { pending: 'Не начато', submitted: 'Ждёт проверки', reviewed: 'Проверено', completed: 'Выполнено' }
const dateLabel = value => value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Без срока'
const initialForm = { groupId: '', kind: 'recite', title: '', surah: 112, ayahFrom: 1, ayahTo: 4, dueAt: '' }

function HomeworkPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState([])
  const [surahs, setSurahs] = useState([])
  const [form, setForm] = useState(initialForm)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const canManage = user?.role === 'teacher' || user?.role === 'staff'
  const selectedSurah = useMemo(() => surahs.find(item => item.number === Number(form.surah)), [surahs, form.surah])

  useEffect(() => {
    let open = true
    Promise.all([getHomework(), canManage ? getGroups() : Promise.resolve([]), getSurahs().catch(() => [])])
      .then(([nextItems, nextGroups, nextSurahs]) => {
        if (!open) return
        setItems(nextItems); setGroups(nextGroups); setSurahs(nextSurahs)
        if (nextGroups[0]) setForm(current => ({ ...current, groupId: nextGroups[0].id }))
      }).catch(() => { if (open) setError('Не удалось загрузить задания') })
      .finally(() => { if (open) setLoading(false) })
    return () => { open = false }
  }, [canManage])

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const payload = { ...form, surah: Number(form.surah), ayahFrom: Number(form.ayahFrom), ayahTo: Number(form.ayahTo), dueAt: form.dueAt ? new Date(`${form.dueAt}T23:59:00`).toISOString() : '' }
      const assignment = await createHomework(payload)
      navigate(`/homework/${assignment.id}`)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось создать задание')
    } finally { setBusy(false) }
  }

  return <div className="homework-page">
    <header className="homework-heading"><div><span className="homework-kicker">AL-QALAM · УЧЕБНЫЙ КАБИНЕТ</span><h2>Домашние задания</h2><p>{canManage ? 'Назначайте задания и проверяйте чтение учеников.' : 'Всё, что нужно сделать к следующему занятию.'}</p></div>{canManage && <button className="homework-button" type="button" onClick={() => setCreating(value => !value)}><FiPlus /> Новое задание</button>}</header>
    {error && <p className="homework-error" role="alert">{error}</p>}
    {creating && <form className="homework-create" onSubmit={submit}>
      <div className="homework-create-top"><h3>Новое задание</h3><button type="button" onClick={() => setCreating(false)}>Закрыть</button></div>
      <div className="homework-kind-choice" role="group" aria-label="Тип задания">{Object.entries(KINDS).map(([kind, { label, Icon }]) => <button type="button" key={kind} className={form.kind === kind ? 'selected' : ''} aria-pressed={form.kind === kind} onClick={() => setForm(current => ({ ...current, kind }))}>{createElement(Icon)}{label}</button>)}</div>
      <div className="homework-fields">
        <label>Группа<select name="groupId" required value={form.groupId} onChange={event => setForm(current => ({ ...current, groupId: event.target.value }))}>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label>Название<input name="title" autoComplete="off" required maxLength="120" placeholder="Например, сура Аль-Ихляс…" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></label>
        <label>Сура<select name="surah" value={form.surah} onChange={event => { const number = Number(event.target.value); const next = surahs.find(s => s.number === number); setForm(current => ({ ...current, surah: number, ayahFrom: 1, ayahTo: Math.min(4, next?.numberOfAyahs || 4) })) }}>{(surahs.length ? surahs : [{ number: 112, englishName: 'Аль-Ихляс', numberOfAyahs: 4 }]).map(surah => <option value={surah.number} key={surah.number}>{surah.number}. {surah.englishName}</option>)}</select></label>
        <label>С аята<input name="ayahFrom" type="number" inputMode="numeric" min="1" max={selectedSurah?.numberOfAyahs || 286} value={form.ayahFrom} onChange={event => setForm(current => ({ ...current, ayahFrom: event.target.value }))} /></label>
        <label>По аят<input name="ayahTo" type="number" inputMode="numeric" min={form.ayahFrom} max={Math.min(Number(form.ayahFrom) + 9, selectedSurah?.numberOfAyahs || 286)} value={form.ayahTo} onChange={event => setForm(current => ({ ...current, ayahTo: event.target.value }))} /></label>
        <label>Срок<input name="dueAt" type="date" value={form.dueAt} onChange={event => setForm(current => ({ ...current, dueAt: event.target.value }))} /></label>
      </div>
      <div className="homework-form-foot"><span>Для чтения с записью ученик сможет переслушать и переделать попытку до отправки.</span><button className="homework-button" disabled={busy || !groups.length}>{busy ? 'Сохраняем…' : 'Назначить группе'} <FiArrowRight /></button></div>
    </form>}
    {loading ? <p className="homework-empty">Загружаем задания…</p> : !items.length ? <div className="homework-empty"><FiBookOpen /><h3>Заданий пока нет</h3><p>{canManage ? 'Создайте первое задание для группы.' : 'Когда преподаватель назначит задание, оно появится здесь.'}</p></div> : <div className="homework-grid">{items.map(item => { const { Icon, label } = KINDS[item.kind]; return <Link className="homework-card" key={item.id} to={`/homework/${item.id}`}><div className="homework-card-top"><span className="homework-kind">{createElement(Icon)}{label}</span><span className="homework-date">{dateLabel(item.dueAt)}</span></div><h3>{item.title}</h3><p>{item.groupName} · Сура {item.surah}, аяты {item.ayahFrom}–{item.ayahTo}</p><div className="homework-card-bottom"><span>{item.myStatus ? STATUS[item.myStatus] : canManage ? 'Открыть ответы' : 'Не начато'}</span><FiArrowRight /></div></Link> })}</div>}
  </div>
}

function SubmissionAudio({ assignmentId, studentId }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let open = true
    let objectURL = ''
    getHomeworkAudio(assignmentId, studentId).then(blob => { objectURL = URL.createObjectURL(blob); if (open) setUrl(objectURL) }).catch(() => { if (open) setError('Запись не загрузилась') })
    return () => { open = false; if (objectURL) URL.revokeObjectURL(objectURL) }
  }, [assignmentId, studentId])
  return url ? <audio className="homework-audio" controls preload="none" src={url} /> : <p className="homework-muted">{error || 'Загружаем запись…'}</p>
}

function ReviewForm({ assignmentId, submission, onSaved }) {
  const [grade, setGrade] = useState(submission.grade || '')
  const [comment, setComment] = useState(submission.teacherComment || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { await reviewHomework(assignmentId, submission.studentId, { grade: grade ? Number(grade) : null, comment }); await onSaved() }
    catch (err) { setError(err.response?.data?.error?.message || 'Не удалось сохранить проверку') }
    finally { setBusy(false) }
  }
  const words = submission.analysis?.tracking?.words || []
  return <div className="homework-review"><SubmissionAudio assignmentId={assignmentId} studentId={submission.studentId} />{words.length > 0 && <div className="homework-analysis"><span>Предварительное распознавание</span><div lang="ar" dir="rtl">{words.map(word => <span key={word.index} className={`homework-word is-${word.state}`}>{word.text} </span>)}</div><small>Подсветка показывает совпадение распознанных слов с текстом. Проверьте запись на слух.</small></div>}{submission.analysisStatus === 'unavailable' && <p className="homework-muted">Анализ недоступен. Запись сохранена для проверки.</p>}<form onSubmit={save}><label>Оценка<select value={grade} onChange={event => setGrade(event.target.value)}><option value="">Без оценки</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Комментарий<textarea rows="2" maxLength="2000" value={comment} onChange={event => setComment(event.target.value)} placeholder="Что получилось и что повторить" /></label>{error && <p className="homework-error">{error}</p>}<button className="homework-button" disabled={busy}>{busy ? 'Сохраняем…' : submission.status === 'reviewed' ? 'Обновить проверку' : 'Сохранить проверку'}</button></form></div>
}

export function HomeworkDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canManage = user?.role === 'teacher' || user?.role === 'staff'
  async function reload() { try { setData(await getHomeworkById(id)); setError('') } catch { setError('Не удалось открыть задание') } }
  useEffect(() => { let open = true; getHomeworkById(id).then(value => { if (open) setData(value) }).catch(() => { if (open) setError('Не удалось открыть задание') }); return () => { open = false } }, [id])
  const assignment = data?.assignment
  const submissions = data?.submissions || []
  const own = !canManage ? submissions[0] : null
  async function complete() { setBusy(true); try { await completeHomework(id); await reload() } catch (err) { setError(err.response?.data?.error?.message || 'Не удалось отметить задание') } finally { setBusy(false) } }
  const target = assignment?.kind === 'recite' ? `/ai-test?assignment=${id}` : `/quran?surah=${assignment?.surah}&ayah=${assignment?.ayahFrom}&ayahTo=${assignment?.ayahTo}&assignment=${id}${assignment?.kind === 'listen' ? '&listen=1' : ''}`
  return <div className="homework-page"><Link className="homework-back" to="/homework"><FiArrowLeft /> Все задания</Link>{error && <p className="homework-error" role="alert">{error}</p>}{!assignment ? <p className="homework-empty">Загружаем задание…</p> : <><header className="homework-detail-head"><span className="homework-kicker">{assignment.groupName} · СУРА {assignment.surah}</span><h2>{assignment.title}</h2><p>{KINDS[assignment.kind].label} · аяты {assignment.ayahFrom}–{assignment.ayahTo} · {dateLabel(assignment.dueAt)}</p></header>{canManage ? <section className="homework-submissions"><h3>Ответы учеников <span>{submissions.filter(item => item.status !== 'pending').length}/{submissions.length}</span></h3>{submissions.map(submission => <article className="homework-student" key={submission.studentId}><div className="homework-student-head"><strong>{submission.studentName}</strong><span className={`homework-state is-${submission.status}`}>{STATUS[submission.status]}</span></div>{submission.status === 'submitted' || submission.status === 'reviewed' ? <ReviewForm assignmentId={id} submission={submission} onSaved={reload} /> : null}</article>)}</section> : <section className="homework-student-task"><div className="homework-task-mark">{createElement(KINDS[assignment.kind].Icon)}</div><h3>{own ? STATUS[own.status] : 'Можно приступать'}</h3><p>{assignment.kind === 'recite' ? 'Откройте чтение, запишите суру и переслушайте себя. Отправляйте запись, когда будете довольны попыткой.' : assignment.kind === 'listen' ? 'Послушайте выбранные аяты и отметьте задание выполненным.' : 'Откройте выбранные аяты и отметьте задание выполненным.'}</p>{own?.teacherComment && <p className="homework-teacher-note"><strong>Преподаватель:</strong> {own.teacherComment}</p>}{own?.grade && <p className="homework-teacher-note"><strong>Оценка:</strong> {own.grade}</p>}{own?.hasAudio && <SubmissionAudio assignmentId={id} studentId={user.studentId} />}{!own && <div className="homework-task-actions"><Link className="homework-button" to={target}>{assignment.kind === 'recite' ? 'Начать чтение' : assignment.kind === 'listen' ? 'Открыть аудио' : 'Открыть аяты'} <FiArrowRight /></Link>{assignment.kind !== 'recite' && <button className="homework-button is-outline" disabled={busy} onClick={complete}><FiCheck /> Отметить выполненным</button>}</div>}</section>}</>}</div>
}

export default HomeworkPage
