import { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth, authErr } from '../auth.js'

export default function Forgot() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await auth.forgot(email.trim())
      setSent(true)
    } catch (e) { setErr(authErr(e)) } finally { setBusy(false) }
  }

  if (sent) {
    return (
      <div className="wrap" style={{ maxWidth: 440 }}>
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Проверьте почту</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
            Если аккаунт с адресом <b>{email}</b> существует, мы отправили на него ссылку
            для сброса пароля. Ссылка действует 1 час. Не пришло — проверьте «Спам».
          </p>
          <Link className="btn btn-ghost" to="/app/login" style={{ marginTop: 16 }}>Вернуться ко входу</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <form className="card" onSubmit={submit}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Восстановление пароля</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
          Укажите email аккаунта — пришлём ссылку для установки нового пароля.
        </p>
        <div className="field">
          <input type="email" placeholder="Email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn btn-dark" disabled={busy || !email}>
          {busy ? 'Отправляем…' : 'Прислать ссылку'}
        </button>
        {err && <p className="status error">{err}</p>}
        <p style={{ marginTop: 14, fontSize: 14 }}><Link to="/app/login">← Ко входу</Link></p>
      </form>
    </div>
  )
}
