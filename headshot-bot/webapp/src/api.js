// Тонкий клиент нашего JSON-API. Фронт и бэк развязаны — тот же API
// использует и статический сайт, и (позже) кабинет с конструктором.

async function req(url, opts) {
  const r = await fetch(url, opts)
  let data = null
  try { data = await r.json() } catch { /* пустой ответ */ }
  if (!r.ok) {
    const err = new Error((data && data.error) || 'request_failed')
    err.status = r.status
    err.code = data && data.error
    throw err
  }
  return data
}

export const api = {
  packages: () => req('/api/packages'),
  styles: () => req('/api/styles'),
  // Каталог конструктора: kind=clothing|background, gender=male|female.
  wardrobe: (kind, gender = 'male') =>
    req(`/api/wardrobe?kind=${kind}&gender=${gender}`),

  // Флоу: тариф → образы (пол + пул одежды + пул фонов) → СЕЛФИ → оплата.
  // Черновик заказа создаётся ДО оплаты (state=collecting), чтобы клиент мог
  // загрузить селфи; email и оплата — на шаге checkout.
  createDraft(pkg, { gender, clothing, backgrounds }) {
    const f = new FormData()
    f.append('package', pkg)
    f.append('consent', 'yes')
    f.append('gender', gender)
    f.append('clothing', clothing.join(','))
    f.append('backgrounds', backgrounds.join(','))
    return req('/api/orders', { method: 'POST', body: f })
  },
  // Оплата после загрузки селфи: привязывает email/аккаунт и создаёт платёж.
  checkout(token, contact) {
    const f = new FormData()
    if (contact) f.append('contact', contact)
    return req(`/api/orders/${token}/checkout`, { method: 'POST', body: f })
  },
  uploadPhoto(token, file) {
    const f = new FormData()
    f.append('photo', file)
    return req(`/api/orders/${token}/photos`, { method: 'POST', body: f })
  },
  // Запуск генерации после загрузки селфи — образы уже сохранены в заказе.
  generate(token) {
    return req(`/api/orders/${token}/generate`, { method: 'POST', body: new FormData() })
  },
  repay: (token) => req(`/api/orders/${token}/pay`, { method: 'POST' }),
  status: (token) => req(`/api/orders/${token}`),
  // Remix готового кадра: mode = clothing|background|regen (+ новый ключ).
  remix(token, { source, mode, clothing, background }) {
    const f = new FormData()
    f.append('source', source)
    f.append('mode', mode)
    if (clothing) f.append('clothing', clothing)
    if (background) f.append('background', background)
    return req(`/api/orders/${token}/remix`, { method: 'POST', body: f })
  },
}

export const SWATCHES = {
  studio_grey: 'linear-gradient(165deg,#6f7377,#c9c7c2)',
  hh_white: 'linear-gradient(165deg,#d9d9d6,#fff)',
  office_modern: 'linear-gradient(165deg,#7d8b96,#e2e2d9)',
  suit_navy: 'linear-gradient(165deg,#1d2635,#5d6d88)',
  business_casual: 'linear-gradient(165deg,#9a8f7d,#e6dcc9)',
  outdoor_city: 'linear-gradient(165deg,#5a5f6e,#d9b98a)',
  speaker_stage: 'linear-gradient(165deg,#17181c,#6b5a4a)',
  linkedin_classic: 'linear-gradient(165deg,#3a3d42,#8f9297)',
}

export const ERRORS = {
  consent_required: 'Нужно согласие на обработку фото.',
  bad_contact: 'Укажите email или телефон.',
  too_large: 'Файл больше 10 МБ.',
  not_an_image: 'Файл не читается — нужен JPG или PNG.',
  too_small: 'Фото меньше 512 пикселей по стороне.',
  too_dark: 'Слишком тёмное фото.',
  too_bright: 'Пересвеченное фото.',
  no_face: 'Лицо не найдено — нужно селфи крупнее.',
  limit: 'Достигнут максимум 15 фото.',
  not_enough_photos: 'Нужно минимум 10 фото.',
  styles_count: 'Выберите нужное число образов.',
  bad_package: 'Выберите тариф.',
  bad_gender: 'Выберите пол.',
  bad_wardrobe: 'Некоторые позиции недоступны — обновите страницу.',
  empty_pool: 'Выберите хотя бы одну одежду и один фон.',
  pool_too_small: 'Добавьте больше одежды или фонов для нужного числа образов.',
  pool_too_big: 'Слишком много вариантов — не больше числа образов тарифа.',
  order_not_found: 'Заказ не найден или уже в работе.',
}
export const errText = (e) => ERRORS[e && e.code] || 'Что-то пошло не так, попробуйте ещё раз.'
