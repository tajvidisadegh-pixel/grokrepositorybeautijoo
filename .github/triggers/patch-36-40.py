from pathlib import Path
import re

# ========== 39 backend: include pro phone in listMineAsCustomer ==========
p = Path("backend/src/bookings/bookings.service.ts")
t = p.read_text()
old2 = "include: { user: { select: { profile: { select: { displayName: true } } } } }"
new2 = "include: { user: { select: { phone: true, profile: { select: { displayName: true, avatarUrl: true } } } } }"
if "phone: true, profile: { select: { displayName: true" not in t:
    if old2 in t:
        t = t.replace(old2, new2, 1)
        print("39 backend OK")
    else:
        print("39 backend SKIP - marker missing")
else:
    print("39 backend skip")
p.write_text(t)

# ========== 39 FE types ==========
p2 = Path("frontend/src/lib/panel-api.ts")
t2 = p2.read_text()
old_type = "user?: { profile?: { displayName?: string | null } | null } | null } | null;"
new_type = "user?: { phone?: string | null; profile?: { displayName?: string | null; avatarUrl?: string | null } | null } | null } | null;"
if old_type in t2:
    t2 = t2.replace(old_type, new_type, 1)
    print("39 types OK")
else:
    print("39 types skip")
p2.write_text(t2)

# ========== 39 FE panel bookings: contact button ==========
p3 = Path("frontend/src/app/panel/bookings/page.tsx")
t3 = p3.read_text()
if "تماس با زیباگر" not in t3:
    name_marker = "b.professional?.user?.profile?.displayName"
    nidx = t3.find(name_marker)
    if nidx > 0:
        ppos = t3.find("persianBookingStatus", nidx)
        if ppos > 0:
            line_start = t3.rfind("\n", 0, ppos)
            insert = """
              {((b.status === 'confirmed' || b.status === 'completed') &&
                (b.professional as { user?: { phone?: string | null } } | undefined)?.user?.phone) ? (
                <a
                  href={`tel:${(b.professional as { user?: { phone?: string | null } }).user!.phone}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-coral hover:text-coral-dark"
                  dir="ltr"
                >
                  تماس با زیباگر: {(b.professional as { user?: { phone?: string | null } }).user!.phone}
                </a>
              ) : null}
"""
            t3 = t3[:line_start] + "\n" + insert + t3[line_start:]
            print("39 panel contact OK")
        else:
            print("39 panel contact marker2 missing")
    else:
        print("39 panel name marker missing")
else:
    print("39 panel skip")
p3.write_text(t3)

# ========== 38 hours conflict warning ==========
p4 = Path("frontend/src/app/zibagar/hours/page.tsx")
t4 = p4.read_text()
if "scheduleConflicts" not in t4:
    conflict_memo = """
  const scheduleConflicts = useMemo(() => {
    const now = Date.now();
    const out: { id: string; when: string; reason: string }[] = [];
    for (const b of bookings) {
      if (!b.startAt) continue;
      const st = (b.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'rejected' || st === 'expired') continue;
      const start = new Date(b.startAt).getTime();
      if (start < now) continue;
      const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', weekday: 'long' }).format(new Date(b.startAt)).toLowerCase();
      const draft = dayDrafts[wd];
      const when = formatDate(b.startAt, { style: 'long', weekday: true }) + ' ' + formatTime24(b.startAt);
      const name = b.customer?.profile?.displayName || 'مشتری';
      if (!draft || !draft.active) {
        out.push({ id: b.id, when, reason: `رزرو ${name} در روز غیرفعال` });
        continue;
      }
      const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(b.startAt));
      const [hh, mm] = hm.split(':').map(Number);
      const mins = hh * 60 + mm;
      const [sh, sm] = draft.startTime.slice(0, 5).split(':').map(Number);
      const [eh, em] = draft.endTime.slice(0, 5).split(':').map(Number);
      const startM = sh * 60 + sm;
      const endM = eh * 60 + em;
      if (mins < startM || mins >= endM) {
        out.push({ id: b.id, when, reason: `رزرو ${name} خارج از بازه ${draft.startTime.slice(0, 5)}–${draft.endTime.slice(0, 5)}` });
      }
    }
    return out;
  }, [bookings, dayDrafts]);

"""
    if "const monthGrid" in t4:
        t4 = t4.replace("const monthGrid", conflict_memo + "  const monthGrid", 1)
        print("38 conflict memo OK")
    else:
        print("38 memo insert skip")

    dirty_banner = "تغییرات ساعات هفتگی هنوز ذخیره نشده‌اند"
    if dirty_banner in t4 and "scheduleConflicts.length" not in t4:
        insert_banner = """
      {scheduleConflicts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:text-sm">
          <p className="font-medium">هشدار تداخل زمانی با رزروهای آینده ({scheduleConflicts.length} مورد)</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {scheduleConflicts.slice(0, 5).map((c) => (
              <li key={c.id}>{c.when} — {c.reason}</li>
            ))}
            {scheduleConflicts.length > 5 && <li>و {scheduleConflicts.length - 5} مورد دیگر…</li>}
          </ul>
          <p className="mt-1 text-[11px] text-red-700">قبل از ذخیره، ساعات را جوری تنظیم کنید که این رزروها پوشش داده شوند یا رزروها را تغییر زمان دهید.</p>
        </div>
      )}
"""
        pos = t4.find(dirty_banner)
        if pos > 0:
            close = t4.find(")}", pos)
            close = t4.find("\n", close) + 1
            t4 = t4[:close] + insert_banner + t4[close:]
            print("38 banner OK")
        else:
            print("38 banner pos missing")
else:
    print("38 skip")
p4.write_text(t4)

# ========== 40 recent searches component ==========
comp = Path("frontend/src/components/search/recent-searches.tsx")
comp.parent.mkdir(parents=True, exist_ok=True)
comp.write_text("'use client';\n\nimport { useEffect, useState } from 'react';\nimport Link from 'next/link';\n\nconst KEY = 'bj_recent_searches_v1';\nconst MAX = 6;\n\nexport type RecentSearchItem = {\n  q?: string;\n  city?: string;\n  label: string;\n  href: string;\n  at: number;\n};\n\nfunction read(): RecentSearchItem[] {\n  try {\n    const raw = localStorage.getItem(KEY);\n    if (!raw) return [];\n    const parsed = JSON.parse(raw) as RecentSearchItem[];\n    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];\n  } catch {\n    return [];\n  }\n}\n\nexport function pushRecentSearch(item: Omit<RecentSearchItem, 'at'>) {\n  try {\n    const prev = read().filter((x) => x.href !== item.href);\n    const next = [{ ...item, at: Date.now() }, ...prev].slice(0, MAX);\n    localStorage.setItem(KEY, JSON.stringify(next));\n  } catch {\n    /* ignore */\n  }\n}\n\nexport function RecentSearches() {\n  const [items, setItems] = useState<RecentSearchItem[]>([]);\n\n  useEffect(() => {\n    setItems(read());\n  }, []);\n\n  if (!items.length) return null;\n\n  return (\n    <div className=\"mt-4\">\n      <div className=\"mb-2 flex items-center justify-between gap-2\">\n        <p className=\"text-xs font-medium text-gray\">جستجوهای اخیر</p>\n        <button\n          type=\"button\"\n          className=\"text-[11px] text-gray-muted hover:text-coral\"\n          onClick={() => {\n            try {\n              localStorage.removeItem(KEY);\n            } catch {\n              /* ignore */\n            }\n            setItems([]);\n          }}\n        >\n          پاک کردن\n        </button>\n      </div>\n      <div className=\"flex flex-wrap gap-2\">\n        {items.map((it) => (\n          <Link\n            key={it.href + String(it.at)}\n            href={it.href}\n            className=\"rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground transition-colors hover:border-coral/40 hover:text-coral\"\n          >\n            {it.label}\n          </Link>\n        ))}\n      </div>\n    </div>\n  );\n}\n\n/** Client side-effect: record current search params into recent list */\nexport function RecordRecentSearch({\n  q,\n  city,\n  href,\n}: {\n  q?: string;\n  city?: string;\n  href: string;\n}) {\n  useEffect(() => {\n    const labelParts = [q?.trim(), city?.trim()].filter(Boolean) as string[];\n    if (!labelParts.length) return;\n    pushRecentSearch({\n      q: q?.trim() || undefined,\n      city: city?.trim() || undefined,\n      label: labelParts.join(' · '),\n      href,\n    });\n  }, [q, city, href]);\n  return null;\n}\n")
print("40 component OK")

# Wire into search page
p5 = Path("frontend/src/app/search/page.tsx")
t5 = p5.read_text()
if "RecentSearches" not in t5:
    if "from '@/components/search/near-me-fields'" in t5:
        t5 = t5.replace(
            "from '@/components/search/near-me-fields';",
            "from '@/components/search/near-me-fields';\nimport { RecentSearches, RecordRecentSearch } from '@/components/search/recent-searches';",
        )
    else:
        t5 = "import { RecentSearches, RecordRecentSearch } from '@/components/search/recent-searches';\n" + t5
    intro = '<p className="mt-1 text-sm text-gray">فیلتر بر اساس متن، شهر، فاصله، دسته، امتیاز، قیمت و تاریخ در دسترس بودن</p>'
    if intro in t5:
        t5 = t5.replace(
            intro,
            intro + "\n\n      <RecentSearches />\n      {(q || city) && (\n        <RecordRecentSearch q={q} city={city} href={buildHref(1)} />\n      )}",
            1,
        )
        print("40 search page OK")
    elif '<h1 className="text-2xl font-bold text-blue">جستجو</h1>' in t5:
        t5 = t5.replace(
            '<h1 className="text-2xl font-bold text-blue">جستجو</h1>',
            '<h1 className="text-2xl font-bold text-blue">جستجو</h1>\n      <RecentSearches />',
            1,
        )
        print("40 search page alt OK")
    else:
        print("40 search page marker missing")
else:
    print("40 search skip")
p5.write_text(t5)

print("DONE ALL")
