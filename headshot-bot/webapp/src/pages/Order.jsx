import { useEffect, useRef, useState } from 'react'
import { api, SWATCHES, errText } from '../api.js'

const STEPS = ['Контакт', 'Селфи', 'Пакет и образы', 'Результат']
const PROGRESS = [
  ['awaiting_payment', 'Подтверждение оплаты (с вами свяжутся)'],
  ['training', 'Обучение нейросети на ваших фото (~30 минут)'],
  ['generating', 'Генерация портретов'],
  ['done', 'Готово'],
]

export default function Order() {
  const [step, setStep] = useState(1)
  const [token, setToken] = useState(() => new URLSearchParams(location.search).get('t') || '')
  const [contact, setContact] = useState('')
  const [consent, setConsent] = useState(false)
  const [thumbs, setThumbs] = useState([])
  const [count, setCount] = useState(0)
  const [packages, setPackages] = useState([])
  const [stylesLib, setStylesLib] = useState([])
  const [pkg, setPkg] = useState(null)
  const [chosen, setChosen] = useState([])
  const [order, setOrder] = useState(null)
  const [msg, setMsg] = useState({ text: '', error: false })
  const drop = useRef(null)

  const say = (text, error = false) => setMsg({ text, error })

  // Возврат по ссылке ?t= — восстанавливаем состояние заказа.
  useEffect(() => {
    if (!token) return
    api.status(token).then((d) => {
      if (d.state === 'collecting') {
        setCount(d.photos); setStep(2)
      } else {
        setOrder(d); setStep(4)
      }
    }).catch(() => {})
  }, []) // eslint-disable-line

  // Поллинг статуса на шаге результата.
  useEffect(() => {
    if (step !== 4 || !token) return
    let alive = true
    const tick = () => api.status(token).then((d) => { if (alive) setOrder(d) }).catch(() => {})
    tick()
    const id = setInterval(tick, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [step, token])

  async function start() {
    try {
      const d = await api.createOrder(contact.trim())
      setToken(d.token)
      history.replaceState(null, '', `/app/order?t=${d.token}`)
      setStep(2); say('')
    } catch (e) { say(errText(e), true) }
  }

  async function upload(files) {
    for (const f of files) {
      if (count >= 15) break
      say(`Загружаем «${f.name}»…`)
      try {
        const d = await api.uploadPhoto(token, f)
        setCount(d.count)
        setThumbs((t) => [...t, URL.createObjectURL(f)])
        say(d.count >= 10 ? 'Фото достаточно — можно добавить ещё или идти дальше.' : '')
      } catch (e) { say(errText(e), true) }
    }
  }

  async function loadCatalog() {
    setPackages(await api.packages())
    setStylesLib(await api.styles())
    setStep(3)
  }

  function pickPackage(p) {
    setPkg(p)
    setChosen(p.styles >= stylesLib.length ? stylesLib.map((s) => s.key) : [])
  }
  function toggleStyle(key) {
    setChosen((c) => c.includes(key) ? c.filter((k) => k !== key)
      : (c.length < pkg.styles ? [...c, key] : c))
  }

  async function submit() {
    try {
      const d = await api.select(token, pkg.code, chosen)
      setOrder({ state: 'awaiting_payment', price_rub: d.price_rub, results: [] })
      setStep(4); say('')
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
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Как с вами связаться</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 18 }}>
            Пришлём ссылку на заказ и сообщим о готовности. Ссылка на эту страницу сохранится — не теряйте её.
          </p>
          <div className="field">
            <input type="text" placeholder="Email или телефон" value={contact}
              onChange={(e) => setContact(e.target.value)} />
          </div>
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Соглашаюсь на обработку загружаемых фотографий для создания портретов,
              включая их передачу техническому провайдеру нейросетевой генерации
              (<a href="/privacy" target="_blank" rel="noreferrer">политика конфиденциальности</a>).
              Фото и модель хранятся не дольше 30 дней и удаляются по запросу.</span>
          </label>
          <button className="btn btn-dark" disabled={!(contact.trim().length > 2 && consent)} onClick={start}>Начать</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 2 && (
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
          <button className="btn btn-dark" disabled={count < 10} onClick={loadCatalog}>Дальше — выбрать образы</button>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>Пакет и образы</h2>
          <div className="plans">
            {packages.map((p) => (
              <div key={p.code} className={`plan ${pkg?.code === p.code ? 'sel' : ''}`} onClick={() => pickPackage(p)}>
                <h3>{p.title}</h3>
                <div className="pr">{p.price_rub} ₽</div>
                <small>{p.portraits} портретов · {p.styles} образов × 10 кадров</small>
              </div>
            ))}
          </div>
          {pkg && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                {pkg.styles >= stylesLib.length
                  ? `В пакет входят все ${stylesLib.length} образов.`
                  : `Выберите ${pkg.styles} образа из ${stylesLib.length}:`}
              </p>
              <div className="styles-grid">
                {stylesLib.map((s) => {
                  const all = pkg.styles >= stylesLib.length
                  const sel = chosen.includes(s.key)
                  return (
                    <div key={s.key} className={`style-opt ${sel ? 'sel' : ''}`}
                      onClick={() => !all && toggleStyle(s.key)} style={all ? { cursor: 'default' } : null}>
                      <span className="sw" style={{ background: SWATCHES[s.key] || '#ccc' }} />{s.title}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <button className="btn btn-dark" disabled={!(pkg && chosen.length === pkg.styles)} onClick={submit}>Оформить заказ</button>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
            Нажимая «Оформить заказ», вы принимаете <a href="/legal" target="_blank" rel="noreferrer">условия
            оказания услуг</a> и <a href="/privacy" target="_blank" rel="noreferrer">политику конфиденциальности</a>.
          </p>
          {msg.text && <p className={`status ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
        </div>
      )}

      {step === 4 && order && <Result order={order} token={token} />}
    </div>
  )
}

function Result({ order, token }) {
  const idx = ['awaiting_payment', 'training', 'generating', 'done'].indexOf(order.state)
  const done = order.state === 'done'
  const failed = ['failed', 'cancelled'].includes(order.state)
  return (
    <div className="card">
      <h2 style={{ fontSize: 22 }}>{done ? 'Ваши портреты готовы 🎉' : 'Заказ оформлен'}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: '6px 0 4px' }}>
        {done ? 'Нажмите на кадр, чтобы открыть и сохранить в полном размере.'
          : failed ? 'Возникла задержка — мы уже разбираемся и свяжемся с вами.'
          : `Стоимость: ${order.price_rub} ₽. Мы свяжемся по указанному контакту для оплаты — после подтверждения запустится генерация. Сохраните ссылку на эту страницу!`}
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
        <div className="gallery">
          {order.results.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noreferrer"><img loading="lazy" src={r.url} alt="" /></a>
          ))}
        </div>
      )}
    </div>
  )
}
