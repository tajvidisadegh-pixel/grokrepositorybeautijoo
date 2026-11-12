from pathlib import Path

ab = Path("frontend/src/app/admin/bookings/page.tsx")
at = ab.read_text()
if "const [selected, setSelected]" not in at:
    at = at.replace(
        "  const [reason, setReason] = useState('');\n",
        "  const [reason, setReason] = useState('');\n  const [selected, setSelected] = useState<Set<string>>(new Set());\n",
    )
if "city?: string" not in at:
    at = at.replace(
        "    slug?: string;\n    title?: string | null;",
        "    slug?: string;\n    title?: string | null;\n    city?: string | null;",
    )
if "selected.has(b.id)" not in at:
    old_h = '<th className="p-3">کد</th>\n                <th className="p-3">کاربر</th>\n                <th className="p-3">زیباگر</th>\n                <th className="p-3">زمان</th>'
    new_h = '<th className="p-3"><input type="checkbox" aria-label="all" onChange={() => setSelected((prev) => prev.size === items.length && items.length ? new Set() : new Set(items.map((b) => b.id)))} checked={selected.size === items.length && items.length > 0} /></th>\n                <th className="p-3">کد</th>\n                <th className="p-3">کاربر</th>\n                <th className="p-3">زیباگر</th>\n                <th className="p-3">شهر</th>\n                <th className="p-3">زمان</th>'
    if old_h in at:
        at = at.replace(old_h, new_h, 1)
        print("head")
    old_r = '<tr key={b.id} className="cursor-pointer border-t hover:bg-gray-light/30" onClick={() => openDetail(b.id)}>\n                  <td className="p-3 font-mono text-xs" dir="ltr">#{b.id.slice(0, 8)}</td>\n                  <td className="p-3">{b.customer?.profile?.displayName || b.customer?.phone || \'—\'}</td>\n                  <td className="p-3">{b.professional?.user?.profile?.displayName || b.professional?.title || \'—\'}</td>\n                  <td className="p-3">{formatDate(b.startAt, { style: \'short\', includeTime: true })}</td>'
    new_r = '<tr key={b.id} className="cursor-pointer border-t hover:bg-gray-light/30" onClick={() => openDetail(b.id)}>\n                  <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(b.id)} onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })} /></td>\n                  <td className="p-3 font-mono text-xs" dir="ltr">#{b.id.slice(0, 8)}</td>\n                  <td className="p-3">{b.customer?.profile?.displayName || b.customer?.phone || \'—\'}</td>\n                  <td className="p-3">{b.professional?.user?.profile?.displayName || b.professional?.title || \'—\'}</td>\n                  <td className="p-3">{b.professional?.city || \'—\'}</td>\n                  <td className="p-3">{formatDate(b.startAt, { style: \'short\', includeTime: true })}</td>'
    if old_r in at:
        at = at.replace(old_r, new_r, 1)
        print("row")
    else:
        print("row pattern miss")
ab.write_text(at)

cf = Path("frontend/src/app/booking/confirmation/[id]/page.tsx")
ct = cf.read_text()
ct = ct.replace(">تأیید رزرو<", ">رزرو شما ثبت شد<", 1)
if "پرداخت به صورت حضوری" not in ct:
    needle = "{payOk && ("
    insert = """{!payOk && !payFail && (booking.status === 'confirmed' || booking.status === 'pending') && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-bold">رزرو شما ثبت شد</p>
          <p className="mt-1 text-xs">پرداخت به صورت حضوری انجام می‌شود.</p>
        </div>
      )}
      {payOk && ("""
    if needle in ct:
        ct = ct.replace(needle, insert, 1)
ct = ct.replace(
    "{paymentSucceeded && (proPhone || proAddress || proSlug) && (",
    "{(paymentSucceeded || booking.status === 'pending' || booking.status === 'confirmed') && (proPhone || proAddress || proSlug) && (",
    1,
)
cf.write_text(ct)
print("confirm")

pb = Path("frontend/src/app/panel/bookings/page.tsx")
pt = pb.read_text()
pt = pt.replace(
    "setReportMsg('گزارش برای پشتیبانی ارسال شد.');",
    "setReportMsg('گزارش شما ارسال شد و به‌زودی بررسی خواهد شد.');",
)
pb.write_text(pt)
print("panel")

for path in ["frontend/src/app/login/page.tsx", "frontend/src/app/register/page.tsx", "frontend/src/app/otp/page.tsx"]:
    fp = Path(path)
    if not fp.exists():
        continue
    txt = fp.read_text()
    if "نوبت‌گیر" in txt:
        fp.write_text(txt.replace("نوبت‌گیر", "حساب کاربری"))
        print("wording", path)
print("done frontend")
