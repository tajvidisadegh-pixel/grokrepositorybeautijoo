#!/usr/bin/env python3
from pathlib import Path

METHOD = r'''
  /**
   * Move a pending/confirmed booking to a new startAt (same services/duration).
   */
  async reschedule(
    id: string,
    userId: string,
    roles: string[],
    startAtIso: string,
  ) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true } },
        professional: { select: { id: true, userId: true, title: true } },
        items: true,
      },
    });
    if (!b) throw new NotFoundException();

    const isAdmin = roles.some((r) => ['admin', 'SUPER_ADMIN'].includes(r));
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = !!(pro && b.professionalId === pro.id);
    const isCustomer = b.customerId === userId;
    if (!isAdmin && !isCustomer && !isPro) throw new ForbiddenException();

    const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
    if (!allowed.includes(b.status)) {
      throw new BadRequestException('فقط رزرو در انتظار یا تأییدشده قابل تغییر زمان است');
    }

    if (isCustomer && !isAdmin) {
      const minHours = parseInt(process.env.CANCEL_MIN_HOURS_BEFORE || '2', 10);
      const hours = Number.isFinite(minHours) && minHours >= 0 ? minHours : 2;
      const msLeft = b.startAt.getTime() - Date.now();
      if (msLeft < hours * 3600_000) {
        throw new BadRequestException(
          hours === 0
            ? 'امکان تغییر زمان این رزرو وجود ندارد.'
            : `تغییر زمان فقط تا ${hours} ساعت قبل از نوبت امکان‌پذیر است.`,
        );
      }
    }

    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now() + 60_000) {
      throw new BadRequestException('زمان جدید باید در آینده باشد');
    }

    const durationMs = Math.max(15 * 60_000, b.endAt.getTime() - b.startAt.getTime());
    const endAt = new Date(startAt.getTime() + durationMs);

    const clash = await this.prisma.booking.findFirst({
      where: {
        id: { not: id },
        professionalId: b.professionalId,
        status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');

    try {
      const dateStr = tehranDateStr(startAt);
      const durationMin = Math.round(durationMs / 60_000);
      const avail = await this.availability.getSlots(b.professionalId, dateStr, durationMin);
      const slotList = Array.isArray(avail)
        ? avail
        : Array.isArray((avail as { slots?: unknown })?.slots)
          ? (avail as { slots: { start?: string; available?: boolean }[] }).slots
          : [];
      const hhmm = tehranHHMM(startAt);
      const ok = slotList.some(
        (s) =>
          s.available !== false &&
          (s.start === hhmm || s.start === hhmm.slice(0, 5)),
      );
      if (!ok) {
        throw new BadRequestException('زمان انتخاب‌شده در ساعات کاری زیباگر موجود نیست');
      }
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof ConflictException) throw err;
      this.logger.warn(`reschedule availability check skipped: ${(err as Error)?.message}`);
    }

    const previousStart = b.startAt;
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        startAt,
        endAt,
        notes: b.notes
          ? `${b.notes}\n[تغییر زمان از ${previousStart.toISOString()}]`
          : `[تغییر زمان از ${previousStart.toISOString()}]`,
      },
    });

    let when: string;
    try {
      when = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(startAt);
    } catch {
      when = startAt.toISOString();
    }

    const targets = new Set<string>();
    targets.add(b.customerId);
    if (b.professional?.userId) targets.add(b.professional.userId);
    for (const uid of targets) {
      if (uid === userId && !isAdmin) continue;
      await this.notifications.notify({
        userId: uid,
        type: NotificationType.booking_confirmed,
        title: 'زمان رزرو تغییر کرد',
        body: `نوبت به ${when} منتقل شد.`,
        data: {
          bookingId: id,
          startAt: startAt.toISOString(),
          previousStart: previousStart.toISOString(),
        },
        sms: true,
      });
    }
    return updated;
  }
'''


def patch_service() -> None:
    p = Path('backend/src/bookings/bookings.service.ts')
    s = p.read_text()
    if 'async reschedule(' in s and 'slotList' in s:
        print('service already good')
        return
    if 'async reschedule(' in s:
        a = s.find('Move a pending')
        if a < 0:
            a = s.find('async reschedule(')
        a = s.rfind('  /**', 0, a if a > 0 else len(s))
        b = s.find('  async transition(', a if a > 0 else 0)
        if a >= 0 and b > a:
            s = s[:a] + METHOD + '\n' + s[b:]
            p.write_text(s)
            print('service replaced')
            return
    marker = '  async transition('
    if marker not in s:
        raise SystemExit('transition missing')
    p.write_text(s.replace(marker, METHOD + '\n  async transition(', 1))
    print('service inserted')


def patch_controller() -> None:
    p = Path('backend/src/bookings/bookings.controller.ts')
    s = p.read_text()
    if "@Patch(':id/reschedule')" in s:
        print('controller ok')
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
    s = s.replace("  @Patch(':id/confirm')", ep + "\n  @Patch(':id/confirm')", 1)
    p.write_text(s)
    print('controller ok')


def patch_api() -> None:
    p = Path('frontend/src/lib/panel-api.ts')
    s = p.read_text()
    if 'rescheduleBooking' in s:
        print('api ok')
        return
    s = s.replace(
        'export async function transitionBooking',
        'export async function rescheduleBooking(id: string, startAt: string) {\n'
        '  return apiClient.patch(`/bookings/${id}/reschedule`, { startAt });\n'
        '}\n\n'
        'export async function transitionBooking',
        1,
    )
    p.write_text(s)
    print('api ok')


def patch_page() -> None:
    p = Path('frontend/src/app/panel/bookings/page.tsx')
    s = p.read_text()
    if 'rescheduleBooking' in s and 'تغییر زمان' in s:
        print('page ok')
        return
    if 'rescheduleBooking' not in s:
        s = s.replace(
            '  createReview,\n  transitionBooking,',
            '  createReview,\n  transitionBooking,\n  rescheduleBooking,',
            1,
        )
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
    p.write_text(s)
    print('page ok')


if __name__ == '__main__':
    patch_service()
    patch_controller()
    patch_api()
    patch_page()
    print('done')
