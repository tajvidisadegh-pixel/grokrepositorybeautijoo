import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export function Footer() {
  return (
    <footer className="mt-auto bg-blue text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:py-12">
        <div className="sm:col-span-1">
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
      </div>
      <div className="border-t border-white/10 bg-blue-dark/40 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Beautijoo — بیوتی‌جو · همه حقوق محفوظ است
      </div>
    </footer>
  );
}
