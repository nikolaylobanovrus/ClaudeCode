import { Link } from 'react-router-dom'

// Задел под личный кабинет: история заказов, повторная генерация,
// управление командой (B2B). Пока — заглушка на входе в заказ по ссылке.
// Полноценный кабинет с авторизацией — следующий этап.
export default function Cabinet() {
  return (
    <div className="wrap">
      <div className="card" style={{ marginTop: 26, textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>Личный кабинет — скоро</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: '46ch', margin: '0 auto 20px' }}>
          Здесь появятся история заказов, повторная генерация и управление командой.
          Пока доступ к заказу — по персональной ссылке, которую вы получили при оформлении.
        </p>
        <Link className="btn btn-dark" to="/app/order">Создать портреты</Link>
      </div>
    </div>
  )
}
