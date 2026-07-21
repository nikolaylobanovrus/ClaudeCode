import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { auth, authErr } from '../auth.js'

export default function Login() {
  const { refresh } = useOutletContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await auth.login(email.trim(), password)
      await refresh()
      navigate('/app/cabinet')
    } catch (e) { setErr(authErr(e)) } finally { setBusy(false) }
  }

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <form className="card" onSubmit={submit}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Вход в кабинет</h2>
        <div className="field">
          <input type="email" placeholder="Email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <input type="password" placeholder="Пароль" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-dark" disabled={busy || !email || !password}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        {err && <p className="status error">{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 14 }}>
          <Link to="/app/forgot">Забыли пароль?</Link>
          <Link to="/app/register">Создать аккаунт</Link>
        </div>
      </form>
    </div>
  )
}
