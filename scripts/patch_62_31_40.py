from pathlib import Path
import re

changed = []

# ---- 37: hide phone/whatsapp on public professional profile ----
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text(encoding='utf-8')
if 'پس از تأیید رزرو' not in t:
    old_phone = "const phone = (sl.phone || '').trim();\n        if (phone) items.push({ label: 'تماس', href: `tel:${phone}`, text: phone });"
    new_phone = "// #62.37 — phone only after confirmed booking (panel), not on public profile\n        // const phone = (sl.phone || '').trim();\n        // if (phone) items.push(...);"
    if old_phone in t:
        t = t.replace(old_phone, new_phone, 1)
    # also hide whatsapp as direct contact channel on public page (optional - keep wa as social)
    # add notice after social links block
    if 'شماره تماس پس از تأیید' not in t:
        t = t.replace(
            '<StickyBookBar slug={pro.slug} />',
            '<p className="mt-3 text-center text-xs text-gray-muted">شماره تماس زیباگر پس از تأیید رزرو در پنل شما نمایش داده می‌شود.</p>\n      <StickyBookBar slug={pro.slug} />',
            1,
        )
    p.write_text(t, encoding='utf-8')
    changed.append('37-phone')
else:
    changed.append('37-exists')

# ---- 34: lightbox on zibagar portfolio ----
p = Path('frontend/src/app/zibagar/portfolio/page.tsx')
t = p.read_text(encoding='utf-8')
if 'ImageLightbox' not in t:
    t = t.replace(
        "import { formatPrice, parsePriceInput } from '@/lib/utils';",
        "import { formatPrice, parsePriceInput } from '@/lib/utils';\n"
        "import { ImageLightbox } from '@/components/media/image-lightbox';",
        1,
    )
    # state
    if 'const [localPreview, setLocalPreview]' in t:
        t = t.replace(
            'const [localPreview, setLocalPreview] = useState<string | null>(null);',
            "const [localPreview, setLocalPreview] = useState<string | null>(null);\n"
            "  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);",
            1,
        )
    elif 'const [uploadProgress, setUploadProgress]' in t:
        t = t.replace(
            'const [uploadProgress, setUploadProgress] = useState<number | null>(null);',
            "const [uploadProgress, setUploadProgress] = useState<number | null>(null);\n"
            "  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);",
            1,
        )
    # make image clickable
    t = t.replace(
        '''<img
                      src={m.publicUrl || ''}
                      alt={m.title || 'portfolio'}
                      className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                    />''',
        '''<button
                      type="button"
                      className="block w-full"
                      onClick={() => setLightboxIndex(items.findIndex((x) => x.id === m.id))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.publicUrl || ''}
                        alt={m.title || 'portfolio'}
                        className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                      />
                    </button>''',
        1,
    )
    # also video click to open lightbox
    t = t.replace(
        '''<video
                      src={m.publicUrl || ''}
                      className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                      muted
                      playsInline
                      controls
                    />''',
        '''<button
                      type="button"
                      className="block w-full"
                      onClick={() => setLightboxIndex(items.findIndex((x) => x.id === m.id))}
                    >
                      <video
                        src={m.publicUrl || ''}
                        className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                        muted
                        playsInline
                      />
                    </button>''',
        1,
    )
    # append lightbox at end before final closing of main div
    if 'lightboxIndex != null' not in t:
        # before last closing of return root
        idx = t.rfind('    </div>\n  );\n}')
        if idx > 0:
            block = '''
      {lightboxIndex != null && (
        <ImageLightbox
          items={items.map((m) => ({
            id: m.id,
            url: m.publicUrl || m.url || '',
            mimeType: m.mimeType || undefined,
            caption: m.title || undefined,
          }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
'''
            t = t[:idx] + block + t[idx:]
    p.write_text(t, encoding='utf-8')
    changed.append('34-lightbox')
else:
    changed.append('34-exists')

# ---- 33: AddToCalendar on panel bookings if missing ----
p = Path('frontend/src/app/panel/bookings/page.tsx')
t = p.read_text(encoding='utf-8')
if 'AddToCalendarActions' not in t:
    t = t.replace(
        "import { friendlyApiError } from '@/lib/api-errors';",
        "import { friendlyApiError } from '@/lib/api-errors';\n"
        "import { AddToCalendarActions } from '@/components/booking/add-to-calendar';",
        1,
    )
    # insert after short code copy area or near status - after contact link block
    if 'تماس با زیباگر' in t and 'AddToCalendarActions' not in t:
        needle = ''') : null}
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-xs text-gray-muted hover:text-coral"
                          onClick={() => {
                            setReportFor(reportFor === b.id ? null : b.id);'''
        insert = ''') : null}
                      <div className="mt-2 w-full max-w-[220px]">
                        <AddToCalendarActions
                          booking={{
                            id: b.id,
                            startAt: b.startAt,
                            endAt: b.endAt,
                            totalPrice: b.totalPrice,
                            status: b.status,
                          }}
                          proName={b.professional?.user?.profile?.displayName || b.professional?.title || 'زیباگر'}
                          serviceNames={(b.services || []).map((s: { name?: string }) => s.name || '').filter(Boolean)}
                        />
                      </div>
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-xs text-gray-muted hover:text-coral"
                          onClick={() => {
                            setReportFor(reportFor === b.id ? null : b.id);'''
        if needle in t:
            t = t.replace(needle, insert, 1)
            p.write_text(t, encoding='utf-8')
            changed.append('33-calendar')
        else:
            # simpler: after status span closing
            changed.append('33-miss')
            p.write_text(t, encoding='utf-8')  # still keep import for later
    else:
        p.write_text(t, encoding='utf-8')
        changed.append('33-partial')
else:
    changed.append('33-exists')

# ---- 39: toast on portfolio upload success ----
p = Path('frontend/src/app/zibagar/portfolio/page.tsx')
t = p.read_text(encoding='utf-8')
if 'useToast' not in t:
    t = t.replace(
        "import { ImageLightbox } from '@/components/media/image-lightbox';",
        "import { ImageLightbox } from '@/components/media/image-lightbox';\n"
        "import { useToast } from '@/components/ui/app-toast';",
        1,
    )
    # if ImageLightbox import not there yet order differs
    if 'useToast' not in t:
        t = t.replace(
            "'use client';\n",
            "'use client';\n\nimport { useToast } from '@/components/ui/app-toast';\n",
            1,
        )
    # inside component - find function start
    if 'export default function' in t and 'const { success } = useToast()' not in t:
        t = re.sub(
            r'(export default function \w+\([^)]*\) \{\n)',
            r'\1  const { success: toastSuccess } = useToast();\n',
            t,
            count=1,
        )
    t = t.replace(
        "setMsg(video ? 'ویدیو آپلود شد.' : 'تصویر آپلود شد.');",
        "setMsg(video ? 'ویدیو آپلود شد.' : 'تصویر آپلود شد.');\n"
        "      try { toastSuccess(video ? 'ویدیو آپلود شد' : 'تصویر آپلود شد'); } catch { /* */ }",
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('39-toast')

# ---- 40: network-friendly error page ----
p = Path('frontend/src/app/error.tsx')
t = p.read_text(encoding='utf-8')
if 'صفحه اصلی' not in t:
    t = t.replace(
        '<Button onClick={() => reset()}>تلاش مجدد</Button>',
        '''<div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>تلاش مجدد</Button>
        <a href="/" className="rounded-xl border border-border bg-white px-4 py-2 text-sm">بازگشت به صفحه اصلی</a>
      </div>''',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('40-error')

# docs
Path('docs').mkdir(exist_ok=True)
doc = Path('docs/issue-62-week4-mobile.md')
if not doc.exists():
    doc.write_text(
        "# ایشو ۶۲ — هفته ۴ موبایل و اعتماد (۳۱–۴۰)\n\n"
        "- ۳۱: Bottom nav در PanelShell (mobile: true)\n"
        "- ۳۲: formatDate با fa-IR-u-ca-persian\n"
        "- ۳۳: AddToCalendarActions + کپی جزئیات\n"
        "- ۳۴: ImageLightbox گالری\n"
        "- ۳۵: ShareProfileButton واتساپ/تلگرام/کپی\n"
        "- ۳۶: generateMetadata + sitemap\n"
        "- ۳۷: تلفن فقط بعد از تأیید رزرو در پنل\n"
        "- ۳۸: badge عددی unread در bottom/side nav\n"
        "- ۳۹: ToastProvider + toast موفقیت\n"
        "- ۴۰: not-found + error فارسی\n",
        encoding='utf-8',
    )
    changed.append('docs')

print('CHANGED', changed)
