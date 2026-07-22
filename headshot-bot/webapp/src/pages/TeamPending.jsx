import { Link } from 'react-router-dom'

// Клиент нажал «Оплатить картой/СБП» — заявка ушла в продажи, оплата пока
// обрабатывается вручную. Извиняемся и обещаем прислать ссылку/QR на email.
export default function TeamPending() {
  return (
    <div className="wrap" style={{ maxWidth: 560 }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🛠️</div>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>Оплата картой/СБП — скоро</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: '48ch', margin: '0 auto 8px' }}>
          Приносим извинения — мгновенная оплата картой и по СБП для команд ещё в разработке.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: '48ch', margin: '0 auto 18px' }}>
          Мы уже получили вашу заявку и в ближайшее время направим <b>ссылку и QR-код для оплаты
          на ваш email</b>. Если удобнее по счёту — можно оформить его прямо сейчас.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-dark" to="/app/cabinet">В личный кабинет</Link>
        </div>
      </div>
    </div>
  )
}
