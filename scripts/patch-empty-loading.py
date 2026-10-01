#!/usr/bin/env python3
"""Surgical empty/loading consistency for #40 item 2 — no full page rewrites."""
from pathlib import Path


def patch(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    s = p.read_text()
    if new.strip() and new in s and old not in s:
        print(label, 'already')
        return
    if old not in s:
        print(label, 'SKIP no match')
        return
    p.write_text(s.replace(old, new, 1))
    print(label, 'OK')


def main() -> None:
    # Favorites: grid skeleton while loading
    patch(
        'frontend/src/app/panel/favorites/page.tsx',
        'if (loading) return <PanelLoading />;',
        'if (loading) return <PanelLoading grid cards={6} />;',
        'favorites loading',
    )

    # Notifications empty
    patch(
        'frontend/src/app/panel/notifications/page.tsx',
        '<PanelEmpty title="اعلانی نیست" />',
        '<PanelEmpty\n'
        '          title="اعلانی نیست"\n'
        '          description="وقتی رزرو، پرداخت یا پیام جدیدی باشد اینجا می‌بینید."\n'
        '          icon="🔔"\n'
        '        />',
        'notifications empty',
    )

    # Panel reviews empty + CTA
    patch(
        'frontend/src/app/panel/reviews/page.tsx',
        '<PanelEmpty title="هنوز نظری ثبت نکرده‌اید" />',
        '<PanelEmpty\n'
        '            title="هنوز نظری ثبت نکرده‌اید"\n'
        '            description="پس از تکمیل نوبت می‌توانید از صفحه رزروها امتیاز بدهید."\n'
        '            icon="⭐"\n'
        '            action={\n'
        '              <Link href="/panel/bookings">\n'
        '                <Button size="sm">مشاهده رزروها</Button>\n'
        '              </Link>\n'
        '            }\n'
        '          />',
        'panel reviews empty',
    )

    # Ensure Link/Button imports on panel reviews if we added them
    pr = Path('frontend/src/app/panel/reviews/page.tsx')
    if pr.exists():
        s = pr.read_text()
        if 'مشاهده رزروها' in s:
            if "from 'next/link'" not in s and 'from "next/link"' not in s:
                s = "import Link from 'next/link';\n" + s
            if 'Button' not in s.split('PanelEmpty')[0]:
                if "from '@/components/ui/button'" not in s:
                    s = s.replace(
                        "from '@/components/panel/state-blocks';",
                        "from '@/components/panel/state-blocks';\nimport { Button } from '@/components/ui/button';",
                        1,
                    )
            pr.write_text(s)
            print('panel reviews imports OK')

    # Zibagar bookings empty
    patch(
        'frontend/src/app/zibagar/bookings/page.tsx',
        '<PanelEmpty title="رزروی یافت نشد" />',
        '<PanelEmpty\n'
        '        title="رزروی یافت نشد"\n'
        '        description="هنوز نوبتی برای شما ثبت نشده یا با فیلتر فعلی نتیجه‌ای نیست."\n'
        '        icon="📅"\n'
        '      />',
        'zibagar bookings empty',
    )

    # Admin bookings empty
    patch(
        'frontend/src/app/admin/bookings/page.tsx',
        '<PanelEmpty title="رزروی یافت نشد" />',
        '<PanelEmpty\n'
        '        title="رزروی یافت نشد"\n'
        '        description="با فیلتر فعلی رزروی نیست. فیلتر را پاک کنید یا بعداً دوباره ببینید."\n'
        '        icon="📋"\n'
        '      />',
        'admin bookings empty',
    )

    # Admin reviews / notifications if weak
    for path, old, new, label in [
        (
            'frontend/src/app/admin/reviews/page.tsx',
            '<PanelEmpty title="نظری یافت نشد" />',
            '<PanelEmpty title="نظری یافت نشد" description="هنوز نظری در سیستم ثبت نشده یا فیلتر خالی است." icon="⭐" />',
            'admin reviews',
        ),
        (
            'frontend/src/app/admin/notifications/page.tsx',
            '<PanelEmpty title="اعلانی نیست" />',
            '<PanelEmpty title="اعلانی نیست" description="اعلان سیستمی برای نمایش وجود ندارد." icon="🔔" />',
            'admin notif',
        ),
    ]:
        p = Path(path)
        if p.exists():
            s = p.read_text()
            if old in s:
                p.write_text(s.replace(old, new, 1))
                print(label, 'OK')
            else:
                # try softer titles
                import re

                m = re.search(r'<PanelEmpty title="[^"]+" />', s)
                if m and 'description=' not in m.group(0):
                    print(label, 'found', m.group(0)[:60], '- leave')
                else:
                    print(label, 'skip')

    # Services: PanelEmpty
    patch(
        'frontend/src/app/zibagar/services/page.tsx',
        "import { PanelLoading, PanelError } from '@/components/panel/state-blocks';",
        "import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';",
        'services import',
    )
    patch(
        'frontend/src/app/zibagar/services/page.tsx',
        '''          {mine.length === 0 && myRoots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
              <p className={`text-sm font-medium ${navy.title}`}>هنوز تخصصی انتخاب نکرده‌اید</p>
              <p className="mt-1 text-xs text-gray-500">روی «افزودن تخصص جدید» بزنید و از فهرست انتخاب کنید.</p>
            </div>
          )''',
        '''          {mine.length === 0 && myRoots.length === 0 ? (
            <PanelEmpty
              title="هنوز تخصصی انتخاب نکرده‌اید"
              description="روی «افزودن تخصص جدید» بزنید و از فهرست انتخاب کنید."
              icon="✂️"
            />
          )''',
        'services empty',
    )

    # Search empty + CTA
    search = Path('frontend/src/app/search/page.tsx')
    s = search.read_text()
    old_es = '''          <EmptyState
            title={lat && lng ? 'زیباگری در محدوده انتخاب‌شده پیدا نشد' : 'نتیجه‌ای یافت نشد'}
            description={lat && lng ? 'شعاع را بزرگ‌تر کنید یا فیلترها را کم کنید.' : undefined}
          />'''
    new_es = '''          <EmptyState
            title={lat && lng ? 'زیباگری در محدوده انتخاب‌شده پیدا نشد' : 'نتیجه‌ای یافت نشد'}
            description={
              lat && lng
                ? 'شعاع را بزرگ‌تر کنید یا فیلترها را کم کنید.'
                : 'عبارت یا فیلتر دیگری امتحان کنید، یا همه زیباگران را ببینید.'
            }
            action={
              <Link
                href="/professionals"
                className="inline-flex rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
              >
                مشاهده همه زیباگران
              </Link>
            }
          />'''
    if old_es in s:
        s = s.replace(old_es, new_es, 1)
        search.write_text(s)
        print('search empty OK')
    else:
        print('search empty SKIP')

    # Professionals empty
    patch(
        'frontend/src/app/professionals/page.tsx',
        '<EmptyState title="زیباگری یافت نشد" />',
        '''<EmptyState
            title="زیباگری یافت نشد"
            description="با این فیلتر نتیجه‌ای نیست. جستجوی پیشرفته را امتحان کنید."
            action={
              <Link
                href="/search"
                className="inline-flex rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
              >
                جستجوی پیشرفته
              </Link>
            }
          />''',
        'professionals empty',
    )

    # Zibagar reviews already has description — ensure icon
    zr = Path('frontend/src/app/zibagar/reviews/page.tsx')
    if zr.exists():
        s = zr.read_text()
        if '<PanelEmpty title="هنوز نظری ثبت نشده"' in s and 'icon=' not in s[
            s.find('<PanelEmpty title="هنوز نظری ثبت نشده"') : s.find('<PanelEmpty title="هنوز نظری ثبت نشده"') + 200
        ]:
            s = s.replace(
                '<PanelEmpty title="هنوز نظری ثبت نشده" description="پس از تکمیل رزروها، نظرات اینجا نمایش داده می‌شوند." />',
                '<PanelEmpty title="هنوز نظری ثبت نشده" description="پس از تکمیل رزروها، نظرات اینجا نمایش داده می‌شوند." icon="⭐" />',
                1,
            )
            zr.write_text(s)
            print('zibagar reviews icon OK')

    print('done')


if __name__ == '__main__':
    main()
