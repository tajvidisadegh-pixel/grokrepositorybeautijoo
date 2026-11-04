#!/usr/bin/env python3
"""#68.4 OTP limits + #69 login role labels."""
from pathlib import Path


def patch_auth_service() -> None:
    path = Path('backend/src/auth/auth.service.ts')
    t = path.read_text()
    # Raise defaults: 100 / 10 minutes window semantics via hourly 100 + daily 100
    t2 = t
    t2 = t2.replace(
        "const maxPerHour = this.config.get<number>('otpMaxPerHour') || 5;",
        "const maxPerHour = this.config.get<number>('otpMaxPerHour') || 100;",
    )
    t2 = t2.replace(
        "const maxPerDay = this.config.get<number>('otpMaxPerDay') || 10;",
        "const maxPerDay = this.config.get<number>('otpMaxPerDay') || 100;",
    )
    # Friendlier messages aligned with 10-minute recovery after burst
    t2 = t2.replace(
        "throw new BadRequestException('تعداد درخواست کد در این ساعت بیش از حد مجاز است');",
        "throw new BadRequestException('تعداد درخواست کد بیش از حد مجاز است. حدود ۱۰ دقیقه دیگر دوباره تلاش کنید');",
    )
    t2 = t2.replace(
        "throw new BadRequestException('تعداد درخواست کد در امروز بیش از حد مجاز است');",
        "throw new BadRequestException('سقف روزانه درخواست کد پر شده است. فردا دوباره تلاش کنید');",
    )
    if t2 == t:
        print('auth.service: no change or already patched')
    else:
        path.write_text(t2)
        print('auth.service patched')


def patch_login_labels() -> None:
    path = Path('frontend/src/app/login/page.tsx')
    t = path.read_text()
    # Align with register wording (#69)
    if 'می‌خواهم نوبت بگیرم' in t:
        print('login labels already friendly')
        return
    t = t.replace('>نوبت می‌گیرم<', '>می‌خواهم نوبت بگیرم<', 1)
    t = t.replace('>زیباگر هستم<', '>زیباگر هستم / نوبت می‌دهم<', 1)
    path.write_text(t)
    print('login labels patched')


def patch_register_hint() -> None:
    path = Path('frontend/src/app/register/page.tsx')
    t = path.read_text()
    if 'بعداً می‌توانید فقط با همین شماره وارد شوید' in t:
        print('register hint exists')
        return
    # Insert after role toggle block if possible
    needle = 'زیباگر هستم و نوبت می‌دهم'
    idx = t.find(needle)
    if idx < 0:
        print('register role button not found')
        return
    # after closing of role buttons section - find next form or phone field
    # insert a helper paragraph after role selection container
    marker = "زیباگر هستم و نوبت می‌دهم\n                </button>\n              </div>"
    if marker in t:
        t = t.replace(
            marker,
            marker
            + "\n              <p className=\"mt-2 text-center text-xs text-gray\">"
            + "بعداً می‌توانید فقط با همین شماره وارد شوید؛ نوع حساب را اینجا مشخص کنید."
            + "</p>",
            1,
        )
        path.write_text(t)
        print('register hint added')
    else:
        print('register marker not exact; skip hint')


if __name__ == '__main__':
    patch_auth_service()
    patch_login_labels()
    patch_register_hint()
