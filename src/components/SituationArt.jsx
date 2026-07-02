// Иллюстрации плашек «Выберите ситуацию»: единый стиль — мягкий градиентный
// фон, фирменные синий/зелёный, простые узнаваемые силуэты.

const Frame = ({ id, from, to, children }) => (
  <svg viewBox="0 0 300 170" role="img" aria-hidden="true" className="sit-card__art">
    <defs>
      <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
    <rect width="300" height="170" fill={`url(#bg-${id})`} />
    <circle cx="262" cy="24" r="46" fill="#ffffff" opacity="0.12" />
    <circle cx="30" cy="152" r="34" fill="#ffffff" opacity="0.10" />
    {children}
  </svg>
);

const Check = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="15" fill="#16b364" />
    <path d="M-6 0l4.5 4.5L7 -4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

function HouseArt() {
  return (
    <Frame id="house" from="#e7efff" to="#c9dcff">
      <g transform="translate(150 92)">
        <polygon points="-62,-14 0,-62 62,-14" fill="#0a2a66" />
        <rect x="-50" y="-14" width="100" height="62" rx="6" fill="#1b62e0" />
        <rect x="-34" y="2" width="24" height="46" rx="4" fill="#0a2a66" />
        <rect x="6" y="0" width="28" height="24" rx="4" fill="#7ef0b0" />
        <line x1="20" y1="0" x2="20" y2="24" stroke="#1b62e0" strokeWidth="2" />
        <line x1="6" y1="12" x2="34" y2="12" stroke="#1b62e0" strokeWidth="2" />
        <rect x="30" y="-52" width="12" height="24" rx="3" fill="#0a2a66" />
      </g>
      <Check x={216} y={122} />
    </Frame>
  );
}

function MortgageArt() {
  return (
    <Frame id="mortgage" from="#e9e7ff" to="#cfd0ff">
      <g transform="translate(118 96)">
        <polygon points="-52,-10 0,-52 52,-10" fill="#3b3a8f" />
        <rect x="-42" y="-10" width="84" height="52" rx="6" fill="#5b5bd6" />
        <rect x="-14" y="8" width="28" height="34" rx="4" fill="#3b3a8f" />
      </g>
      <g transform="translate(210 70)">
        <circle r="34" fill="#ffffff" />
        <text x="0" y="11" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="34" fontWeight="800" fill="#5b5bd6">%</text>
      </g>
      <g transform="translate(196 128)">
        <ellipse rx="18" ry="7" fill="#f2b90d" />
        <ellipse rx="18" ry="7" cy="-8" fill="#ffd23e" />
      </g>
      <Check x={252} y={128} />
    </Frame>
  );
}

function MedEduArt() {
  return (
    <Frame id="mededu" from="#e0f6ec" to="#c2ecd9">
      <g transform="translate(104 84)">
        <path d="M0 34 C-30 12 -44 -8 -34 -26 C-26 -40 -6 -40 0 -26 C6 -40 26 -40 34 -26 C44 -8 30 12 0 34Z" fill="#e5484d" />
        <rect x="-6" y="-18" width="12" height="28" rx="3" fill="#fff" />
        <rect x="-14" y="-10" width="28" height="12" rx="3" fill="#fff" />
      </g>
      <g transform="translate(206 84)">
        <polygon points="0,-30 52,-10 0,10 -52,-10" fill="#0a2a66" />
        <path d="M-30 -2 v22 c0 8 60 8 60 0 v-22" fill="none" stroke="#0a2a66" strokeWidth="10" strokeLinecap="round" />
        <line x1="52" y1="-10" x2="52" y2="26" stroke="#f2b90d" strokeWidth="4" strokeLinecap="round" />
        <circle cx="52" cy="30" r="5" fill="#f2b90d" />
      </g>
      <Check x={150} y={136} />
    </Frame>
  );
}

function ForeignArt() {
  return (
    <Frame id="foreign" from="#e0f2fe" to="#bfe3fd">
      <g transform="translate(118 86)">
        <circle r="44" fill="#0ea5e9" />
        <ellipse rx="20" ry="44" fill="none" stroke="#fff" strokeWidth="3" opacity="0.85" />
        <line x1="-44" y1="0" x2="44" y2="0" stroke="#fff" strokeWidth="3" opacity="0.85" />
        <path d="M-38 -20 h76 M-38 20 h76" stroke="#fff" strokeWidth="3" opacity="0.6" fill="none" />
      </g>
      <g transform="translate(206 92)">
        <rect x="-26" y="-38" width="52" height="70" rx="8" fill="#fff" />
        <rect x="-16" y="-26" width="32" height="6" rx="3" fill="#0a2a66" />
        <rect x="-16" y="-12" width="32" height="6" rx="3" fill="#9aa7bd" />
        <rect x="-16" y="2" width="20" height="6" rx="3" fill="#9aa7bd" />
        <text x="0" y="27" textAnchor="middle" fontFamily="Arial" fontSize="16" fontWeight="800" fill="#0ea5e9">3-НДФЛ</text>
      </g>
      <Check x={244} y={132} />
    </Frame>
  );
}

function SaleArt() {
  return (
    <Frame id="sale" from="#fff1e2" to="#ffdfc0">
      <g transform="translate(96 88)">
        <rect x="-34" y="-44" width="68" height="88" rx="6" fill="#f97316" />
        {[-22, 0].map((y) =>
          [-22, -2, 18].map((x) => (
            <rect key={`${x}${y}`} x={x} y={y - 12} width="12" height="12" rx="2" fill="#ffe1c7" />
          ))
        )}
        <rect x="-8" y="20" width="16" height="24" rx="2" fill="#c2410c" />
      </g>
      <g transform="translate(196 112)">
        <path d="M-52 8 c0 -10 8 -14 14 -22 c8 -10 14 -12 38 -12 c20 0 28 6 34 14 l10 12 c4 6 4 16 -4 16 h-88 c-4 0 -4 -4 -4 -8z" fill="#0a2a66" />
        <circle cx="-24" cy="18" r="10" fill="#33415c" stroke="#fff" strokeWidth="3" />
        <circle cx="26" cy="18" r="10" fill="#33415c" stroke="#fff" strokeWidth="3" />
        <rect x="-30" y="-18" width="30" height="14" rx="4" fill="#7ec3ff" />
      </g>
      <g transform="translate(236 52)">
        <rect x="-30" y="-16" width="60" height="32" rx="8" fill="#16b364" />
        <text x="0" y="7" textAnchor="middle" fontFamily="Arial" fontSize="19" fontWeight="800" fill="#fff">₽</text>
      </g>
    </Frame>
  );
}

function OtherArt() {
  return (
    <Frame id="other" from="#f3e8ff" to="#e2ccff">
      <g transform="translate(140 84)">
        <path d="M-58 -40 h116 a14 14 0 0 1 14 14 v52 a14 14 0 0 1 -14 14 h-64 l-26 22 v-22 h-26 a14 14 0 0 1 -14 -14 v-52 a14 14 0 0 1 14 -14z" fill="#8b5cf6" />
        <text x="0" y="16" textAnchor="middle" fontFamily="Arial" fontSize="48" fontWeight="800" fill="#fff">?</text>
      </g>
      <g fill="#8b5cf6">
        <circle cx="236" cy="46" r="5" opacity="0.7" />
        <circle cx="252" cy="66" r="3.5" opacity="0.5" />
        <circle cx="58" cy="132" r="4" opacity="0.6" />
      </g>
      <Check x={226} y={126} />
    </Frame>
  );
}

export const situationArts = {
  kvartira: HouseArt,
  ipoteka: MortgageArt,
  "lechenie-obuchenie": MedEduArt,
  inostrannym: ForeignArt,
  prodazha: SaleArt,
  inaya: OtherArt,
};
