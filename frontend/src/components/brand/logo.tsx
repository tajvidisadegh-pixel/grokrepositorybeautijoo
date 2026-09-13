import Link from 'next/link';

type LogoProps = {
  /** icon box size classes, e.g. size-8 sm:size-9 */
  markClassName?: string;
  /** show BEAUTIJOO + بیوتی‌جو wordmark */
  showWordmark?: boolean;
  /** light text for navy footer backgrounds */
  onDark?: boolean;
  className?: string;
  href?: string | null;
};

/** Coral ribbon-style B mark inspired by Beautijoo mockups */
export function LogoMark({ className = 'size-8 text-sm' }: { className?: string }) {
  return (
    <span className={`logo-mark ${className}`} aria-hidden>
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Stylized B with soft ribbon curves */}
        <path
          d="M10 6.5h7.2c3.35 0 5.55 1.7 5.55 4.35 0 1.85-1 3.2-2.65 3.9 2.05.75 3.25 2.25 3.25 4.45 0 3-2.4 4.8-6.1 4.8H10V6.5z"
          fill="white"
          fillOpacity="0.95"
        />
        <path
          d="M13.15 9.15v4.55h3.85c1.55 0 2.45-.75 2.45-2.25s-.9-2.3-2.5-2.3h-3.8zm0 7.1v5.1h4.2c1.75 0 2.75-.85 2.75-2.5s-1-2.6-2.8-2.6h-4.15z"
          fill="url(#coralB)"
        />
        <defs>
          <linearGradient id="coralB" x1="10" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff9a9d" />
            <stop offset="0.45" stopColor="#fc7074" />
            <stop offset="1" stopColor="#e85a5f" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function Logo({
  markClassName = 'size-8 sm:size-9',
  showWordmark = true,
  onDark = false,
  className = '',
  href = '/',
}: LogoProps) {
  const inner = (
    <>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`text-[15px] font-bold tracking-tight sm:text-base ${
              onDark ? 'text-white' : 'text-coral'
            }`}
          >
            BEAUTIJOO
          </span>
          <span
            className={`text-[11px] font-semibold sm:text-xs ${
              onDark ? 'text-coral-light' : 'text-coral-dark'
            }`}
          >
            بیوتی‌جو
          </span>
        </div>
      )}
    </>
  );

  if (href === null) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`.trim()}>{inner}</div>
    );
  }

  return (
    <Link href={href} className={`flex shrink-0 items-center gap-2.5 ${className}`.trim()}>
      {inner}
    </Link>
  );
}
