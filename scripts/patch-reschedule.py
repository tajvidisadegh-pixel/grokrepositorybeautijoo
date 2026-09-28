#!/usr/bin/env python3
"""Add PATCH /bookings/:id/reschedule + customer UI."""
from pathlib import Path

RESCHEDULE_METHOD = r'''
  /**
   * Move a pending/confirmed booking to a new startAt (same services/duration).
   * Customer, professional, or admin. Customer subject to CANCEL_MIN_HOURS_BEFORE.
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

    // Same lead-time window as cancel for customers
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

    const durationMs = Math.max(
      15 * 60_000,
      b.endAt.getTime() - b.startAt.getTime(),
    );
    const endAt = new Date(startAt.getTime() + durationMs);

    // Overlap with other active bookings (exclude self)
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
    if (clash) {
      throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
    }

    // Soft availability check via AvailabilityService when possible
    try {
      const dateStr = tehranDateStr(startAt);
      const durationMin = Math.round(durationMs / 60_000);
      const slots = await this.availability.getSlots(
        b.professionalId,
        dateStr,
        durationMin,
      );
      const hhmm = tehranHHMM(startAt);
      const ok = (slots || []).some(
        (s: { start?: string }) => s.start === hhmm || s.start === hhmm.slice(0, 5),
      );
      if (!ok) {
        throw new BadRequestException(
          'زمان انتخاب‌شده در ساعات کاری زیباگر موجود نیست',
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof ConflictException) throw err;
      this.logger.warn(
        `reschedule availability check skipped: ${(err as Error)?.message}`,
      );
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

    const when = (() => {
      try {
        return new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(startAt);
      } catch {
        return startAt.toISOString();
      }
    })();

    const targets = new Set<string>();
    targets.add(b.customerId);
    if (b.professional?.userId) targets.add(b.professional.userId);

    for (const uid of targets) {
      if (uid === userId && !isAdmin) continue; // skip actor unless admin moved it
      await this.notifications.notify({
        userId: uid,
        type: NotificationType.booking_confirmed,
        title: 'زمان رزرو تغییر کرد',
        body: `نوبت به ${when} منتقل شد.`,
        data: { bookingId: id, startAt: startAt.toISOString(), previousStart: previousStart.toISOString() },
        sms: true,
      });
    }

    return updated;
  }
'''


def patch_service() -> None:
    p = Path('backend/src/bookings/bookings.service.ts')
    s = p.read_text()
    if 'async reschedule(' in s:
        print('service already has reschedule')
        return

    # Ensure timezone helpers imported
    if 'tehranDateStr' not in s:
        # find import from timezone
        if "from '../common/timezone'" in s or 'from "../common/timezone"' in s:
            pass
        else:
            # add import after prisma import line
            s = s.replace(
                "import { PrismaService } from '../prisma/prisma.service';",
                "import { PrismaService } from '../prisma/prisma.service';\n"
                "import { tehranDateStr, tehranHHMM } from '../common/timezone';",
                1,
            )
    elif 'tehranHHMM' not in s:
        s = s.replace('tehranDateStr', 'tehranDateStr, tehranHHMM', 1)

    # Insert before transition or at end before last closing of class
    marker = '  async transition('
    if marker not in s:
        raise SystemExit('transition not found')
    s = s.replace(marker, RESCHEDULE_METHOD + '\n  async transition(', 1)
    p.write_text(s)
    print('service reschedule added')


def patch_controller() -> None:
    p = Path('backend/src/bookings/bookings.controller.ts')
    s = p.read_text()
    if 'reschedule' in s and 'RescheduleDto' in s:
        print('controller already')
        return

    if 'class RescheduleDto' not in s:
        s = s.replace(
            'class TransitionDto {',
            '''class RescheduleDto {
  @IsString()
  startAt!: string;
}

class TransitionDto {''',
            1,
        )

    endpoint = '''
  @Patch(':id/reschedule')
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Body() dto: RescheduleDto,
  ) {
    return this.service.reschedule(id, userId, roles || [], dto.startAt);
  }
'''
    if "@Patch(':id/reschedule')" not in s:
        s = s.replace(
            "  @Patch(':id/confirm')",
            endpoint + "\n  @Patch(':id/confirm')",
            1,
        )
    p.write_text(s)
    print('controller ok')


def patch_panel_api() -> None:
    p = Path('frontend/src/lib/panel-api.ts')
    s = p.read_text()
    if 'rescheduleBooking' in s:
        print('panel-api already')
        return
    needle = "export async function transitionBooking"
    insert = '''export async function rescheduleBooking(id: string, startAt: string) {
  return apiClient.patch(`/bookings/${id}/reschedule`, { startAt });
}

'''
    if needle not in s:
        raise SystemExit('transitionBooking not found')
    p.write_text(s.replace(needle, insert + needle, 1))
    print('panel-api ok')


def patch_customer_page() -> None:
    p = Path('frontend/src/app/panel/bookings/page.tsx')
    s = p.read_text()
    if 'rescheduleBooking' in s:
        print('customer page already')
        return

    s = s.replace(
        '  createReview,\n  transitionBooking,',
        '  createReview,\n  transitionBooking,\n  rescheduleBooking,',
        1,
    )
    # import fetchAvailability from booking-api
    if "from '@/lib/booking-api'" not in s:
        s = s.replace(
            "from '@/lib/panel-api';",
            "from '@/lib/panel-api';\nimport { fetchAvailability } from '@/lib/booking-api';",
            1,
        )

    # state for reschedule
    if 'rescheduleFor' not in s:
        s = s.replace(
            '  const [cancellingId, setCancellingId] = useState<string | null>(null);\n',
            '''  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string }[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
''',
            1,
        )

    # helper functions before return
    if 'async function loadRescheduleSlots' not in s:
        anchor = '  async function handleCancel'
        if anchor not in s:
            # try after submitReview
            anchor = '  async function submitReview'
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
      // slot times from availability are HH:mm in Tehran; build ISO via noon-safe path used elsewhere
      const startAt = `${rescheduleDate}T${slotStart.length === 5 ? slotStart + ':00' : slotStart}.000Z`;
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
        # Insert before handleCancel if present
        if 'async function handleCancel' in s:
            s = s.replace('  async function handleCancel', helpers + '  async function handleCancel', 1)
        else:
            s = s.replace('  async function submitReview', helpers + '  async function submitReview', 1)

    # Button + panel near cancel button
    if 'تغییر زمان' not in s:
        # add button next to cancel
        old_btn = "{payStatus === 'paid' ? 'لغو و درخواست بازپرداخت' : 'لغو رزرو'}"
        # find cancel button block - add reschedule before it for pending/confirmed
        marker = "{canCustomerCancel(b) && ("
        if marker in s:
            insert = '''{(b.status === 'pending' || b.status === 'confirmed') && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-sm"
                        onClick={() => {
                          setRescheduleFor(b.id);
                          setRescheduleDate('');
                          setRescheduleSlots([]);
                        }}
                      >
                        تغییر زمان
                      </Button>
                    )}
                    {canCustomerCancel(b) && ('''
            s = s.replace(marker, insert, 1)

        # form panel
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
        # insert after review form or after buttons
        if '{reviewFor === b.id && (' in s:
            s = s.replace('{reviewFor === b.id && (', panel + '\n                  {reviewFor === b.id && (', 1)
        elif 'ثبت امتیاز و نظر' in s:
            # after action buttons area
            pass

    p.write_text(s)
    print('customer page ok')


def main() -> None:
    patch_service()
    patch_controller()
    patch_panel_api()
    patch_customer_page()
    print('done')


if __name__ == '__main__':
    main()
