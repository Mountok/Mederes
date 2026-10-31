import { useEffect, useRef, useState } from 'react'
import { getSurahAudio } from '../api/quranApi.js'

export default function useAyahAudio(surahNumber) {
  const audio = useRef(null)
  const request = useRef(null)
  const cache = useRef(new Map())
  const generation = useRef(0)
  const [current, setCurrent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function stop() {
    generation.current++
    request.current?.abort()
    audio.current?.pause()
    setCurrent(null)
    setBusy(false)
  }
  useEffect(() => () => {
    generation.current++
    request.current?.abort()
    audio.current?.pause()
  }, [])
  useEffect(() => {
    stop()
    setError('')
  }, [surahNumber])
  async function play(number) {
    const previous = current
    stop()
    setError('')
    if (previous === number) return
    const version = generation.current
    setCurrent(number)
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      if (!cache.current.has(surahNumber)) {
        const data = await getSurahAudio(surahNumber, 'ar.alafasy', { signal: controller.signal, timeout: 10000 })
        if (version !== generation.current) return
        cache.current.set(surahNumber, data.ayahs)
      }
      const src = cache.current.get(surahNumber)?.find(ayah => ayah.numberInSurah === number)?.audio
      if (!src) throw new Error('Missing audio')
      const next = new Audio(src)
      audio.current = next
      next.onended = () => { if (version === generation.current) stop() }
      next.onerror = () => {
        if (version !== generation.current) return
        stop(); setError('Не удалось загрузить аят. Проверьте интернет и попробуйте ещё раз.')
      }
      await next.play()
      if (version !== generation.current) { next.pause(); return }
      setBusy(false)
    } catch {
      if (version !== generation.current) return
      stop(); setError('Не удалось включить аят. Проверьте интернет и попробуйте ещё раз.')
    }
  }
  return { current, busy, error, play, stop }
}
