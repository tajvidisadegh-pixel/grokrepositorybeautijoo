#!/usr/bin/env python3
import subprocess
from pathlib import Path

GOOD = '0cccf57ca118674e60422239a4900f49cc572d90'
PATH = 'frontend/src/app/zibagar/bookings/page.tsx'


def main() -> None:
    raw = subprocess.check_output(['git', 'show', f'{GOOD}:{PATH}'], text=True)
    t = raw
    t = t.replace("{ value: 'confirmed', label: 'تأییدشده' },", "{ value: 'confirmed', label: 'قطعی' },")
    t = t.replace(
        "confirm: 'رزرو با موفقیت تأیید شد.',\n        reject: 'رزرو رد شد.',\n        cancel: 'رزرو لغو شد.',",
        "confirm: 'تأیید دستی لازم نیست.',\n        reject: 'رد نوبت مجاز نیست — از پشتیبانی تیکت بزنید.',\n        cancel: 'رزرو لغو شد.',",
    )

    blocks = [
        '''                          {b.status === 'pending' && (
                            <>
                              <Button
                                className="min-h-11 min-w-[7rem] flex-1 sm:flex-none"
                                loading={busy === `${b.id}:confirm`}
                                onClick={() => act(b.id, 'confirm')}
                              >
                                تأیید
                              </Button>
                              <Button
                                className="min-h-11 min-w-[7rem] flex-1 sm:flex-none"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
                            </>
                          )}''',
        '''                              <Button
                                size="sm"
                                variant="outline"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
''',
        '''                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
''',
    ]
    for b in blocks:
        t = t.replace(b, '')

    needle = '''                              {b.status === 'confirmed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busy === `${b.id}:no-show`}
'''
    insert = '''                              {b.status === 'confirmed' && (
                                <p className="w-full text-xs text-gray">
                                  نوبت قطعی است. در صورت مشکل از{' '}
                                  <a href="/zibagar/support" className="text-coral underline">
                                    پشتیبانی تیکت
                                  </a>{' '}
                                  ثبت کنید.
                                </p>
                              )}
                              {b.status === 'confirmed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busy === `${b.id}:no-show`}
'''
    if needle not in t:
        raise SystemExit('no-show anchor missing')
    t = t.replace(needle, insert, 1)

    if "act(b.id, 'confirm')" in t or "act(b.id, 'reject')" in t:
        raise SystemExit('confirm/reject still present')

    Path(PATH).write_text(t)
    print('rebuilt', PATH, len(t))


if __name__ == '__main__':
    main()
