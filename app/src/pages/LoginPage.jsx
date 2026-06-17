import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import { useAuth } from '../auth/useAuth.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login } = useAuth()
  const [loginValue, setLoginValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to="/groups" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const result = await login(loginValue, passwordValue)

    if (!result.ok) {
      setError(result.message)
      return
    }

    const redirectTo = location.state?.from?.pathname ?? '/groups'
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="login-shell">
      <section className="login-card">
        <div className="login-copy">
          <h1>Вход</h1>
          <p>Введите логин и пароль</p>
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
      </section>
    </div>
  )
}

export default LoginPage
