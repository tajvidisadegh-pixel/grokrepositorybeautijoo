/** Free-cancel window notice before booking confirm (issue #40 item 21). */

const DEFAULT_HOURS = 2;

export function CancelPolicyNotice({
  hoursBefore,
  className = '',
}: {
  /** Hours before start when free cancel is allowed (server CANCEL_MIN_HOURS_BEFORE). */
  hoursBefore?: number;
  className?: string;
}) {
  const h =
    typeof hoursBefore === 'number' && Number.isFinite(hoursBefore) && hoursBefore >= 0
      ? Math.floor(hoursBefore)
      : DEFAULT_HOURS;

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ${className}`}
      role="note"
    >
      <p className="font-medium">سیاست لغو</p>
      <p className="mt-1 text-xs leading-6 text-amber-900/90">
        {h === 0
          ? 'پس از ثبت، لغو رایگان ممکن است محدودیت زمانی نداشته باشد؛ جزئیات در قوانین بازگشت وجه.'
          : `تا ${h.toLocaleString('fa-IR')} ساعت قبل از شروع نوبت می‌توانید رزرو را رایگان لغو کنید. پس از آن ممکن است لغو محدود یا مشمول کسر شود.`}
      </p>
      <a href="/refund" className="mt-1 inline-block text-xs font-medium text-coral underline">
        قوانین کنسلی و بازگشت وجه
      </a>
    </div>
  );
}
