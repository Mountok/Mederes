import { useEffect, useRef, useState } from 'react'
import { checkPracticeHealth, practiceErrorMessage, recognizeReading } from '../api/practiceApi.js'
import { latestQueue, wavBlob, wavWindowBlob } from './pcm.js'
import { combineResults, retainConfirmedWords } from './liveTracking.js'

const LIVE_INTERVAL_SECONDS = 4
const LIVE_WINDOW_SECONDS = 12
const CONFIRM_INTERVAL_SECONDS = 8
const MIN_LIVE_AUDIO_SECONDS = 3

export default function useLiveRecitation(selection, refreshAccess) {
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [finalAudio, setFinalAudio] = useState(null)
  const session = useRef(null)
  function dispose(run) {
    if (!run) return
    run.closed = true
    clearInterval(run.timer)
    run.queue?.close(); run.confirmQueue?.close(); run.controller?.abort()
    run.controllers?.forEach(controller => controller.abort())
    run.stream?.getTracks().forEach(track => track.stop())
    run.source?.disconnect(); run.node?.disconnect()
    if (run.context && run.context.state !== 'closed') void run.context.close().catch(() => {})
  }
  useEffect(() => () => dispose(session.current), [])
  function reset() {
    dispose(session.current); session.current = null
    setPhase('idle'); setResult(null); setError(''); setSeconds(0); setLevel(0)
    setProcessing(false)
    setFinalAudio(null)
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
    run.finalBlob = blob
    setFinalAudio(blob)
    run.queue.close()
    run.confirmQueue.close()
    run.controllers.forEach(controller => controller.abort())
    void run.send({ blob, final: true })
  }
  async function start() {
    reset()
    const run = { id: crypto.randomUUID(), chunks: [], samples: 0, closed: false, stopping: false,
      seq: 0, confirmSeq: 0, controllers: new Set(), inflight: 0, previewResult: null, confirmResult: null }
    session.current = run
    setPhase('requesting')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) throw new Error('Микрофон недоступен. Откройте сайт в Chrome или загрузите запись.')
      run.controller = new AbortController()
      try {
        await checkPracticeHealth(run.controller.signal)
      } catch (err) {
        if (err.response?.status === 402) void refreshAccess()
        throw new Error(practiceErrorMessage(err))
      }
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
      run.send = async ({ blob, final, confirm, seq }) => {
        if (run.closed) return
        run.inflight += 1; setProcessing(true)
        const controller = new AbortController()
        run.controllers.add(controller)
        try {
          const data = await recognizeReading({
            stage: final ? 'listen/final' : confirm ? 'confirm' : 'listen',
            selection, attemptId: run.id, seq, audio: blob, signal: controller.signal,
          })
          if (!run.closed && !final && !run.counted && data.transcript?.trim()) {
            run.counted = true
            void refreshAccess()
          }
          if (!run.closed && (final || !run.stopping)) {
            if (final) setResult(retainConfirmedWords(data, run.previewResult, run.confirmResult))
            else {
              if (confirm) run.confirmResult = data
              else run.previewResult = data
              setResult(combineResults(run.previewResult, run.confirmResult))
            }
            setError('')
          }
          if (final && !run.closed) setPhase('done')
        } catch (err) {
          if (!run.closed && (final || !run.stopping)) {
            const status = err.response?.status
            if (!final && [422, 429].includes(status)) return
            if (!final && status === 402) {
              dispose(run)
              setProcessing(false)
              setPhase('idle')
              void refreshAccess()
            }
            setError(practiceErrorMessage(err))
            if (final) setPhase('done')
          }
        } finally {
          if (final && !run.closed) void refreshAccess()
          run.controllers.delete(controller)
          run.inflight -= 1
          if (!run.closed) setProcessing(run.inflight > 0)
        }
      }
      run.queue = latestQueue(run.send)
      run.confirmQueue = latestQueue(run.send)
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
        if (elapsed - (run.lastConfirmed || 0) >= CONFIRM_INTERVAL_SECONDS && run.samples >= run.rate * MIN_LIVE_AUDIO_SECONDS) {
          run.lastConfirmed = elapsed
          run.confirmQueue.push({ blob: wavWindowBlob(run.chunks, run.rate, LIVE_WINDOW_SECONDS),
            confirm: true, seq: ++run.confirmSeq })
        }
      }, 250)
      setPhase('listening')
    } catch (err) {
      if (run.closed) return
      dispose(run); setPhase('idle')
      setError(err.name === 'NotAllowedError' ? 'Разрешите доступ к микрофону в настройках браузера.' : err.name === 'NotFoundError' ? 'Микрофон не найден.' : err.name === 'AbortError' ? 'AI-сервис не отвечает. Запустите его и повторите.' : err.message)
    }
  }
  function retryFinal() {
    const run = session.current
    if (!run?.finalBlob || run.closed || run.inflight || phase !== 'done') return
    setError('')
    setPhase('finishing')
    void run.send({ blob: run.finalBlob, final: true })
  }
  return { retryFinal, phase, result, error, seconds, level, processing, finalAudio, start, stop, reset }
}
