import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import { useAuth } from '../auth/useAuth.jsx'
import PublicFooter from '../components/PublicFooter.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login } = useAuth()
  const [loginValue, setLoginValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [error, setError] = useState('')

  if (user && user.role !== 'reader') {
    return <Navigate to={user.role === 'platform_admin' ? '/platform' : '/groups'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const result = await login(loginValue, passwordValue)

    if (!result.ok) {
      setError(result.message)
      return
    }

    const redirectTo = result.user.role === 'platform_admin' ? '/platform' : (location.state?.from?.pathname ?? '/groups')
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="login-shell">
      <section className="login-card">
        <div className="login-copy">
          <h1>Вход в журнал</h1>
          <p>Для школы, преподавателя или ученика. Введите выданные вам логин и пароль.</p>
          {user?.role === 'reader' && <p>Вы вошли в личную практику. Вход в журнал переключит аккаунт.</p>}
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <Input
            label="Логин"
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
          />
          <Input
            label="Пароль"
            type="password"
            value={passwordValue}
            onChange={(event) => setPasswordValue(event.target.value)}
          />

          {error ? <div className="form-error">{error}</div> : null}

          <Button type="submit" fullWidth>
            Войти
          </Button>
        </form>
        <Link className="login-practice-link" to="/reader">Хотите практиковать чтение? Личный вход</Link>
      </section>
      <PublicFooter />
    </div>
  )
}

export default LoginPage
