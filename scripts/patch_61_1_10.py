from pathlib import Path
import re

changed = []

funnel = Path("frontend/src/lib/funnel.ts")
if not funnel.exists():
    funnel.write_text(
        "/** #61 item 1 — lightweight booking funnel events */\n"
        "export type FunnelStep =\n"
        "  | 'profile_view'\n"
        "  | 'service_select'\n"
        "  | 'datetime_select'\n"
        "  | 'summary_view'\n"
        "  | 'payment_click'\n"
        "  | 'booking_done';\n\n"
        "const KEY = 'bj_funnel_v1';\n\n"
        "export function trackFunnel(step: FunnelStep, meta?: Record<string, string | number | undefined>) {\n"
        "  if (typeof window === 'undefined') return;\n"
        "  try {\n"
        "    const row = { step, t: Date.now(), ...meta };\n"
        "    const prev = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown[];\n"
        "    const next = [...prev.slice(-40), row];\n"
        "    localStorage.setItem(KEY, JSON.stringify(next));\n"
        "    const base = process.env.NEXT_PUBLIC_API_URL || '';\n"
        "    if (base && navigator.sendBeacon) {\n"
        "      const url = `${base.replace(/\\/$/, '')}/public/funnel`;\n"
        "      const blob = new Blob([JSON.stringify(row)], { type: 'application/json' });\n"
        "      navigator.sendBeacon(url, blob);\n"
        "    }\n"
        "  } catch { /* ignore */ }\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("1-funnel-lib")

p = Path("frontend/src/components/booking/booking-wizard.tsx")
t = p.read_text(encoding="utf-8")
if "trackFunnel" not in t:
    t = "import { trackFunnel } from '@/lib/funnel';\n" + t
    t = t.replace(
        "setServiceId(s.serviceId);",
        "setServiceId(s.serviceId);\n                    trackFunnel('service_select', { serviceId: s.serviceId, pro: professional.id });",
        1,
    )
    if "setSlotStart(" in t:
        t = t.replace(
            "setSlotStart(",
            "trackFunnel('datetime_select', { pro: professional.id });\n                        setSlotStart(",
            1,
        )
    t = t.replace(
        "setStep('summary')",
        "trackFunnel('summary_view', { pro: professional.id }); setStep('summary')",
        1,
    )
    t = t.replace(
        "async function submitBooking() {",
        "async function submitBooking() {\n    trackFunnel('payment_click', { pro: professional.id });",
        1,
    )
    t = t.replace(
        "setStep('done')",
        "trackFunnel('booking_done', { pro: professional.id }); setStep('done')",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("1-wizard")

tracker = Path("frontend/src/components/analytics/profile-view-tracker.tsx")
if not tracker.exists():
    tracker.parent.mkdir(parents=True, exist_ok=True)
    tracker.write_text(
        "'use client';\n"
        "import { useEffect } from 'react';\n"
        "import { trackFunnel } from '@/lib/funnel';\n"
        "export function ProfileViewTracker({ proId }: { proId: string }) {\n"
        "  useEffect(() => { trackFunnel('profile_view', { pro: proId }); }, [proId]);\n"
        "  return null;\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("1-tracker")

p = Path("frontend/src/app/professionals/[slug]/page.tsx")
t = p.read_text(encoding="utf-8")
if "ProfileViewTracker" not in t:
    t = "import { ProfileViewTracker } from '@/components/analytics/profile-view-tracker';\n" + t
    if "<header" in t:
        t = t.replace("<header", "<ProfileViewTracker proId={pro.id} />\n          <header", 1)
    p.write_text(t, encoding="utf-8")
    changed.append("1-pro-page")

p = Path("frontend/src/components/booking/booking-wizard.tsx")
t = p.read_text(encoding="utf-8")
if "رزرو سریع" not in t:
    quick = (
        "          {services[0] && (\n"
        "            <button type=\"button\"\n"
        "              className=\"w-full rounded-2xl border border-coral/40 bg-coral-soft px-4 py-3 text-sm font-medium text-coral\"\n"
        "              onClick={() => {\n"
        "                const s = services[0];\n"
        "                setServiceId(s.serviceId);\n"
        "                trackFunnel('service_select', { serviceId: s.serviceId, pro: professional.id, quick: 1 });\n"
        "                const d = new Date();\n"
        "                d.setDate(d.getDate() + 1);\n"
        "                setDate(d.toISOString().slice(0, 10));\n"
        "                setSlotStart('');\n"
        "                setStep('datetime');\n"
        "              }}\n"
        "            >رزرو سریع: {services[0].name} · اولین نوبت ممکن</button>\n"
        "          )}\n"
    )
    if '<h2 className="font-bold">انتخاب خدمت</h2>' in t:
        t = t.replace('<h2 className="font-bold">انتخاب خدمت</h2>', '<h2 className="font-bold">انتخاب خدمت</h2>\n' + quick, 1)
    if "setSlots(res.slots || []);" in t and "firstAvail" not in t:
        t = t.replace(
            "setSlots(res.slots || []);",
            "const list = res.slots || [];\n      setSlots(list);\n      const firstAvail = list.find((s) => s.available !== false);\n      if (firstAvail && !slotStart) setSlotStart(firstAvail.start);",
            1,
        )
    p.write_text(t, encoding="utf-8")
    changed.append("2-quick")

p = Path("frontend/src/components/booking/booking-wizard.tsx")
t = p.read_text(encoding="utf-8")
if "مبلغ نهایی قابل پرداخت" not in t:
    t = t.replace(">مبلغ قابل پرداخت</span>", ">مبلغ نهایی قابل پرداخت</span>", 1)
    t = t.replace(
        "هیچ هزینه پنهانی اضافه نمی‌شود.",
        "مبلغ نهایی همین است؛ هزینه پنهان، مالیات جدا یا کارمزد اضافه در درگاه ندارید.",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("3-price")

changed.append("4-reminders-exist")

p = Path("frontend/src/app/panel/bookings/page.tsx")
t = p.read_text(encoding="utf-8")
if "CancelPolicyNotice" not in t:
    t = "import { CancelPolicyNotice } from '@/components/booking/cancel-policy-notice';\n" + t
    if '<div className="space-y-6">' in t:
        t = t.replace('<div className="space-y-6">', '<div className="space-y-6">\n      <CancelPolicyNotice />\n', 1)
        p.write_text(t, encoding="utf-8")
        changed.append("5-policy")

p = Path("frontend/src/components/professionals/professional-card.tsx")
t = p.read_text(encoding="utf-8")
if "نوبت موفق" not in t:
    if "{city && <span>{city}</span>}" in t:
        t = t.replace(
            "{city && <span>{city}</span>}",
            "{city && <span>{city}</span>}\n"
            "            {(pro as { completedBookingsCount?: number }).completedBookingsCount != null &&\n"
            "              Number((pro as { completedBookingsCount?: number }).completedBookingsCount) > 0 && (\n"
            "              <span className=\"text-xs text-gray\">بیش از {Number((pro as { completedBookingsCount?: number }).completedBookingsCount).toLocaleString('fa-IR')} نوبت موفق</span>\n"
            "            )}",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("6-card")

for rel in [
    "frontend/src/components/professionals/salon-media-gallery.tsx",
    "frontend/src/components/professionals/service-portfolio-gallery.tsx",
]:
    p = Path(rel)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    if "تأیید" in t and "زیباگر" in t:
        continue
    m = re.search(r"<h2[^>]*>[^<]+</h2>", t)
    if m and "نمونه کار" not in t:
        t = t[: m.end()] + '\n      <p className="text-xs text-gray">نمونه کارها · پس از تأیید زیباگر</p>' + t[m.end() :]
        p.write_text(t, encoding="utf-8")
        changed.append("7-" + p.name)

changed.append("8-trust-exists")

why = Path("frontend/src/app/why/page.tsx")
if not why.exists():
    why.parent.mkdir(parents=True, exist_ok=True)
    why.write_text(
        "import type { Metadata } from 'next';\nimport Link from 'next/link';\n\n"
        "export const metadata: Metadata = { title: 'چرا بیوتی‌جو؟', description: 'اعتماد، لغو شفاف، پشتیبانی' };\n\n"
        "const items = [\n"
        "  { t: 'لغو شفاف', d: 'تا چند ساعت قبل از نوبت می‌توانید رایگان لغو کنید.' },\n"
        "  { t: 'زیباگر بررسی‌شده', d: 'پروفایل‌های منتشرشده بررسی می‌شوند؛ نشان احراز هویت برای موارد تأییدشده است.' },\n"
        "  { t: 'پشتیبانی واقعی', d: 'دکمه کمک در مسیر رزرو؛ ایمیل و ساعات پاسخ‌گویی مشخص است.' },\n"
        "  { t: 'قیمت بدون غافلگیری', d: 'مبلغ نهایی را قبل از پرداخت می‌بینید.' },\n"
        "];\n\n"
        "export default function WhyPage() {\n"
        "  return (\n"
        "    <main className=\"mx-auto max-w-2xl space-y-8 px-4 py-12\" dir=\"rtl\">\n"
        "      <h1 className=\"text-3xl font-bold text-blue\">چرا بیوتی‌جو؟</h1>\n"
        "      <ul className=\"space-y-4\">{items.map((it) => (\n"
        "        <li key={it.t} className=\"rounded-3xl border border-border bg-white p-5 shadow-sm\">\n"
        "          <h2 className=\"text-lg font-bold\">{it.t}</h2>\n"
        "          <p className=\"mt-2 text-sm text-gray leading-7\">{it.d}</p>\n"
        "        </li>\n"
        "      ))}</ul>\n"
        "      <div className=\"flex flex-wrap gap-3\">\n"
        "        <Link href=\"/search\" className=\"inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white\">شروع جستجو</Link>\n"
        "        <Link href=\"/refund\" className=\"inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm\">قوانین لغو</Link>\n"
        "      </div>\n"
        "    </main>\n"
        "  );\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("9-why")

help_fab = Path("frontend/src/components/help/help-fab.tsx")
if not help_fab.exists():
    help_fab.parent.mkdir(parents=True, exist_ok=True)
    help_fab.write_text(
        "'use client';\n"
        "import { useState } from 'react';\n"
        "const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir';\n"
        "const HOURS = process.env.NEXT_PUBLIC_SUPPORT_HOURS || '۹ تا ۱۸ · شنبه تا چهارشنبه';\n"
        "export function HelpFab() {\n"
        "  const [open, setOpen] = useState(false);\n"
        "  return (\n"
        "    <div className=\"fixed bottom-20 right-4 z-40 sm:bottom-8 sm:right-8\">\n"
        "      {open && (\n"
        "        <div className=\"mb-2 w-64 rounded-2xl border border-border bg-white p-4 text-sm shadow-lg\" dir=\"rtl\">\n"
        "          <p className=\"font-bold\">نیاز به کمک دارید؟</p>\n"
        "          <p className=\"mt-1 text-xs text-gray\">ساعات پاسخ‌گویی: {HOURS}</p>\n"
        "          <a className=\"mt-2 block text-coral underline\" href={`mailto:${EMAIL}`}>{EMAIL}</a>\n"
        "          <a className=\"mt-1 block text-xs text-gray underline\" href=\"/why\">چرا بیوتی‌جو؟</a>\n"
        "          <a className=\"mt-1 block text-xs text-gray underline\" href=\"/refund\">قوانین لغو</a>\n"
        "        </div>\n"
        "      )}\n"
        "      <button type=\"button\" onClick={() => setOpen((v) => !v)}\n"
        "        className=\"flex h-12 items-center gap-2 rounded-full bg-blue px-4 text-sm font-medium text-white shadow-lg\"\n"
        "        aria-expanded={open}>کمک</button>\n"
        "    </div>\n"
        "  );\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("10-fab")

p = Path("frontend/src/components/booking/booking-wizard.tsx")
t = p.read_text(encoding="utf-8")
if "HelpFab" not in t:
    t = "import { HelpFab } from '@/components/help/help-fab';\n" + t
    idx = t.rfind("    </div>\n  );\n}")
    if idx > 0:
        t = t[:idx] + "      <HelpFab />\n" + t[idx:]
        p.write_text(t, encoding="utf-8")
        changed.append("10-wizard")

print("CHANGED", changed)
