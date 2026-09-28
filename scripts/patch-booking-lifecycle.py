#!/usr/bin/env python3
"""Improve cancel/reject notifications + refund on reject + cancel policy UX."""
from pathlib import Path


def patch_reject_refund(s: str) -> str:
    """After reject update, attempt refund if payment was paid."""
    if 'reject refund' in s or 'Refund on reject' in s:
        print('reject refund already present')
        return s

    marker = """      if (action === 'reject') {
        const body =
          reason?.trim()
            ? `رزرو شما توسط زیباگر رد شد. دلیل: ${reason.trim()}`
            : 'رزرو شما توسط زیباگر رد شد.';
        await this.notifications.notify({
          userId: b.customerId,
          type: NotificationType.booking_rejected,
          title: 'رزرو رد شد',
          body,
          data: { bookingId: id, reason: reason ?? null },
          sms: true,
        });
      } else {
        await this.notifications.notify({
          userId: b.customerId,
          type: NotificationType.booking_confirmed,
          title: 'رزرو تأیید شد',
          body: 'رزرو شما توسط زیباگر تأیید شد.',
          data: { bookingId: id },
          sms: true,
        });
      }
      return updated;"""

    replacement = """      if (action === 'reject') {
        // Refund paid payments when a confirmed/pending booking is rejected
        try {
          const payment = await this.prisma.payment.findUnique({
            where: { bookingId: id },
          });
          if (payment?.status === 'paid') {
            await this.payments.refund(
              payment.id,
              reason ?? 'رد رزرو توسط زیباگر',
              isAdmin ? userId : undefined,
            );
          } else if (
            payment?.status === 'pending' ||
            payment?.status === 'processing'
          ) {
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'cancelled' },
            });
          }
        } catch (err) {
          this.logger.warn(
            `reject refund failed booking=${id}: ${(err as Error)?.message}`,
          );
        }

        const body =
          reason?.trim()
            ? `رزرو شما توسط زیباگر رد شد. دلیل: ${reason.trim()}`
            : 'رزرو شما توسط زیباگر رد شد.';
        await this.notifications.notify({
          userId: b.customerId,
          type: NotificationType.booking_rejected,
          title: 'رزرو رد شد',
          body,
          data: { bookingId: id, reason: reason ?? null },
          sms: true,
        });
      } else {
        await this.notifications.notify({
          userId: b.customerId,
          type: NotificationType.booking_confirmed,
          title: 'رزرو تأیید شد',
          body: 'رزرو شما توسط زیباگر تأیید شد.',
          data: { bookingId: id },
          sms: true,
        });
      }
      return updated;"""

    if marker not in s:
        raise SystemExit('reject notify block not found')
    print('reject: refund + notify')
    return s.replace(marker, replacement, 1)


def patch_cancel_notify_both(s: str) -> str:
    """Admin cancel notifies both customer and professional."""
    if 'Admin cancel notifies both' in s:
        print('cancel dual notify already present')
        return s

    old = """      const notifyUserId = isCustomer ? b.professional.userId : b.customerId;
      await this.notifications.notify({
        userId: notifyUserId,
        type: NotificationType.booking_cancelled,
        title: 'رزرو لغو شد',
        body: reason?.trim()
          ? `رزرو لغو شد. دلیل: ${reason.trim()}`
          : 'رزرو لغو شد.',
        data: {
          bookingId: id,
          reason: reason ?? null,
          refundStatus: refundResult?.status ?? null,
        },
        sms: true,
      });
      return { ...updated, refund: refundResult };"""

    new = """      const cancelBody = reason?.trim()
        ? `رزرو لغو شد. دلیل: ${reason.trim()}`
        : 'رزرو لغو شد.';
      const cancelData = {
        bookingId: id,
        reason: reason ?? null,
        refundStatus: refundResult?.status ?? null,
      };

      // Notify the other party; admin cancel notifies both sides
      const targets = new Set<string>();
      if (isAdmin) {
        targets.add(b.customerId);
        if (b.professional?.userId) targets.add(b.professional.userId);
      } else if (isCustomer) {
        if (b.professional?.userId) targets.add(b.professional.userId);
      } else {
        targets.add(b.customerId);
      }

      for (const uid of targets) {
        await this.notifications.notify({
          userId: uid,
          type: NotificationType.booking_cancelled,
          title: 'رزرو لغو شد',
          body: cancelBody,
          data: cancelData,
          sms: true,
        });
      }
      return { ...updated, refund: refundResult };"""

    if old not in s:
        raise SystemExit('cancel notify block not found')
    print('cancel: dual notify for admin')
    return s.replace(old, new, 1)


def patch_customer_cancel_reason() -> None:
    p = Path('frontend/src/app/panel/bookings/page.tsx')
    s = p.read_text()
    if "window.prompt('دلیل لغو" in s or 'دلیل لغو (اختیاری)' in s:
        print('customer cancel reason already prompted')
        return
    old = """      await transitionBooking(b.id, 'cancel', 'لغو توسط مشتری');"""
    new = """      const reason =
        (typeof window !== 'undefined'
          ? window.prompt('دلیل لغو (اختیاری):')
          : null) || 'لغو توسط مشتری';
      await transitionBooking(b.id, 'cancel', reason.trim() || 'لغو توسط مشتری');"""
    if old not in s:
        print('warn: customer cancel line not found')
        return
    p.write_text(s.replace(old, new, 1))
    print('customer: cancel reason prompt')


def patch_wizard_policy() -> None:
    p = Path('frontend/src/components/booking/booking-wizard.tsx')
    s = p.read_text()
    if 'تا ۲ ساعت قبل از نوبت' in s or 'CANCEL_MIN_HOURS' in s:
        print('wizard policy already present')
        return
    needle = """          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            پس از ثبت، رزرو تا تأیید پرداخت قطعی نیست.
          </p>"""
    # may have longer text from earlier patch
    if 'پس از ثبت، رزرو تا تأیید پرداخت' in s:
        # find and append policy after that block
        idx = s.find('پس از ثبت، رزرو تا تأیید پرداخت')
        # find closing </p> after idx
        end = s.find('</p>', idx)
        if end > 0:
            insert = """</p>
          <p className="rounded-xl bg-gray-light/60 px-3 py-2 text-xs text-gray">
            سیاست لغو: تا حدود ۲ ساعت قبل از نوبت می‌توانید رزرو را لغو کنید. پس از پرداخت موفق،
            با لغو به‌موقع درخواست استرداد ثبت می‌شود.
          </p>"""
            s = s[:end] + insert + s[end + 4 :]
            p.write_text(s)
            print('wizard: cancel policy added')
            return
    print('warn: wizard policy insertion point not found')


def main() -> None:
    svc = Path('backend/src/bookings/bookings.service.ts')
    s = svc.read_text()
    s = patch_reject_refund(s)
    s = patch_cancel_notify_both(s)
    svc.write_text(s)
    patch_customer_cancel_reason()
    patch_wizard_policy()
    print('done')


if __name__ == '__main__':
    main()
