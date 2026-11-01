#!/usr/bin/env python3
from pathlib import Path

p = Path("frontend/src/app/admin/service-categories/page.tsx")
t = p.read_text()
if "togglePopular" in t:
    print("already has togglePopular")
else:
    if "icon?:" not in t:
        t = t.replace(
            "  sortOrder?: number;\n  description?: string | null;",
            "  sortOrder?: number;\n  description?: string | null;\n  icon?: string | null;",
            1,
        )
    idx = t.find("async function setCategoryActive")
    if idx < 0:
        raise SystemExit("setCategoryActive not found")
    end = t.find("\n  async function ", idx + 10)
    if end < 0:
        raise SystemExit("end of setCategoryActive not found")
    insert = (
        "\n  async function togglePopular(cat: Category) {\n"
        "    setBusy(true);\n"
        "    setError(null);\n"
        "    try {\n"
        "      const popular = cat.icon === 'popular';\n"
        "      await apiClient.patch(`/admin/service-categories/${cat.id}`, {\n"
        "        icon: popular ? null : 'popular',\n"
        "      });\n"
        "      setMessage(popular ? 'علامت محبوب برداشته شد' : 'به‌عنوان محبوب علامت خورد');\n"
        "      await load();\n"
        "    } catch (e) {\n"
        "      setError(e instanceof Error ? e.message : 'خطا در علامت محبوب');\n"
        "    } finally {\n"
        "      setBusy(false);\n"
        "    }\n"
        "  }\n"
    )
    t = t[:end] + insert + t[end:]
    old = '<span className="font-medium text-sm">{cat.name}</span>'
    new = (
        '<span className="font-medium text-sm">{cat.name}</span>\n'
        '                        {depth === 0 && (\n'
        '                          <button type="button" disabled={busy} onClick={() => void togglePopular(cat)}\n'
        "                            className={`rounded-full border px-2 py-0.5 text-[11px] ${cat.icon === 'popular' ? 'border-[#FF6F61] bg-[#FF6F61] text-white' : 'border-gray-300 bg-white text-gray-600'}`}>\n"
        "                            {cat.icon === 'popular' ? 'محبوب ✓' : 'محبوب'}\n"
        "                          </button>\n"
        "                        )}"
    )
    if old not in t:
        raise SystemExit("name span not found")
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("service-categories popular added")

p = Path("frontend/src/app/admin/page.tsx")
t = p.read_text()
if "last1Hour" in t:
    print("admin page already has last1Hour")
else:
    t = t.replace(
        "type WindowKey = 'today' | 'last7Days' | 'last30Days' | 'thisMonth';",
        "type WindowKey = 'last1Hour' | 'today' | 'last24Hours' | 'last7Days' | 'last30Days' | 'thisMonth';",
        1,
    )
    t = t.replace(
        "  { key: 'today', label: 'امروز' },\n  { key: 'last7Days', label: '۷ روز اخیر' },",
        "  { key: 'last1Hour', label: '۱ ساعت اخیر' },\n  { key: 'today', label: 'امروز' },\n  { key: 'last24Hours', label: '۲۴ ساعت اخیر' },\n  { key: 'last7Days', label: '۷ روز اخیر' },",
        1,
    )
    t = t.replace(
        "  const timeStats = raw?.timeStats ?? {\n    today: EMPTY_WINDOW,\n    last7Days: EMPTY_WINDOW,\n    last30Days: EMPTY_WINDOW,\n    thisMonth: EMPTY_WINDOW,\n  };",
        "  const timeStats = raw?.timeStats ?? {\n    last1Hour: EMPTY_WINDOW,\n    today: EMPTY_WINDOW,\n    last24Hours: EMPTY_WINDOW,\n    last7Days: EMPTY_WINDOW,\n    last30Days: EMPTY_WINDOW,\n    thisMonth: EMPTY_WINDOW,\n  };",
        1,
    )
    t = t.replace(
        "    timeStats: {\n      today: timeStats.today ?? EMPTY_WINDOW,\n      last7Days: timeStats.last7Days ?? EMPTY_WINDOW,\n      last30Days: timeStats.last30Days ?? EMPTY_WINDOW,\n      thisMonth: timeStats.thisMonth ?? EMPTY_WINDOW,\n    },",
        "    timeStats: {\n      last1Hour: (timeStats as any).last1Hour ?? EMPTY_WINDOW,\n      today: timeStats.today ?? EMPTY_WINDOW,\n      last24Hours: (timeStats as any).last24Hours ?? EMPTY_WINDOW,\n      last7Days: timeStats.last7Days ?? EMPTY_WINDOW,\n      last30Days: timeStats.last30Days ?? EMPTY_WINDOW,\n      thisMonth: timeStats.thisMonth ?? EMPTY_WINDOW,\n    },",
        1,
    )
    p.write_text(t)
    print("admin page windows updated")
print("done")
