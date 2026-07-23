import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api, errText } from '../api.js'
import { auth, authErr } from '../auth.js'
import { goal, ymPurchase } from '../analytics.js'

// Флоу: тариф → образы (пол → одежда → фон) → оплата → селфи → результат.
const STEPS = ['Тариф', 'Образы', 'Оплата', 'Селфи', 'Результат']
const PROGRESS = [
  ['training', 'Обучение нейросети на ваших фото (~30 минут)'],
  ['generating', 'Генерация портретов'],
  ['done', 'Готово'],
]

// Цвет-заглушка для позиции без превью (детерминированно по категории) —
// сетка остаётся без «дыр», флоу работает и на неполном каталоге.
function catColor(cat) {
  let h = 0
  for (const ch of cat || '') h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 24% 42%)`
}

// Плитка каталога: фото с фолбэком на цветной свотч категории.
function WCard({ item, selected, onToggle }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`wcard ${selected ? 'sel' : ''}`} onClick={() => onToggle(item.key)}>
      <span className="chk">✓</span>
      {broken
        ? <div className="wthumb ph" style={{ background: catColor(item.category) }}>{item.label}</div>
        : <img className="wthumb" loading="lazy" src={item.thumb} alt={item.label}
            onError={() => setBroken(true)} />}
      <div className="lbl">{item.label}</div>
    </div>
  )
}

// Галерея с поиском и табами-категориями, мультивыбор пула.
function WardrobeGallery({ catalog, selected, onToggle }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (catalog.items || []).filter((it) =>
      (!cat || it.category === cat) &&
      (!needle || it.label.toLowerCase().includes(needle)))
  }, [catalog, q, cat])
  return (
    <>
      <input className="wsearch" placeholder="Поиск по названию…" value={q}
        onChange={(e) => setQ(e.target.value)} />
      <div className="wtabs">
        <span className={`wtab ${!cat ? 'active' : ''}`} onClick={() => setCat('')}>Все</span>
        {(catalog.categories || []).map((c) => (
          <span key={c} className={`wtab ${cat === c ? 'active' : ''}`}
            onClick={() => setCat(c)}>{c}</span>
        ))}
      </div>
      <div className="wgrid">
        {items.map((it) => (
          <WCard key={it.key} item={it} selected={selected.includes(it.key)} onToggle={onToggle} />
        ))}
        {items.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ничего не найдено.</p>}
      </div>
    </>
  )
}

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
  // Конструктор образов: подшаг, пол и пулы одежды/фона.
  const [sub, setSub] = useState('gender')        // gender | clothing | background
  const [gender, setGender] = useState('')
  const [cloCat, setCloCat] = useState({ categories: [], items: [] })
  const [bgCat, setBgCat] = useState({ categories: [], items: [] })
  const [selClo, setSelClo] = useState([])
  const [selBg, setSelBg] = useState([])
  const [order, setOrder] = useState(null)
  const [remixTick, setRemixTick] = useState(0)  // перезапуск поллинга после remix
  const [msg, setMsg] = useState({ text: '', error: false })
  const drop = useRef(null)
  const thumbsRef = useRef([])
  const wantPkg = params.get('pkg')
  const outlet = useOutletContext()
  const account = outlet?.account
  const refresh = outlet?.refresh

  const say = (text, error = false) => setMsg({ text, error })
  // Сколько комбинаций даёт выбранный пул и сколько образов нужно собрать.
  const combos = selClo.length * selBg.length
  const needN = pkg?.styles || 0
  const poolOk = selClo.length >= 1 && selBg.length >= 1 && combos >= needN

  // Вошедшему клиенту подставляем email аккаунта в контакт.
  useEffect(() => {
    if (account?.email) setContact((c) => c || account.email)
  }, [account])

  // Каталог тарифов — сразу; предвыбор из ?pkg= ведёт прямо к образам.
  useEffect(() => {
    api.packages().then((ps) => {
      setPackages(ps)
      if (wantPkg && !token) {
        const p = ps.find((x) => x.code === wantPkg)
        if (p) { setPkg(p); enterWardrobe(p) }
      }
    }).catch(() => {})
  }, []) // eslint-disable-line

  // Возврат по ссылке ?t= — восстанавливаем шаг по состоянию заказа.
  useEffect(() => {
    if (!token) return
    api.status(token).then((d) => {
      setOrder(d)
      // Уже оплаченный заказ (возврат по ссылке) — фиксируем покупку один раз.
      if (['collecting', 'training', 'generating', 'done'].includes(d.state)) markPurchase(token, d.package)
      if (d.state === 'awaiting_payment') setStep(3)
      else if (d.state === 'collecting') { setCount(d.photos); setStep(4) }
      else setStep(5)
    }).catch(() => {})
  }, []) // eslint-disable-line

  // Восстановление тарифа после возврата из ЮKassa (?t= без ?pkg=).
  useEffect(() => {
    if (!pkg && packages.length && order?.package) {
      const p = packages.find((x) => x.code === order.package)
      if (p) setPkg(p)
    }
  }, [packages, order, pkg])

  // Поллинг: ждём подтверждения оплаты (шаг 3 с токеном) и на шаге результата.
  useEffect(() => {
    if (!token || (step !== 3 && step !== 5)) return
    let alive = true
    let id
    const tick = () => api.status(token).then((d) => {
      if (!alive) return
      setOrder(d)
      // Возврат из ЮKassa: заказ стал оплаченным → фиксируем покупку (один раз).
      if (step === 3 && d.state === 'collecting') { markPurchase(token, d.package); setCount(d.photos); setStep(4) }
      // На готовом заказе продолжаем поллинг, пока есть remix в работе.
      const terminal = ['done', 'failed', 'cancelled'].includes(d.state)
      if (terminal && !(d.pending_remixes > 0)) clearInterval(id)
    }).catch(() => {})
    tick()
    id = setInterval(tick, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [step, token, remixTick])

  // Ревок object URL превью-миниатюр при размонтировании.
  useEffect(() => () => thumbsRef.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Покупка засчитывается один раз на заказ (защита от повтора при возвратах).
  function markPurchase(tok, code) {
    if (!tok) return
    try { if (localStorage.getItem('ymp_' + tok)) return; localStorage.setItem('ymp_' + tok, '1') } catch { /* ignore */ }
    ymPurchase(tok, code, packages.find((p) => p.code === code)?.price_rub)
  }

  function enterWardrobe(p) {
    setPkg(p); setStep(2); setSub('gender')
    setGender(''); setSelClo([]); setSelBg([]); say('')
    goal('order_start', { pkg: p.code })
  }
  async function pickGender(g) {
    setGender(g); setSelClo([]); say('')
    setSub('clothing')
    try {
      // Фоны грузим под выбранный пол — превью с моделью того же пола.
      const [clo, bg] = await Promise.all([
        api.wardrobe('clothing', g),
        api.wardrobe('background', g),
      ])
      setCloCat(clo); setBgCat(bg)
    } catch (e) { say(errText(e), true) }
  }
  const toggleClo = (key) =>
    setSelClo((c) => c.includes(key) ? c.filter((k) => k !== key) : [...c, key])
  const toggleBg = (key) =>
    setSelBg((c) => c.includes(key) ? c.filter((k) => k !== key) : [...c, key])

  async function pay() {
    if (!pkg) return
    setPaying(true); say('')
    try {
      // Оплата привязана к аккаунту: у гостя создаём его здесь (или входим,
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
      // Пулы одежды/фона сохраняются в заказе; воркер соберёт N образов.
      const d = await api.createOrder(pkg.code, email,
        { gender, clothing: selClo, backgrounds: selBg })
      setToken(d.token)
      history.replaceState(null, '', `/app/order?t=${d.token}`)
      if (d.payment_url) { window.location.href = d.payment_url; return } // ЮKassa
      if (d.paid) { markPurchase(d.token, pkg.code); setStep(4); say(''); return }  // заглушка оплаты → к селфи
      // Ручной режим: заказ ждёт подтверждения — экран ожидания (token уже задан).
      say('')
    } catch (e) { say(errText(e), true) } finally { setPaying(false) }
  }

  // Повторная оплата брошенного заказа (возврат по ссылке в awaiting_payment).
  async function repay() {
    setPaying(true); say('')
    try {
      const d = await api.repay(token)
      if (d.payment_url) { window.location.href = d.payment_url; return }
      if (d.paid) { markPurchase(token, pkg?.code); setStep(4); say('') }
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
        say(d.count >= 10 ? 'Фото достаточно — можно добавить ещё или запускать.' : '')
      } catch (e) { say(errText(e), true) }
    }
  }

  async function generate() {
    try {
      await api.generate(token)  // образы уже выбраны при оформлении
      setOrder({ state: 'training', results: [] })
      setStep(5); say('')
    } catch (e) { say(errText(e), true) }
  }

  const dragHandlers = {
    onDragOver: (e) => { e.preventDefault(); drop.current?.classList.add('drag') },
    onDragLeave: () => drop.current?.classList.remove('drag'),
    onDrop: (e) => { e.preventDefault(); drop.current?.classList.remove('drag'); upload(e.dataTransfer.files) },
  }

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
            Оплата — один раз, портреты остаются вашими навсегда. Дальше выберете образы, оплатите и загрузите селфи.
          </p>
          <div className="plans">
            {packages.map((p) => (
              <div key={p.code} className={`plan ${pkg?.code === p.code ? 'sel' : ''}`} onClick={() => setPkg(p)}>
                {p.recommended && <span className="plan-badge">Рекомендуем</span>}
                <h3>{p.title}</h3>
                <div className="pr">{p.price_rub} ₽</div>
                <small>{p.portraits} портретов · {p.styles} образов
                  × {Math.round(p.portraits / p.styles)} кадров
                  {p.remixes ? ` · ${p.remixes} перегенерации` : ''}</small>
              </div>
            ))}
          </div>
          <button className="btn btn-dark" disabled={!pkg} onClick={() => enterWardrobe(pkg)}>Дальше — выбрать образы</button>
        </div>
      )}

      {step === 2 && pkg && sub === 'gender' && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Для кого портреты?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
            От этого зависит подбор одежды. Фоны — общие.
          </p>
          <div className="gender-pick">
            <div className={`gender-opt ${gender === 'male' ? 'sel' : ''}`} onClick={() => pickGender('male')}>
              <span className="em">👔</span>Мужские
            </div>
            <div className={`gender-opt ${gender === 'female' ? 'sel' : ''}`} onClick={() => pickGender('female')}>
              <span className="em">👗</span>Женские
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setStep(1)}>← Назад к тарифам</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 2 && pkg && sub === 'clothing' && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Выберите одежду</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Отметьте понравившиеся варианты — из них и фонов соберём {needN} образов.
            Чем больше выбор, тем разнообразнее портреты.
          </p>
          <WardrobeGallery catalog={cloCat} selected={selClo} onToggle={toggleClo} />
          <div className="wcount">Выбрано одежды: <b>{selClo.length}</b></div>
          <button className="btn btn-dark" style={{ marginTop: 10 }}
            disabled={selClo.length < 1} onClick={() => { setSub('background'); say('') }}>
            Далее — выбрать фон
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 6 }}
            onClick={() => setSub('gender')}>← Назад к полу</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 2 && pkg && sub === 'background' && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Выберите фон</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Отметьте фоны — мы разнообразно скомбинируем их с выбранной одеждой.
          </p>
          <WardrobeGallery catalog={bgCat} selected={selBg} onToggle={toggleBg} />
          <div className="wcount">
            Одежда: <b>{selClo.length}</b> · Фоны: <b>{selBg.length}</b> · Комбинаций: <b>{combos}</b>{' '}
            {poolOk
              ? <span style={{ color: 'var(--good)' }}>— соберём {needN} образов ✓</span>
              : <span style={{ color: 'var(--bad)' }}>— нужно ≥ {needN} (добавьте одежду или фон)</span>}
          </div>
          <button className="btn btn-dark" style={{ marginTop: 10 }}
            disabled={!poolOk} onClick={() => { setStep(3); say(''); goal('reach_payment', { pkg: pkg.code }) }}>
            Продолжить к оплате
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 6 }}
            onClick={() => setSub('clothing')}>← Назад к одежде</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 3 && !token && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Оплата · {pkg?.title} — {pkg?.price_rub} ₽</h2>
          {account ? (
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 18 }}>
              Вы вошли как <b>{account.email}</b>. После оплаты загрузите селфи — и запустим генерацию.
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
          <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setStep(2)}>← Назад к образам</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 3 && token && (
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

      {step === 4 && (
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
          <button className="btn btn-dark" disabled={count < 10} onClick={generate}>Запустить генерацию</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 5 && order && (
        <Result order={order} token={token} onRemixed={() => setRemixTick((t) => t + 1)} />
      )}
    </div>
  )
}

function Result({ order, token, onRemixed }) {
  const idx = ['training', 'generating', 'done'].indexOf(order.state)
  const done = order.state === 'done'
  const failed = ['failed', 'cancelled'].includes(order.state)
  const left = order.remixes_left || 0
  const [remixMode, setRemixMode] = useState(false)
  const [source, setSource] = useState(null)   // style-ключ выбранного кадра
  const [picker, setPicker] = useState(null)   // null | 'clothing' | 'background'
  const [cat, setCat] = useState({ categories: [], items: [] })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function openPicker(kind) {
    setNote(''); setPicker(kind)
    try {
      setCat(await api.wardrobe(kind, order.gender || 'male'))
    } catch { setNote('Не удалось загрузить каталог') }
  }
  async function fire(payload) {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const d = await api.remix(token, { source, ...payload })
      setSource(null); setPicker(null)
      setNote(`Готовим новый кадр — появится в галерее через минуту. Осталось remix: ${d.remixes_left}.`)
      onRemixed?.()
    } catch (e) { setNote(errText(e)) } finally { setBusy(false) }
  }

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
          {left > 0 && (
            <button className="btn btn-ghost" style={{ marginBottom: 4 }}
              onClick={() => { setRemixMode((v) => !v); setSource(null); setPicker(null); setNote('') }}>
              {remixMode ? 'Выйти из режима remix' : `✨ Доработать кадр (remix) — осталось ${left}`}
            </button>
          )}
          <div className="gallery">
            {order.results.map((r) => (
              remixMode ? (
                <div key={r.id} className={`wcard ${source === r.style ? 'sel' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setSource(source === r.style ? null : r.style); setPicker(null) }}>
                  <span className="chk">✓</span>
                  <img className="wthumb" loading="lazy" src={r.url} alt="" />
                </div>
              ) : (
                <a key={r.id} href={`${r.url}?full=1`} target="_blank" rel="noreferrer">
                  <img loading="lazy" src={r.url} alt="" />
                </a>
              )
            ))}
          </div>

          {remixMode && left > 0 && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg)',
              border: '1px solid var(--line)', borderRadius: 12 }}>
              <b style={{ fontSize: 15 }}>Remix — доработка кадров</b>
              <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '4px 0 10px' }}>
                Осталось <b style={{ color: 'var(--accent-deep)' }}>{left}</b>. Выберите понравившийся
                кадр выше и что изменить: одежду, фон или просто перегенерировать.
              </p>
              {!source && <p style={{ fontSize: 13, color: 'var(--muted)' }}>↑ Отметьте кадр в галерее.</p>}
              {source && !picker && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => openPicker('clothing')}>Сменить одежду</button>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => openPicker('background')}>Сменить фон</button>
                  <button className="btn btn-dark" disabled={busy} onClick={() => fire({ mode: 'regen' })}>Перегенерировать</button>
                </div>
              )}
              {source && picker && (
                <>
                  <p style={{ fontSize: 13.5, margin: '2px 0 6px' }}>
                    Выберите {picker === 'clothing' ? 'новую одежду' : 'новый фон'}:
                  </p>
                  <WardrobeGallery catalog={cat} selected={[]}
                    onToggle={(key) => fire(picker === 'clothing'
                      ? { mode: 'clothing', clothing: key }
                      : { mode: 'background', background: key })} />
                  <button className="btn btn-ghost" onClick={() => setPicker(null)}>← Назад</button>
                </>
              )}
              {note && <p className="status">{note}</p>}
            </div>
          )}

          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>
            Клик по кадру открывает полный размер для сохранения. Условия гарантии
            возврата — в <a href="/offer" target="_blank" rel="noreferrer">оферте</a>.
          </p>
        </>
      )}
    </div>
  )
}
