import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export function Footer() {
  return (
    <footer className="mt-auto bg-blue text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 sm:py-12">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="mb-3">
            <Logo onDark href={null} />
          </div>
          <p className="text-sm leading-7 text-white/75">
            پلتفرم رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای — آسان، سریع و مطمئن.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">دسترسی سریع</h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <Link href="/professionals" className="transition-colors hover:text-coral-light">
                زیباگران
              </Link>
            </li>
            <li>
              <Link href="/search" className="transition-colors hover:text-coral-light">
                جستجو
              </Link>
            </li>
            <li>
              <Link href="/services" className="transition-colors hover:text-coral-light">
                خدمات
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">حساب کاربری</h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <Link href="/login" className="transition-colors hover:text-coral-light">
                ورود
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition-colors hover:text-coral-light">
                ثبت‌نام
              </Link>
            </li>
            <li>
              <Link href="/panel" className="transition-colors hover:text-coral-light">
                پنل مشتری
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">قوانین و پشتیبانی</h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <Link href="/about" className="transition-colors hover:text-coral-light">
                درباره ما
              </Link>
            </li>
            <li>
              <Link href="/faq" className="transition-colors hover:text-coral-light">
                سوالات متداول
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors hover:text-coral-light">
                تماس با پشتیبانی
              </Link>
            </li>
            <li>
              <Link href="/complaint" className="transition-colors hover:text-coral-light">
                ثبت شکایت
              </Link>
            </li>
            <li>
              <Link href="/accessibility" className="transition-colors hover:text-coral-light">
                دسترس‌پذیری
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-coral-light">
                شرایط استفاده
              </Link>
            </li>
            <li>
              <Link href="/refund" className="transition-colors hover:text-coral-light">
                کنسلی و بازپرداخت
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="transition-colors hover:text-coral-light">
                حریم خصوصی
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="transition-colors hover:text-coral-light">
                سیاست کوکی
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* نماد اعتماد الکترونیکی (اینماد) — کد رسمی */}
      <div className="border-t border-white/10 bg-blue-dark/30 px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
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
              style={{ cursor: 'pointer', width: '125px', height: 'auto' }}
              // @ts-expect-error official Enamad attribute required by the seal
              code="oIq4x36ixuAEvijxIK4X4tgqhy5A0S4G"
            />
          </a>
        </div>
      </div>

      <div className="border-t border-white/10 bg-blue-dark/40 py-4 text-center text-xs text-white/60">
        ©{' '}
        {new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date())}{' '}
        Beautijoo — بیوتی‌جو · همه حقوق محفوظ است
      </div>
    </footer>
  );
}
