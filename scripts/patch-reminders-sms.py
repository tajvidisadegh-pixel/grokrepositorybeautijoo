#!/usr/bin/env python3
from pathlib import Path


def main() -> None:
    p = Path('backend/src/reminders/reminders.service.ts')
    s = p.read_text()

    if 'REMINDERS_SMS' in s and 'notify pro' in s.lower():
        print('already patched')
        return

    # Update file header comment
    s = s.replace(
        ' * Uses in-app notifications only (SMS out of scope for #11).',
        ' * In-app always; SMS when REMINDERS_SMS=true (or production default for 2h).',
    )

    old = '''      const result = await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.booking_reminder,
        title,
        body,
        data: { bookingId: b.id, professionalId: b.professionalId, window: windowKey },
        sms: false,
      });
      if (result?.id) sent += 1;
    }
    return sent;
  }'''

    new = '''      const smsEnabled = this.shouldSendSms(windowKey);

      const result = await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.booking_reminder,
        title,
        body,
        data: {
          bookingId: b.id,
          professionalId: b.professionalId,
          window: windowKey,
          href: `/panel/bookings`,
        },
        sms: smsEnabled,
      });
      if (result?.id) sent += 1;

      // Soft in-app reminder for professional (no SMS by default)
      const proUserId = (
        b as { professional?: { userId?: string | null } }
      ).professional?.userId;
      if (proUserId) {
        const proAlready = await this.hasNotification(
          proUserId,
          NotificationType.booking_reminder,
          { bookingId: b.id, window: `${windowKey}-pro` },
        );
        if (!proAlready) {
          await this.notifications.notify({
            userId: proUserId,
            type: NotificationType.booking_reminder,
            title:
              windowKey === '24h'
                ? 'یادآوری نوبت فردا'
                : 'یادآوری نوبت نزدیک',
            body:
              windowKey === '24h'
                ? `فردا حدود این ساعت نوبت دارید (${when}).`
                : `حدود ۲ ساعت دیگر نوبت دارید (${when}).`,
            data: {
              bookingId: b.id,
              window: `${windowKey}-pro`,
              href: `/zibagar/bookings`,
            },
            sms: false,
          });
        }
      }
    }
    return sent;
  }

  /** SMS for reminders: REMINDERS_SMS=true|false; default true in production for 2h only. */
  private shouldSendSms(windowKey: '24h' | '2h'): boolean {
    const raw = (process.env.REMINDERS_SMS || '').trim().toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    // default: production 2h reminders only (cost-aware)
    return (
      (process.env.NODE_ENV || '').toLowerCase() === 'production' &&
      windowKey === '2h'
    );
  }'''

    if old not in s:
        raise SystemExit('notify block not found')

    # Also need professional.userId in select
    old_select = '''      select: {
        id: true,
        customerId: true,
        professionalId: true,
        startAt: true,
        professional: {
          select: { title: true },
        },
      },'''
    new_select = '''      select: {
        id: true,
        customerId: true,
        professionalId: true,
        startAt: true,
        professional: {
          select: { title: true, userId: true },
        },
      },'''
    if old_select not in s:
        raise SystemExit('select block not found')
    s = s.replace(old_select, new_select, 1)
    s = s.replace(old, new, 1)
    p.write_text(s)
    print('reminders patched')


if __name__ == '__main__':
    main()
