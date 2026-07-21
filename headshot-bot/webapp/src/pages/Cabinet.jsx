import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { auth, authErr, ORDER_STATE } from '../auth.js'

const ACTION = {
  awaiting_payment: 'Оплатить',
  collecting: 'Загрузить фото',
  training: 'Открыть',
  generating: 'Открыть',
  delivering: 'Открыть',
  done: 'Скачать портреты',
  failed: 'Открыть',
  cancelled: 'Открыть',
}

export default function Cabinet() {
  const { account, ready, refresh } = useOutletContext()
  const navigate = useNavigate()
  const [orders, setOrders] = useState(null)

  // Не авторизован — на вход.
  useEffect(() => {
    if (ready && !account) navigate('/app/login')
  }, [ready, account, navigate])

  useEffect(() => {
    if (account) auth.orders().then((d) => setOrders(d.orders)).catch(() => setOrders([]))
  }, [account])

  if (!account) return null

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        margin: '4px 0 18px', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Личный кабинет</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '2px 0 0' }}>{account.email}</p>
        </div>
        <Link className="btn btn-dark" to="/app/order">Создать новые портреты</Link>
      </div>

      {!account.verified && <VerifyBanner email={account.email} refresh={refresh} />}

      {orders === null && <p style={{ color: 'var(--muted)' }}>Загружаем заказы…</p>}
      {orders && orders.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '4px 0 16px' }}>
            У вас пока нет заказов. Создайте первый — это займёт пару минут.
          </p>
          <Link className="btn btn-dark" to="/app/order">Создать портреты</Link>
        </div>
      )}

      {orders && orders.map((o) => <OrderCard key={o.token} o={o} />)}

      <ChangePassword />
    </div>
  )
}

function OrderCard({ o }) {
  const done = o.state === 'done'
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString('ru-RU') : ''
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: 15.5 }}>
            Заказ {o.package ? `«${o.package}»` : ''} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {date}</span>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--accent-deep)', marginTop: 3 }}>
            {ORDER_STATE[o.state] || o.state}
            {done && o.results_count ? ` · ${o.results_count} портретов` : ''}
          </div>
        </div>
        <Link className={done ? 'btn btn-dark' : 'btn btn-ghost'}
          to={`/app/order?t=${o.token}`} style={{ padding: '10px 18px', fontSize: 14 }}>
          {ACTION[o.state] || 'Открыть'}
        </Link>
      </div>
      {done && o.results.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {o.results.map((r) => (
            <img key={r.id} src={r.url} alt="" loading="lazy"
              style={{ width: 68, height: 90, objectFit: 'cover', borderRadius: 8 }} />
          ))}
        </div>
      )}
    </div>
  )
}

function VerifyBanner({ email }) {
  const [sent, setSent] = useState(false)
  async function resend() {
    try { await auth.resendVerify(); setSent(true) } catch { /* ничего */ }
  }
  return (
    <div className="card" style={{ marginBottom: 14, background: '#FBF3E1', borderColor: '#EBD9B3' }}>
      <div style={{ fontSize: 14 }}>
        <b>Подтвердите email.</b> Мы отправили письмо на <b>{email}</b> — перейдите по ссылке из него.
        {sent
          ? <span style={{ color: 'var(--muted)' }}> Письмо отправлено повторно.</span>
          : <> <button onClick={resend}
              style={{ background: 'none', border: 0, color: 'var(--accent-deep)', cursor: 'pointer', fontSize: 14, textDecoration: 'underline', padding: 0 }}>
              Отправить снова
            </button></>}
      </div>
    </div>
  )
}

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [oldp, setOldp] = useState('')
  const [newp, setNewp] = useState('')
  const [msg, setMsg] = useState({ text: '', error: false })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg({ text: '', error: false })
    try {
      await auth.changePassword(oldp, newp)
      setMsg({ text: 'Пароль изменён.', error: false })
      setOldp(''); setNewp('')
    } catch (e) { setMsg({ text: authErr(e), error: true }) } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 15, fontWeight: 650, padding: 0 }}>
        Сменить пароль {open ? '▲' : '▼'}
      </button>
      {open && (
        <form onSubmit={submit} style={{ marginTop: 14 }}>
          <div className="field">
            <input type="password" placeholder="Текущий пароль" value={oldp}
              autoComplete="current-password" onChange={(e) => setOldp(e.target.value)} />
          </div>
          <div className="field">
            <input type="password" placeholder="Новый пароль (минимум 8 символов)" value={newp}
              autoComplete="new-password" onChange={(e) => setNewp(e.target.value)} />
          </div>
          <button className="btn btn-dark" disabled={busy || !oldp || newp.length < 8}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </form>
      )}
    </div>
  )
}
