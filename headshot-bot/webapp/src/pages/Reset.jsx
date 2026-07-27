import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { auth, authErr } from '../auth.js'

export default function Reset() {
  const { refresh } = useOutletContext()
  const navigate = useNavigate()
  const token = new URLSearchParams(location.search).get('token') || ''
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
      await auth.reset(token, password)
      await refresh()
      navigate('/app/cabinet')
    } catch (e) { setErr(authErr(e)) } finally { setBusy(false) }
  }

  if (!token) {
    return (
      <div className="wrap" style={{ maxWidth: 440 }}>
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Ссылка недействительна</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
            Откройте ссылку из письма целиком или запросите сброс заново.
          </p>
          <Link className="btn btn-ghost" to="/app/forgot" style={{ marginTop: 16 }}>Запросить сброс</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <form className="card" onSubmit={submit}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Новый пароль</h2>
        <div className="field">
          <input type="password" placeholder="Новый пароль" value={password}
            autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <input type="password" placeholder="Повторите пароль" value={confirm}
            autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {mismatch && <p className="status error">Пароли не совпадают.</p>}
        <button className="btn btn-dark" disabled={busy || !password || mismatch}>
          {busy ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>
        {err && <p className="status error">{err}</p>}
      </form>
    </div>
  )
}
