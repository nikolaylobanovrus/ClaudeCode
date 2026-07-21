import { Outlet, Link } from 'react-router-dom'

export default function AppShell() {
  return (
    <>
      <div className="appbar">
        <div className="appbar-in">
          <a className="brand" href="/">
            <svg width="28" height="28" viewBox="0 0 96 96">
              <defs>
                <clipPath id="lg-l"><rect width="46" height="96" /></clipPath>
                <clipPath id="lg-c"><circle cx="48" cy="48" r="40" /></clipPath>
              </defs>
              <circle cx="48" cy="48" r="42" fill="none" stroke="#1B1D22" strokeWidth="9" />
              <g clipPath="url(#lg-c)">
                <g clipPath="url(#lg-l)">
                  <circle cx="48" cy="36" r="13" fill="#1B1D22" />
                  <path d="M16 94 c0-19 14-29 32-29 s32 10 32 29" fill="#1B1D22" />
                </g>
              </g>
              <g fill="#9A6B1F">
                <circle cx="58" cy="28" r="5" />
                <circle cx="70" cy="28" r="3.4" />
                <circle cx="58" cy="44" r="5" fill="#E8B96A" />
                <circle cx="70" cy="44" r="3.4" />
                <circle cx="58" cy="60" r="5" />
                <circle cx="70" cy="60" r="3.4" fill="#E8B96A" />
                <circle cx="58" cy="74" r="5" fill="#E8B96A" />
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
