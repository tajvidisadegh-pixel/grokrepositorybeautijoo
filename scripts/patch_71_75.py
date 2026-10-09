from pathlib import Path
import re

changed = []

# ---- 72: forgot password on OTP ----
p = Path("frontend/src/app/otp/page.tsx")
t = p.read_text(encoding="utf-8")
if "forgot-password" not in t:
    old = '<div className="mt-6 border-t border-border pt-4 text-center text-sm text-gray">'
    if old in t:
        new = (
            '<div className="mt-6 space-y-2 border-t border-border pt-4 text-center text-sm text-gray">\n'
            "          <p>\n"
            "            <Link\n"
            "              href={`/forgot-password?as=${accountType}`}\n"
            '              className="font-medium text-coral hover:text-coral-dark"\n'
            "            >\n"
            "              \u0631\u0645\u0632 \u0639\u0628\u0648\u0631\u0645 \u0631\u0627 \u0641\u0631\u0627\u0645\u0648\u0634 \u06a9\u0631\u062f\u0647\u200c\u0627\u0645\n"
            "            </Link>\n"
            "          </p>\n"
            "          <p>"
        )
        t = t.replace(old, new, 1)
        p.write_text(t, encoding="utf-8")
        changed.append("72")
    else:
        print("72 miss")
else:
    print("72 exists")

# ---- 73: version footer ----
p = Path("frontend/src/components/panel/panel-shell.tsx")
t = p.read_text(encoding="utf-8")
if "APP_VERSION" not in t:
    t = t.replace(
        "'use client';",
        "'use client';\n\nconst APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '3.0.0';",
        1,
    )
    footer = (
        "\n        <p className=\"mt-8 text-center text-[10px] text-gray-muted\" dir=\"ltr\">\n"
        "          beautijoo v{APP_VERSION}\n"
        "        </p>"
    )
    marker = "      </div>\n    </RequireAuth>"
    if marker in t and "beautijoo v" not in t:
        t = t.replace(marker, footer + "\n" + marker, 1)
        p.write_text(t, encoding="utf-8")
        changed.append("73")
    else:
        print("73 miss")
else:
    print("73 exists")

# ---- 74: booking code util ----
util = Path("frontend/src/lib/booking-code.ts")
if not util.exists():
    util.write_text(
        "/** #40 item 74 */\n"
        "export function shortBookingCode(id: string): string {\n"
        "  return (id || '').replace(/-/g, '').slice(0, 8).toUpperCase();\n"
        "}\n"
        "export async function copyBookingCode(id: string): Promise<boolean> {\n"
        "  const code = shortBookingCode(id);\n"
        "  try {\n"
        "    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {\n"
        "      await navigator.clipboard.writeText(code);\n"
        "      return true;\n"
        "    }\n"
        "  } catch {\n"
        "    /* ignore */\n"
        "  }\n"
        "  return false;\n"
        "}\n",
        encoding="utf-8",
    )
    changed.append("74-util")

def ensure_import(t: str) -> str:
    if "from '@/lib/booking-code'" in t:
        return t
    m = re.search(r"(import .+ from '@/lib/[^']+';)", t)
    if m:
        return t.replace(
            m.group(1),
            m.group(1) + "\nimport { shortBookingCode, copyBookingCode } from '@/lib/booking-code';",
            1,
        )
    return t

code_ui = (
    '                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-muted" dir="ltr">\n'
    "                      <span>#{shortBookingCode(b.id)}</span>\n"
    '                      <button\n'
    '                        type="button"\n'
    '                        className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-gray-light"\n'
    "                        onClick={() => {\n"
    "                          void copyBookingCode(b.id);\n"
    "                        }}\n"
    "                      >\n"
    "                        \u06a9\u067e\u06cc\n"
    "                      </button>\n"
    "                    </div>\n"
)
code_ui = code_ui.replace("#{shortBookingCode(b.id)}", "#" + "{shortBookingCode(b.id)}")

p = Path("frontend/src/app/panel/bookings/page.tsx")
t = p.read_text(encoding="utf-8")
if "shortBookingCode" not in t:
    t = ensure_import(t)
    if '<p className="font-semibold">{proName}</p>' in t:
        t = t.replace(
            '<p className="font-semibold">{proName}</p>',
            '<p className="font-semibold">{proName}</p>\n' + code_ui,
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("74-panel")
    else:
        print("74 panel miss")

p = Path("frontend/src/app/zibagar/bookings/page.tsx")
t = p.read_text(encoding="utf-8")
if "shortBookingCode" not in t:
    t = ensure_import(t)
    code_row = (
        '<div className="mb-1 flex items-center gap-2 text-xs text-gray-muted" dir="ltr">'
        "<span>#" + "{shortBookingCode(b.id)}" + "</span>"
        '<button type="button" className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-gray-light" '
        'onClick={() => void copyBookingCode(b.id)}>\u06a9\u067e\u06cc</button></div>'
    )
    if "<li key={b.id}>" in t:
        t = t.replace("<li key={b.id}>", "<li key={b.id}>\n                    " + code_row, 1)
        p.write_text(t, encoding="utf-8")
        changed.append("74-zibagar")
    else:
        print("74 zibagar miss")

# ---- 71 capacity warning ----
p = Path("frontend/src/app/zibagar/page.tsx")
t = p.read_text(encoding="utf-8")
cap_phrase = "\u0638\u0631\u0641\u06cc\u062a \u0627\u0645\u0631\u0648\u0632"
if cap_phrase not in t and "todayBookings" in t:
    warn = (
        "\n      {todayBookings.length >= 5 && (\n"
        '        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">\n'
        "          \u0638\u0631\u0641\u06cc\u062a \u0627\u0645\u0631\u0648\u0632 \u062a\u0642\u0631\u06cc\u0628\u0627\u064b \u067e\u0631 \u0627\u0633\u062a "
        "({todayBookings.length.toLocaleString('fa-IR')} \u0646\u0648\u0628\u062a).\n"
        "        </div>\n"
        "      )}\n"
    )
    if "<PauseBookingsToggle />" in t:
        t = t.replace("<PauseBookingsToggle />", "<PauseBookingsToggle />" + warn, 1)
        p.write_text(t, encoding="utf-8")
        changed.append("71")
    else:
        m2 = re.search(r"(return \(\s*\n\s*<div[^>]*>)", t)
        if m2:
            t = t[: m2.end()] + warn + t[m2.end() :]
            p.write_text(t, encoding="utf-8")
            changed.append("71-alt")
        else:
            print("71 miss")
else:
    print("71 skip")

# ---- 75 today filter label ----
p = Path("frontend/src/app/zibagar/bookings/page.tsx")
t = p.read_text(encoding="utf-8")
if "datePreset" in t:
    if "{ v: 'today' as const, l: '\u0627\u0645\u0631\u0648\u0632' }" in t:
        t = t.replace(
            "{ v: 'today' as const, l: '\u0627\u0645\u0631\u0648\u0632' }",
            "{ v: 'today' as const, l: '\u0641\u0642\u0637 \u0627\u0645\u0631\u0648\u0632' }",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("75")
    elif "l: 'امروز'" in t:
        t = t.replace(
            "{ v: 'today' as const, l: 'امروز' }",
            "{ v: 'today' as const, l: '\u0641\u0642\u0637 \u0627\u0645\u0631\u0648\u0632' }",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("75-fa")
    else:
        changed.append("75-present")
else:
    print("75 no preset")

print("CHANGED", changed)
