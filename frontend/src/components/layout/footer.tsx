import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || '09153885879';

/** Minimal public footer — grouped links, short height on mobile. */
export function Footer() {
  return (
    <footer className="mt-auto bg-blue text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:py-9">
        <div className="max-w-xs">
          <div className="mb-2">
            <Logo onDark href={null} />
          </div>
          <p className="text-sm leading-6 text-white/75">
            رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای.
          </p>
          <p className="mt-2 text-sm text-white/75">
            پشتیبانی:{' '}
            <a
              href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
              className="font-medium text-white transition-colors hover:text-coral-light"
              dir="ltr"
            >
              {SUPPORT_PHONE}
            </a>
          </p>
        </div>

        <nav
          aria-label="لینک‌های پاورقی"
          className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm sm:grid-cols-3"
        >
          <div>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-white/90">سایت</h3>
            <ul className="space-y-2 text-white/75">
              <li>
                <Link href="/professionals" className="hover:text-coral-light">
                  زیباگران
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-coral-light">
                  جستجو
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-coral-light">
                  درباره ما
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-white/90">حساب و پشتیبانی</h3>
            <ul className="space-y-2 text-white/75">
              <li>
                <Link href="/login" className="hover:text-coral-light">
                  ورود / ثبت‌نام
                </Link>
              </li>
              <li>
                <Link href="/panel" className="hover:text-coral-light">
                  پنل من
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-coral-light">
                  تماس و پشتیبانی
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <h3 className="mb-2 text-xs font-bold tracking-wide text-white/90">قوانین</h3>
            <ul className="space-y-2 text-white/75">
              <li>
                <Link href="/terms" className="hover:text-coral-light">
                  شرایط و کنسلی
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-coral-light">
                  حریم خصوصی و کوکی
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      {/* نماد اعتماد الکترونیکی (اینماد) */}
      <div className="border-t border-white/10 bg-blue-dark/30 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            referrerPolicy="origin"
            target="_blank"
            rel="noopener noreferrer"
            href="https://trustseal.enamad.ir/?id=7847181&Code=oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              referrerPolicy="origin"
              src="https://trustseal.enamad.ir/logo.aspx?id=7847181&Code=oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G"
              alt="نماد اعتماد الکترونیکی"
              style={{ cursor: 'pointer', width: 100, height: 'auto' }}
              {...({ code: 'oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G' } as React.ImgHTMLAttributes<HTMLImageElement>)}
            />
          </a>
        </div>
      </div>

      <div className="border-t border-white/10 bg-blue-dark/40 py-3 text-center text-xs text-white/60">
        ©{' '}
        {new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date())}{' '}
        Beautijoo — بیوتی‌جو
      </div>
    </footer>
  );
}
