import { useId } from 'react';

/**
 * The niimai mark: a label tag with a punched hole, a bold "n", and one square
 * print dot. Same artwork as public/logo.svg.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const hole = `hole-${useId()}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="logo-mark">
      <defs>
        <mask id={hole}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="16.5" cy="32" r="3.6" fill="#000" />
        </mask>
      </defs>
      <path
        mask={`url(#${hole})`}
        fill="var(--primary)"
        d="M23 9h27a9 9 0 0 1 9 9v28a9 9 0 0 1-9 9H23a7 7 0 0 1-5.1-2.2L5.3 37.4a8 8 0 0 1 0-10.8L17.9 11.2A7 7 0 0 1 23 9z"
      />
      <path d="M28.5 45V31.5a7 7 0 0 1 14 0V45" fill="none" stroke="#fff" strokeWidth="6.5" />
      <rect x="46.5" y="17" width="6" height="6" rx="1" fill="#fff" />
    </svg>
  );
}

/** "niimai" drawn in geometric strokes; the dots on the three i's are print dots. */
export function Wordmark({ height = 18 }: { height?: number }) {
  return (
    <svg viewBox="0 0 109 28" height={height} width={(height * 109) / 28} role="img" aria-label="niimai" className="logo-wordmark">
      <g fill="none" stroke="currentColor" strokeWidth="5">
        <path d="M2.5 28V17a6.5 6.5 0 0 1 13 0v11" />
        <path d="M25.5 28V8M35.5 28V8" />
        <path d="M45.5 28V17a6.5 6.5 0 0 1 13 0v11M58.5 17a6.5 6.5 0 0 1 13 0v11" />
        <circle cx="89" cy="18" r="7.5" />
        <path d="M96.5 8v20M106.5 28V8" />
      </g>
      <g fill="var(--primary)">
        <rect x="23" y="0" width="5" height="5" rx="0.8" />
        <rect x="33" y="0" width="5" height="5" rx="0.8" />
        <rect x="104" y="0" width="5" height="5" rx="0.8" />
      </g>
    </svg>
  );
}

/** Mark and wordmark together, as used in headers. */
export function LogoLockup({ size = 30 }: { size?: number }) {
  return (
    <span className="logo-lockup">
      <Logo size={size} />
      <Wordmark height={Math.round(size * 0.6)} />
    </span>
  );
}
