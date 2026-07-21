import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { auth } from '../auth.js'

export default function Verify() {
  const { refresh } = useOutletContext()
  const [state, setState] = useState('loading') // loading | ok | bad
  const token = new URLSearchParams(location.search).get('token') || ''

  useEffect(() => {
    if (!token) { setState('bad'); return }
    auth.verify(token)
      .then(() => { setState('ok'); refresh() })
      .catch(() => setState('bad'))
  }, []) // eslint-disable-line

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <div className="card" style={{ textAlign: 'center' }}>
        {state === 'loading' && <p style={{ color: 'var(--muted)' }}>Подтверждаем email…</p>}
        {state === 'ok' && (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>Email подтверждён ✓</h2>
            <Link className="btn btn-dark" to="/app/cabinet">В личный кабинет</Link>
          </>
        )}
        {state === 'bad' && (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>Ссылка недействительна</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 16 }}>
              Возможно, она устарела. Войдите и запросите письмо заново.
            </p>
            <Link className="btn btn-ghost" to="/app/cabinet">В кабинет</Link>
          </>
        )}
      </div>
    </div>
  )
}
