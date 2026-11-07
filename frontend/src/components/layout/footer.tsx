import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const FOOTER_LINKS = [
  { href: '/professionals', label: 'زیباگران' },
  { href: '/search', label: 'جستجو' },
  { href: '/about', label: 'درباره ما' },
  { href: '/login', label: 'ورود' },
  { href: '/contact', label: 'تماس' },
  { href: '/terms', label: 'شرایط' },
  { href: '/privacy', label: 'حریم خصوصی' },
] as const;

/**
 * Compact public footer.
 * Enamad stays in the DOM with official href/src/code/referrerPolicy
 * (required for trust-seal verification) — only rendered smaller inline.
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-blue text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Logo onDark href={null} className="scale-90 origin-right" />
        </div>

        <nav aria-label="لینک‌های پاورقی" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/75">
          {FOOTER_LINKS.map((item, i) => (
            <span key={item.href} className="inline-flex items-center gap-x-3">
              {i > 0 && <span className="text-white/30" aria-hidden>
                ·
              </span>}
              <Link href={item.href} className="hover:text-coral-light">
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 bg-blue-dark/40 px-4 py-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-[11px] leading-none text-white/55">
            ©{' '}
            {new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
              year: 'numeric',
            }).format(new Date())}{' '}
            بیوتی‌جو
          </p>

          {/* اینماد — کوچک اما رسمی؛ حذف/display:none ممنوع */}
          <a
            referrerPolicy="origin"
            target="_blank"
            rel="noopener noreferrer"
            href="https://trustseal.enamad.ir/?id=7847181&Code=oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G"
            className="shrink-0 opacity-90 transition-opacity hover:opacity-100"
            title="نماد اعتماد الکترونیکی"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              referrerPolicy="origin"
              src="https://trustseal.enamad.ir/logo.aspx?id=7847181&Code=oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G"
              alt="نماد اعتماد الکترونیکی"
              width={48}
              height={48}
              style={{ cursor: 'pointer', width: 48, height: 'auto' }}
              {...({
                code: 'oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G',
              } as React.ImgHTMLAttributes<HTMLImageElement>)}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
