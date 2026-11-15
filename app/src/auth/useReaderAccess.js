import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/client.js'

export function useReaderAccess(user) {
  const readerId = user?.role === 'reader' ? user.id : null
  const [state, setState] = useState(null)
  const pending = useRef(null)

  const refresh = useCallback(async () => {
    if (!readerId) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    try {
      const { data } = await api.get('/readers/access', { signal: controller.signal, timeout: 10000 })
      if (!controller.signal.aborted) setState({ readerId, access: data })
    } catch {
      if (!controller.signal.aborted) setState({ readerId, error: 'Не удалось загрузить остаток проверок.' })
    }
  }, [readerId])

  useEffect(() => {
    if (!readerId) return
    const initialLoad = window.setTimeout(refresh, 0)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener('focus', refresh)
      pending.current?.abort()
    }
  }, [readerId, refresh])

  const access = state?.readerId === readerId ? state?.access : null
  const error = state?.readerId === readerId ? state?.error : null
  const exhausted = Boolean(access && !access.subscribed && access.remaining === 0)
  return { access, error, exhausted, refresh, canStart: !readerId || Boolean(access && !exhausted) }
}
