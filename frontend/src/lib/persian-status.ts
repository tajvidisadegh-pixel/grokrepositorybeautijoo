/** Status labels aligned with Prisma enums (lowercase / snake_case). */
export function persianBookingStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'در انتظار تأیید',
    confirmed: 'تأیید شده',
    rejected: 'رد شده',
    cancelled: 'لغو شده',
    completed: 'انجام شده',
    expired: 'منقضی شده',
    no_show: 'عدم حضور',
    NO_SHOW: 'عدم حضور',
  };
  return map[status] || map[status.toLowerCase()] || status;
}

export function persianProfessionalStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'پیش‌نویس',
    pending_review: 'در انتظار بررسی',
    approved: 'تأیید شده',
    rejected: 'رد شده',
    suspended: 'معلق',
  };
  return map[status] || status;
}

export function persianPaymentStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'در انتظار پرداخت',
    processing: 'در حال پردازش',
    paid: 'موفق و تسویه‌شده',
    failed: 'ناموفق',
    refunded: 'مسترد شده',
    cancelled: 'لغو شده',
  };
  return map[status] || map[status?.toLowerCase()] || status;
}

export const WEEKDAY_FA: Record<string, string> = {
  SUNDAY: 'یکشنبه',
  MONDAY: 'دوشنبه',
  TUESDAY: 'سه‌شنبه',
  WEDNESDAY: 'چهارشنبه',
  THURSDAY: 'پنجشنبه',
  FRIDAY: 'جمعه',
  SATURDAY: 'شنبه',
};
