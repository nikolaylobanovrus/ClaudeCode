// Клиент аутентификации. Сессия — httpOnly-cookie, поэтому запросы идут с
// credentials, а токен во фронте не хранится.

async function req(url, body) {
  const opts = { credentials: 'same-origin' }
  if (body) {
    const f = new FormData()
    Object.entries(body).forEach(([k, v]) => f.append(k, v))
    opts.method = 'POST'
    opts.body = f
  }
  const r = await fetch(url, opts)
  let data = null
  try { data = await r.json() } catch { /* пусто */ }
  if (!r.ok) {
    const e = new Error((data && data.error) || 'request_failed')
    e.status = r.status; e.code = data && data.error
    throw e
  }
  return data
}

export const auth = {
  me: () => req('/api/auth/me'),
  register: (email, password) => req('/api/auth/register', { email, password }),
  login: (email, password) => req('/api/auth/login', { email, password }),
  logout: () => req('/api/auth/logout', { _: '1' }),
  forgot: (email) => req('/api/auth/forgot', { email }),
  reset: (token, password) => req('/api/auth/reset', { token, password }),
  changePassword: (old_password, new_password) =>
    req('/api/auth/change-password', { old_password, new_password }),
  orders: () => req('/api/account/orders'),
  teamQuote: (n) => req(`/api/team/quote?n=${encodeURIComponent(n)}`),
  teamCheckout: (data) => req('/api/team/checkout', data),
}

export const AUTH_ERRORS = {
  bad_email: 'Некорректный email.',
  weak_password: 'Пароль — минимум 8 символов.',
  email_taken: 'Аккаунт с таким email уже есть — войдите.',
  bad_credentials: 'Неверный email или пароль.',
  bad_token: 'Ссылка недействительна или устарела.',
  unauthorized: 'Нужно войти в аккаунт.',
}
export const authErr = (e) => AUTH_ERRORS[e && e.code] || 'Что-то пошло не так, попробуйте ещё раз.'

export const ORDER_STATE = {
  awaiting_payment: 'Ожидает оплаты',
  collecting: 'Загрузите фото',
  training: 'Обучение нейросети',
  generating: 'Генерация портретов',
  delivering: 'Почти готово',
  done: 'Готово',
  failed: 'Задержка',
  cancelled: 'Отменён',
}
