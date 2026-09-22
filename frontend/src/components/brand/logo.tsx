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

/** Full-coral rounded mark with white stylized B (Beautijoo mockups) */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <span className={`logo-mark ${className}`} aria-hidden>
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M11 7h7.4c3.55 0 5.85 1.85 5.85 4.55 0 1.7-.85 3.05-2.35 3.8 1.95.8 3.15 2.35 3.15 4.55 0 3.15-2.55 5.1-6.45 5.1H11V7zm3.2 2.65v4.35h3.95c1.6 0 2.5-.8 2.5-2.15 0-1.4-.95-2.2-2.55-2.2H14.2zm0 6.9v5.15h4.35c1.8 0 2.85-.9 2.85-2.5 0-1.55-1.05-2.65-2.9-2.65H14.2z"
          fill="white"
        />
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
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2.5 ${className}`.trim()}
      aria-label="صفحه اصلی بیوتی‌جو"
    >
      {inner}
    </Link>
  );
}
