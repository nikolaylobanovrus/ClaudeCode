import { Outlet, Link } from 'react-router-dom'

export default function AppShell() {
  return (
    <>
      <div className="appbar">
        <div className="appbar-in">
          <a className="brand" href="/">
            <svg width="26" height="26" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#1B1D22" strokeWidth="9" />
              <circle cx="48" cy="36" r="13" fill="#1B1D22" />
              <path d="M16 94 c0-19 14-29 32-29 s32 10 32 29" fill="#1B1D22" />
              <g fill="#9A6B1F">
                <circle cx="58" cy="30" r="5" /><circle cx="58" cy="48" r="5" fill="#E8B96A" /><circle cx="58" cy="66" r="5" />
              </g>
            </svg>
            <span>Деловые портреты <i>AI</i></span>
          </a>
          <Link to="/app/cabinet" style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'none' }}>Мои заказы</Link>
        </div>
      </div>
      <Outlet />
    </>
  )
}
