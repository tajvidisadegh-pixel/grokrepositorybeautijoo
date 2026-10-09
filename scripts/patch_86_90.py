from pathlib import Path
import re
changed = []

p = Path("frontend/src/app/search/page.tsx")
t = p.read_text(encoding="utf-8")
if "durationBand" not in t:
    t = t.replace("حداقل قیمت (ریال)", "حداقل قیمت (تومان)", 1)
    t = t.replace("حداکثر قیمت (ریال)", "حداکثر قیمت (تومان)", 1)
    if "const minPrice = sp.minPrice" in t:
        t = t.replace(
            "const minPrice = sp.minPrice",
            "const durationBand = (sp.durationBand || '').trim();\n"
            "  let minDuration: number | undefined;\n"
            "  let maxDuration: number | undefined;\n"
            "  if (durationBand === 'under60') { minDuration = 1; maxDuration = 60; }\n"
            "  else if (durationBand === '60to120') { minDuration = 61; maxDuration = 120; }\n"
            "  else if (durationBand === 'over120') { minDuration = 121; }\n"
            "  const minPrice = sp.minPrice",
            1,
        )
    if "minPrice: Number.isFinite(minPrice as number) ? minPrice : undefined," in t:
        t = t.replace(
            "minPrice: Number.isFinite(minPrice as number) ? minPrice : undefined,",
            "minPrice: Number.isFinite(minPrice as number) ? minPrice : undefined,\n"
            "      minDuration: minDuration != null && Number.isFinite(minDuration) ? minDuration : undefined,\n"
            "      maxDuration: maxDuration != null && Number.isFinite(maxDuration) ? maxDuration : undefined,",
            1,
        )
    if "if (minPrice != null && Number.isFinite(minPrice)) params.set('minPrice', String(minPrice));" in t:
        t = t.replace(
            "if (minPrice != null && Number.isFinite(minPrice)) params.set('minPrice', String(minPrice));",
            "if (minDuration != null && Number.isFinite(minDuration)) params.set('minDuration', String(minDuration));\n"
            "    if (maxDuration != null && Number.isFinite(maxDuration)) params.set('maxDuration', String(maxDuration));\n"
            "    if (durationBand) params.set('durationBand', durationBand);\n"
            "    if (minPrice != null && Number.isFinite(minPrice)) params.set('minPrice', String(minPrice));",
            1,
        )
    if 'name="durationBand"' not in t and 'name="availableDate"' in t:
        ui = (
            '          <div>\n'
            '            <label className="mb-1 block text-xs font-medium text-gray">مدت خدمت</label>\n'
            '            <select name="durationBand" defaultValue={durationBand || ""} className={inputCls}>\n'
            '              <option value="">همه مدت‌ها</option>\n'
            '              <option value="under60">زیر ۶۰ دقیقه</option>\n'
            '              <option value="60to120">۶۰ تا ۱۲۰ دقیقه</option>\n'
            '              <option value="over120">بیش از ۲ ساعت</option>\n'
            '            </select>\n'
            '          </div>\n'
        )
        idx = t.find('name="availableDate"')
        ds = t.rfind('<div>', 0, idx)
        if ds > 0:
            t = t[:ds] + ui + t[ds:]
    p.write_text(t, encoding="utf-8")
    changed.append("86")

p = Path("frontend/src/lib/public-api.ts")
t = p.read_text(encoding="utf-8")
if "maxDuration" not in t:
    t = t.replace("minDuration?: number;", "minDuration?: number;\n  maxDuration?: number;", 1)
    t = t.replace(
        "if (params.minDuration != null) sp.set('minDuration', String(params.minDuration));",
        "if (params.minDuration != null) sp.set('minDuration', String(params.minDuration));\n"
        "  if (params.maxDuration != null) sp.set('maxDuration', String(params.maxDuration));",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("86-api")

p = Path("backend/src/professionals/professionals.service.ts")
t = p.read_text(encoding="utf-8")
if "maxDuration" not in t and "minDuration" in t:
    t = t.replace("minDuration?: number;", "minDuration?: number;\n    maxDuration?: number;", 1)
    if "svcSome.durationMin = { gte: params.minDuration };" in t:
        t = t.replace(
            "svcSome.durationMin = { gte: params.minDuration };",
            "svcSome.durationMin = {\n"
            "          ...(params.minDuration != null ? { gte: params.minDuration } : {}),\n"
            "          ...(params.maxDuration != null ? { lte: params.maxDuration } : {}),\n"
            "        };",
            1,
        )
    t = t.replace(
        "const hasDuration = params.minDuration != null && Number.isFinite(params.minDuration) && params.minDuration > 0;",
        "const hasDuration = (params.minDuration != null && Number.isFinite(params.minDuration) && params.minDuration > 0)\n"
        "      || (params.maxDuration != null && Number.isFinite(params.maxDuration) && params.maxDuration > 0);",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("86-be")

for ctrl_path in [
    "backend/src/professionals/professionals.controller.ts",
    "backend/src/service-filters/service-filters.controller.ts",
]:
    p = Path(ctrl_path)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    if "minDuration" in t and "maxDuration" not in t:
        t = t.replace(
            "@Query('minDuration') minDuration?: string,",
            "@Query('minDuration') minDuration?: string,\n    @Query('maxDuration') maxDuration?: string,",
            1,
        )
        t = t.replace(
            "minDuration: minDuration ? parseInt(minDuration, 10) : undefined,",
            "minDuration: minDuration ? parseInt(minDuration, 10) : undefined,\n"
            "      maxDuration: maxDuration ? parseInt(maxDuration, 10) : undefined,",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("86-" + p.name)

p = Path("frontend/src/components/professionals/professional-card.tsx")
t = p.read_text(encoding="utf-8")
if "جدید" not in t:
    m = re.search(r"\{pro\.isFeatured && \([\s\S]*?\)\}\n", t)
    if m:
        badge = (
            "              {(() => {\n"
            "                const created = (pro as { createdAt?: string | null }).createdAt\n"
            "                  || (pro as { verifiedAt?: string | null }).verifiedAt;\n"
            "                if (!created) return null;\n"
            "                const days = (Date.now() - new Date(created).getTime()) / 86400000;\n"
            "                if (days < 0 || days > 21) return null;\n"
            "                return (\n"
            "                  <span className=\"rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:text-xs\">\n"
            "                    جدید\n"
            "                  </span>\n"
            "                );\n"
            "              })()}\n"
        )
        t = t[: m.end()] + badge + t[m.end() :]
        p.write_text(t, encoding="utf-8")
        changed.append("87")
    else:
        print("87 miss")

changed.append("88-ok")

p = Path("frontend/src/components/booking/booking-wizard.tsx")
t = p.read_text(encoding="utf-8")
if "نوبت خالی نیست" not in t:
    old = '<p className="text-sm text-gray">ساعت آزادی برای این روز نیست.</p>'
    if old in t:
        new = (
            '<div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">\n'
            '                <p className="font-medium">در این تاریخ نوبت خالی نیست</p>\n'
            '                <p className="text-xs">تاریخ دیگری انتخاب کنید یا روز بعد را امتحان کنید.</p>\n'
            '                <button type="button" className="text-xs font-medium text-coral underline" onClick={() => {\n'
            '                  if (!date) return;\n'
            '                  const d = new Date(date + "T12:00:00");\n'
            '                  d.setDate(d.getDate() + 1);\n'
            '                  setDate(d.toISOString().slice(0, 10));\n'
            '                  setSlotStart("");\n'
            '                }}>امتحان روز بعد</button>\n'
            '              </div>'
        )
        t = t.replace(old, new, 1)
        p.write_text(t, encoding="utf-8")
        changed.append("89")
    else:
        print("89 miss")

p = Path("frontend/src/components/search/near-me-fields.tsx")
t = p.read_text(encoding="utf-8")
if "bj_saved_geo" not in t:
    t = t.replace(
        "useEffect(() => {\n    setLat(defaultLat || '');\n    setLng(defaultLng || '');\n  }, [defaultLat, defaultLng]);",
        "useEffect(() => {\n    setLat(defaultLat || '');\n    setLng(defaultLng || '');\n  }, [defaultLat, defaultLng]);\n\n"
        "  useEffect(() => {\n"
        "    if (defaultLat || defaultLng) return;\n"
        "    try {\n"
        "      const raw = localStorage.getItem('bj_saved_geo');\n"
        "      if (!raw) return;\n"
        "      const parsed = JSON.parse(raw) as { lat?: string; lng?: string; ts?: number };\n"
        "      if (!parsed.lat || !parsed.lng) return;\n"
        "      if (parsed.ts && Date.now() - parsed.ts > 30 * 86400000) {\n"
        "        localStorage.removeItem('bj_saved_geo');\n"
        "        return;\n"
        "      }\n"
        "      setLat(parsed.lat);\n"
        "      setLng(parsed.lng);\n"
        "      setStatus('موقعیت ذخیره‌شده بارگذاری شد');\n"
        "    } catch { /* ignore */ }\n"
        "  }, [defaultLat, defaultLng]);",
        1,
    )
    t = t.replace(
        "setLat(la);\n        setLng(ln);\n        setStatus('موقعیت دریافت شد. در حال اعمال فیلتر نزدیک‌ترین…');",
        "setLat(la);\n"
        "        setLng(ln);\n"
        "        try {\n"
        "          if (window.confirm('موقعیت شما برای دفعات بعد ذخیره شود؟')) {\n"
        "            localStorage.setItem('bj_saved_geo', JSON.stringify({ lat: la, lng: ln, ts: Date.now() }));\n"
        "          }\n"
        "        } catch { /* ignore */ }\n"
        "        setStatus('موقعیت دریافت شد. در حال اعمال فیلتر نزدیک‌ترین…');",
        1,
    )
    t = t.replace(
        "function clearGeo() {\n    setLat('');\n    setLng('');\n    setStatus(null);\n  }",
        "function clearGeo() {\n"
        "    setLat('');\n"
        "    setLng('');\n"
        "    setStatus(null);\n"
        "    try { localStorage.removeItem('bj_saved_geo'); } catch { /* ignore */ }\n"
        "  }",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("90")

print("CHANGED", changed)
