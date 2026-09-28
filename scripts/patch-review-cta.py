#!/usr/bin/env python3
"""Stronger post-completion review CTA + deep link + notification href."""
from pathlib import Path


def patch_panel_bookings() -> None:
    p = Path('frontend/src/app/panel/bookings/page.tsx')
    s = p.read_text()
    if 'pendingReviewCount' in s or 'review=bookingId' in s:
        print('panel bookings already enhanced')
        return

    # Add useSearchParams import usage
    if "from 'next/navigation'" not in s:
        s = s.replace(
            "import Link from 'next/link';",
            "import Link from 'next/link';\nimport { useSearchParams } from 'next/navigation';",
            1,
        )
    elif 'useSearchParams' not in s:
        s = s.replace(
            "import Link from 'next/link';",
            "import Link from 'next/link';\nimport { useSearchParams } from 'next/navigation';",
            1,
        )

    # Inside component - after useState declarations, add searchParams + effect for deep link
    if 'const [reviewedIds' in s and 'useSearchParams' not in s[s.find('export default'):s.find('export default')+800]:
        s = s.replace(
            '  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());\n',
            '  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());\n'
            '  const searchParams = useSearchParams();\n',
            1,
        )

    # After load effect, open review from query
    load_marker = '  }, [load]);\n'
    deep_link = '''  }, [load]);

  // Deep link: /panel/bookings?review=<bookingId>
  useEffect(() => {
    const rid = searchParams.get('review');
    if (!rid || items.length === 0) return;
    const b = items.find((x) => x.id === rid);
    if (!b || b.status !== 'completed') return;
    if (reviewedIds.has(rid) || b.review || b.hasReview) return;
    setReviewFor(rid);
    setRating(5);
    setComment('');
  }, [searchParams, items, reviewedIds]);
'''
    if 'Deep link: /panel/bookings?review' not in s:
        if load_marker in s:
            s = s.replace(load_marker, deep_link, 1)
        else:
            # try alternate
            alt = '  }, [load]);'
            if alt in s and 'Deep link' not in s:
                s = s.replace(
                    alt,
                    alt
                    + '''

  useEffect(() => {
    const rid = searchParams.get('review');
    if (!rid || items.length === 0) return;
    const b = items.find((x) => x.id === rid);
    if (!b || b.status !== 'completed') return;
    if (reviewedIds.has(rid) || b.review || b.hasReview) return;
    setReviewFor(rid);
    setRating(5);
    setComment('');
  }, [searchParams, items, reviewedIds]);''',
                    1,
                )

    # Banner before list
    if 'pendingReviewCount' not in s:
        banner_anchor = '      {reviewMsg && ('
        banner = '''      {(() => {
        const pending = items.filter(
          (b) =>
            b.status === 'completed' &&
            !reviewedIds.has(b.id) &&
            !b.review &&
            !b.hasReview,
        );
        if (pending.length === 0) return null;
        return (
          <div className="rounded-2xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm">
            <p className="font-medium text-coral">
              {pending.length.toLocaleString('fa-IR')} نوبت منتظر نظر شماست
            </p>
            <p className="mt-1 text-xs text-gray">
              ثبت نظر به دیگران کمک می‌کند زیباگر مناسب را پیدا کنند.
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-coral underline"
              onClick={() => {
                setReviewFor(pending[0].id);
                setRating(5);
                setComment('');
              }}
            >
              ثبت نظر برای اولین مورد
            </button>
          </div>
        );
      })()}

      {reviewMsg && ('''
        if banner_anchor in s:
            s = s.replace(banner_anchor, banner, 1)
            print('banner added')
        else:
            print('warn: reviewMsg anchor missing')

    # Stronger CTA button label
    s = s.replace(
        '''                        ثبت نظر
                      </Button>''',
        '''                        ⭐ ثبت امتیاز و نظر
                      </Button>''',
        1,
    )

    p.write_text(s)
    print('panel bookings ok')


def patch_reminders_href() -> None:
    p = Path('backend/src/reminders/reminders.service.ts')
    s = p.read_text()
    if "href: `/panel/bookings?review=" in s or 'href: `/panel/bookings?review=' in s:
        print('reminder href already')
        return
    old = '''        data: { bookingId: b.id, professionalId: b.professionalId },
        sms: false,
      });
      if (result?.id) sent += 1;
    }
    return sent;
  }

  /** Dedup:'''
    new = '''        data: {
          bookingId: b.id,
          professionalId: b.professionalId,
          href: `/panel/bookings?review=${b.id}`,
        },
        sms: false,
      });
      if (result?.id) sent += 1;
    }
    return sent;
  }

  /** Dedup:'''
    if old not in s:
        # softer replace just data line in review_request block
        if "type: NotificationType.review_request" in s:
            s = s.replace(
                'data: { bookingId: b.id, professionalId: b.professionalId },\n        sms: false,',
                'data: { bookingId: b.id, professionalId: b.professionalId, href: `/panel/bookings?review=${b.id}` },\n        sms: false,',
                1,
            )
            p.write_text(s)
            print('reminder href soft patch')
            return
        raise SystemExit('review_request data block not found')
    p.write_text(s.replace(old, new, 1))
    print('reminder href ok')


def patch_complete_notify() -> None:
    """On complete, include review deep link in notification data."""
    p = Path('backend/src/bookings/bookings.service.ts')
    s = p.read_text()
    if 'panel/bookings?review=' in s:
        print('complete notify already has href')
        return
    old = '''      await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.booking_completed,
        title: 'رزرو تکمیل شد',
        body: 'رزرو شما تکمیل شد. می‌توانید نظر بدهید.',
        data: { bookingId: id },
        sms: false,
      });'''
    new = '''      await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.booking_completed,
        title: 'رزرو تکمیل شد',
        body: 'رزرو شما تکمیل شد. می‌توانید نظر بدهید.',
        data: { bookingId: id, href: `/panel/bookings?review=${id}` },
        sms: false,
      });'''
    if old not in s:
        print('warn: complete notify block not found')
        return
    p.write_text(s.replace(old, new, 1))
    print('complete notify ok')


def main() -> None:
    patch_panel_bookings()
    patch_reminders_href()
    patch_complete_notify()
    print('done')


if __name__ == '__main__':
    main()
