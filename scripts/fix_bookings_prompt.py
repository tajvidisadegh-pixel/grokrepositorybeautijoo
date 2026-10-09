from pathlib import Path
import re
p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text(encoding='utf-8')
t2 = re.sub(
    r"const preset = window\.prompt\(\s*'دلیل رد \(اختیاری\):[\s\S]*?',\s*'1',\s*\);",
    "const preset = window.prompt(\n          'دلیل رد (اختیاری): 1) پر بودن  2) مرخصی  3) خارج از تخصص  4) سایر',\n          '1',\n        );",
    t,
    count=1,
)
p.write_text(t2, encoding='utf-8')
print('ok', t2 != t)
