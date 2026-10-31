import { useEffect, useRef, useState } from 'react'
import { combineResults, keepAlignedProvisional } from './liveTracking.js'
import { pcm16Buffer } from './pcm.js'

export default function useLiveRecitation(selection) {
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [processing, setProcessing] = useState(false)
  const session = useRef(null)

  function dispose(run) {
    if (!run) return
    run.closed = true
    clearInterval(run.timer)
    clearTimeout(run.finalTimeout)
    run.socket?.close()
    run.stream?.getTracks().forEach(track => track.stop())
    run.source?.disconnect()
    run.node?.disconnect()
    if (run.context && run.context.state !== 'closed') void run.context.close().catch(() => {})
  }
  useEffect(() => () => dispose(session.current), [])

  function reset() {
    dispose(session.current)
    session.current = null
    setPhase('idle'); setResult(null); setError(''); setSeconds(0); setLevel(0); setProcessing(false)
  }

  async function stop() {
    const run = session.current
    if (!run || run.closed || run.stopping || !run.node) return
    run.stopping = true
    clearInterval(run.timer)
    run.stream.getTracks().forEach(track => track.stop())
    run.source.disconnect()
    setPhase('finishing'); setLevel(0); setProcessing(true)
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 1000)
      run.flushed = () => { clearTimeout(timeout); resolve() }
      run.node.port.postMessage('flush')
    })
    if (run.closed) return
    run.node.disconnect()
    void run.context.close().catch(() => {})
    if (run.socket.readyState === WebSocket.OPEN) run.socket.send(JSON.stringify({ type: 'stop' }))
    run.finalTimeout = setTimeout(() => {
      if (!run.closed) { setError('Проверка заняла слишком много времени. Попробуйте ещё раз.'); setPhase('done'); setProcessing(false); run.socket.close() }
    }, 90000)
  }

  async function start() {
    reset()
    const run = { closed: false, stopping: false, preview: null, confirmed: null, previewSeq: 0, confirmSeq: 0 }
    session.current = run
    setPhase('requesting')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) throw new Error('Микрофон недоступен. Откройте сайт в Chrome или загрузите запись.')
      run.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }, video: false })
      if (run.closed) return
      run.context = new AudioContext()
      await run.context.audioWorklet.addModule('/recitation-capture.js')
      if (run.closed) return
      await run.context.resume()
      run.rate = run.context.sampleRate
      run.source = run.context.createMediaStreamSource(run.stream)
      run.node = new AudioWorkletNode(run.context, 'recitation-capture', { channelCount: 1 })
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      run.socket = new WebSocket(`${protocol}//${location.host}/ai-stream`)
      run.socket.binaryType = 'arraybuffer'
      run.socket.onopen = () => run.socket.send(JSON.stringify({
        type: 'start', surah: selection.surah, ayah_from: selection.ayahFrom,
        ayah_to: selection.ayahTo, sample_rate: run.rate,
      }))
      run.socket.onmessage = ({ data }) => {
        if (run.closed) return
        let message
        try { message = JSON.parse(data) } catch { return }
        if (message.type === 'ready') {
          run.node.port.onmessage = ({ data: audio }) => {
            if (run.closed) return
            if (audio.type === 'flushed') { run.flushed?.(); return }
            if (audio.type !== 'samples') return
            const samples = audio.samples
            if (run.socket.readyState === WebSocket.OPEN) run.socket.send(pcm16Buffer(samples))
            if (!run.stopping) setLevel(Math.min(1, Math.sqrt(samples.reduce((sum, x) => sum + x*x, 0) / samples.length) * 8))
          }
          run.source.connect(run.node)
          run.node.connect(run.context.destination)
          run.started = performance.now()
          run.timer = setInterval(() => {
            const elapsed = (performance.now() - run.started) / 1000
            setSeconds(Math.min(55, Math.floor(elapsed)))
            if (elapsed >= 55) void stop()
          }, 250)
          setPhase('listening')
          return
        }
        if (message.type === 'error') {
          setError(message.error || 'Не удалось обработать запись.')
          setProcessing(false)
          if (run.stopping) {
            setResult(keepAlignedProvisional(null, run.preview, run.confirmed))
            setPhase('done')
          }
          else { dispose(run); setPhase('idle') }
          return
        }
        if (message.type === 'preview' || message.type === 'confirm') {
          if (run.stopping || !message.result?.tracking) return
          if (message.type === 'preview' && message.seq > run.previewSeq) {
            run.previewSeq = message.seq; run.preview = message.result
          }
          if (message.type === 'confirm' && message.seq > run.confirmSeq) {
            run.confirmSeq = message.seq; run.confirmed = message.result
          }
          setResult(combineResults(run.preview, run.confirmed))
          setError('')
          return
        }
        if (message.type === 'final') {
          clearTimeout(run.finalTimeout)
          setResult(keepAlignedProvisional(message.result, run.preview, run.confirmed))
          setPhase('done'); setProcessing(false); setError('')
        }
      }
      run.socket.onerror = () => {
        if (!run.closed) setError('Не удалось связаться с AI-сервисом. Проверьте локальный запуск.')
      }
      run.socket.onclose = () => {
        if (run.closed) return
        if (run.stopping) { setPhase('done'); setProcessing(false) }
        else {
          dispose(run); setPhase('idle')
          setError(run.started ? 'Соединение с AI-сервисом прервалось. Начните чтение заново.' : 'AI-сервис недоступен. Запустите его и повторите.')
        }
      }
    } catch (err) {
      if (run.closed) return
      dispose(run); setPhase('idle')
      setError(err.name === 'NotAllowedError' ? 'Разрешите доступ к микрофону в настройках браузера.' : err.name === 'NotFoundError' ? 'Микрофон не найден.' : err.message)
    }
  }
  return { phase, result, error, seconds, level, processing, start, stop, reset }
}
