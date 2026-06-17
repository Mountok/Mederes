import axios from 'axios'

const STORAGE_KEY = 'medrese-auth-session'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (raw) {
    try {
      const session = JSON.parse(raw)

      if (session?.token) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${session.token}`
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  return config
})

export default api
