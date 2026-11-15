import api from './client.js'

export function practiceErrorMessage(error) {
  const detail = error.response?.data?.error
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message
  if (error.code === 'ECONNABORTED') return 'Проверка заняла слишком много времени.'
  return 'Не удалось связаться с сервисом проверки. Попробуйте ещё раз.'
}

export function checkPracticeHealth(signal) {
  return api.get('/practice/health', { signal, timeout: 5000 })
}

export async function recognizeReading({ stage, selection, attemptId, seq, audio, signal }) {
  const { data } = await api.post(`/practice/${stage}`, audio, {
    params: {
      surah: selection.surah,
      ayah_from: selection.ayahFrom,
      ayah_to: selection.ayahTo,
      session: attemptId,
      seq,
    },
    headers: { 'Content-Type': audio.type === 'audio/wav' ? 'audio/wav' : 'application/octet-stream', 'X-Attempt-Id': attemptId },
    signal,
    timeout: 90000,
  })
  if (!data?.tracking) throw new Error('Сервис вернул неполный результат.')
  return data
}
