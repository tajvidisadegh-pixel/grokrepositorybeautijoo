#!/usr/bin/env python3
from pathlib import Path


def main() -> None:
    # Backend: replace entire blockCustomer / unblockCustomer bodies
    path = Path('backend/src/professionals/professionals.service.ts')
    t = path.read_text()

    import re

    t, n1 = re.subn(
        r"async blockCustomer\([\s\S]*?\n  async unblockCustomer",
        "async blockCustomer(_userId: string, _customerId: string) {\n"
        "    // #72 — professionals cannot block customers\n"
        "    throw new BadRequestException(\n"
        "      'مسدود کردن کاربر توسط زیباگر مجاز نیست. در صورت مشکل از پشتیبانی تیکت ثبت کنید.',\n"
        "    );\n"
        "  }\n\n"
        "  async unblockCustomer",
        t,
        count=1,
    )
    t, n2 = re.subn(
        r"async unblockCustomer\([\s\S]*?\n  /\*\* #40 item 58",
        "async unblockCustomer(_userId: string, _customerId: string) {\n"
        "    // #72\n"
        "    throw new BadRequestException('رفع مسدودی از این مسیر در دسترس نیست');\n"
        "  }\n\n\n"
        "  /** #40 item 58",
        t,
        count=1,
    )
    print('block methods', n1, n2)

    # socialLinks public URL guard
    if 'ثبت لینک شبکه‌های اجتماعی' not in t:
        t = t.replace(
            'if (data.socialLinks !== undefined) {',
            "if (data.socialLinks !== undefined) {\n"
            "      // #72 — strip/reject public social URLs from pro updates\n"
            "      if (data.socialLinks && typeof data.socialLinks === 'object') {\n"
            "        const pub = data.socialLinks as Record<string, unknown>;\n"
            "        for (const k of ['instagram', 'telegram', 'website', 'phone', 'whatsapp'] as const) {\n"
            "          if (pub[k] != null && String(pub[k]).trim() !== '') {\n"
            "            throw new BadRequestException('ثبت لینک شبکه‌های اجتماعی در پروفایل زیباگر مجاز نیست');\n"
            "          }\n"
            "        }\n"
            "      }",
            1,
        )
        print('social guard added')

    path.write_text(t)

    # Frontend: remove block button and function
    fp = Path('frontend/src/app/zibagar/bookings/page.tsx')
    ft = fp.read_text()
    # remove function blockCustomer entirely
    ft2, nf = re.subn(
        r"\n  async function blockCustomer\([\s\S]*?\n  \}\n",
        "\n",
        ft,
        count=1,
    )
    print('removed blockCustomer fn', nf)
    # remove button containing مسدود کردن مشتری
    lines = ft2.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        if 'مسدود کردن مشتری' in lines[i] or (
            i + 3 < len(lines)
            and 'blockCustomer' in ''.join(lines[i : i + 6])
            and '<Button' in ''.join(lines[max(0, i - 5) : i + 1])
        ):
            # walk back to Button start
            j = i
            while j > 0 and '<Button' not in lines[j]:
                j -= 1
            k = i
            while k < len(lines) and '</Button>' not in lines[k]:
                k += 1
            i = k + 1
            continue
        out.append(lines[i])
        i += 1
    ft2 = ''.join(out)
    if 'blockCustomer' in ft2:
        print('WARN still has blockCustomer')
    fp.write_text(ft2)
    print('frontend', fp.stat().st_size)


if __name__ == '__main__':
    main()
