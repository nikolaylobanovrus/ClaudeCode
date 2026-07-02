import { useId } from "react";

// Фирменный знак «Налог-сервис»: рубль под защитой щита.
// useId — уникальные ID градиента при нескольких логотипах на странице.
export default function Logo({ size = 38 }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="navbar__logo"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1650b8" />
          <stop offset="1" stopColor="#1b62e0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-g)`} />
      <path
        d="M32 10 l17 6 v13 c0 12 -7.5 20 -17 25 c-9.5 -5 -17 -13 -17 -25 v-13 z"
        fill="#fff"
      />
      <path
        d="M32 15 l12.5 4.4 v9.8 c0 9.4 -5.6 15.8 -12.5 20 c-6.9 -4.2 -12.5 -10.6 -12.5 -20 v-9.8 z"
        fill={`url(#${id}-g)`}
      />
      <text
        x="32"
        y="33"
        dominantBaseline="central"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="21"
        fontWeight="800"
        fill="#fff"
      >
        ₽
      </text>
    </svg>
  );
}
