#!/usr/bin/env python3
"""#71 — پرداخت موفق = نوبت قطعی؛ حذف تأیید/رد زیباگر برای رزرو پرداخت‌شده."""
from pathlib import Path


def patch_bookings_transition() -> None:
    path = Path('backend/src/bookings/bookings.service.ts')
    t = path.read_text()
    if 'issue #71' in t or '#71' in t and 'پرداخت' in t and 'reject' in t:
        # still apply if old confirm/reject block exists
        pass

    old = '''    if (action === 'confirm' || action === 'reject') {
      if (!isPro) throw new ForbiddenException();
      if (action === 'confirm' && b.status !== BookingStatus.pending) {
        throw new BadRequestException('فقط رزرو در انتظار قابل تأیید است');
      }
      const allowedForReject: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (action === 'reject' && !allowedForReject.includes(b.status)) {
        throw new BadRequestException('این رزرو قابل رد نیست');
      }
      const status = action === 'confirm' ? BookingStatus.confirmed : BookingStatus.rejected;
      return this.prisma.booking.update({
        where: { id },
        data: {
          status,
          confirmedAt: action === 'confirm' ? new Date() : undefined,
          rejectedReason: action === 'reject' ? reason ?? null : undefined,
        },
      });
    }

    if (action === 'cancel') {
      if (!isCustomer && !isPro) throw new ForbiddenException();
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) throw new BadRequestException('این رزرو قابل لغو نیست');
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
        },
      });
    }'''

    new = '''    // #71 — پرداخت = نوبت قطعی؛ زیباگر confirm/reject ندارد
    if (action === 'confirm' || action === 'reject') {
      if (!isPro) throw new ForbiddenException();
      throw new BadRequestException(
        action === 'confirm'
          ? 'تأیید دستی لازم نیست. پس از پرداخت موفق، نوبت به‌صورت خودکار قطعی است.'
          : 'رد نوبت توسط زیباگر مجاز نیست. در صورت مشکل از پشتیبانی تیکت ثبت کنید.',
      );
    }

    if (action === 'cancel') {
      if (!isCustomer && !isPro) throw new ForbiddenException();
      const paid =
        b.payment?.status === 'paid' ||
        (b.payment as { status?: string } | null)?.status === 'paid';
      // Pro cannot cancel a paid booking — must open support ticket (#71 / #72)
      if (isPro && !isCustomer && paid) {
        throw new BadRequestException(
          'لغو نوبت پرداخت‌شده توسط زیباگر مجاز نیست. لطفاً از پشتیبانی تیکت ثبت کنید.',
        );
      }
      // Unpaid pending: either side may cancel (slot release)
      if (isPro && !isCustomer && b.status === BookingStatus.pending && !paid) {
        // allow pro to clear unpaid hold
      }
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) throw new BadRequestException('این رزرو قابل لغو نیست');
      // Customer cancel of confirmed/paid remains (policy may refund later)
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
        },
      });
    }'''

    if old not in t:
        print('WARN: transition confirm/reject block not found exactly')
    else:
        t = t.replace(old, new, 1)
        path.write_text(t)
        print('bookings.service transition patched')


def patch_payments_confirm_message() -> None:
    path = Path('backend/src/payments/payments.service.ts')
    t = path.read_text()
    # Ensure paid always confirms booking (already does)
    if "status: 'confirmed', confirmedAt: new Date()" in t or 'status: BookingStatus.confirmed' in t:
        print('payments already confirms booking on paid')
    # Prefer BookingStatus.confirmed enum if string used
    if "status: 'confirmed', confirmedAt" in t and 'BookingStatus.confirmed' not in t[t.find('payment.bookingId'):t.find('payment.bookingId')+400]:
        t = t.replace(
            "data: { status: 'confirmed', confirmedAt: new Date() },",
            "data: { status: BookingStatus.confirmed, confirmedAt: new Date() },",
            1,
        )
        path.write_text(t)
        print('payments uses BookingStatus.confirmed')


def patch_pro_bookings_ui() -> None:
    path = Path('frontend/src/app/zibagar/bookings/page.tsx')
    t = path.read_text()
    if 'نوبت قطعی است' in t and 'confirm' not in t[t.find('function act'):t.find('function act')+200]:
        print('pro UI may already be patched')

    # Soften status label
    t = t.replace(
        "{ value: 'confirmed', label: 'تأییدشده' },",
        "{ value: 'confirmed', label: 'قطعی' },",
        1,
    )

    # Update act() messages - remove confirm/reject success paths emphasis
    if "confirm: 'رزرو با موفقیت تأیید شد.'" in t:
        t = t.replace(
            "confirm: 'رزرو با موفقیت تأیید شد.',\n        reject: 'رزرو رد شد.',\n        cancel: 'رزرو لغو شد.',",
            "confirm: 'تأیید دستی لازم نیست.',\n        reject: 'رد نوبت مجاز نیست — از پشتیبانی تیکت بزنید.',\n        cancel: 'رزرو لغو شد.',",
            1,
        )

    # Remove confirm/reject buttons block - look for typical patterns
    # Pattern: confirm and reject buttons for pending
    import re

    # Remove button groups that call act(b.id, 'confirm') or 'reject'
    # Safer: replace visible button JSX chunks

    # Common block with تأیید and رد for pending
    patterns = [
        (
            r"\s*<Button\s+size=\"sm\"\s+loading=\{busy === `\$\{b\.id\}:confirm`\}\s+onClick=\{\(\) => act\(b\.id, 'confirm'\)\}\s*>\s*تأیید\s*</Button>",
            '',
        ),
        (
            r"\s*<Button\s+size=\"sm\"\s+[^>]*loading=\{busy === `\$\{b\.id\}:confirm`\}[^>]*>\s*تأیید\s*</Button>",
            '',
        ),
    ]

    # Simpler line-based removal
    lines = t.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        chunk = ''.join(lines[i : i + 8])
        if "act(b.id, 'confirm')" in chunk or 'act(b.id, "confirm")' in chunk:
            # skip until closing Button or 12 lines
            while i < len(lines) and '</Button>' not in lines[i]:
                i += 1
            i += 1
            continue
        if "act(b.id, 'reject')" in chunk or 'act(b.id, "reject")' in chunk:
            while i < len(lines) and '</Button>' not in lines[i]:
                i += 1
            i += 1
            continue
        out.append(lines[i])
        i += 1
    t = ''.join(out)

    # For pro cancel on confirmed: replace with support CTA note near actions
    if 'نوبت قطعی است' not in t:
        # inject notice when status confirmed
        needle = "{b.status === 'confirmed' && ("
        # only first occurrence of no-show area is fine
        notice = (
            "{(b.status === 'confirmed' || (b.payment && (b.payment as { status?: string }).status === 'paid')) && (\n"
            "                              <p className=\"w-full text-xs text-gray\">\n"
            "                                نوبت قطعی است. در صورت مشکل از{' '}\n"
            "                                <a href=\"/zibagar/support\" className=\"text-coral underline\">پشتیبانی تیکت</a> ثبت کنید.\n"
            "                              </p>\n"
            "                            )}\n"
            "                            {b.status === 'confirmed' && ("
        )
        if needle in t:
            t = t.replace(needle, notice, 1)

    # Hide pro cancel for confirmed/paid — wrap cancel button
    # If cancel button exists without paid guard, leave backend to enforce

    path.write_text(t)
    print('pro bookings UI patched', path.stat().st_size)


def patch_payment_callback_ui() -> None:
    path = Path('frontend/src/app/payment/callback/page.tsx')
    if not path.exists():
        print('no payment callback page')
        return
    t = path.read_text()
    if 'نوبت شما قطعی شد' in t:
        print('callback already has final message')
        return
    # Try inject success message
    if 'موفق' in t or 'success' in t.lower() or 'پرداخت' in t:
        # add a clear line if paid success block exists
        for old, new in [
            ('پرداخت با موفقیت انجام شد', 'پرداخت با موفقیت انجام شد. نوبت شما قطعی شد.'),
            ('پرداخت موفق', 'پرداخت موفق — نوبت شما قطعی شد'),
        ]:
            if old in t and 'نوبت شما قطعی شد' not in t:
                t = t.replace(old, new, 1)
                path.write_text(t)
                print('callback message updated')
                return
    # Append note in component return if not found
    print('callback page left as-is (no clear success string)')


if __name__ == '__main__':
    patch_bookings_transition()
    patch_payments_confirm_message()
    patch_pro_bookings_ui()
    patch_payment_callback_ui()
