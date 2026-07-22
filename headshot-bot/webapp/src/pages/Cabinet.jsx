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
  const { account, ready } = useOutletContext()
  const navigate = useNavigate()
  const [orders, setOrders] = useState(null)
  const [teamReq, setTeamReq] = useState([])
  const team = new URLSearchParams(location.search).get('team')
  const [quote, setQuote] = useState(null)

  // Не авторизован — на вход.
  useEffect(() => {
    if (ready && !account) navigate('/app/login')
  }, [ready, account, navigate])

  useEffect(() => {
    if (account) auth.orders()
      .then((d) => { setOrders(d.orders); setTeamReq(d.team_requests || []) })
      .catch(() => setOrders([]))
  }, [account])

  // Расчёт по числу сотрудников из ползунка на главной (B2B).
  useEffect(() => {
    if (account && team) auth.teamQuote(team).then(setQuote).catch(() => {})
  }, [account, team])

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

      {quote && <TeamOffer quote={quote} navigate={navigate} />}

      {teamReq.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, color: 'var(--muted)', margin: '4px 0 8px' }}>Заявки для команды</h3>
          {teamReq.map((t) => <TeamRequestCard key={t.id} t={t} />)}
        </>
      )}

      {orders === null && <p style={{ color: 'var(--muted)' }}>Загружаем заказы…</p>}
      {orders && orders.length === 0 && teamReq.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '4px 0 16px' }}>
            У вас пока нет заказов. Создайте первый — это займёт пару минут.
          </p>
          <Link className="btn btn-dark" to="/app/order">Создать портреты</Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <h3 style={{ fontSize: 15, color: 'var(--muted)', margin: '18px 0 8px' }}>Заказы</h3>
      )}
      {orders && orders.map((o) => <OrderCard key={o.token} o={o} />)}

      <ChangePassword />
    </div>
  )
}

function TeamOffer({ quote, navigate }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fmt = (x) => x.toLocaleString('ru-RU') + ' ₽'

  async function payCard() {
    setBusy(true); setErr('')
    try {
      await auth.teamCheckout({ mode: 'card', headcount: quote.headcount })
      navigate('/app/team-pending')
    } catch { setErr('Не удалось отправить заявку. Попробуйте ещё раз.'); setBusy(false) }
  }

  const Row = ({ label, value, accent }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <span style={{ color: '#B9BCC2', fontSize: 14 }}>{label}</span>
      <b style={{ color: accent ? '#E8B96A' : '#F2F0EC', fontSize: 15 }}>{value}</b>
    </div>
  )

  return (
    <div className="card" style={{ marginBottom: 16, background: '#1B1D22', borderColor: 'transparent' }}>
      <h3 style={{ fontSize: 20, margin: '0 0 4px', color: '#F2F0EC' }}>Портреты для команды</h3>
      <p style={{ color: '#B9BCC2', fontSize: 14, margin: '0 0 12px' }}>
        Расчёт по вашему выбору — {quote.headcount} сотрудников. Оплата один раз, без подписки.
      </p>
      <div style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
        <Row label="Сотрудников" value={quote.headcount} />
        <Row label={`Цена за сотрудника (−${quote.percent}%)`} value={fmt(quote.per_seat)} />
        <Row label="Экономия против тарифа для одного" value={fmt(quote.discount)} accent />
        <Row label="Каждый сотрудник получит"
          value={`${quote.portraits_per_seat} портретов · ${quote.styles_per_seat} образов`} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0 2px',
        borderTop: '1px solid rgba(255,255,255,.12)', marginTop: 6, color: '#F2F0EC' }}>
        <span style={{ fontSize: 15 }}>Итого</span>
        <b style={{ fontSize: 22, fontFamily: 'Georgia, serif' }}>{fmt(quote.total)}</b>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <Link className="btn" to={`/app/team-invoice?team=${quote.headcount}`}
          style={{ background: '#fff', color: 'var(--ink)', padding: '12px 22px', fontSize: 15, textDecoration: 'none' }}>
          Получить счёт
        </Link>
        <button className="btn" disabled={busy} onClick={payCard}
          style={{ padding: '12px 22px', fontSize: 15, background: 'transparent',
            border: '1.5px solid rgba(242,240,236,.35)', color: '#F2F0EC' }}>
          {busy ? 'Отправляем…' : 'Оплатить картой/СБП'}
        </button>
      </div>
      {err && <p className="status error" style={{ color: '#ffb4ab' }}>{err}</p>}
    </div>
  )
}

function TeamRequestCard({ t }) {
  const date = t.created_at ? new Date(t.created_at).toLocaleDateString('ru-RU') : ''
  const status = t.mode === 'card'
    ? 'Оплата картой/СБП — вышлем ссылку и QR на email'
    : 'Счёт формируется — направим на email'
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 650, fontSize: 15.5 }}>
        Команда · {t.headcount} сотрудников
        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
          {t.total_rub ? ` · ${t.total_rub.toLocaleString('ru-RU')} ₽` : ''} · {date}
        </span>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--accent-deep)', marginTop: 3 }}>{status}</div>
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
            {o.package_title ? `Пакет «${o.package_title}»` : 'Заказ'} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {date}</span>
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
