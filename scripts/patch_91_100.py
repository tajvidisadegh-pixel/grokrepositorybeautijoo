from pathlib import Path
import re
changed = []

# 92 backend
p = Path("backend/src/professionals/professionals.service.ts")
t = p.read_text(encoding="utf-8")
if "completedBookingsCount" not in t:
    idx = t.find("async findBySlug(slug: string)")
    if idx > 0:
        pos = t.find("return professional;", idx)
        if 0 < pos < idx + 5000:
            inject = (
                "const completedBookingsCount = await this.prisma.booking.count({\n"
                "      where: { professionalId: professional.id, status: 'completed' as any },\n"
                "    }).catch(() => 0);\n"
                "    return { ...professional, completedBookingsCount };"
            )
            t = t[:pos] + inject + t[pos + len("return professional;"):]
            p.write_text(t, encoding="utf-8")
            changed.append("92-be")
        else:
            print("92 structure miss")

p = Path("frontend/src/app/professionals/[slug]/page.tsx")
t = p.read_text(encoding="utf-8")
if "نوبت موفق" not in t and "{pro.ratingCount} نظر)" in t:
    t = t.replace(
        "{pro.ratingCount} نظر)",
        "{pro.ratingCount} نظر)"
        "\n                      {(pro as { completedBookingsCount?: number }).completedBookingsCount != null &&"
        "\n                        Number((pro as { completedBookingsCount?: number }).completedBookingsCount) > 0 && ("
        "\n                        <span className=\"ms-2 text-xs text-gray\">"
        "\n                          بیش از {Number((pro as { completedBookingsCount?: number }).completedBookingsCount).toLocaleString(\"fa-IR\")} نوبت موفق"
        "\n                        </span>"
        "\n                      )}",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("92-fe")

# 93
p = Path("frontend/src/app/zibagar/hours/page.tsx")
t = p.read_text(encoding="utf-8")
if "removeTimeOff(" in t and "بازه مسدود حذف" not in t:
    t = t.replace(
        "await removeTimeOff(",
        "if (!window.confirm('این بازه مسدود حذف شود؟')) return; await removeTimeOff(",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("93")

HELPER = '''
function bookingTimeline(b: { status?: string; createdAt?: string; startAt?: string; updatedAt?: string }) {
  const steps: { label: string; at?: string }[] = [{ label: 'ثبت شد', at: b.createdAt }];
  const st = String(b.status || '');
  if (['confirmed', 'completed', 'in_progress', 'done'].includes(st)) {
    steps.push({ label: 'تأیید شد', at: b.updatedAt || b.createdAt });
  }
  if (st === 'completed' || st === 'done') {
    steps.push({ label: 'انجام شد', at: b.updatedAt || b.startAt });
  }
  if (st === 'cancelled' || st === 'rejected') {
    steps.push({ label: st === 'rejected' ? 'رد شد' : 'لغو شد', at: b.updatedAt });
  }
  return steps;
}
'''
UI = '''                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-muted">
                      {bookingTimeline(b).map((s, i) => (
                        <span key={i} className="rounded bg-gray-light px-1.5 py-0.5">
                          {s.label}
                          {s.at ? ` · ${new Date(s.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                      ))}
                    </div>
'''
for rel in ["frontend/src/app/panel/bookings/page.tsx", "frontend/src/app/zibagar/bookings/page.tsx"]:
    p = Path(rel)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    if "function bookingTimeline" in t:
        continue
    if "export default function" in t:
        t = t.replace("export default function", HELPER + "\nexport default function", 1)
    if "shortBookingCode(b.id)" in t:
        idx = t.find("shortBookingCode(b.id)")
        end = t.find("</div>", idx)
        if end > 0:
            t = t[: end + 6] + "\n" + UI + t[end + 6 :]
            changed.append("94-" + rel.split("/")[3])
    p.write_text(t, encoding="utf-8")

comp = Path("frontend/src/components/ui/scroll-to-top.tsx")
if not comp.exists():
    comp.write_text(
        "'use client';\n"
        "import { useEffect, useState } from 'react';\n"
        "export function ScrollToTop() {\n"
        "  const [show, setShow] = useState(false);\n"
        "  useEffect(() => {\n"
        "    const onScroll = () => setShow(window.scrollY > 400);\n"
        "    window.addEventListener('scroll', onScroll, { passive: true });\n"
        "    return () => window.removeEventListener('scroll', onScroll);\n"
        "  }, []);\n"
        "  if (!show) return null;\n"
        "  return (\n"
        "    <button type=\"button\" aria-label=\"بازگشت به بالا\"\n"
        "      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}\n"
        "      className=\"fixed bottom-20 left-4 z-40 flex size-11 items-center justify-center rounded-full bg-coral text-white shadow-lg hover:bg-coral-dark sm:bottom-8 sm:left-8\">↑</button>\n"
        "  );\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("97-comp")

p = Path("frontend/src/app/search/page.tsx")
t = p.read_text(encoding="utf-8")
if "ScrollToTop" not in t:
    t = "import { ScrollToTop } from '@/components/ui/scroll-to-top';\n" + t
    if "<PersistSearchFilters" in t:
        t = t.replace("<PersistSearchFilters", "<ScrollToTop />\n      <PersistSearchFilters", 1)
        p.write_text(t, encoding="utf-8")
        changed.append("97-search")

p = Path("frontend/src/app/zibagar/services/page.tsx")
t = p.read_text(encoding="utf-8")
if "موقتاً غیرفعال" not in t and "deactivateMyService" in t:
    if "patchMyService" not in t[:1000]:
        t = t.replace("deactivateMyService,", "deactivateMyService, patchMyService,", 1)
        if "patchMyService" not in t[:1000]:
            t = t.replace("deactivateMyService", "deactivateMyService, patchMyService", 1)
    if "}>حذف</button>" in t:
        t = t.replace(
            "}>حذف</button>",
            "}>حذف</button>\n"
            "                              <button type=\"button\" className=\"text-xs text-amber-700 hover:underline\" "
            "onClick={async () => { setBusy(true); try { const inactive = ps.isActive === false; "
            "await patchMyService(ps.id, { isActive: inactive }); "
            "setMsg(inactive ? 'فعال شد' : 'موقتاً غیرفعال شد'); await load(); "
            "} catch (e) { setError(friendlyApiError(e)); } finally { setBusy(false); } }}"
            ">{ps.isActive === false ? 'فعال‌سازی' : 'موقتاً غیرفعال'}</button>",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("99")

sp = Path("frontend/src/app/status/page.tsx")
if not sp.exists():
    sp.parent.mkdir(parents=True, exist_ok=True)
    sp.write_text(
        "import type { Metadata } from 'next';\n\n"
        "export const metadata: Metadata = { title: 'وضعیت سامانه', description: 'وضعیت سرویس‌های بیوتی‌جو' };\n\n"
        "type Health = { status?: string; database?: string; storage?: string; appVersion?: string; timestamp?: string };\n\n"
        "async function fetchHealth(): Promise<Health | null> {\n"
        "  const base = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';\n"
        "  try {\n"
        "    const res = await fetch(`${base.replace(/\\/$/, '')}/health`, { next: { revalidate: 30 }, headers: { Accept: 'application/json' } });\n"
        "    if (!res.ok) return null;\n"
        "    return (await res.json()) as Health;\n"
        "  } catch { return null; }\n"
        "}\n\n"
        "function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {\n"
        "  return (\n"
        "    <div className=\"flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3\">\n"
        "      <span className=\"font-medium\">{label}</span>\n"
        "      <span className={ok ? 'text-emerald-700' : 'text-red-600'}>{ok ? 'سالم' : 'مختل'}{detail ? ` · ${detail}` : ''}</span>\n"
        "    </div>\n"
        "  );\n"
        "}\n\n"
        "export default async function StatusPage() {\n"
        "  const h = await fetchHealth();\n"
        "  const apiOk = !!h && h.status !== 'degraded' && h.database !== 'down';\n"
        "  return (\n"
        "    <main className=\"mx-auto max-w-lg space-y-4 px-4 py-12\" dir=\"rtl\">\n"
        "      <h1 className=\"text-2xl font-bold text-blue\">وضعیت سامانه بیوتی‌جو</h1>\n"
        "      <p className=\"text-sm text-gray\">بروزرسانی تقریبی هر ۳۰ ثانیه</p>\n"
        "      <Row label=\"API\" ok={apiOk} detail={h?.appVersion} />\n"
        "      <Row label=\"پایگاه داده\" ok={h?.database === 'up'} detail={h?.database} />\n"
        "      <Row label=\"ذخیره‌سازی\" ok={h?.storage === 'up' || h?.storage === 'unconfigured'} detail={h?.storage || 'نامشخص'} />\n"
        "      <Row label=\"پرداخت / پیامک\" ok={apiOk} detail=\"وابسته به API\" />\n"
        "      {h?.timestamp && <p className=\"text-center text-xs text-gray-muted\" dir=\"ltr\">{h.timestamp}</p>}\n"
        "    </main>\n"
        "  );\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("100")

changed.append("91-admin-notify-sms-exists")
changed.append("96-reply-exists")
print("CHANGED", changed)
