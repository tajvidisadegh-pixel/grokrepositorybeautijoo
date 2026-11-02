import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'درباره ما',
  description:
    'بیوتی‌جو بستر آنلاین رزرو نوبت خدمات زیبایی است؛ پیدا کردن زیباگر، دیدن قیمت و زمان آزاد، و رزرو شفاف.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10" dir="rtl">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[#0B2C4A]">دربارهٔ بیوتی‌جو</h1>
        <p className="text-sm leading-7 text-gray-700">
          بیوتی‌جو یک بستر آنلاین برای رزرو نوبت خدمات زیبایی است. اینجا می‌توانید زیباگر پیدا
          کنید، ببینید چه خدمتی با چه قیمتی ارائه می‌شود، زمان‌های آزاد را چک کنید و نوبت بگیرید.
          هدف این نیست که همه‌چیز پیچیده شود؛ برعکس، می‌خواهیم همان کار همیشگیِ هماهنگ کردن نوبت،
          مرتب‌تر و روشن‌تر انجام شود.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">اسم بیوتی‌جو از کجا آمده؟</h2>
        <div className="space-y-3 text-sm leading-7 text-gray-800">
          <p>
            بیوتی از واژهٔ Beauty به‌معنی زیبایی گرفته شده و «جو» در فارسی یعنی جوینده. بیوتی‌جو
            یعنی جایی برای کسی که زیبایی را می‌جوید.
          </p>
          <p>
            این اسم را عمداً ساده انتخاب کردیم تا از همان اول معلوم باشد سایت دربارهٔ چیست.
            بیوتی‌جو فروشگاه لوازم آرایشی نیست، مجلهٔ مد نیست، و جای تبلیغ پراکنده هم نیست. تمرکزش
            روی یک کار است: کمک به پیدا کردن خدمت زیبایی مناسب و رزرو نوبت، در فضایی که اطلاعات تا
            حد ممکن شفاف باشد.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">داستان ما</h2>
        <div className="space-y-3 text-sm leading-7 text-gray-800">
          <p>شروع کار از تجربهٔ واقعی بود، نه از یک ایدهٔ روی کاغذ.</p>
          <p>
            برای گرفتن یک نوبت، خیلی وقت‌ها باید چند مسیر را هم‌زمان رفت: پیام به چند نفر، پرسیدن
            قیمت از این و آن، چک کردن ساعت، جابه‌جا شدن برنامه، و آخر سر هم گاهی دقیق معلوم نبود
            خدمت شامل چیست و چه چیزی جدا حساب می‌شود. از سمت دیگر، کسی که کار زیبایی می‌کند بخش
            مهمی از وقتش صرف همین هماهنگی‌های تکه‌تکه می‌شود؛ بین تماس‌ها، پیام‌ها و نوبت‌هایی که
            این طرف و آن طرف جابه‌جا می‌شوند.
          </p>
          <p>
            بیوتی‌جو از همین نقطه شکل گرفت: یک جای مشخص که هم کسی که دنبال نوبت است تکلیفش روشن
            باشد، هم زیباگر بتواند کارش را منظم‌تر نشان بدهد و مدیریت کند. نه به‌عنوان جایگزین
            مهارت و تجربهٔ زیباگر، بلکه به‌عنوان ابزاری برای کمتر شدن سردرگمی قبل و بعد از رزرو.
          </p>
          <p>
            مسیر ساخت محصول هم همین‌طور پیش رفته: اول اصلِ رزرو و نمایش خدمات درست کار کند، بعد
            جزئیات و امکانات اضافه شوند. هنوز هم اولویت با چیزهایی است که در عمل به درد می‌خورند؛
            نه با شلوغ کردن صفحه.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">زیباگر کیست؟</h2>
        <div className="space-y-3 text-sm leading-7 text-gray-800">
          <p>
            در بیوتی‌جو به کسی که خدمات زیبایی ارائه می‌دهد{' '}
            <strong className="text-[#0B2C4A]">زیباگر</strong> می‌گوییم.
          </p>
          <p>
            زیباگر ممکن است در حوزهٔ مو کار کند، ناخن، پوست، ابرو و مژه، میکاپ، یا خدمات نزدیک به
            این‌ها. مهم این است که خدمت را خودش — یا در چارچوب فعالیت حرفه‌ای‌اش — انجام می‌دهد و در
            سایت مشخص می‌کند:
          </p>
          <ul className="list-disc space-y-1 pr-5">
            <li>چه کارهایی انجام می‌دهد</li>
            <li>هر خدمت حدوداً چقدر زمان می‌برد</li>
            <li>قیمت چگونه است</li>
            <li>چه زمان‌هایی برای رزرو آزاد است</li>
          </ul>
          <p>
            پروفایل زیباگر برای این است که قبل از رزرو تصویر روشن‌تری از کار و شرایط داشته باشید؛
            نه اینکه فقط یک اسم و یک شماره باشد.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">
          اگر نوبت می‌خواهید، اینجا چه کار می‌کنید؟
        </h2>
        <ol className="list-decimal space-y-1.5 pr-5 text-sm leading-7 text-gray-800">
          <li>جستجو می‌کنید؛ مثلاً بر اساس نوع خدمت یا شهر</li>
          <li>پروفایل زیباگر و فهرست خدمات را می‌بینید</li>
          <li>قیمت و زمان‌های قابل رزرو را بررسی می‌کنید</li>
          <li>نوبت را ثبت می‌کنید و وضعیتش را پیگیری می‌کنید</li>
          <li>بعد از انجام خدمت، اگر بخواهید، نظرتان را می‌نویسید</li>
        </ol>
        <p className="text-sm leading-7 text-gray-800">
          این‌ها کمک می‌کند قبل از آمدن سر نوبت، تا جای ممکن بدانید قرار است چه خدمتی دریافت کنید
          و با چه شرایطی هماهنگ شده است.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">
          اگر زیباگر هستید، بیوتی‌جو چه کمکی می‌کند؟
        </h2>
        <div className="space-y-3 text-sm leading-7 text-gray-800">
          <p>
            برای زیباگر، سایت بیشتر شبیه یک میز کار جمع‌وجور است تا یک صفحهٔ تبلیغاتی خالی:
          </p>
          <ul className="list-disc space-y-1 pr-5">
            <li>ساخت و ویرایش پروفایل</li>
            <li>تعریف خدمات، قیمت و مدت زمان</li>
            <li>مدیریت زمان‌های قابل رزرو و نوبت‌ها</li>
            <li>کاهش رفت‌وبرگشت‌های پراکنده‌ای که معمولاً خارج از یک سامانهٔ مشخص پیش می‌آید</li>
          </ul>
          <p>
            هدف این است که بخش هماهنگی سبک‌تر شود و انرژی بیشتری برای خودِ کار باقی بماند. کیفیت
            نهایی خدمت همچنان به مهارت و حرفهٔ خودِ زیباگر بستگی دارد؛ بیوتی‌جو فقط چارچوب رزرو و
            نمایش را منظم می‌کند.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">
          بیوتی‌جو چه نقشی دارد و چه نقشی ندارد؟
        </h2>
        <div className="space-y-3 text-sm leading-7 text-gray-800">
          <p>
            بیوتی‌جو خودش سالن زیبایی، کلینیک یا آرایشگاه نیست. اینجا کسی را آرایش نمی‌کنیم و خدمت
            را به نام پلتفرم انجام نمی‌دهیم.
          </p>
          <p>
            <strong className="text-[#0B2C4A]">نقش ما:</strong> فراهم کردن بستر جستجو، مشاهدهٔ
            اطلاعات، رزرو نوبت و پیگیری آن.
          </p>
          <p>
            <strong className="text-[#0B2C4A]">نقش زیباگر:</strong> ارائهٔ واقعی خدمت، در محل و با
            شرایط فعالیت خودش.
          </p>
          <p>
            این تفکیک مهم است، چون انتظار را درست می‌گذارد: بیوتی‌جو واسط و سامانه‌دهنده است، نه
            جایگزین زیباگر.
          </p>
          <p>
            موضوعاتی مثل قواعد استفاده از سایت، حریم خصوصی، کنسلی و بازپرداخت در صفحات جداگانه
            آمده‌اند. اگر به جزئیات حقوقی و مالی نیاز دارید، همان بخش‌ها مرجع دقیق‌تری هستند.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">چه چیزی برایمان مهم است؟</h2>
        <ul className="list-disc space-y-1.5 pr-5 text-sm leading-7 text-gray-800">
          <li>
            <strong>شفافیت:</strong> تا جای ممکن قبل از رزرو معلوم باشد چه چیزی رزرو می‌شود
          </li>
          <li>
            <strong>احترام به وقت:</strong> هم وقت کسی که نوبت می‌گیرد، هم وقت زیباگر
          </li>
          <li>
            <strong>مسیر روشن:</strong> از جستجو تا رزرو، مرحله‌ها قابل فهم باشند
          </li>
          <li>
            <strong>قابل پیگیری بودن:</strong> نوبت و وضعیت آن گم نشود
          </li>
          <li>
            <strong>صداقت دربارهٔ نقش پلتفرم:</strong> قول کاری را ندهیم که انجامش با زیباگر است
          </li>
        </ul>
        <p className="text-sm leading-7 text-gray-800">
          سایت کامل و بدون نقص به دنیا نیامده؛ مثل هر محصول واقعی، با استفاده و بازخورد بهتر
          می‌شود. چیزی که عوض نمی‌شود، جهت کار است: رزرو خدمات زیبایی باید ساده‌تر و شفاف‌تر از
          مدل پراکندهٔ پیام و تماس باشد.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">ارتباط با ما</h2>
        <div className="space-y-3 text-sm leading-7 text-gray-800">
          <p>
            اگر سوال، پیشنهاد یا مشکلی دارید، از صفحهٔ{' '}
            <Link href="/contact" className="text-[#2D6CDF] underline">
              تماس با ما
            </Link>{' '}
            پیام بفرستید.
          </p>
          <p>
            برای جواب‌های پرتکرار، بخش{' '}
            <Link href="/faq" className="text-[#2D6CDF] underline">
              سوالات متداول
            </Link>{' '}
            را ببینید.
          </p>
          <p>
            اگر موضوعی به پیگیری رسمی‌تر یا شکایت مربوط می‌شود، مسیر آن در بخش‌های مربوط به
            پشتیبانی و{' '}
            <Link href="/complaint" className="text-[#2D6CDF] underline">
              ثبت شکایت
            </Link>{' '}
            در سایت مشخص شده است.
          </p>
          <p>
            شرایط استفاده، حریم خصوصی و کنسلی و بازپرداخت هم از فوتر و صفحات قانونی سایت در
            دسترس‌اند.
          </p>
        </div>
      </section>

      <p className="rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm leading-7 text-gray-800 shadow-sm">
        بیوتی‌جو برای این است که مسیر بین «نیاز به یک خدمت زیبایی» و «نوبت قطعی با زیباگر»
        کوتاه‌تر، شفاف‌تر و قابل‌اعتمادتر شود — بدون اینکه جای مهارت و مسئولیت خودِ زیباگر را
        بگیرد.
      </p>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
        <Link href="/terms" className="text-[#2D6CDF] underline">
          شرایط استفاده
        </Link>
        <Link href="/privacy" className="text-[#2D6CDF] underline">
          حریم خصوصی
        </Link>
        <Link href="/refund" className="text-[#2D6CDF] underline">
          کنسلی و بازپرداخت
        </Link>
        <Link href="/complaint" className="text-[#2D6CDF] underline">
          ثبت شکایت
        </Link>
        <Link href="/contact" className="text-[#2D6CDF] underline">
          تماس با ما
        </Link>
        <Link href="/faq" className="text-[#2D6CDF] underline">
          سوالات متداول
        </Link>
      </div>

      <p className="text-xs text-gray-500">{siteName()}</p>
    </div>
  );
}
