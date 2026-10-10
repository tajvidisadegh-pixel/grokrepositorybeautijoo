from pathlib import Path

# --- login expired banner ---
p = Path("frontend/src/app/login/page.tsx")
t = p.read_text(encoding="utf-8")
if "sessionExpired" not in t:
    needle = "const asParam = search?.get('as');"
    if needle in t:
        t = t.replace(
            needle,
            needle + "\n  const sessionExpired = search?.get('expired') === '1';",
            1,
        )
if "نشست شما منقضی شده است" not in t:
    needle = "<Card"
    if needle in t and "sessionExpired" in t:
        t = t.replace(
            needle,
            (
                "{sessionExpired && (\n"
                "        <div className=\"mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900\" role=\"status\">\n"
                "          نشست شما منقضی شده است. لطفاً دوباره وارد شوید.\n"
                "        </div>\n"
                "      )}\n"
                "      <Card"
            ),
            1,
        )
p.write_text(t, encoding="utf-8")
print("login", "sessionExpired" in t, "banner" in t or "نشست شما منقضی" in t)

# --- booking wizard lead note ---
p = Path("frontend/src/components/booking/booking-wizard.tsx")
t = p.read_text(encoding="utf-8")
marker = "حداقل چند ساعت قبل از نوبت"
if marker not in t:
    old = (
        '<Button className="w-full" disabled={!slotStart} onClick={goSummary}>\n'
        "            ادامه به خلاصه\n"
        "          </Button>"
    )
    new = (
        f'<p className="text-xs text-gray">{marker}؛ زمان‌های خیلی نزدیک قبول نمی‌شوند.</p>\n'
        "          <Button className=\"w-full\" disabled={!slotStart} onClick={goSummary}>\n"
        "            ادامه به خلاصه\n"
        "          </Button>"
    )
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t, encoding="utf-8")
        print("wizard ok")
    else:
        print("wizard anchor miss")
else:
    print("wizard exists")

# --- pro report spacing ---
p = Path("frontend/src/app/professionals/[slug]/page.tsx")
t = p.read_text(encoding="utf-8")
if "تخلف مشاهده کردید؟{}" in t:
    t = t.replace("تخلف مشاهده کردید؟{}", "تخلف مشاهده کردید؟{' '}")
    p.write_text(t, encoding="utf-8")
    print("report spacing fixed")
else:
    print("report spacing ok")
