import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { FiArrowLeft, FiMic, FiSquare, FiUpload, FiRotateCcw, FiVolume2, FiGrid, FiBookOpen, FiClipboard, FiHome, FiLogIn, FiChevronDown, FiUser } from 'react-icons/fi'
import useLiveRecitation from '../audio/useLiveRecitation.js'
import useAyahAudio from '../audio/useAyahAudio.js'
import { practiceErrorMessage, recognizeReading } from '../api/practiceApi.js'
import { useReaderAccess } from '../auth/useReaderAccess.js'
import { getSurahArabic, getSurahs } from '../api/quranApi.js'
import { getHomeworkById, submitHomework } from '../api/mockApi.js'
import { useAuth } from '../auth/useAuth.jsx'
import { MobileMenuButton } from '../components/MobileNavigation.jsx'
import './AiTestPage.css'

const DEFAULT_SURAH = 112
const MAX_AYAHS_PER_ATTEMPT = 10
const FALLBACK_SURAH = { number: 112, name: 'سُورَةُ الإِخْلَاصِ', englishName: 'Al-Ikhlaas', numberOfAyahs: 4 }
const FALLBACK_AYAHS = ['قُلْ هُوَ اللَّهُ أَحَدٌ', 'اللَّهُ الصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ']
const arabicNumber = value => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])

export default function AiTestPage() {
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignment')
  const { user, school, logout } = useAuth()
  const [assignment, setAssignment] = useState(null)
  const [assignmentError, setAssignmentError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [surahs, setSurahs] = useState([])
  const [selectedSurah, setSelectedSurah] = useState(DEFAULT_SURAH)
  const [arabicSurah, setArabicSurah] = useState(null)
  const [ayahFrom, setAyahFrom] = useState(1)
  const [ayahTo, setAyahTo] = useState(4)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const quota = useReaderAccess(user)
  const live = useLiveRecitation({ surah: selectedSurah, ayahFrom, ayahTo }, quota.refresh)
  const reference = useAyahAudio(selectedSurah)
  const [uploaded, setUploaded] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [previewAudio, setPreviewAudio] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const request = useRef(null)
  const uploadAttempt = useRef(null)
  const result = uploaded || live.result
  const tracking = result?.tracking
  const active = ['requesting', 'listening', 'finishing'].includes(live.phase)
  const error = uploadError || live.error
  const paywall = quota.exhausted && !active && !loading
  const assignmentReady = !assignmentId || !!assignment
  useEffect(() => {
    const audio = uploadedFile || live.finalAudio
    if (!audio) { setPreviewAudio(''); return }
    const url = URL.createObjectURL(audio)
    setPreviewAudio(url)
    return () => URL.revokeObjectURL(url)
  }, [uploadedFile, live.finalAudio])
  useEffect(() => {
    if (!assignmentId) return
    let open = true
    if (user?.role !== 'student') { setAssignmentError('Войдите как ученик, чтобы выполнить задание.'); return }
    getHomeworkById(assignmentId).then(({ assignment: next, submissions }) => {
      if (!open) return
      if (next.kind !== 'recite' || submissions.length) { setAssignmentError('Это задание уже выполнено или недоступно.'); return }
      setAssignment(next)
      setSelectedSurah(next.surah)
      setAyahFrom(next.ayahFrom)
      setAyahTo(next.ayahTo)
    }).catch(() => { if (open) setAssignmentError('Не удалось загрузить задание.') })
    return () => { open = false }
  }, [assignmentId, user?.role])
  const selectedSurahInfo = useMemo(
    () => surahs.find(surah => surah.number === selectedSurah) || (selectedSurah === DEFAULT_SURAH ? FALLBACK_SURAH : null),
    [selectedSurah, surahs],
  )
  const selectedSurahLabel = selectedSurah === DEFAULT_SURAH ? 'Аль-Ихляс' : selectedSurahInfo?.englishName || `Сура ${selectedSurah}`
  const ayahCount = arabicSurah?.ayahs?.length || selectedSurahInfo?.numberOfAyahs || 0
  const selectedAyahs = useMemo(
    () => (arabicSurah?.ayahs || []).filter(ayah => ayah.numberInSurah >= ayahFrom && ayah.numberInSurah <= ayahTo),
    [arabicSurah, ayahFrom, ayahTo],
  )
  const selectionReady = selectedAyahs.length === ayahTo - ayahFrom + 1
  const showBasmala = ayahFrom === 1 && selectedSurah !== 1 && selectedSurah !== 9
  useEffect(() => {
    let cancelled = false
    getSurahs()
      .then(data => { if (!cancelled) setSurahs(data) })
      .catch(() => { if (!cancelled) setSurahs([FALLBACK_SURAH]) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setCatalogLoading(true)
    setCatalogError('')
    getSurahArabic(selectedSurah, { signal: controller.signal, timeout: 12000 })
      .then(data => setArabicSurah(data))
      .catch(() => {
        if (controller.signal.aborted) return
        if (selectedSurah === DEFAULT_SURAH) {
          setArabicSurah({ ayahs: FALLBACK_AYAHS.map((text, index) => ({ text, numberInSurah: index + 1 })) })
        } else {
          setArabicSurah(null)
          setCatalogError('Не удалось загрузить текст суры. Проверьте интернет и попробуйте ещё раз.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [selectedSurah])
  useEffect(() => () => request.current?.abort(), [])
  function reset() {
    reference.stop()
    request.current?.abort()
    uploadAttempt.current = null
    live.reset(); setUploaded(null); setUploadedFile(null); setUploadError('')
  }
  function changeSurah(event) {
    const number = Number(event.target.value)
    const info = surahs.find(surah => surah.number === number)
    reset()
    setArabicSurah(null)
    setSelectedSurah(number)
    setAyahFrom(1)
    setAyahTo(Math.min(4, info?.numberOfAyahs || 1))
  }
  function changeAyahFrom(event) {
    const next = Number(event.target.value)
    reset()
    setAyahFrom(next)
    setAyahTo(current => Math.min(Math.max(current, next), next + MAX_AYAHS_PER_ATTEMPT - 1, ayahCount))
  }
  function changeAyahTo(event) {
    reset()
    setAyahTo(Number(event.target.value))
  }
  async function checkFile(file, attemptId) {
    if (request.current && !request.current.signal.aborted) return
    setLoading(true)
    setUploadError('')
    const controller = new AbortController()
    request.current = controller
    try {
      const data = await recognizeReading({
        stage: 'listen/final', selection: { surah: selectedSurah, ayahFrom, ayahTo },
        audio: file, attemptId, signal: controller.signal,
      })
      if (!controller.signal.aborted) setUploaded(data)
    } catch (err) {
      if (!controller.signal.aborted) setUploadError(practiceErrorMessage(err))
    } finally {
      if (request.current === controller && !controller.signal.aborted) {
        request.current = null
        setLoading(false)
        void quota.refresh()
      }
    }
  }
  function upload(event) {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next || !assignmentReady || !quota.canStart) return
    reset()
    if (!next.size || next.size > 20 * 1024 * 1024) { setUploadError('Нужен аудиофайл до 20 МБ.'); return }
    setUploadedFile(next)
    uploadAttempt.current = crypto.randomUUID()
    void checkFile(next, uploadAttempt.current)
  }
  function listen(number) {
    if (active) return
    void reference.play(number)
  }
  function startReading() {
    if (!quota.canStart) return
    uploadAttempt.current = null
    reference.stop()
    setUploaded(null); setUploadedFile(null); setUploadError('')
    void live.start()
  }
  async function sendToTeacher() {
    const audio = uploadedFile || live.finalAudio
    if (!assignment || !audio || submitting) return
    setSubmitting(true); setAssignmentError('')
    try { await submitHomework(assignment.id, audio); setSubmitted(true) }
    catch (err) { setAssignmentError(err.response?.data?.error?.message || 'Не удалось отправить запись. Попробуйте ещё раз.') }
    finally { setSubmitting(false) }
  }
  const status = loading ? 'Проверяем запись' : live.phase === 'requesting' ? 'Подключаем микрофон' : live.phase === 'finishing' ? 'Завершаем проверку' : live.phase === 'listening' ? (live.processing ? 'Обновляем подсветку' : 'Слушаем') : tracking ? (result.final_fallback ? 'Предварительная подсветка — финал требует проверки' : tracking.low_confidence ? 'Найдены отдельные слова — проверьте чтение' : !tracking.aligned ? 'Не удалось сопоставить чтение' : !tracking.final ? 'Обновляем подсветку' : tracking.reviewed ? 'Проверьте выделенные слова' : tracking.complete ? 'Чтение завершено' : 'Диапазон прочитан не полностью') : ''
  let index = 0
  return (
    <div className="recitation-page">
      <aside className="recitation-side-nav" aria-label="Навигация">
        <Link className="recitation-side-brand" to="/"><img src="/logo_al-qalam.png" alt="" />Al-Qalam</Link>
        <nav>
          {user?.role === 'platform_admin' ? <NavLink to="/platform"><FiGrid />Школы</NavLink> : user?.role === 'reader' ? <NavLink to="/"><FiHome />Главная</NavLink> : user ? <>
            <NavLink to="/groups"><FiGrid />Группы</NavLink>
            {user.role !== 'parent' && <NavLink to="/homework"><FiClipboard />Задания</NavLink>}
            <NavLink to="/quran"><FiBookOpen />Коран</NavLink>
          </> : <NavLink to="/"><FiHome />Главная</NavLink>}
          <NavLink to="/practice"><FiMic />Практика чтения</NavLink>
          {user?.role === 'reader' && <NavLink to="/account"><FiUser />Мой профиль</NavLink>}
          <NavLink to="/privacy"><FiBookOpen />Обработка данных</NavLink>
          {!user && <NavLink to="/login"><FiLogIn />Вход в журнал</NavLink>}
        </nav>
        {user && <span className="recitation-side-school">{school?.name || user.label}</span>}
        {user?.role === 'reader' && <button className="recitation-side-logout" type="button" onClick={logout}>Выйти из аккаунта</button>}
      </aside>
      <header className="recitation-header"><Link to={assignment ? `/homework/${assignment.id}` : '/'} className="recitation-back"><FiArrowLeft /><img src="/logo_al-qalam.png" alt="" /><span>Al-Qalam</span></Link><span className="recitation-section">{assignment ? 'Домашнее задание' : 'Практика чтения'}</span><MobileMenuButton /></header>
      <main className="recitation-main">
        <h1 className="recitation-sr-only">{assignment?.title || 'Практика чтения'}</h1>
        {assignment && <p className="recitation-assignment-label">{assignment.title}</p>}
        {assignmentError && <p className="recitation-error" role="alert">{assignmentError}</p>}
        <details className="recitation-selection">
          <summary><span className="recitation-number">{selectedSurah}</span><span className="recitation-selection-name"><strong>{selectedSurahLabel}</strong><small>Аяты {ayahFrom}–{ayahTo}</small></span><FiChevronDown aria-hidden="true" /></summary>
          <div className="recitation-selection-fields">
            <div className="recitation-surah-picker"><label htmlFor="practice-surah"><span>Сура</span><select id="practice-surah" value={selectedSurah} disabled={active || loading || !!assignmentId} onChange={changeSurah}>{(surahs.length ? surahs : [FALLBACK_SURAH]).map(surah => <option value={surah.number} key={surah.number}>{surah.number}. {surah.englishName} · {surah.numberOfAyahs}</option>)}</select></label></div>
            <div className="recitation-range" aria-label="Диапазон аятов"><label htmlFor="ayah-from"><span>С аята</span><select id="ayah-from" value={ayahFrom} disabled={active || loading || catalogLoading || !ayahCount || !!assignmentId} onChange={changeAyahFrom}>{Array.from({ length: ayahCount }, (_, index) => index + 1).map(number => <option value={number} key={number}>{number}</option>)}</select></label><span className="recitation-range-dash">—</span><label htmlFor="ayah-to"><span>По аят</span><select id="ayah-to" value={ayahTo} disabled={active || loading || catalogLoading || !ayahCount || !!assignmentId} onChange={changeAyahTo}>{Array.from({ length: Math.min(MAX_AYAHS_PER_ATTEMPT, Math.max(0, ayahCount - ayahFrom + 1)) }, (_, index) => ayahFrom + index).map(number => <option value={number} key={number}>{number}</option>)}</select></label></div>
          </div>
        </details>
        <section className="recitation-sheet" aria-label={`${selectedSurahInfo?.englishName || 'Выбранная сура'}, аяты ${ayahFrom}–${ayahTo}, с подсветкой распознанных слов`}>
          {showBasmala && <p className="recitation-basmala" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}
          {catalogLoading ? <div className="recitation-loading" role="status">Загружаем аяты…</div> : catalogError ? <p className="recitation-error" role="alert">{catalogError}</p> : <div className="recitation-verses" lang="ar" dir="rtl">{selectedAyahs.map(ayah => <p className="recitation-ayah" key={ayah.numberInSurah}>{ayah.text.split(' ').map(word => {
            const wordIndex = index++
            const state = tracking?.words[wordIndex]?.state || 'pending'
            return <span key={wordIndex} className={`recitation-word is-${state}`}>{word}</span>
          })}<span className="recitation-verse-number" aria-label={`Аят ${ayah.numberInSurah}`}>{arabicNumber(ayah.numberInSurah)}</span><button type="button" lang="ru" className="recitation-listen" disabled={active} aria-label={reference.current === ayah.numberInSurah ? `Остановить аят ${ayah.numberInSurah}` : `Послушать аят ${ayah.numberInSurah}`} title={active ? 'Прослушивание доступно после завершения записи' : `Послушать аят ${ayah.numberInSurah}`} aria-pressed={reference.current === ayah.numberInSurah} onClick={() => listen(ayah.numberInSurah)}>{reference.current === ayah.numberInSurah ? <FiSquare /> : <FiVolume2 />}</button></p>)}</div>}
        </section>
        {reference.current !== null && <p className="recitation-reference" role="status">{reference.busy ? 'Загружаем' : 'Слушаем'} аят {reference.current} · Мишари Рашид аль-Афаси</p>}
        {reference.error && <p className="recitation-error" role="alert">{reference.error}</p>}
        <div className={`recitation-controls ${error ? 'has-error' : ''}`}>
          {status ? <div className="recitation-status" role="status" aria-live="polite"><span className={`recitation-indicator ${active ? 'is-active' : ''}`} />{status}</div> : null}
          {user?.role === 'reader' && <div className="recitation-access" aria-live="polite">
            {quota.error ? <>{quota.error} <button type="button" onClick={quota.refresh}>Обновить</button></>
              : !quota.access ? 'Проверяем доступ…'
              : quota.access.subscribed ? 'Подписка активна'
              : paywall ? 'Бесплатные проверки закончились'
              : `Бесплатных проверок осталось: ${quota.access.remaining} из ${quota.access.trialLimit}`}
          </div>}
          {paywall ? <Link className="recitation-subscribe" to="/account?plans=1">Посмотреть подписку</Link> : <>
          <div className="recitation-action-row"><span className="recitation-timer">{String(Math.floor(live.seconds/60)).padStart(2,'0')}:{String(live.seconds%60).padStart(2,'0')}</span><button className={`recitation-primary ${live.phase === 'listening' ? 'is-recording' : ''}`} disabled={(!quota.canStart && !active) || loading || catalogLoading || !selectionReady || !assignmentReady || submitted || ['requesting','finishing'].includes(live.phase)} onClick={() => { if (live.phase === 'listening') void live.stop(); else startReading() }}>{live.phase === 'listening' ? <FiSquare /> : <FiMic />}<span className="recitation-primary-label">{live.phase === 'listening' ? 'Завершить' : 'Начать чтение'}</span></button><span className="recitation-meter" aria-label={`Уровень микрофона ${Math.round(live.level*100)} процентов`}>{[0.6,1,0.75,0.9,0.5].map((scale,i) => <i key={i} style={{height:`${4+live.level*22*scale}px`}} />)}</span></div>
          <div className="recitation-secondary"><label className={!quota.canStart || active || loading || catalogLoading || !selectionReady || !assignmentReady || submitted ? 'is-disabled' : ''}><FiUpload />Загрузить запись<input type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg" disabled={!quota.canStart || active || loading || catalogLoading || !selectionReady || !assignmentReady || submitted} onChange={upload} /></label>{(result || error) && !active && !loading && !submitted && <button type="button" onClick={reset}><FiRotateCcw />Заново</button>}</div>
          </>}
          {error && !active && !loading && (live.finalAudio || uploadAttempt.current) && <button type="button" className="recitation-retry" onClick={() => {
            if (uploadedFile && uploadAttempt.current) void checkFile(uploadedFile, uploadAttempt.current)
            else live.retryFinal()
          }}>Повторить проверку этой записи</button>}
          <div className="recitation-legend" aria-label="Значение подсветки"><span><i className="is-match" />Совпало с текстом</span><span><i className="is-review" />Перепроверить слово</span></div>
          {error && <p className="recitation-error" role="alert">{error}</p>}
          {live.phase === 'requesting' && <button type="button" className="recitation-cancel" onClick={reset}>Отменить</button>}
        </div>
        <p className="recitation-privacy">При проверке запись отправляется на сервер. <Link to="/privacy">Как обрабатываются данные</Link></p>
        {assignment && (uploadedFile || live.finalAudio) && !active && !loading && <div className="recitation-homework-submit">{submitted ? <Link to={`/homework/${assignment.id}`}>Запись отправлена · Вернуться к заданию</Link> : <><p>Послушайте свою запись. Если хотите, прочитайте ещё раз. Когда будете готовы, отправьте преподавателю.</p>{previewAudio && <audio controls preload="metadata" src={previewAudio} aria-label="Ваша запись чтения" />}<div className="recitation-homework-actions"><button type="button" className="is-outline" disabled={submitting} onClick={reset}>Перезаписать</button><button type="button" disabled={submitting} onClick={sendToTeacher}>{submitting ? 'Отправляем…' : 'Отправить преподавателю'}</button></div></>}</div>}
      </main>
      <footer className="recitation-footer">Al-Qalam</footer>
    </div>
  )
}
