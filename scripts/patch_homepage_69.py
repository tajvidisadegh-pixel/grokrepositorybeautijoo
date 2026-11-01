#!/usr/bin/env python3
"""Apply #69/#70 homepage UX polish on top of a dual-path-free page.tsx.

Note: chips under hero must be wrapped in a single parent (fragment/div)
with the search form to satisfy JSX typecheck.
"""
from pathlib import Path

PAGE = Path("frontend/src/app/page.tsx")
REG = Path("frontend/src/app/register/page.tsx")

def main():
    t = PAGE.read_text()
    reps = [
        ("title: 'بیوتی‌جو، رزرو آنلاین نوبت'", "title: 'نوبت زیبایی، راحت‌تر از همیشه'"),
        ("subtitle: 'آسان و سریع'", "subtitle: 'زیباگر خوب نزدیک خودت را پیدا کن'"),
        (
            "description: 'زیباگر مناسب خود را پیدا کنید — آرایش، ناخن، پوست و بیشتر، نزدیک شما'",
            "description: 'جستجو کن، زمان آزاد ببین و آنلاین رزرو کن — بدون تماس و رفت‌وآمد اضافه.'",
        ),
        ("searchPlaceholder: 'جستجوی خدمت یا زیباگر...'", "searchPlaceholder: 'کوتاهی مو، ناخن، رنگ، نام زیباگر…'"),
        ("categoriesTitle: 'دسته‌بندی‌های محبوب'", "categoriesTitle: 'چه خدمتی می‌خوای؟'"),
        ("featuredTitle: 'زیباگرهای برتر هفته'", "featuredTitle: 'زیباگرهایی که الان می‌تونی ببینی'"),
        ("ctaTitle: 'آماده رزرو هستید؟'", "ctaTitle: 'اگر آماده‌ای، از اینجا شروع کن'"),
        (
            "ctaDescription: 'زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.'",
            "ctaDescription: 'جستجو کن، زیباگر را انتخاب کن و نوبت بگیر.'",
        ),
        (
            "['hero', 'near-me-strip', 'categories', 'featured', 'cta']",
            "['hero', 'near-me-strip', 'categories', 'featured', 'trust', 'cta']",
        ),
        (
            "const ordered = sections.filter((s) => s.enabled !== false).map((s) => s.id);",
            "const ordered = sections.filter((s) => s.enabled !== false && s.id !== 'dual-path').map((s) => s.id);",
        ),
        (
            "در حال حاضر امکان بارگذاری لیست زیباگران نیست. بعداً تلاش کنید.",
            "الان لیست را نیاوردیم. از جستجو ادامه بده.",
        ),
        (
            "هنوز زیباگر تأییدشده‌ای ثبت نشده است.",
            "هنوز کسی اینجا نیست — از جستجو شروع کن.",
        ),
    ]
    for a, b in reps:
        t = t.replace(a, b)

    if "case 'trust':" not in t:
        trust = (
            "\n      case 'trust':\n"
            "        return (\n"
            "          <section key=\"trust\" className=\"mx-auto max-w-6xl px-4 py-10 sm:py-12\">\n"
            "            <div className=\"grid grid-cols-1 gap-3 sm:grid-cols-3\">\n"
            "              <div className=\"rounded-2xl border border-border/70 bg-white px-4 py-4\">\n"
            "                <p className=\"text-sm font-bold text-foreground\">رزرو آنلاین سریع</p>\n"
            "                <p className=\"mt-0.5 text-xs text-gray\">زمان آزاد را ببین و همان‌جا نوبت بگیر</p>\n"
            "              </div>\n"
            "              <div className=\"rounded-2xl border border-border/70 bg-white px-4 py-4\">\n"
            "                <p className=\"text-sm font-bold text-foreground\">زیباگرهای واقعی</p>\n"
            "                <p className=\"mt-0.5 text-xs text-gray\">پروفایل و نظرات قابل مشاهده</p>\n"
            "              </div>\n"
            "              <div className=\"rounded-2xl border border-border/70 bg-white px-4 py-4\">\n"
            "                <p className=\"text-sm font-bold text-foreground\">پشتیبانی وقتی لازم شد</p>\n"
            "                <p className=\"mt-0.5 text-xs text-gray\">اگر مشکلی پیش آمد، کنار شماییم</p>\n"
            "              </div>\n"
            "            </div>\n"
            "          </section>\n"
            "        );\n"
        )
        trust = trust.replace('\\"', '"')
        t = t.replace("case 'cta':", trust + "\n      case 'cta':", 1)

    if 'search?q=%DA%A9%D9%88%D8%AA%D8%A7%D9%87%DB%8C' not in t:
        chips = (
            '\n                    <div className="mt-3 flex flex-wrap justify-center gap-2">'
            '\n                      <Link href="/search?q=%DA%A9%D9%88%D8%AA%D8%A7%D9%87%DB%8C+%D9%85%D9%88" className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:border-coral/40 hover:bg-coral-soft/60">کوتاهی مو</Link>'
            '\n                      <Link href="/search?q=%D9%86%D8%A7%D8%AE%D9%86" className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:border-coral/40 hover:bg-coral-soft/60">ناخن</Link>'
            '\n                      <Link href="/search?q=%D8%A7%D8%A8%D8%B1%D9%88" className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:border-coral/40 hover:bg-coral-soft/60">ابرو</Link>'
            '\n                      <Link href="/search?sort=distance" className="rounded-full border border-coral/40 bg-coral-soft/50 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral-soft">نزدیک من</Link>'
            '\n                    </div>'
        )
        marker = "case 'near-me-strip'"
        pos = t.find(marker)
        if pos > 0:
            idx2 = t.rfind("</form>", 0, pos)
            if idx2 > 0:
                t = t[: idx2 + 7] + chips + t[idx2 + 7 :]

    PAGE.write_text(t)
    print("page", PAGE.stat().st_size, "chips", 'search?q=%DA%A9' in t, "trust", "case 'trust':" in t)

    if REG.exists():
        rt = REG.read_text()
        if "می‌خواهم نوبت بگیرم" not in rt:
            rt = rt.replace("\n                  مشتری\n", "\n                  می‌خواهم نوبت بگیرم\n")
            rt = rt.replace("\n                  زیباگر\n", "\n                  زیباگر هستم و نوبت می‌دهم\n")
            REG.write_text(rt)
            print("register updated")
        else:
            print("register already ok")

if __name__ == "__main__":
    main()
