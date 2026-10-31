import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiMic, FiSquare, FiUpload, FiRotateCcw, FiVolume2 } from 'react-icons/fi'
import useLiveRecitation from '../audio/useLiveRecitation.js'
import useAyahAudio from '../audio/useAyahAudio.js'
import { getSurahArabic, getSurahs } from '../api/quranApi.js'
import './AiTestPage.css'

const DEFAULT_SURAH = 112
const MAX_AYAHS_PER_ATTEMPT = 10
const FALLBACK_SURAH = { number: 112, name: 'سُورَةُ الإِخْلَاصِ', englishName: 'Al-Ikhlaas', numberOfAyahs: 4 }
const FALLBACK_AYAHS = ['قُلْ هُوَ اللَّهُ أَحَدٌ', 'اللَّهُ الصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ']
const arabicNumber = value => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])

export default function AiTestPage() {
  const [surahs, setSurahs] = useState([])
  const [selectedSurah, setSelectedSurah] = useState(DEFAULT_SURAH)
  const [arabicSurah, setArabicSurah] = useState(null)
  const [ayahFrom, setAyahFrom] = useState(1)
  const [ayahTo, setAyahTo] = useState(4)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const live = useLiveRecitation({ surah: selectedSurah, ayahFrom, ayahTo })
  const reference = useAyahAudio(selectedSurah)
  const [uploaded, setUploaded] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const request = useRef(null)
  const result = uploaded || live.result
  const tracking = result?.tracking
  const active = ['requesting', 'listening', 'finishing'].includes(live.phase)
  const error = uploadError || live.error
  const selectedSurahInfo = useMemo(
    () => surahs.find(surah => surah.number === selectedSurah) || (selectedSurah === DEFAULT_SURAH ? FALLBACK_SURAH : null),
    [selectedSurah, surahs],
  )
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
    live.reset(); setUploaded(null); setUploadError('')
  }
  function requestUrl(path) {
    const query = new URLSearchParams({
      surah: String(selectedSurah),
      ayah_from: String(ayahFrom),
      ayah_to: String(ayahTo),
    })
    return `${path}?${query}`
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
  async function upload(event) {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    reset()
    if (!next.size || next.size > 20 * 1024 * 1024) { setUploadError('Нужен аудиофайл до 20 МБ.'); return }
    setLoading(true)
    const controller = new AbortController()
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const response = await fetch(requestUrl('/ai-api/listen/final'), { method: 'POST', body: next, signal: controller.signal,
        headers: { 'X-Al-Qalam-Test': '1', 'Content-Type': 'application/octet-stream' } })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'AI-сервис недоступен. Инструкция — внизу страницы.')
      if (!data?.tracking) throw new Error('Перезапустите AI-сервис, чтобы применить обновление.')
      setUploaded(data)
    } catch (err) { setUploadError(err.name === 'AbortError' ? 'Время ожидания истекло.' : err.message) }
    finally { clearTimeout(timeout); setLoading(false) }
  }
  function listen(number) {
    if (active) return
    void reference.play(number)
  }
  function startReading() {
    reference.stop()
    setUploaded(null); setUploadError('')
    void live.start()
  }
  const status = loading ? 'Проверяем запись' : live.phase === 'requesting' ? 'Подключаем микрофон' : live.phase === 'finishing' ? 'Завершаем проверку' : live.phase === 'listening' ? (live.processing ? 'Обновляем подсветку' : 'Слушаем') : tracking ? (result.final_fallback ? 'Предварительная подсветка — финал требует проверки' : tracking.low_confidence ? 'Найдены отдельные слова — проверьте чтение' : !tracking.aligned ? 'Не удалось сопоставить чтение' : !tracking.final ? 'Обновляем подсветку' : tracking.reviewed ? 'Проверьте выделенные слова' : tracking.complete ? 'Чтение завершено' : 'Диапазон прочитан не полностью') : ''
  let index = 0
  return (
    <div className="recitation-page">
      <header className="recitation-header"><Link to="/" className="recitation-back"><FiArrowLeft /><img src="/logo_al-qalam.png" alt="" /><span>Al-Qalam</span></Link><span className="recitation-section">Практика чтения</span></header>
      <main className="recitation-main">
        <div className="recitation-title"><div><h1>Практика чтения</h1></div></div>
        <div className="recitation-surah-picker"><span className="recitation-number">{selectedSurah}</span><label htmlFor="practice-surah"><span>Сура</span><select id="practice-surah" value={selectedSurah} disabled={active || loading} onChange={changeSurah}>{(surahs.length ? surahs : [FALLBACK_SURAH]).map(surah => <option value={surah.number} key={surah.number}>{surah.number}. {surah.englishName} · {surah.numberOfAyahs}</option>)}</select></label><span className="recitation-arabic-title" lang="ar">{selectedSurahInfo?.name}</span></div>
        <div className="recitation-range" aria-label="Диапазон аятов"><label htmlFor="ayah-from"><span>Начать с аята</span><select id="ayah-from" value={ayahFrom} disabled={active || loading || catalogLoading || !ayahCount} onChange={changeAyahFrom}>{Array.from({ length: ayahCount }, (_, index) => index + 1).map(number => <option value={number} key={number}>{number}</option>)}</select></label><span className="recitation-range-dash">—</span><label htmlFor="ayah-to"><span>Закончить аятом</span><select id="ayah-to" value={ayahTo} disabled={active || loading || catalogLoading || !ayahCount} onChange={changeAyahTo}>{Array.from({ length: Math.min(MAX_AYAHS_PER_ATTEMPT, Math.max(0, ayahCount - ayahFrom + 1)) }, (_, index) => ayahFrom + index).map(number => <option value={number} key={number}>{number}</option>)}</select></label><span className="recitation-range-note">до {MAX_AYAHS_PER_ATTEMPT} за попытку</span></div>
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
        <div className="recitation-controls">
          {status ? <div className="recitation-status" role="status" aria-live="polite"><span className={`recitation-indicator ${active ? 'is-active' : ''}`} />{status}</div> : null}
          <div className="recitation-action-row"><span className="recitation-timer">{String(Math.floor(live.seconds/60)).padStart(2,'0')}:{String(live.seconds%60).padStart(2,'0')}</span><button className={`recitation-primary ${live.phase === 'listening' ? 'is-recording' : ''}`} disabled={loading || catalogLoading || !selectionReady || ['requesting','finishing'].includes(live.phase)} onClick={() => { if (live.phase === 'listening') void live.stop(); else startReading() }}>{live.phase === 'listening' ? <FiSquare /> : <FiMic />}<span className="recitation-primary-label">{live.phase === 'listening' ? 'Завершить' : 'Начать чтение'}</span></button><span className="recitation-meter" aria-label={`Уровень микрофона ${Math.round(live.level*100)} процентов`}>{[0.6,1,0.75,0.9,0.5].map((scale,i) => <i key={i} style={{height:`${4+live.level*22*scale}px`}} />)}</span></div>
          <div className="recitation-secondary"><label className={active || loading || catalogLoading || !selectionReady ? 'is-disabled' : ''}><FiUpload />Загрузить запись<input type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg" disabled={active || loading || catalogLoading || !selectionReady} onChange={upload} /></label>{(result || error) && !active && !loading && <button type="button" onClick={reset}><FiRotateCcw />Заново</button>}</div>
          {error && <p className="recitation-error" role="alert">{error}</p>}
          {live.phase === 'requesting' && <button type="button" className="recitation-cancel" onClick={reset}>Отменить</button>}
        </div>
      </main>
      <footer className="recitation-footer">Al-Qalam</footer>
    </div>
  )
}
