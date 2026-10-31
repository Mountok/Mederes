import { useEffect, useRef, useState } from 'react'
import { latestQueue, wavBlob, wavWindowBlob } from './pcm.js'

const LIVE_INTERVAL_SECONDS = 4
const LIVE_WINDOW_SECONDS = 12
const MIN_LIVE_AUDIO_SECONDS = 3

export default function useLiveRecitation(selection) {
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [processing, setProcessing] = useState(false)
  const session = useRef(null)
  function endpoint(path) {
    const query = new URLSearchParams({
      surah: String(selection.surah),
      ayah_from: String(selection.ayahFrom),
      ayah_to: String(selection.ayahTo),
      session: session.current?.id || '',
    })
    return `${path}?${query}`
  }
  function dispose(run) {
    if (!run) return
    run.closed = true
    clearInterval(run.timer)
    run.queue?.close(); run.controller?.abort()
    run.stream?.getTracks().forEach(track => track.stop())
    run.source?.disconnect(); run.node?.disconnect()
    if (run.context && run.context.state !== 'closed') void run.context.close().catch(() => {})
  }
  useEffect(() => () => dispose(session.current), [])
  function reset() {
    dispose(session.current); session.current = null
    setPhase('idle'); setResult(null); setError(''); setSeconds(0); setLevel(0)
    setProcessing(false)
  }
  async function stop() {
    const run = session.current
    if (!run || run.closed || run.stopping || !run.node) return
    run.stopping = true
    clearInterval(run.timer)
    run.stream.getTracks().forEach(track => track.stop())
    run.source.disconnect()
    setPhase('finishing'); setLevel(0)
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 1000)
      run.flushed = () => { clearTimeout(timeout); resolve() }
      run.node.port.postMessage('flush')
    })
    if (run.closed) return
    run.node.disconnect(); void run.context.close().catch(() => {})
    const blob = wavBlob(run.chunks, run.rate)
    run.queue.close()
    run.controller?.abort()
    void run.send({ blob, final: true })
  }
  async function start() {
    reset()
    const run = { id: crypto.randomUUID(), chunks: [], samples: 0, closed: false, stopping: false, seq: 0 }
    session.current = run
    setPhase('requesting')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) throw new Error('Микрофон недоступен. Откройте сайт в Chrome или загрузите запись.')
      run.controller = new AbortController()
      const timeout = setTimeout(() => run.controller.abort(), 5000)
      let health
      try { health = await fetch('/ai-api/health', { signal: run.controller.signal }) }
      finally { clearTimeout(timeout) }
      if (!health.ok) throw new Error('Запустите локальный AI-сервис и попробуйте ещё раз.')
      if (run.closed) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true }, video: false })
      if (run.closed) { stream.getTracks().forEach(track => track.stop()); return }
      run.stream = stream
      run.context = new AudioContext()
      await run.context.audioWorklet.addModule('/recitation-capture.js')
      if (run.closed) return
      await run.context.resume()
      if (run.closed) return
      run.rate = run.context.sampleRate
      run.source = run.context.createMediaStreamSource(stream)
      run.node = new AudioWorkletNode(run.context, 'recitation-capture', { channelCount: 1 })
      run.send = async ({ blob, final, seq }) => {
        if (run.closed) return
        setProcessing(true)
        const controller = new AbortController()
        run.controller = controller
        const requestTimeout = setTimeout(() => controller.abort(), 90000)
        try {
          const path = endpoint(`/ai-api/listen${final ? '/final' : ''}`)
          const url = seq === undefined ? path : `${path}&seq=${seq}`
          const response = await fetch(url, {
            method: 'POST', body: blob, signal: controller.signal,
            headers: { 'Content-Type': 'audio/wav', 'X-Al-Qalam-Test': '1' },
          })
          const data = await response.json().catch(() => null)
          if (!response.ok) {
            if (!final && [422, 429].includes(response.status)) return
            throw new Error(data?.error || 'Не удалось связаться с AI-сервисом.')
          }
          if (!data?.tracking) throw new Error('Перезапустите AI-сервис: нужна обновлённая версия.')
          if (!run.closed && (final || !run.stopping)) { setResult(data); setError('') }
          if (final && !run.closed) setPhase('done')
        } catch (err) {
          if (!run.closed && (final || !run.stopping)) {
            setError(err.name === 'AbortError' ? 'Распознавание заняло слишком много времени.' : err.message)
            if (final) setPhase('done')
          }
        } finally { clearTimeout(requestTimeout); if (!run.closed && run.controller === controller) setProcessing(false) }
      }
      run.queue = latestQueue(run.send)
      run.node.port.onmessage = ({ data }) => {
        if (run.closed) return
        if (data.type === 'flushed') { run.flushed?.(); return }
        if (data.type !== 'samples') return
        const remaining = Math.max(0, 55 * run.rate - run.samples)
        const samples = data.samples.subarray(0, remaining)
        if (samples.length) {
          run.chunks.push(samples); run.samples += samples.length
          if (!run.stopping) setLevel(Math.min(1, Math.sqrt(samples.reduce((sum, x) => sum + x*x, 0) / samples.length) * 8))
        }
        if (!remaining && !run.stopping) void stop()
      }
      run.source.connect(run.node)
      run.node.connect(run.context.destination) // Worklet outputs silence, not mic monitoring.
      run.started = performance.now(); run.lastSent = 0
      run.timer = setInterval(() => {
        const elapsed = (performance.now() - run.started) / 1000
        setSeconds(Math.min(55, Math.floor(elapsed)))
        if (elapsed >= 55) { void stop(); return }
        if (elapsed - run.lastSent >= LIVE_INTERVAL_SECONDS && run.samples >= run.rate * MIN_LIVE_AUDIO_SECONDS) {
          run.lastSent = elapsed
          run.queue.push({ blob: wavWindowBlob(run.chunks, run.rate, LIVE_WINDOW_SECONDS), final: false, seq: ++run.seq })
        }
      }, 250)
      setPhase('listening')
    } catch (err) {
      if (run.closed) return
      dispose(run); setPhase('idle')
      setError(err.name === 'NotAllowedError' ? 'Разрешите доступ к микрофону в настройках браузера.' : err.name === 'NotFoundError' ? 'Микрофон не найден.' : err.name === 'AbortError' ? 'AI-сервис не отвечает. Запустите его и повторите.' : err.message)
    }
  }
  return { phase, result, error, seconds, level, processing, start, stop, reset }
}
