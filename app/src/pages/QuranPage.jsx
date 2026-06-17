import { useEffect, useMemo, useRef, useState } from 'react'
import { FiBookOpen, FiPause, FiPlay, FiStopCircle } from 'react-icons/fi'
import {
  getRussianEditions,
  getSurahArabic,
  getSurahAudio,
  getSurahTranslation,
  getSurahs,
} from '../api/quranApi.js'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import StatusState from '../components/StatusState.jsx'

const LAST_SURAH_KEY = 'al-qalam-quran-last-surah'
const DEFAULT_TRANSLATION = 'ru.kuliev'
const DEFAULT_RECITER = 'ar.alafasy'

function readLastSurah() {
  const storedValue = window.localStorage.getItem(LAST_SURAH_KEY)

  if (!storedValue) {
    return 1
  }

  const surahNumber = Number(storedValue)
  return Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= 114 ? surahNumber : 1
}

function QuranPage() {
  const [surahs, setSurahs] = useState([])
  const [selectedSurah, setSelectedSurah] = useState(() => readLastSurah())
  const [translationEdition, setTranslationEdition] = useState(DEFAULT_TRANSLATION)
  const [arabicSurah, setArabicSurah] = useState(null)
  const [translatedSurah, setTranslatedSurah] = useState(null)
  const [audioSurah, setAudioSurah] = useState(null)
  const [surahsLoading, setSurahsLoading] = useState(true)
  const [surahLoading, setSurahLoading] = useState(true)
  const [activeAyah, setActiveAyah] = useState(null)
  const [playbackMode, setPlaybackMode] = useState('single')
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [currentAudioSrc, setCurrentAudioSrc] = useState('')
  const [error, setError] = useState('')
  const audioRef = useRef(null)
  const activeAyahRef = useRef(null)
  const playbackModeRef = useRef('single')
  const surahQueueRef = useRef([])

  useEffect(() => {
    async function loadInitialData() {
      setSurahsLoading(true)
      setError('')

      try {
        const [nextSurahs, editions] = await Promise.all([
          getSurahs(),
          getRussianEditions().catch(() => []),
        ])
        const preferredEdition =
          editions.find((edition) => edition.identifier === DEFAULT_TRANSLATION) ??
          editions.find((edition) => edition.identifier?.includes('kuliev')) ??
          editions[0]

        setSurahs(nextSurahs)
        setTranslationEdition(preferredEdition?.identifier ?? DEFAULT_TRANSLATION)
      } catch {
        setError('Не удалось загрузить список сур')
      } finally {
        setSurahsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadSurah() {
      setSurahLoading(true)
      setError('')
      setActiveAyah(null)
      setPlaybackMode('single')
      setIsAudioPlaying(false)
      setCurrentAudioSrc('')
      surahQueueRef.current = []
      audioRef.current?.pause()

      try {
        const [arabic, translation, audio] = await Promise.all([
          getSurahArabic(selectedSurah),
          getSurahTranslation(selectedSurah, translationEdition),
          getSurahAudio(selectedSurah, DEFAULT_RECITER).catch(() => null),
        ])

        setArabicSurah(arabic)
        setTranslatedSurah(translation)
        setAudioSurah(audio)
        window.localStorage.setItem(LAST_SURAH_KEY, String(selectedSurah))
      } catch {
        setArabicSurah(null)
        setTranslatedSurah(null)
        setAudioSurah(null)
        setError('Не удалось загрузить суру')
      } finally {
        setSurahLoading(false)
      }
    }

    if (!surahsLoading) {
      loadSurah()
    }
  }, [selectedSurah, surahsLoading, translationEdition])

  useEffect(() => {
    const audio = audioRef.current

    return () => audio?.pause()
  }, [])

  const selectedSurahInfo = useMemo(
    () => surahs.find((surah) => surah.number === selectedSurah),
    [selectedSurah, surahs],
  )

  useEffect(() => {
    if (!activeAyah || !selectedSurahInfo) {
      document.title = 'Коран | Al-Qalam'
      return
    }

    const title = `${selectedSurahInfo.englishName} · аят ${activeAyah}`
    document.title = `${title} | Al-Qalam`

    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist: 'Мишари Рашид аль-Афаси',
        album: selectedSurahInfo.name,
        artwork: [
          {
            src: '/logo_al-qalam.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      })
    }
  }, [activeAyah, selectedSurahInfo])

  const translatedAyahByNumber = useMemo(() => {
    if (!translatedSurah?.ayahs) {
      return {}
    }

    return Object.fromEntries(
      translatedSurah.ayahs.map((ayah) => [ayah.numberInSurah, ayah]),
    )
  }, [translatedSurah])

  const audioAyahByNumber = useMemo(() => {
    if (!audioSurah?.ayahs) {
      return {}
    }

    return Object.fromEntries(audioSurah.ayahs.map((ayah) => [ayah.numberInSurah, ayah]))
  }, [audioSurah])

  useEffect(() => {
    activeAyahRef.current = activeAyah
  }, [activeAyah])

  useEffect(() => {
    playbackModeRef.current = playbackMode
  }, [playbackMode])

  function playAudio(src, ayahNumber, mode = 'single', resetTime = true) {
    if (!src || !ayahNumber) {
      setError('Аудио для этого аята недоступно')
      return
    }

    const audio = audioRef.current

    if (!audio) {
      return
    }

    setError('')
    audio.pause()
    audio.src = src
    audio.load()

    if (resetTime) {
      audio.currentTime = 0
    }

    setCurrentAudioSrc(src)
    setActiveAyah(ayahNumber)
    setPlaybackMode(mode)
    activeAyahRef.current = ayahNumber
    playbackModeRef.current = mode

    const playPromise = audio.play()

    if (playPromise) {
      playPromise.catch(() => {
        setIsAudioPlaying(false)
        setError('Не удалось воспроизвести аудио')
      })
    }
  }

  function pauseAudio() {
    audioRef.current?.pause()
    setIsAudioPlaying(false)
  }

  function resumeAudio() {
    if (!audioRef.current || !currentAudioSrc) {
      return
    }

    audioRef.current.play().catch(() => {
      setIsAudioPlaying(false)
      setError('Не удалось продолжить аудио')
    })
  }

  function stopAudio() {
    const audio = audioRef.current

    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audio.removeAttribute('src')
      audio.load()
    }

    setActiveAyah(null)
    setPlaybackMode('single')
    setIsAudioPlaying(false)
    setCurrentAudioSrc('')
    activeAyahRef.current = null
    playbackModeRef.current = 'single'
    surahQueueRef.current = []
  }

  function handleAudioEnded() {
    const currentMode = playbackModeRef.current

    if (currentMode === 'surah') {
      const nextAyah = surahQueueRef.current.shift()

      if (nextAyah?.audio) {
        playAudio(nextAyah.audio, nextAyah.numberInSurah, 'surah')
        return
      }
    }

    setActiveAyah(null)
    setPlaybackMode('single')
    setIsAudioPlaying(false)
    setCurrentAudioSrc('')
    activeAyahRef.current = null
    playbackModeRef.current = 'single'
    surahQueueRef.current = []
  }

  function handleToggleAyahAudio(ayahNumber) {
    if (activeAyah === ayahNumber && playbackMode === 'single') {
      if (isAudioPlaying) {
        pauseAudio()
      } else {
        resumeAudio()
      }

      return
    }

    surahQueueRef.current = []
    const audioAyah = audioAyahByNumber[ayahNumber]
    playAudio(audioAyah?.audio, ayahNumber)
  }

  function handleToggleSurahAudio() {
    if (playbackMode === 'surah' && activeAyah) {
      if (isAudioPlaying) {
        pauseAudio()
      } else {
        resumeAudio()
      }

      return
    }

    const playableAyahs =
      audioSurah?.ayahs
        ?.filter((ayah) => ayah.audio)
        .sort((firstAyah, secondAyah) => firstAyah.numberInSurah - secondAyah.numberInSurah) ?? []
    const firstAyah = playableAyahs[0]

    if (!firstAyah?.audio) {
      setError('Аудио для этой суры недоступно')
      return
    }

    surahQueueRef.current = playableAyahs.slice(1)
    playAudio(firstAyah.audio, firstAyah.numberInSurah, 'surah')
  }

  if (surahsLoading) {
    return (
      <div className="page-grid">
        <StatusState title="Загрузка" description="Загружаю список сур..." />
      </div>
    )
  }

  return (
    <div className="page-grid">
      <section className="page-header pulse-in">
        <div className="page-header-main">
          <h2>Коран</h2>
          <div className="page-header-meta">
            <span>114 сур</span>
            <span>Перевод: {translationEdition}</span>
            <span>Чтец: Mishary Alafasy</span>
          </div>
        </div>
      </section>

      <section className="surface quran-layout pulse-in">
        <aside className="quran-sidebar" aria-label="Выбор суры">
          <Input
            label="Сура"
            as="select"
            value={selectedSurah}
            onChange={(event) => setSelectedSurah(Number(event.target.value))}
          >
            {surahs.map((surah) => (
              <option key={surah.number} value={surah.number}>
                {surah.number}. {surah.englishName} · {surah.numberOfAyahs}
              </option>
            ))}
          </Input>

          <p className="quran-sidebar-note">
            Выберите суру из списка. Каждый аят можно читать с переводом или слушать отдельно.
          </p>

          <div className="quran-audio-panel">
            <strong>Озвучка</strong>
            <p>Мишари Рашид аль-Афаси</p>
            <div className="quran-player-actions">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleToggleSurahAudio}
                disabled={surahLoading || !audioSurah?.ayahs?.length}
              >
                {playbackMode === 'surah' && isAudioPlaying ? <FiPause /> : <FiPlay />}
                {playbackMode === 'surah' && activeAyah
                  ? isAudioPlaying
                    ? 'Пауза'
                    : 'Продолжить'
                  : 'Слушать суру'}
              </Button>

              {currentAudioSrc ? (
                <Button variant="secondary" fullWidth onClick={stopAudio}>
                  <FiStopCircle />
                  Остановить
                </Button>
              ) : null}
            </div>

            <audio
              ref={audioRef}
              className="quran-audio-player"
              controls
              onPlay={() => setIsAudioPlaying(true)}
              onPause={() => setIsAudioPlaying(false)}
              onEnded={handleAudioEnded}
            />
          </div>
        </aside>

        <div className="quran-reader">
          {error ? <div className="form-error">{error}</div> : null}

          <div className="quran-reader-head">
            <div>
              <h3>
                {selectedSurahInfo
                  ? `${selectedSurahInfo.number}. ${selectedSurahInfo.englishName}`
                  : 'Сура'}
              </h3>
              {selectedSurahInfo ? (
                <p>
                  {selectedSurahInfo.name} · {selectedSurahInfo.numberOfAyahs} аятов
                </p>
              ) : null}
            </div>
            <span className="quran-reader-icon">
              <FiBookOpen />
            </span>
          </div>

          {surahLoading ? (
            <StatusState title="Загрузка" description="Загружаю суру..." />
          ) : !arabicSurah?.ayahs?.length ? (
            <div className="empty-state">
              <strong>Сура не загружена</strong>
              <p>Попробуйте выбрать другую суру или обновить страницу.</p>
            </div>
          ) : (
            <div className="quran-ayah-list">
              {arabicSurah.ayahs.map((ayah) => {
                const translatedAyah = translatedAyahByNumber[ayah.numberInSurah]
                const audioAyah = audioAyahByNumber[ayah.numberInSurah]
                const isActive = activeAyah === ayah.numberInSurah

                return (
                  <article
                    key={ayah.number}
                    className={`quran-ayah ${isActive ? 'highlighted' : ''}`}
                  >
                    <button
                      type="button"
                      className="quran-ayah-play"
                      onClick={() => handleToggleAyahAudio(ayah.numberInSurah)}
                      disabled={!audioAyah?.audio}
                      aria-label={`Воспроизвести аят ${ayah.numberInSurah}`}
                    >
                      {isActive && isAudioPlaying ? <FiPause /> : <FiPlay />}
                    </button>
                    <div className="quran-ayah-copy">
                      <div className="quran-ayah-meta">
                        <span>{ayah.numberInSurah}</span>
                      </div>
                      <p className="quran-arabic" dir="rtl" lang="ar">
                        {ayah.text}
                      </p>
                      <p className="quran-translation">
                        {translatedAyah?.text ?? 'Перевод недоступен'}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default QuranPage
