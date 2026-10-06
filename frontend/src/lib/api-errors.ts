import { ApiError } from './api';

/** Known backend / Nest message fragments → Persian UI copy */
const MESSAGE_MAP: Array<{ test: RegExp; fa: string }> = [
  { test: /توکن نامعتبر|invalid token|jwt expired|token expired/i, fa: 'نشست منقضی شده است. دوباره وارد شوید.' },
  { test: /توکن منقضی|باطل شده/i, fa: 'نشست منقضی یا باطل شده است. دوباره وارد شوید.' },
  { test: /already exists|قبلاً ثبت|duplicate|unique constraint/i, fa: 'این مورد قبلاً ثبت شده است.' },
  { test: /not found|یافت نشد/i, fa: 'مورد درخواستی یافت نشد.' },
  { test: /forbidden|اجازه|permission|access denied/i, fa: 'اجازه انجام این عملیات را ندارید.' },
  { test: /unauthorized|unauthorised/i, fa: 'برای ادامه باید وارد حساب کاربری شوید.' },
  { test: /too many|rate.?limit|تعداد درخواست/i, fa: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.' },
  { test: /network|failed to fetch|econnrefused|timeout|ECONNRESET/i, fa: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.' },
  { test: /slot|بازه.*رزرو|overlap|تداخل|no_overlap|قبلاً رزرو/i, fa: 'این بازه زمانی در دسترس نیست یا قبلاً رزرو شده است.' },
  { test: /otp|کد.*یکبار|verification code|invalid code/i, fa: 'کد تأیید نامعتبر یا منقضی است.' },
  { test: /password|رمز عبور/i, fa: 'رمز عبور نامعتبر است.' },
  { test: /validation|must be|should not|isString|isUUID|isInt|whitelist/i, fa: 'اطلاعات ارسالی نامعتبر است. فیلدها را بررسی کنید.' },
  { test: /file too large|payload too large|entity too large/i, fa: 'حجم فایل بیش از حد مجاز است.' },
  { test: /unsupported media|invalid file|mime/i, fa: 'فرمت فایل پشتیبانی نمی‌شود.' },
  { test: /payment|درگاه|zarinpal|آیدی.?پی/i, fa: 'مشکل در پرداخت. دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.' },
  { test: /پروفایل ناقص|incomplete profile|completion/i, fa: 'پروفایل ناقص است. ابتدا موارد الزامی را تکمیل کنید.' },
  { test: /cancel.*hour|ساعات قبل|min.?hours/i, fa: 'در این فاصله زمانی امکان لغو یا تغییر وجود ندارد.' },
  { test: /only after|فقط پس از تکمیل/i, fa: 'این عملیات فقط پس از تکمیل نوبت امکان‌پذیر است.' },
  { test: /internal server error/i, fa: 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.' },
];

function mapKnownMessage(msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;
  for (const { test, fa } of MESSAGE_MAP) {
    if (test.test(m)) return fa;
  }
  // Prefer short Persian backend messages as-is
  if (/[\u0600-\u06FF]/.test(m) && m.length <= 160) return m;
  return null;
}

/** Map HTTP / backend messages to Persian UI copy */
export function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const mapped = err.message ? mapKnownMessage(err.message) : null;
    if (mapped) return mapped;

    switch (err.status) {
      case 0:
        return err.message || 'ارتباط با سرور برقرار نشد.';
      case 401:
        return 'برای ادامه باید وارد حساب کاربری شوید.';
      case 403:
        return 'اجازه انجام این عملیات را ندارید.';
      case 404:
        return 'مورد درخواستی یافت نشد.';
      case 409:
        return mapKnownMessage(err.message) || err.message || 'تداخل — این مورد قبلاً ثبت شده است.';
      case 422:
        return mapKnownMessage(err.message) || 'اطلاعات ارسالی نامعتبر است.';
      case 429:
        return 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.';
      case 400:
        return mapKnownMessage(err.message) || err.message || 'درخواست نامعتبر است.';
      case 413:
        return 'حجم فایل یا درخواست بیش از حد مجاز است.';
      case 415:
        return 'فرمت ارسال‌شده پشتیبانی نمی‌شود.';
      default:
        if (err.status >= 500) {
          return err.message && !/internal server error/i.test(err.message)
            ? mapKnownMessage(err.message) || err.message
            : 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.';
        }
        return mapKnownMessage(err.message) || err.message || 'خطا در ارتباط با سرور';
    }
  }

  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
  }

  if (err instanceof Error && err.message && err.message.trim().length > 0) {
    const mapped = mapKnownMessage(err.message);
    if (mapped) return mapped;
    const m = err.message.trim();
    if (/[\u0600-\u06FF]/.test(m) || m.length < 120) return m;
  }

  return 'خطای غیرمنتظره رخ داد. دوباره تلاش کنید.';
}

/** Optional HTTP status extraction for callers that branch on status */
export function getErrorStatus(err: unknown): number | null {
  if (err instanceof ApiError) return err.status;
  return null;
}
