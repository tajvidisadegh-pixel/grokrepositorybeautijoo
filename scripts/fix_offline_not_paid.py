#!/usr/bin/env python3
"""#82.2 — offline confirm must not set PaymentStatus.paid."""
from pathlib import Path
import sys

p = Path('backend/src/payments/payments.service.ts')
if not p.is_file():
    print('missing payments.service.ts')
    sys.exit(1)
t = p.read_text()

if "status: 'offline_confirmed'" in t or 'offline_not_paid' in t:
    print('already patched')
else:
    old = '''    if (booking.payment?.status === PaymentStatus.paid) {
      return {
        offline: true,
        status: 'paid' as const,
        bookingId,
        redirectUrl: null as string | null,
        providerRef: booking.payment.providerRef ?? 'offline',
      };
    }
    const idempotencyKey = booking.payment?.idempotencyKey || randomUUID();
    if (!booking.payment) {
      await this.prisma.payment.create({
        data: {
          bookingId,
          amount: booking.totalPrice,
          status: PaymentStatus.pending,
          provider: 'offline',
          idempotencyKey,
        },
      });
    }
    let rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    try {
      const rateRow = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (rateRow?.value != null && Number.isFinite(Number(rateRow.value))) {
        rate = Number(rateRow.value);
      }
    } catch {
      /* optional */
    }
    const { commissionAmount, professionalNetAmount } = calculateCommission(booking.totalPrice, rate);
    const ref = 'offline-' + bookingId.replace(/-/g, '').slice(0, 12);
    await this.prisma.payment.update({
      where: { bookingId },
      data: {
        status: PaymentStatus.paid,
        provider: 'offline',
        providerRef: ref,
        paidAt: new Date(),
        platformCommissionAmount: commissionAmount,
        professionalNetAmount: professionalNetAmount,
        metadata: {
          mode: 'offline',
          note: 'Confirmed without online gateway. Not a bank settlement.', settlementEligible: false, realMoney: false,
        },
      },
    });
    if (booking.status === BookingStatus.pending) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.confirmed, confirmedAt: new Date() },
      });
    }
    return {
      offline: true,
      status: 'paid' as const,
      bookingId,
      redirectUrl: null as string | null,
      providerRef: ref,
    };
  }'''

    new = '''    // #82.2 — already confirmed offline: payment stays non-paid
    if (
      booking.payment?.provider === 'offline' &&
      (booking.status === BookingStatus.confirmed ||
        booking.payment?.status === PaymentStatus.pending)
    ) {
      return {
        offline: true,
        status: 'offline_confirmed' as const,
        bookingId,
        redirectUrl: null as string | null,
        providerRef: booking.payment.providerRef ?? 'offline',
      };
    }
    if (booking.payment?.status === PaymentStatus.paid) {
      return {
        offline: true,
        status: 'paid' as const,
        bookingId,
        redirectUrl: null as string | null,
        providerRef: booking.payment.providerRef ?? 'offline',
      };
    }
    const idempotencyKey = booking.payment?.idempotencyKey || randomUUID();
    if (!booking.payment) {
      await this.prisma.payment.create({
        data: {
          bookingId,
          amount: booking.totalPrice,
          status: PaymentStatus.pending,
          provider: 'offline',
          idempotencyKey,
        },
      });
    }
    const ref = 'offline-' + bookingId.replace(/-/g, '').slice(0, 12);
    // #82.2 — do NOT mark as paid (no bank settlement). Keep pending + offline metadata.
    await this.prisma.payment.update({
      where: { bookingId },
      data: {
        status: PaymentStatus.pending,
        provider: 'offline',
        providerRef: ref,
        paidAt: null,
        metadata: {
          mode: 'offline',
          offline_not_paid: true,
          note: 'Booking confirmed; payment is in-person. Not a bank settlement.',
          settlementEligible: false,
          realMoney: false,
        },
      },
    });
    if (booking.status === BookingStatus.pending) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.confirmed, confirmedAt: new Date() },
      });
    }
    return {
      offline: true,
      status: 'offline_confirmed' as const,
      bookingId,
      redirectUrl: null as string | null,
      providerRef: ref,
    };
  }'''

    if old not in t:
        print('confirmOfflineBooking block mismatch')
        sys.exit(1)
    t = t.replace(old, new, 1)
    print('confirmOfflineBooking patched')

# #82.4 — reject callback for offline provider rows
if 'provider === \'offline\'' not in t[t.find('async callback'): t.find('async callback') + 800]:
    needle = '''    const payment = await this.prisma.payment.findFirst({
      where: { providerRef },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');

    if (payment.status === PaymentStatus.paid) {
      return { status: 'paid', bookingId: payment.bookingId, refId: providerRef };
    }'''
    insert = '''    const payment = await this.prisma.payment.findFirst({
      where: { providerRef },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');

    // #82.4 — offline rows are not gateway callbacks
    if ((payment.provider || '').toLowerCase() === 'offline') {
      throw new BadRequestException('این تراکنش آفلاین است و از درگاه قابل تأیید نیست');
    }

    if (payment.status === PaymentStatus.paid) {
      return { status: 'paid', bookingId: payment.bookingId, refId: providerRef };
    }'''
    if needle in t:
        t = t.replace(needle, insert, 1)
        print('callback offline reject patched')
    else:
        print('callback needle missing (skip)')

p.write_text(t)
print('done', p.stat().st_size)
