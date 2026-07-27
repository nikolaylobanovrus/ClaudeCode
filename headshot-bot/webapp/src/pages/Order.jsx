import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api, errText } from '../api.js'
import { auth, authErr } from '../auth.js'
import { goal, ymPurchase } from '../analytics.js'

// Флоу: тариф → образы (пол → одежда → фон) → селфи → оплата → результат.
const STEPS = ['Тариф', 'Образы', 'Селфи', 'Оплата', 'Результат']
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

// Встроенная камера: гарантированно фронтальная (facingMode:'user') и позволяет
// снять несколько кадров подряд — file input с capture на части телефонов
// открывает заднюю камеру и отдаёт лишь один кадр за раз.
function Camera({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [err, setErr] = useState('')
  const [shots, setShots] = useState(0)

  useEffect(() => {
    let cancelled = false
    const md = navigator.mediaDevices
    if (!md || !md.getUserMedia) { setErr('no-cam'); return }
    // Просим фронталку с запасом по разрешению — иначе многие телефоны отдают
    // 480p, и кадр не проходит серверную проверку минимума 512px.
    md.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream }
      })
      .catch(() => setErr('no-cam'))
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  function snap() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    // Гарантируем короткую сторону ≥ 640px (серверный минимум — 512), иначе
    // 480p-фронталка даёт кадр, который отклоняется как too_small.
    const short = Math.min(v.videoWidth, v.videoHeight)
    const k = short < 640 ? 640 / short : 1
    const w = Math.round(v.videoWidth * k)
    const h = Math.round(v.videoHeight * k)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d').drawImage(v, 0, 0, w, h)
    c.toBlob((blob) => {
      if (!blob) return
      onCapture(new File([blob], `selfie_${shots + 1}.jpg`, { type: 'image/jpeg' }))
      setShots((n) => n + 1)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="cam">
      {err
        ? (
          <div className="cam-fallback">
            <p>Не удалось открыть камеру в приложении. Разрешите доступ к камере
              или снимите фото системной камерой:</p>
            <label className="btn btn-dark" style={{ marginTop: 12 }}>
              <input type="file" accept="image/*" capture="user" style={{ display: 'none' }}
                onChange={(e) => { onCapture(e.target.files); onClose() }} />
              📷 Открыть камеру
            </label>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Закрыть</button>
          </div>
        )
        : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="cam-video" />
            <div className="cam-bar">
              <span className="cam-count">{shots ? `Снято: ${shots}` : 'Наведите камеру на лицо'}</span>
              <button className="cam-shutter" onClick={snap} aria-label="Сделать снимок" />
              <button className="btn btn-ghost cam-done" onClick={onClose}>
                {shots ? 'Готово' : 'Закрыть'}
              </button>
            </div>
          </>
        )}
    </div>
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
  const [paying, setPaying] = useState(false)
  const [thumbs, setThumbs] = useState([])
  const [count, setCount] = useState(0)
  const [showCam, setShowCam] = useState(false)   // оверлей встроенной камеры
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
  const draftRef = useRef(null)                 // single-flight создание черновика
  const uploadChain = useRef(Promise.resolve())  // последовательная загрузка селфи
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
      // Оплаченный заказ (возврат по ссылке) — фиксируем покупку один раз.
      if (['training', 'generating', 'done'].includes(d.state)) markPurchase(token, d.package)
      // collecting = черновик с селфи (ещё не оплачен) → шаг «Селфи»;
      // awaiting_payment = ждёт оплаты → шаг «Оплата»; дальше — результат.
      if (d.state === 'awaiting_payment') setStep(4)
      else if (d.state === 'collecting') { setCount(d.photos); setStep(3) }
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

  // Поллинг: ждём подтверждения оплаты (шаг «Оплата» с токеном) и на результате.
  useEffect(() => {
    if (!token || (step !== 4 && step !== 5)) return
    let alive = true
    let id
    const tick = () => api.status(token).then((d) => {
      if (!alive) return
      setOrder(d)
      // Возврат из ЮKassa: оплата прошла → генерация пошла → на результат.
      if (step === 4 && ['training', 'generating', 'delivering', 'done'].includes(d.state)) {
        markPurchase(token, d.package); setStep(5)
      }
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
    // Метрика: отдельная цель на пол — видно, кто кликает чаще (муж./жен.).
    goal('gender_' + g, { gender: g })
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
  // Пул одежды/фона: не менее 1 и не более числа образов тарифа (needN).
  // Снять выбор можно всегда; добавить — только пока не достигнут предел.
  const toggleClo = (key) =>
    setSelClo((c) => c.includes(key) ? c.filter((k) => k !== key)
      : (c.length >= needN ? (say(`Не больше ${needN} — по числу образов тарифа.`, true), c) : (say(''), [...c, key])))
  const toggleBg = (key) =>
    setSelBg((c) => c.includes(key) ? c.filter((k) => k !== key)
      : (c.length >= needN ? (say(`Не больше ${needN} — по числу образов тарифа.`, true), c) : (say(''), [...c, key])))

  // Черновик заказа создаём при первой загрузке селфи (до оплаты). Single-flight:
  // при быстрых снимках камеры создаётся ровно один заказ (иначе фото разъедутся
  // по разным черновикам). Пулы одежды/фона сохраняются в заказе.
  function ensureDraft() {
    if (token) return Promise.resolve(token)
    if (!draftRef.current) {
      draftRef.current = api.createDraft(pkg.code, { gender, clothing: selClo, backgrounds: selBg })
        .then((d) => {
          setToken(d.token)
          history.replaceState(null, '', `/app/order?t=${d.token}`)
          return d.token
        })
        .catch((e) => { draftRef.current = null; throw e })
    }
    return draftRef.current
  }

  // Загрузка сериализована: снимки камеры прилетают почти одновременно, а сервер
  // нумерует файлы по текущему счётчику — параллельная загрузка их бы затёрла.
  function upload(files) {
    const list = Array.from(files || [])
    if (!list.length) return uploadChain.current
    uploadChain.current = uploadChain.current.then(() => _uploadSeq(list))
    return uploadChain.current
  }

  async function _uploadSeq(list) {
    let tok
    try { tok = await ensureDraft() } catch (e) { say(errText(e), true); return }
    for (const f of list) {
      say(`Загружаем «${f.name}»…`)
      try {
        const d = await api.uploadPhoto(tok, f)
        setCount(d.count)
        const url = URL.createObjectURL(f)
        thumbsRef.current.push(url)
        setThumbs((t) => [...t, url])
        if (d.count >= 15) { say('Достигнут максимум — 15 фото.'); break }
        say(d.count >= 10 ? 'Фото достаточно — можно добавить ещё или перейти к оплате.' : '')
      } catch (e) {
        say(errText(e), true)
        if (e.code === 'limit') break
      }
    }
  }

  // Оплата после селфи: создаём/входим в аккаунт (гость), затем checkout —
  // он привязывает email, берёт оплату и сразу запускает генерацию.
  async function checkout() {
    if (!pkg || !token) return
    setPaying(true); say('')
    try {
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
      const d = await api.checkout(token, email)
      if (d.payment_url) { window.location.href = d.payment_url; return } // ЮKassa
      if (d.paid) { markPurchase(token, pkg.code); setOrder({ state: 'training', results: [] }); setStep(5); say(''); return }
      say('')  // ручной режим: ждёт подтверждения админом
    } catch (e) { say(errText(e), true) } finally { setPaying(false) }
  }

  // Повторная оплата брошенного заказа (возврат по ссылке в awaiting_payment).
  async function repay() {
    setPaying(true); say('')
    try {
      const d = await api.repay(token)
      if (d.payment_url) { window.location.href = d.payment_url; return }
      if (d.paid) { markPurchase(token, pkg?.code); setOrder({ state: 'training', results: [] }); setStep(5); say('') }
    } catch (e) { say(errText(e), true) } finally { setPaying(false) }
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
            Оплата — один раз, портреты остаются вашими навсегда. Дальше выберете образы, загрузите селфи и оплатите.
          </p>
          <div className="plans">
            {packages.map((p) => (
              // Клик по тарифу сразу ведёт к выбору образов — без кнопки внизу.
              <div key={p.code} className={`plan ${pkg?.code === p.code ? 'sel' : ''}`} onClick={() => enterWardrobe(p)}>
                {p.recommended && <span className="plan-badge">Рекомендуем</span>}
                <h3>{p.title}</h3>
                <div className="pr">{p.price_rub} ₽</div>
                <small>{p.portraits} портретов · {p.styles} образов
                  × {Math.round(p.portraits / p.styles)} кадров
                  {p.remixes ? ` · ${p.remixes} перегенерации` : ''}</small>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 14 }}>
            Нажмите на тариф, чтобы продолжить
          </p>
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
              <img src="/static/img/gen/gender_male.jpg?v=2" alt="" loading="lazy" />
              <span className="glabel">Мужские</span>
            </div>
            <div className={`gender-opt ${gender === 'female' ? 'sel' : ''}`} onClick={() => pickGender('female')}>
              <img src="/static/img/gen/gender_female.jpg?v=1" alt="" loading="lazy" />
              <span className="glabel">Женские</span>
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
            Отметьте от 1 до {needN} вариантов — из них и фонов соберём {needN} образов.
            Чем больше выбор, тем разнообразнее портреты.
          </p>
          <WardrobeGallery catalog={cloCat} selected={selClo} onToggle={toggleClo} />
          <div className="wcount">Выбрано одежды: <b>{selClo.length}</b> из {needN}</div>
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
            Отметьте от 1 до {needN} фонов — разнообразно скомбинируем их с выбранной одеждой.
          </p>
          <WardrobeGallery catalog={bgCat} selected={selBg} onToggle={toggleBg} />
          <div className="wcount">
            Одежда: <b>{selClo.length}</b> · Фоны: <b>{selBg.length}</b> · Комбинаций: <b>{combos}</b>{' '}
            {poolOk
              ? <span style={{ color: 'var(--good)' }}>— соберём {needN} образов ✓</span>
              : <span style={{ color: 'var(--bad)' }}>— нужно ≥ {needN} (добавьте одежду или фон)</span>}
          </div>
          <button className="btn btn-dark" style={{ marginTop: 10 }}
            disabled={!poolOk} onClick={() => { setStep(3); say('') }}>
            Далее — загрузить селфи
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 6 }}
            onClick={() => setSub('clothing')}>← Назад к одежде</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Загрузите 10–15 селфи</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 14 }}>
            Разные ракурсы и фоны, хороший свет, лицо крупно. Хотя бы часть — без очков и головных уборов.
          </p>
          <div className="upload-actions">
            {/* Галерея — она же зона перетаскивания на десктопе. */}
            <label className="uploader" ref={drop} {...dragHandlers}>
              <input type="file" accept="image/jpeg,image/png" multiple style={{ display: 'none' }}
                onChange={(e) => upload(e.target.files)} />
              <span className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
              </span>
              <b>Выбрать фото</b>
              <small>из галереи · можно все сразу</small>
            </label>
            {/* Встроенная камера: фронтальная + можно снять несколько кадров подряд. */}
            <button type="button" className="uploader" onClick={() => setShowCam(true)}>
              <span className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
              <b>Сделать фото</b>
              <small>камерой телефона</small>
            </button>
          </div>
          {showCam && <Camera onCapture={(f) => upload(f.length ? f : [f])} onClose={() => setShowCam(false)} />}
          <p className="drop-hint">На компьютере можно перетащить файлы сюда</p>
          <div className="thumbs">{thumbs.map((src, i) => <img key={i} src={src} alt="" />)}</div>
          <p style={{ fontSize: 14, marginTop: 10 }}>Загружено: <b style={{ color: 'var(--accent-deep)' }}>{count}</b> из 15</p>
          <button className="btn btn-dark" disabled={count < 10}
            onClick={() => { setStep(4); say(''); goal('reach_payment', { pkg: pkg.code }) }}>
            Далее — к оплате
          </button>
          {/* Согласие даётся действием загрузки (конклюдентно), без отдельной галочки. */}
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
            Загружая фото, вы даёте согласие на их обработку для создания портретов
            согласно <a href="/privacy" target="_blank" rel="noreferrer">политике
            конфиденциальности</a>.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setStep(2)}>← Назад к образам</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 4 && order?.state !== 'awaiting_payment' && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Оплата · {pkg?.title} — {pkg?.price_rub} ₽</h2>
          {account ? (
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 18 }}>
              Вы вошли как <b>{account.email}</b>. Селфи загружены — после оплаты запустим генерацию.
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
                <input type="password" placeholder="Пароль" value={password}
                  autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
              </div>
              <p style={{ fontSize: 13, marginTop: -4, marginBottom: 4 }}>
                Уже покупали? <Link to="/app/login">Войти</Link> · <Link to="/app/forgot">Забыли пароль?</Link>
              </p>
            </>
          )}
          <button className="btn btn-dark"
            disabled={paying || (!account && (!contact.includes('@') || !password))}
            onClick={checkout}>
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
          <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setStep(3)}>← Назад к селфи</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 4 && order?.state === 'awaiting_payment' && (
        <div className="card">
          <h2 style={{ fontSize: 22 }}>Завершите оплату</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '8px 0 16px' }}>
            Селфи загружены, заказ ждёт оплаты. Нажмите кнопку — после оплаты запустим генерацию.
            Сохраните ссылку на эту страницу: по ней вы вернётесь к заказу.
          </p>
          <button className="btn btn-dark" disabled={paying} onClick={repay}>
            {paying ? 'Открываем оплату…' : (pkg ? `Оплатить ${pkg.price_rub} ₽` : 'Оплатить')}
          </button>
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
