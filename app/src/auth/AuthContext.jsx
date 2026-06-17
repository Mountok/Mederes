import { useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'
import { AuthContext } from './auth-context.js'

const STORAGE_KEY = 'medrese-auth-session'

function readStoredSession() {
  const storedValue = window.localStorage.getItem(STORAGE_KEY)

  if (!storedValue) {
    return null
  }

  try {
    return JSON.parse(storedValue)
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession())

  useEffect(() => {
    let ignore = false

    async function loadCurrentUser() {
      if (!session?.token) {
        return
      }

      try {
        const { data } = await api.get('/me')
        if (ignore) {
          return
        }

        const nextSession = {
          token: session.token,
          user: data.user,
          school: data.school,
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
        setSession(nextSession)
      } catch {
        if (ignore) {
          return
        }

        window.localStorage.removeItem(STORAGE_KEY)
        setSession(null)
      }
    }

    loadCurrentUser()

    return () => {
      ignore = true
    }
  }, [session?.token])

  async function login(loginValue, passwordValue) {
    try {
      const { data } = await api.post('/auth/login', {
        login: loginValue.trim(),
        password: passwordValue,
      })

      const nextSession = {
        token: data.token,
        user: data.user,
        school: data.school,
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
      setSession(nextSession)

      return { ok: true, user: data.user }
    } catch (error) {
      return {
        ok: false,
        message: error?.response?.data?.error?.message ?? 'Неверный логин или пароль',
      }
    }
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }

  const user = session?.user ?? null
  const school = session?.school ?? null

  const value = useMemo(
    () => ({
      user,
      school,
      token: session?.token ?? null,
      login,
      logout,
      isTeacher: user?.role === 'teacher',
      isStaff: user?.role === 'staff',
      canManageAssignedGroups: user?.role === 'teacher' || user?.role === 'staff',
      isParent: user?.role === 'parent',
      isStudent: user?.role === 'student',
    }),
    [school, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
