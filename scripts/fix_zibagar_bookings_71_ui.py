#!/usr/bin/env python3
"""Restore zibagar bookings actions block and apply #71 UI cleanly."""
from pathlib import Path

OLD_ACTIONS = '''                        <div className="flex flex-wrap gap-2">
                          {b.status === 'pending' && (
                            <>
                              <Button
                                className="min-h-11 min-w-[7rem] flex-1 sm:flex-none"
                                loading={busy === `${b.id}:confirm`}
                                onClick={() => act(b.id, 'confirm')}
                              >
                                تأیید
                              </Button>
                              <Button
                                className="min-h-11 min-w-[7rem] flex-1 sm:flex-none"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
                            </>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRescheduleFor(b.id);
                                  setRescheduleDate('');
                                  setRescheduleSlots([]);
                                }}
'''

# We'll replace a larger broken region by matching from notes block to rescheduleFor

NEW_ACTIONS = '''                        <div className="flex flex-wrap gap-2">
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRescheduleFor(b.id);
                                  setRescheduleDate('');
                                  setRescheduleSlots([]);
                                }}
                              >
                                تغییر زمان
                              </Button>
                              {b.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busy === `${b.id}:cancel`}
                                  onClick={() => act(b.id, 'cancel')}
                                >
                                  لغو (پرداخت‌نشده)
                                </Button>
                              )}
                              <Button
                                size="sm"
                                loading={busy === `${b.id}:complete`}
                                onClick={() => act(b.id, 'complete')}
                              >
                                تکمیل
                              </Button>
                              {b.status === 'confirmed' && (
                                <>
                                  <p className="w-full text-xs text-gray">
                                    نوبت قطعی است. در صورت مشکل از{' '}
                                    <a href="/zibagar/support" className="text-coral underline">
                                      پشتیبانی تیکت
                                    </a>{' '}
                                    ثبت کنید.
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    loading={busy === `${b.id}:no-show`}
                                    onClick={() => {
                                      if (
                                        typeof window !== 'undefined' &&
                                        !window.confirm('مشتری حضور نداشته؟ ثبت عدم حضور؟')
                                      )
                                        return;
                                      void act(b.id, 'no-show');
                                    }}
                                  >
                                    عدم حضور
                                  </Button>
                                </>
                              )}
                            </>
                          )}

                          {rescheduleFor === b.id && (
'''


def main() -> None:
    path = Path('frontend/src/app/zibagar/bookings/page.tsx')
    t = path.read_text()

    # Prefer label already
    t = t.replace("{ value: 'confirmed', label: 'تأییدشده' },", "{ value: 'confirmed', label: 'قطعی' },")

    start = t.find("{b.notes && (")
    # find actions div after notes
    start = t.find('<div className="flex flex-wrap gap-2">', start if start >= 0 else 0)
    end = t.find('{rescheduleFor === b.id && (', start if start >= 0 else 0)
    if start < 0 or end < 0:
        raise SystemExit(f'anchors not found start={start} end={end}')

    t = t[:start] + NEW_ACTIONS + t[end + len('{rescheduleFor === b.id && ('):]
    # NEW_ACTIONS already includes '{rescheduleFor === b.id && ('
    path.write_text(t)
    print('fixed', path.stat().st_size)


if __name__ == '__main__':
    main()
