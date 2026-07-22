import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { auth } from '../auth.js'

export default function TeamInvoice() {
  const { account, ready } = useOutletContext()
  const navigate = useNavigate()
  const team = new URLSearchParams(location.search).get('team') || '1'
  const [quote, setQuote] = useState(null)
  const [f, setF] = useState({ company: '', inn: '', kpp: '', address: '', name: '', phone: '', comment: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (ready && !account) navigate('/app/login') }, [ready, account, navigate])
  useEffect(() => { auth.teamQuote(team).then(setQuote).catch(() => {}) }, [team])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const valid = f.company.trim().length >= 2 && f.inn.trim().length >= 5

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true); setErr('')
    try {
      await auth.teamCheckout({ mode: 'invoice', headcount: team, ...f })
      setDone(true)
    } catch { setErr('Не удалось отправить. Проверьте поля и попробуйте ещё раз.'); setBusy(false) }
  }

  if (!account) return null

  if (done) {
    return (
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Заявка на счёт принята</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: '46ch', margin: '0 auto 18px' }}>
            Сформируем счёт по вашим реквизитам и направим его на <b>{account.email}</b> в течение
            рабочего дня. Там же пришлём инструкцию, как сотрудники загрузят фото.
          </p>
          <Link className="btn btn-dark" to="/app/cabinet">В личный кабинет</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap" style={{ maxWidth: 560 }}>
      <form className="card" onSubmit={submit}>
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Реквизиты для счёта</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
          {quote
            ? `Команда ${quote.headcount} сотрудников · итого ${quote.total.toLocaleString('ru-RU')} ₽`
            : 'Заполните данные организации — выставим счёт на оплату по безналу.'}
        </p>
        <div className="field"><input placeholder="Организация (ООО / ИП)" value={f.company} onChange={set('company')} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><input placeholder="ИНН" value={f.inn} onChange={set('inn')} /></div>
          <div className="field" style={{ flex: 1 }}><input placeholder="КПП (если есть)" value={f.kpp} onChange={set('kpp')} /></div>
        </div>
        <div className="field"><input placeholder="Юридический адрес" value={f.address} onChange={set('address')} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><input placeholder="Контактное лицо" value={f.name} onChange={set('name')} /></div>
          <div className="field" style={{ flex: 1 }}><input placeholder="Телефон" value={f.phone} onChange={set('phone')} /></div>
        </div>
        <div className="field"><input placeholder="Комментарий (необязательно)" value={f.comment} onChange={set('comment')} /></div>
        <button className="btn btn-dark" disabled={busy || !valid}>
          {busy ? 'Отправляем…' : 'Сформировать счёт'}
        </button>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
          Счёт придёт на {account.email}. Оплата по безналу; закрывающие документы предоставим.
        </p>
        <Link to="/app/cabinet" style={{ fontSize: 14, display: 'inline-block', marginTop: 8 }}>← Назад</Link>
        {err && <p className="status error">{err}</p>}
      </form>
    </div>
  )
}
