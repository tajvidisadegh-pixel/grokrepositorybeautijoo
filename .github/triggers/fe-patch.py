
from pathlib import Path

p = Path("frontend/src/app/professionals/[slug]/page.tsx")
t = p.read_text()
if "formatLastActivity" not in t:
    helper = """
/** Relative Persian label for last activity (#40 item 32) */
function formatLastActivity(iso?: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 0) return null;
  if (diffMin < 15) return 'آنلاین اخیراً';
  if (diffMin < 60) return `آخرین فعالیت: ${diffMin} دقیقه پیش`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `آخرین فعالیت: ${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'آخرین فعالیت: دیروز';
  if (d < 7) return `آخرین فعالیت: ${d} روز پیش`;
  if (d < 30) return `آخرین فعالیت: ${Math.floor(d / 7)} هفته پیش`;
  return 'آخرین فعالیت: بیش از یک ماه پیش';
}

"""
    idx = t.find("export async function generateMetadata")
    if idx < 0:
        raise SystemExit("generateMetadata missing")
    t = t[:idx] + helper + t[idx:]
    city_needle = "{pro.locations?.[0]?.location?.city && ("
    cpos = t.find(city_needle)
    if cpos > 0:
        end = t.find(")}", cpos)
        end = t.find("\n", end) + 1
        insert = """                  {formatLastActivity((pro as { user?: { lastLoginAt?: string | null } }).user?.lastLoginAt) && (
                    <span className="text-xs text-gray">
                      {formatLastActivity((pro as { user?: { lastLoginAt?: string | null } }).user?.lastLoginAt)}
                    </span>
                  )}
"""
        t = t[:end] + insert + t[end:]
    p.write_text(t)
    print("pro page OK")
else:
    print("pro page skip")

p2 = Path("frontend/src/app/zibagar/hours/page.tsx")
t2 = p2.read_text()
if "HOURS_DRAFT_KEY" not in t2:
    t2 = t2.replace(
        "const INTERVALS = [15, 30, 45, 60, 90, 120] as const;",
        "const INTERVALS = [15, 30, 45, 60, 90, 120] as const;\n\nconst HOURS_DRAFT_KEY = 'bj_zibagar_hours_draft_v1';",
        1,
    )
    marker = "  useEffect(() => {\n    load();\n  }, [load]);\n"
    if marker not in t2:
        raise SystemExit("load effect missing")
    extra = """  useEffect(() => {
    load();
  }, [load]);

  const [draftRestored, setDraftRestored] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loading || draftRestored) return;
    try {
      const raw = localStorage.getItem(HOURS_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, { active: boolean; startTime: string; endTime: string }>;
        if (parsed && typeof parsed === 'object') {
          setDayDrafts((prev) => ({ ...prev, ...parsed }));
          setDirty(true);
        }
      }
    } catch { /* ignore */ }
    setDraftRestored(true);
  }, [loading, draftRestored]);

  useEffect(() => {
    if (!draftRestored || !dirty) return;
    try { localStorage.setItem(HOURS_DRAFT_KEY, JSON.stringify(dayDrafts)); } catch { /* ignore */ }
  }, [dayDrafts, dirty, draftRestored]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!draftRestored || loading) return;
    const serverKey = JSON.stringify(
      Object.fromEntries(
        DAYS.map((d) => {
          const rows = workingHours.filter(
            (h) => String(h.dayOfWeek).toLowerCase() === d.value && h.isActive !== false,
          );
          if (!rows.length) return [d.value, { active: false, startTime: '09:00', endTime: '20:00' }];
          const s = [...rows].sort((a, b) => pm(a.startTime) - pm(b.startTime));
          return [d.value, { active: true, startTime: s[0].startTime.slice(0, 5), endTime: s[s.length - 1].endTime.slice(0, 5) }];
        }),
      ),
    );
    setDirty(serverKey !== JSON.stringify(dayDrafts));
  }, [dayDrafts, workingHours, draftRestored, loading]);
"""
    t2 = t2.replace(marker, extra, 1)
    t2 = t2.replace(
        "setSuccess('ساعات هفتگی ذخیره شد');",
        "setSuccess('ساعات هفتگی ذخیره شد');\n                  try { localStorage.removeItem(HOURS_DRAFT_KEY); } catch {}\n                  setDirty(false);",
    )
    bn = """      {error && <p className=\"rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 sm:text-sm\">{error}</p>}
      {success && <p className=\"rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 sm:text-sm\">{success}</p>}
"""
    be = bn + """      {dirty && (
        <p className=\"rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:text-sm\">
          تغییرات ساعات هفتگی هنوز ذخیره نشده‌اند و به‌صورت موقت روی این دستگاه نگه‌داری می‌شوند.
        </p>
      )}
"""
    if bn in t2:
        t2 = t2.replace(bn, be, 1)
    p2.write_text(t2)
    print("hours page OK")
else:
    print("hours page skip")
print("DONE")
