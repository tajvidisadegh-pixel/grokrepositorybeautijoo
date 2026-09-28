#!/usr/bin/env python3
from pathlib import Path


def patch_controller() -> None:
    p = Path('backend/src/bookings/bookings.controller.ts')
    s = p.read_text()
    if "@Patch(':id/reschedule')" in s:
        print('controller already')
        return
    if 'class RescheduleDto' not in s:
        s = s.replace(
            'class TransitionDto {',
            'class RescheduleDto {\n  @IsString()\n  startAt!: string;\n}\n\nclass TransitionDto {',
            1,
        )
    ep = (
        "\n  @Patch(':id/reschedule')\n"
        '  reschedule(\n'
        "    @Param('id', ParseUUIDPipe) id: string,\n"
        "    @CurrentUser('id') userId: string,\n"
        "    @CurrentUser('roles') roles: string[],\n"
        '    @Body() dto: RescheduleDto,\n'
        '  ) {\n'
        '    return this.service.reschedule(id, userId, roles || [], dto.startAt);\n'
        '  }\n'
    )
    if "  @Patch(':id/confirm')" not in s:
        raise SystemExit('confirm route missing')
    s = s.replace("  @Patch(':id/confirm')", ep + "\n  @Patch(':id/confirm')", 1)
    p.write_text(s)
    print('controller patched')


def patch_page() -> None:
    p = Path('frontend/src/app/panel/bookings/page.tsx')
    s = p.read_text()
    if 'rescheduleBooking' in s and 'تغییر زمان' in s:
        print('page already')
        return

    if 'rescheduleBooking' not in s:
        if '  createReview,\n  transitionBooking,' in s:
            s = s.replace(
                '  createReview,\n  transitionBooking,',
                '  createReview,\n  transitionBooking,\n  rescheduleBooking,',
                1,
            )
        elif 'transitionBooking,' in s:
            s = s.replace('transitionBooking,', 'transitionBooking,\n  rescheduleBooking,', 1)

    if "from '@/lib/booking-api'" not in s:
        s = s.replace(
            "from '@/lib/panel-api';",
            "from '@/lib/panel-api';\nimport { fetchAvailability } from '@/lib/booking-api';",
            1,
        )

    if 'rescheduleFor' not in s:
        s = s.replace(
            '  const [cancellingId, setCancellingId] = useState<string | null>(null);\n',
            '  const [cancellingId, setCancellingId] = useState<string | null>(null);\n'
            '  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);\n'
            "  const [rescheduleDate, setRescheduleDate] = useState('');\n"
            '  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string }[]>([]);\n'
            '  const [rescheduleLoading, setRescheduleLoading] = useState(false);\n',
            1,
        )

    if 'loadRescheduleSlots' not in s:
        helpers = '''
  async function loadRescheduleSlots(b: BookingWithReview, date: string) {
    if (!date || !b.professional?.id) return;
    setRescheduleLoading(true);
    try {
      const start = b.startAt ? new Date(b.startAt).getTime() : 0;
      const end = b.endAt ? new Date(b.endAt).getTime() : start + 30 * 60_000;
      const durationMin = Math.max(15, Math.round((end - start) / 60_000) || 30);
      const avail = await fetchAvailability(b.professional.id, date, durationMin);
      setRescheduleSlots(Array.isArray(avail?.slots) ? avail.slots : []);
    } catch {
      setRescheduleSlots([]);
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function applyReschedule(b: BookingWithReview, slotStart: string) {
    if (!rescheduleDate) return;
    setRescheduleLoading(true);
    setActionMsg(null);
    try {
      const hh = slotStart.length === 5 ? slotStart + ':00' : slotStart;
      const startAt = `${rescheduleDate}T${hh}.000Z`;
      await rescheduleBooking(b.id, startAt);
      setActionMsg('زمان رزرو با موفقیت تغییر کرد.');
      setRescheduleFor(null);
      setRescheduleSlots([]);
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setRescheduleLoading(false);
    }
  }

'''
        if 'async function handleCancel' in s:
            s = s.replace('  async function handleCancel', helpers + '  async function handleCancel', 1)
        elif 'async function submitReview' in s:
            s = s.replace('  async function submitReview', helpers + '  async function submitReview', 1)

    if 'تغییر زمان' not in s:
        marker = '{canCustomerCancel(b) && ('
        if marker in s:
            s = s.replace(
                marker,
                "{(b.status === 'pending' || b.status === 'confirmed') && (\n"
                '                      <Button\n'
                '                        type="button"\n'
                '                        variant="outline"\n'
                '                        className="text-sm"\n'
                '                        onClick={() => {\n'
                '                          setRescheduleFor(b.id);\n'
                "                          setRescheduleDate('');\n"
                '                          setRescheduleSlots([]);\n'
                '                        }}\n'
                '                      >\n'
                '                        تغییر زمان\n'
                '                      </Button>\n'
                '                    )}\n'
                '                    {canCustomerCancel(b) && (',
                1,
            )
        panel = '''
                  {rescheduleFor === b.id && (
                    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-gray-light/40 p-3">
                      <p className="text-sm font-medium">انتخاب زمان جدید</p>
                      <input
                        type="date"
                        className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                        value={rescheduleDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          const d = e.target.value;
                          setRescheduleDate(d);
                          void loadRescheduleSlots(b, d);
                        }}
                      />
                      {rescheduleLoading && <p className="text-xs text-gray">در حال بارگذاری ساعات…</p>}
                      {!rescheduleLoading && rescheduleDate && rescheduleSlots.length === 0 && (
                        <p className="text-xs text-gray">ساعت آزادی برای این روز نیست.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {rescheduleSlots.map((sl) => (
                          <button
                            key={sl.start}
                            type="button"
                            disabled={rescheduleLoading}
                            className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs hover:border-coral hover:text-coral"
                            onClick={() => void applyReschedule(b, sl.start)}
                          >
                            {sl.start}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="text-xs text-gray underline" onClick={() => setRescheduleFor(null)}>
                        انصراف
                      </button>
                    </div>
                  )}
'''
        if '{reviewFor === b.id && (' in s:
            s = s.replace('{reviewFor === b.id && (', panel + '\n                  {reviewFor === b.id && (', 1)
        else:
            # append before closing of map item if possible
            pass

    p.write_text(s)
    print('page patched')


if __name__ == '__main__':
    patch_controller()
    patch_page()
    print('done')
