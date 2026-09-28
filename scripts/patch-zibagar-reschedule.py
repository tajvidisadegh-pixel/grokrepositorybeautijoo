#!/usr/bin/env python3
from pathlib import Path


def main() -> None:
    p = Path('frontend/src/app/zibagar/bookings/page.tsx')
    s = p.read_text()
    if 'rescheduleBooking' in s and 'تغییر زمان' in s:
        print('already patched')
        return

    # imports
    if 'rescheduleBooking' not in s:
        s = s.replace(
            '  transitionBooking,',
            '  transitionBooking,\n  rescheduleBooking,',
            1,
        )
    if "from '@/lib/booking-api'" not in s:
        # find panel-api import line end
        if "from '@/lib/panel-api'" in s:
            s = s.replace(
                "from '@/lib/panel-api';",
                "from '@/lib/panel-api';\nimport { fetchAvailability } from '@/lib/booking-api';",
                1,
            )

    # state after busy
    if 'rescheduleFor' not in s:
        if 'const [busy, setBusy]' in s:
            s = s.replace(
                'const [busy, setBusy] = useState<string | null>(null);',
                "const [busy, setBusy] = useState<string | null>(null);\n"
                '  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);\n'
                "  const [rescheduleDate, setRescheduleDate] = useState('');\n"
                '  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string }[]>([]);\n'
                '  const [rescheduleLoading, setRescheduleLoading] = useState(false);',
                1,
            )
        else:
            # insert after error state
            s = s.replace(
                'const [error, setError] = useState<string | null>(null);',
                'const [error, setError] = useState<string | null>(null);\n'
                '  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);\n'
                "  const [rescheduleDate, setRescheduleDate] = useState('');\n"
                '  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string }[]>([]);\n'
                '  const [rescheduleLoading, setRescheduleLoading] = useState(false);',
                1,
            )

    if 'loadRescheduleSlots' not in s:
        helpers = '''
  async function loadRescheduleSlots(b: BookingListItem, date: string) {
    const proId = b.professional?.id;
    if (!date || !proId) return;
    setRescheduleLoading(true);
    try {
      const start = b.startAt ? new Date(b.startAt).getTime() : 0;
      const end = b.endAt ? new Date(b.endAt).getTime() : start + 30 * 60_000;
      const durationMin = Math.max(15, Math.round((end - start) / 60_000) || 30);
      const avail = await fetchAvailability(proId, date, durationMin);
      setRescheduleSlots(Array.isArray(avail?.slots) ? avail.slots : []);
    } catch {
      setRescheduleSlots([]);
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function applyReschedule(b: BookingListItem, slotStart: string) {
    if (!rescheduleDate) return;
    setRescheduleLoading(true);
    setError(null);
    try {
      const hh = slotStart.length === 5 ? slotStart + ':00' : slotStart;
      const startAt = `${rescheduleDate}T${hh}.000Z`;
      await rescheduleBooking(b.id, startAt);
      setRescheduleFor(null);
      setRescheduleSlots([]);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setRescheduleLoading(false);
    }
  }

'''
        s = s.replace(
            '  async function act(id: string',
            helpers + '  async function act(id: string',
            1,
        )

    if 'تغییر زمان' not in s:
        # add button in the pending/confirmed action group before رد
        old = '''{(b.status === 'pending' || b.status === 'confirmed') && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>'''
        new = '''{(b.status === 'pending' || b.status === 'confirmed') && (
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
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>'''
        if old not in s:
            print('warn: action block not exact match')
            # softer: insert before رد button only once
            soft = '''                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد'''
            if soft in s and 'تغییر زمان' not in s:
                s = s.replace(
                    soft,
                    '''                              <Button
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
'''
                    + soft,
                    1,
                )
                print('soft button insert')
        else:
            s = s.replace(old, new, 1)
            print('button block replaced')

    if 'rescheduleFor === b.id' not in s:
        panel = '''
                          {rescheduleFor === b.id && (
                            <div className="mt-2 space-y-2 rounded-xl border border-border bg-gray-light/50 p-3">
                              <p className="text-xs font-medium">زمان جدید برای این نوبت</p>
                              <input
                                type="date"
                                className="h-9 w-full max-w-xs rounded-lg border border-border px-2 text-sm"
                                value={rescheduleDate}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={(e) => {
                                  const d = e.target.value;
                                  setRescheduleDate(d);
                                  void loadRescheduleSlots(b, d);
                                }}
                              />
                              {rescheduleLoading && (
                                <p className="text-xs text-gray">بارگذاری ساعات…</p>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {rescheduleSlots.map((sl) => (
                                  <button
                                    key={sl.start}
                                    type="button"
                                    disabled={rescheduleLoading}
                                    className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs hover:border-coral hover:text-coral"
                                    onClick={() => void applyReschedule(b, sl.start)}
                                  >
                                    {sl.start}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="text-xs text-gray underline"
                                onClick={() => setRescheduleFor(null)}
                              >
                                انصراف
                              </button>
                            </div>
                          )}
'''
        # place after the action buttons fragment ends — look for report button area
        if 'submitReport' in s or 'گزارش' in s:
            # insert before report button if present in same card
            marker = 'گزارش مشکل'
            # find a stable point: after the actions </div> near complete
            pass
        # After the complete/confirm button group - search for "تکمیل"
        marker = '''                                تکمیل
                              </Button>
                            </>
                          )}'''
        if marker in s:
            s = s.replace(
                marker,
                '''                                تکمیل
                              </Button>
                            </>
                          )}
'''
                + panel,
                1,
            )
            print('panel after complete')
        else:
            # try after cancel/complete block differently
            alt = "onClick={() => act(b.id, 'complete')}"
            if alt in s and 'rescheduleFor === b.id' not in s:
                # find end of that fragment
                idx = s.find(alt)
                close = s.find('</>', idx)
                if close > 0:
                    # after the )} following </>
                    end = s.find(')}', close)
                    if end > 0:
                        insert_at = end + 2
                        s = s[:insert_at] + panel + s[insert_at:]
                        print('panel soft insert')

    p.write_text(s)
    print('done')


if __name__ == '__main__':
    main()
