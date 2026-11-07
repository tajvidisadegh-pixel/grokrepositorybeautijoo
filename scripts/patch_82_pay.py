from pathlib import Path

p = Path("backend/src/payments/payments.service.ts")
t = p.read_text()
if "#82.5" in t:
    print("pay already #82.5")
else:
    needle = "    const rateRow = await this.prisma.platformSetting.findUnique({\n      where: { key: PLATFORM_COMMISSION_RATE_KEY },\n    });"
    guard = """    // #82.5 — never mark paid / confirm against a cancelled booking
    const bookingRow =
      payment.booking ||
      (await this.prisma.booking.findUnique({ where: { id: payment.bookingId } }));
    if (!bookingRow) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          metadata: {
            ...(typeof payment.metadata === 'object' && payment.metadata !== null
              ? (payment.metadata as object)
              : {}),
            gatewayRefId: verified.refId ?? null,
            rejectReason: 'booking_missing',
            verifiedButRejected: true,
          },
        },
      });
      return { status: 'failed', bookingId: payment.bookingId, reason: 'booking_missing' };
    }
    if (bookingRow.status === BookingStatus.cancelled) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          metadata: {
            ...(typeof payment.metadata === 'object' && payment.metadata !== null
              ? (payment.metadata as object)
              : {}),
            gatewayRefId: verified.refId ?? null,
            rejectReason: 'booking_cancelled',
            verifiedButRejected: true,
          },
        },
      });
      try {
        if (payment.providerRef) {
          await this.provider.refund({
            providerRef: payment.providerRef,
            amount: payment.amount,
            reason: 'رزرو در زمان تأیید پرداخت لغو شده بود',
          });
        }
      } catch { /* non-blocking */ }
      return { status: 'failed', bookingId: payment.bookingId, reason: 'booking_cancelled' };
    }
    // #82.5 — re-check slot before confirming pending/expired
    if (bookingRow.status === BookingStatus.expired || bookingRow.status === BookingStatus.pending) {
      const overlap = await this.prisma.booking.count({
        where: {
          professionalId: bookingRow.professionalId,
          id: { not: bookingRow.id },
          status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
          startAt: { lt: bookingRow.endAt },
          endAt: { gt: bookingRow.startAt },
        },
      });
      const timeOff = await this.prisma.timeOff.count({
        where: {
          professionalId: bookingRow.professionalId,
          startAt: { lt: bookingRow.endAt },
          endAt: { gt: bookingRow.startAt },
        },
      });
      const manual = await this.prisma.manualReservation.count({
        where: {
          professionalId: bookingRow.professionalId,
          startAt: { lt: bookingRow.endAt },
          endAt: { gt: bookingRow.startAt },
        },
      });
      if (overlap > 0 || timeOff > 0 || manual > 0) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.failed,
            metadata: {
              ...(typeof payment.metadata === 'object' && payment.metadata !== null
                ? (payment.metadata as object)
                : {}),
              gatewayRefId: verified.refId ?? null,
              rejectReason: 'slot_unavailable',
              verifiedButRejected: true,
            },
          },
        });
        try {
          if (payment.providerRef) {
            await this.provider.refund({
              providerRef: payment.providerRef,
              amount: payment.amount,
              reason: 'اسلات در زمان تأیید پرداخت آزاد نبود',
            });
          }
        } catch { /* non-blocking */ }
        return { status: 'failed', bookingId: payment.bookingId, reason: 'slot_unavailable' };
      }
    }

"""
    if needle not in t:
        raise SystemExit("payments needle missing")
    t = t.replace(needle, guard + needle, 1)
    old_confirm = """    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
    });
    if (booking && (booking.status === 'pending' || booking.status === 'expired')) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.confirmed, confirmedAt: new Date() },
      });
    }"""
    new_confirm = """    if (
      bookingRow.status === BookingStatus.pending ||
      bookingRow.status === BookingStatus.expired
    ) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.confirmed, confirmedAt: new Date() },
      });
    }"""
    if old_confirm in t:
        t = t.replace(old_confirm, new_confirm, 1)
    p.write_text(t)
    print("#82.5 applied")
