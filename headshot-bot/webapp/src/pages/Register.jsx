import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { auth, authErr } from '../auth.js'

export default function Register() {
  const { account, ready, refresh } = useOutletContext()
  const navigate = useNavigate()
  // Уже вошёл — регистрация не нужна, сразу к оформлению заказа.
  useEffect(() => {
    if (ready && account) navigate('/app/order', { replace: true })
  }, [ready, account, navigate])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm

  async function submit(e) {
    e.preventDefault()
    if (mismatch) return
    setBusy(true); setErr('')
    try {
      await auth.register(email.trim(), password)
      await refresh()
      navigate('/app/cabinet')
    } catch (e) { setErr(authErr(e)) } finally { setBusy(false) }
  }

  if (account) return null  // редирект в процессе — форму не показываем

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <form className="card" onSubmit={submit}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Создать аккаунт</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
          В кабинете — все ваши заказы, статусы и готовые портреты в одном месте.
        </p>
        <div className="field">
          <input type="email" placeholder="Email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <input type="password" placeholder="Пароль (минимум 8 символов)" value={password}
            autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <input type="password" placeholder="Повторите пароль" value={confirm}
            autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {mismatch && <p className="status error">Пароли не совпадают.</p>}
        <button className="btn btn-dark" disabled={busy || password.length < 8 || mismatch || !email}>
          {busy ? 'Создаём…' : 'Создать аккаунт'}
        </button>
        {err && <p className="status error">{err}</p>}
        <p style={{ marginTop: 14, fontSize: 14 }}>
          Уже есть аккаунт? <Link to="/app/login">Войти</Link>
        </p>
      </form>
    </div>
  )
}
