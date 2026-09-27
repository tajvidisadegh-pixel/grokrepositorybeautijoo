/** Trust / KYC surface badges — uses Professional.status + verifiedAt (no extra schema). */

type Props = {
  /** ProfessionalStatus: approved | pending_review | ... */
  status?: string | null;
  /** Set by admin on approve; shows identity-verified badge when present */
  verifiedAt?: string | Date | null;
  size?: 'sm' | 'md';
  className?: string;
};

export function TrustBadge({ status, verifiedAt, size = 'sm', className = '' }: Props) {
  const approved = status === 'approved' || !status;
  const identityVerified = !!verifiedAt;
  if (!approved && !identityVerified) return null;

  const text = size === 'sm' ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm';
  const pad = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {approved && (
        <span
          className={`rounded-full bg-emerald-50 ${pad} ${text} font-medium text-emerald-700`}
          title="پروفایل توسط بیوتی‌جو بررسی و تأیید شده است"
        >
          ✓ تأییدشده
        </span>
      )}
      {identityVerified && (
        <span
          className={`rounded-full bg-blue-50 ${pad} ${text} font-medium text-blue-700`}
          title="هویت زیباگر توسط پلتفرم احراز شده است"
        >
          ◆ احراز هویت
        </span>
      )}
    </span>
  );
}
