from pathlib import Path
import re
changed = []

p = Path("frontend/src/app/panel/favorites/page.tsx")
t = p.read_text(encoding="utf-8")
if "\u062c\u0633\u062a\u062c\u0648\u06cc \u0632\u06cc\u0628\u0627\u06af\u0631" not in t and "PanelEmpty" in t:
    t = t.replace('href="/professionals"', 'href="/search"', 1)
    t = t.replace("\u0645\u0634\u0627\u0647\u062f\u0647 \u0632\u06cc\u0628\u0627\u06af\u0631\u0647\u0627", "\u062c\u0633\u062a\u062c\u0648\u06cc \u0632\u06cc\u0628\u0627\u06af\u0631", 1)
    t = t.replace('title="\u0644\u06cc\u0633\u062a \u062e\u0627\u0644\u06cc \u0627\u0633\u062a"', 'title="\u0647\u0646\u0648\u0632 \u06a9\u0633\u06cc \u0631\u0627 \u0630\u062e\u06cc\u0631\u0647 \u0646\u06a9\u0631\u062f\u0647\u200c\u0627\u06cc\u062f"', 1)
    t = t.replace(
        'description="\u0647\u0646\u0648\u0632 \u0632\u06cc\u0628\u0627\u06af\u0631\u06cc \u0627\u0636\u0627\u0641\u0647 \u0646\u06a9\u0631\u062f\u0647\u200c\u0627\u06cc\u062f."',
        'description="\u0632\u06cc\u0628\u0627\u06af\u0631\u0647\u0627\u06cc \u0645\u0648\u0631\u062f \u0639\u0644\u0627\u0642\u0647 \u0631\u0627 \u0627\u06cc\u0646\u062c\u0627 \u0630\u062e\u06cc\u0631\u0647 \u06a9\u0646\u06cc\u062f."',
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("76")

p = Path("backend/src/auth/auth.service.ts")
t = p.read_text(encoding="utf-8")
old2 = "throw new BadRequestException(`\u0644\u0637\u0641\u0627\u064b ${wait} \u062b\u0627\u0646\u06cc\u0647 \u0635\u0628\u0631 \u06a9\u0646\u06cc\u062f \u0648 \u062f\u0648\u0628\u0627\u0631\u0647 \u062a\u0644\u0627\u0634 \u06a9\u0646\u06cc\u062f`);"
# try real Persian from repo
old_fa = "throw new BadRequestException(`لطفاً ${wait} ثانیه صبر کنید و دوباره تلاش کنید`);"
if old_fa in t:
    t = t.replace(
        old_fa,
        "throw new BadRequestException(\n        wait >= 55\n          ? 'لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید'\n          : `لطفاً ${wait} ثانیه صبر کنید و دوباره تلاش کنید`,\n      );",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("77")
elif "${wait}" in t and "ثانیه صبر" in t:
    import re
    t2, n = re.subn(
        r"throw new BadRequestException\(`لطفاً \$\{wait\} ثانیه صبر کنید و دوباره تلاش کنید`\);",
        "throw new BadRequestException(\n        wait >= 55\n          ? 'لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید'\n          : `لطفاً ${wait} ثانیه صبر کنید و دوباره تلاش کنید`,\n      );",
        t,
        count=1,
    )
    if n:
        p.write_text(t2, encoding="utf-8")
        changed.append("77-re")

changed.append("78-ok")

p = Path("frontend/src/lib/panel-api.ts")
t = p.read_text(encoding="utf-8")
if "setCustomerNote" not in t:
    block = """
/** #40 item 79 */
export async function setCustomerNote(customerId: string, note: string) {
  const me = await apiClient.get<{ socialLinks?: Record<string, unknown> }>('/professionals/me');
  const prev = (me?.socialLinks || {}) as Record<string, unknown>;
  const notes = { ...((prev._customerNotes as Record<string, string>) || {}) };
  if (note.trim()) notes[customerId] = note.trim().slice(0, 500);
  else delete notes[customerId];
  return apiClient.patch('/professionals/me', { socialLinks: { _customerNotes: notes } });
}
export async function getCustomerNotes(): Promise<Record<string, string>> {
  const me = await apiClient.get<{ socialLinks?: { _customerNotes?: Record<string, string> } }>('/professionals/me');
  return me?.socialLinks?._customerNotes || {};
}
"""
    if "export async function fetchMyServices" in t:
        t = t.replace("export async function fetchMyServices", block + "export async function fetchMyServices", 1)
    else:
        t = t + block
    p.write_text(t, encoding="utf-8")
    changed.append("79-api")

p = Path("frontend/src/app/zibagar/bookings/page.tsx")
t = p.read_text(encoding="utf-8")
if "setCustomerNote" not in t:
    t = "import { setCustomerNote, getCustomerNotes } from '@/lib/panel-api';\n" + t
    if "const [busy, setBusy]" in t:
        t = t.replace(
            "const [busy, setBusy]",
            "const [customerNotes, setCustomerNotes] = useState<Record<string, string>>({});\n  const [noteEdit, setNoteEdit] = useState<string | null>(null);\n  const [noteText, setNoteText] = useState('');\n  const [busy, setBusy]",
            1,
        )
    if "useEffect(" in t:
        idx = t.find("useEffect(")
        t = t[:idx] + "\n  useEffect(() => { void getCustomerNotes().then(setCustomerNotes).catch(() => undefined); }, []);\n  " + t[idx:]
    note_ui = """                    {b.customer?.id && (
                      <div className="mt-1 text-xs">
                        {noteEdit === b.customer.id ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <input className="h-8 flex-1 rounded-lg border border-border px-2 text-xs" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="یادداشت خصوصی..." maxLength={500} />
                            <button type="button" className="rounded bg-coral px-2 py-1 text-[10px] text-white" onClick={() => { void (async () => { try { await setCustomerNote(b.customer!.id, noteText); setCustomerNotes((prev) => { const n = { ...prev }; if (noteText.trim()) n[b.customer!.id] = noteText.trim(); else delete n[b.customer!.id]; return n; }); setNoteEdit(null); } catch { /* ignore */ } })(); }}>ذخیره</button>
                          </div>
                        ) : (
                          <button type="button" className="text-gray-muted hover:text-coral" onClick={() => { setNoteEdit(b.customer!.id); setNoteText(customerNotes[b.customer!.id] || ''); }}>
                            {customerNotes[b.customer.id] ? `یادداشت: ${customerNotes[b.customer.id].slice(0, 40)}` : 'یادداشت خصوصی'}
                          </button>
                        )}
                      </div>
                    )}
"""
    if "copyBookingCode(b.id)" in t:
        idx = t.find("copyBookingCode(b.id)")
        end = t.find("</div>", idx)
        if end > 0:
            t = t[: end + 6] + "\n" + note_ui + t[end + 6 :]
            changed.append("79-ui")
    p.write_text(t, encoding="utf-8")

p = Path("frontend/src/app/professionals/[slug]/page.tsx")
t = p.read_text(encoding="utf-8")
if "formatProfileUpdated" not in t:
    helper = """
function formatProfileUpdated(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'پروفایل امروز به‌روز شده';
  if (days === 1) return 'پروفایل دیروز به‌روز شده';
  if (days < 30) return `پروفایل آخرین بار ${days.toLocaleString('fa-IR')} روز پیش به‌روز شده`;
  return null;
}
"""
    if "function formatLastActivity" in t:
        t = t.replace("function formatLastActivity", helper + "function formatLastActivity", 1)
    block = """                  {formatProfileUpdated((pro as { updatedAt?: string | null }).updatedAt) && (
                    <span className="text-xs text-gray">
                      {formatProfileUpdated((pro as { updatedAt?: string | null }).updatedAt)}
                    </span>
                  )}
"""
    needle = "formatLastActivity((pro as { user?: { lastLoginAt?: string | null } }).user?.lastLoginAt)}"
    idx = t.find(needle)
    if idx > 0:
        end = t.find(")}", t.find("</span>", idx))
        if end > 0:
            t = t[: end + 2] + "\n" + block + t[end + 2 :]
            changed.append("80")
    p.write_text(t, encoding="utf-8")

print("CHANGED", changed)
