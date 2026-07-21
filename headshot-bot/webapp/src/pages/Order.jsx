import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api, SWATCHES, errText } from '../api.js'
import { auth, authErr } from '../auth.js'

// Флоу как у HeadshotPro: тариф → оплата → селфи → образы → результат.
const STEPS = ['Тариф', 'Оплата', 'Селфи', 'Образы', 'Результат']
const PROGRESS = [
  ['training', 'Обучение нейросети на ваших фото (~30 минут)'],
  ['generating', 'Генерация портретов'],
  ['done', 'Готово'],
]

export default function Order() {
  const params = new URLSearchParams(location.search)
  const [step, setStep] = useState(1)
  const [token, setToken] = useState(() => params.get('t') || '')
  const [packages, setPackages] = useState([])
  const [pkg, setPkg] = useState(null)
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [paying, setPaying] = useState(false)
  const [thumbs, setThumbs] = useState([])
  const [count, setCount] = useState(0)
  const [stylesLib, setStylesLib] = useState([])
  const [chosen, setChosen] = useState([])
  const [order, setOrder] = useState(null)
  const [msg, setMsg] = useState({ text: '', error: false })
  const drop = useRef(null)
  const wantPkg = params.get('pkg')
  const outlet = useOutletContext()
  const account = outlet?.account
  const refresh = outlet?.refresh

  const say = (text, error = false) => setMsg({ text, error })

  // Вошедшему клиенту подставляем email аккаунта в контакт.
  useEffect(() => {
    if (account?.email) setContact((c) => c || account.email)
  }, [account])

  // Каталог тарифов — сразу (нужен на шаге 1) + предвыбор из ?pkg=.
  // Если тариф уже выбран на лендинге, шаг выбора пропускаем — сразу к оплате.
  useEffect(() => {
    api.packages().then((ps) => {
      setPackages(ps)
      if (wantPkg) {
        const p = ps.find((x) => x.code === wantPkg)
        if (p) { setPkg(p); if (!token) setStep(2) }
      }
    }).catch(() => {})
  }, []) // eslint-disable-line

  // Возврат по ссылке ?t= — восстанавливаем шаг по состоянию заказа.
  useEffect(() => {
    if (!token) return
    api.status(token).then((d) => {
      setOrder(d)  // держим d.package, чтобы восстановить тариф ниже
      if (d.state === 'awaiting_payment') setStep(2)
      else if (d.state === 'collecting') { setCount(d.photos); setStep(3) }
      else setStep(5)
    }).catch(() => {})
  }, []) // eslint-disable-line

  // Восстановление тарифа: после возврата из ЮKassa (?t= без ?pkg=) pkg пуст —
  // берём код пакета из статуса заказа, как только загружен каталог тарифов.
  useEffect(() => {
    if (!pkg && packages.length && order?.package) {
      const p = packages.find((x) => x.code === order.package)
      if (p) setPkg(p)
    }
  }, [packages, order, pkg])

  // Поллинг: ждём оплаты (шаг 2 с токеном) и на шаге результата.
  // Останавливаемся на терминальном статусе, чтобы не долбить сервер вечно.
  useEffect(() => {
    if (!token || (step !== 2 && step !== 5)) return
    let alive = true
    let id
    const tick = () => api.status(token).then((d) => {
      if (!alive) return
      setOrder(d)
      if (step === 2 && d.state === 'collecting') { setCount(d.photos); setStep(3) }
      if (['done', 'failed', 'cancelled'].includes(d.state)) clearInterval(id)
    }).catch(() => {})
    tick()
    id = setInterval(tick, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [step, token])

  // Ревок object URL превью-миниатюр при размонтировании (утечка памяти).
  const thumbsRef = useRef([])
  useEffect(() => () => thumbsRef.current.forEach((u) => URL.revokeObjectURL(u)), [])

  async function pay() {
    if (!pkg) return
    setPaying(true); say('')
    try {
      // Оплата привязана к аккаунту: у гостя создаём его здесь же (или входим,
      // если email уже зарегистрирован) — тогда после оплаты он попадёт в ЛК.
      if (!account) {
        const email = contact.trim()
        try {
          await auth.register(email, password)
        } catch (e) {
          if (e.code === 'email_taken') {
            try {
              await auth.login(email, password)
            } catch {
              say('У этого email уже есть аккаунт, но пароль не подошёл. '
                + 'Войдите или восстановите пароль.', true)
              setPaying(false); return
            }
          } else { say(authErr(e), true); setPaying(false); return }
        }
        await refresh?.()
      }
      const email = account ? account.email : contact.trim()
      const d = await api.createOrder(pkg.code, email)
      setToken(d.token)
      history.replaceState(null, '', `/app/order?t=${d.token}`)
      if (d.payment_url) { window.location.href = d.payment_url; return } // ЮKassa
      if (d.paid) { setStep(3); say(''); return }  // заглушка оплаты
      // Ручной режим: заказ ждёт подтверждения админом — экран ожидания (token уже задан).
      say('')
    } catch (e) { say(errText(e), true) } finally { setPaying(false) }
  }

  // Повторная оплата брошенного заказа (возврат по ссылке в awaiting_payment).
  async function repay() {
    setPaying(true); say('')
    try {
      const d = await api.repay(token)
      if (d.payment_url) { window.location.href = d.payment_url; return }
      if (d.paid) { setStep(3); say('') }
    } catch (e) { say(errText(e), true) } finally { setPaying(false) }
  }

  async function upload(files) {
    let n = count
    for (const f of files) {
      if (n >= 15) break
      say(`Загружаем «${f.name}»…`)
      try {
        const d = await api.uploadPhoto(token, f)
        n = d.count
        setCount(d.count)
        const url = URL.createObjectURL(f)
        thumbsRef.current.push(url)
        setThumbs((t) => [...t, url])
        say(d.count >= 10 ? 'Фото достаточно — можно добавить ещё или идти дальше.' : '')
      } catch (e) { say(errText(e), true) }
    }
  }

  async function toStyles() {
    setStylesLib(await api.styles())
    setChosen([])
    setStep(4)
  }
  function toggleStyle(key) {
    setChosen((c) => c.includes(key) ? c.filter((k) => k !== key)
      : (c.length < pkg.styles ? [...c, key] : c))
  }

  async function generate() {
    const all = pkg.styles >= stylesLib.length
    const styles = all ? stylesLib.map((s) => s.key) : chosen
    try {
      await api.generate(token, styles)
      setOrder({ state: 'training', results: [] })
      setStep(5); say('')
    } catch (e) { say(errText(e), true) }
  }

  const dragHandlers = {
    onDragOver: (e) => { e.preventDefault(); drop.current?.classList.add('drag') },
    onDragLeave: () => drop.current?.classList.remove('drag'),
    onDrop: (e) => { e.preventDefault(); drop.current?.classList.remove('drag'); upload(e.dataTransfer.files) },
  }

  const allStyles = pkg && stylesLib.length > 0 && pkg.styles >= stylesLib.length

  return (
    <div className="wrap">
      <div className="stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}>{i + 1} · {s}</div>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Выберите тариф</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 18 }}>
            Оплата — один раз. Портреты остаются вашими навсегда. После оплаты загрузите селфи и выберите образы.
          </p>
          <div className="plans">
            {packages.map((p) => (
              <div key={p.code} className={`plan ${pkg?.code === p.code ? 'sel' : ''}`} onClick={() => setPkg(p)}>
                {p.recommended && <span className="plan-badge">Рекомендуем</span>}
                <h3>{p.title}</h3>
                <div className="pr">{p.price_rub} ₽</div>
                <small>{p.portraits} портретов · {p.styles >= 8 ? 'все' : ''} {p.styles} образов
                  × {Math.round(p.portraits / p.styles)} кадров</small>
              </div>
            ))}
          </div>
          <button className="btn btn-dark" disabled={!pkg} onClick={() => { setStep(2); say('') }}>Продолжить к оплате</button>
        </div>
      )}

      {step === 2 && !token && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Оплата · {pkg?.title} — {pkg?.price_rub} ₽</h2>
          {account ? (
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 18 }}>
              Вы вошли как <b>{account.email}</b>. После оплаты продолжите в личном кабинете.
            </p>
          ) : (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 16 }}>
                Создаём аккаунт — по нему вы вернётесь в кабинет и заберёте портреты.
                Придумайте пароль. Чек и уведомления пришлём на email.
              </p>
              <div className="field">
                <input type="email" placeholder="Email" value={contact} autoComplete="email"
                  onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="field">
                <input type="password" placeholder="Пароль (минимум 8 символов)" value={password}
                  autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
              </div>
              <p style={{ fontSize: 13, marginTop: -4, marginBottom: 4 }}>
                Уже покупали? <Link to="/app/login">Войти</Link> · <Link to="/app/forgot">Забыли пароль?</Link>
              </p>
            </>
          )}
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Соглашаюсь на обработку загружаемых фотографий для создания портретов,
              включая их передачу техническому провайдеру нейросетевой генерации
              (<a href="/privacy" target="_blank" rel="noreferrer">политика конфиденциальности</a>).
              Фото и модель хранятся не дольше 30 дней и удаляются по запросу.</span>
          </label>
          <button className="btn btn-dark"
            disabled={paying || !consent || (!account && (!contact.includes('@') || password.length < 8))}
            onClick={pay}>
            {paying ? 'Переходим к оплате…' : `Оплатить ${pkg?.price_rub} ₽`}
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14,
            padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🛡️</span>
            <div style={{ fontSize: 13.5 }}>
              <b>Гарантия возврата денег — 14 дней.</b>{' '}
              <span style={{ color: 'var(--muted)' }}>
                Не подойдёт ни один портрет — вернём оплату в течение 14 дней,
                согласно <a href="/offer" target="_blank" rel="noreferrer">публичной оферте</a>.
              </span>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
            Нажимая «Оплатить», вы принимаете <a href="/offer" target="_blank" rel="noreferrer">публичную
            оферту</a> и <a href="/privacy" target="_blank" rel="noreferrer">политику конфиденциальности</a>.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setStep(1)}>← Назад к тарифам</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 2 && token && (
        <div className="card">
          <h2 style={{ fontSize: 22 }}>Завершите оплату</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '8px 0 16px' }}>
            Заказ создан и ждёт оплаты. Нажмите кнопку — после оплаты откроется загрузка фото.
            Сохраните ссылку на эту страницу: по ней вы вернётесь к заказу.
          </p>
          <button className="btn btn-dark" disabled={paying} onClick={repay}>
            {paying ? 'Открываем оплату…' : (pkg ? `Оплатить ${pkg.price_rub} ₽` : 'Оплатить')}
          </button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Загрузите 10–15 селфи</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 18 }}>
            Разные ракурсы и фоны, хороший свет, лицо крупно. Хотя бы часть — без очков и головных уборов.
          </p>
          <label className="drop" ref={drop} {...dragHandlers}>
            <input type="file" accept="image/jpeg,image/png" multiple style={{ display: 'none' }}
              onChange={(e) => upload(e.target.files)} />
            <b>Выберите фото</b> или перетащите сюда (можно все сразу)
          </label>
          <div className="thumbs">{thumbs.map((src, i) => <img key={i} src={src} alt="" />)}</div>
          <p style={{ fontSize: 14, marginTop: 10 }}>Загружено: <b style={{ color: 'var(--accent-deep)' }}>{count}</b> из 15</p>
          <button className="btn btn-dark" disabled={count < 10} onClick={toStyles}>Дальше — выбрать образы</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>Выберите образы</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {allStyles
              ? `В тариф «${pkg.title}» входят все ${stylesLib.length} образов.`
              : `Тариф «${pkg.title}»: выберите ${pkg.styles} образа из ${stylesLib.length}.`}
          </p>
          <div className="styles-grid">
            {stylesLib.map((s) => {
              const sel = allStyles || chosen.includes(s.key)
              return (
                <div key={s.key} className={`style-opt ${sel ? 'sel' : ''}`}
                  onClick={() => !allStyles && toggleStyle(s.key)} style={allStyles ? { cursor: 'default' } : null}>
                  <span className="sw" style={{ background: SWATCHES[s.key] || '#ccc' }} />{s.title}
                </div>
              )
            })}
          </div>
          <button className="btn btn-dark"
            disabled={!(allStyles || chosen.length === pkg.styles)} onClick={generate}>
            Запустить генерацию
          </button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 5 && order && <Result order={order} />}
    </div>
  )
}

function Result({ order }) {
  const idx = ['training', 'generating', 'done'].indexOf(order.state)
  const done = order.state === 'done'
  const failed = ['failed', 'cancelled'].includes(order.state)
  return (
    <div className="card">
      <h2 style={{ fontSize: 22 }}>{done ? 'Ваши портреты готовы 🎉' : 'Генерация запущена'}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '6px 0 4px' }}>
        {done ? 'Нажмите на кадр, чтобы открыть и сохранить в полном размере.'
          : failed ? 'Возникла задержка — мы уже разбираемся и свяжемся с вами.'
          : 'Нейросеть обучается на ваших фото и создаёт портреты. Можно закрыть вкладку — вернётесь по ссылке на эту страницу и заберёте готовые кадры.'}
      </p>
      {!done && !failed && (
        <div className="progress">
          {PROGRESS.map(([key, label], i) => (
            <div key={key} className={`pstep ${i < idx ? 'ok' : i === idx ? 'on' : ''}`}>
              <span className="dot" />{label}
            </div>
          ))}
        </div>
      )}
      {done && (
        <>
          <div className="gallery">
            {order.results.map((r) => (
              <a key={r.id} href={`${r.url}?full=1`} target="_blank" rel="noreferrer">
                <img loading="lazy" src={r.url} alt="" />
              </a>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>
            Клик по кадру открывает полный размер для сохранения. Условия гарантии
            возврата — в <a href="/offer" target="_blank" rel="noreferrer">оферте</a>.
          </p>
        </>
      )}
    </div>
  )
}
