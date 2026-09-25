from pathlib import Path
import re

p = Path('frontend/src/app/zibagar/services/SpecialtyView.tsx')
t = p.read_text()
orig = t

t = t.replace(
    "      )}\n        </div>\n      )}\n\n      {rootDirectChildren.length > 0 && (",
    "      )}\n\n      {rootDirectChildren.length > 0 && (",
)

t2, n = re.subn(
    r'          <div className="flex flex-wrap gap-2 pt-1">[\s\S]*?          </div>\n        </div>\n      \)\}\n',
    "          {verticalItems.length === 0 && currentLeafServices.length === 0 && (\n"
    "            <p className=\"rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900\">\n"
    "              No catalog children at this level.\n"
    "            </p>\n"
    "          )}\n"
    "        </div>\n"
    "      )}\n",
    t,
    count=1,
)
print('free-text block removed:', n)
t = t2

for line in [
    "  const [showAddFeature, setShowAddFeature] = useState(false);\n",
    "  const [newFeatureName, setNewFeatureName] = useState('');\n",
    "  const [showAddFinal, setShowAddFinal] = useState(false);\n",
    "  const [newFinalName, setNewFinalName] = useState('');\n",
    "  const [newFinalPrice, setNewFinalPrice] = useState(0);\n",
    "  const [newFinalDuration, setNewFinalDuration] = useState(60);\n",
]:
    t = t.replace(line, '')

t = t.replace('    createAndEditCustomService,\n    createFeature,\n', '')

body_tail = t.split("from '@/lib/utils';", 1)[-1] if "from '@/lib/utils';" in t else t
if 'formatPriceDigits' not in body_tail and 'parsePriceInput' not in body_tail:
    t = t.replace(
        "import { formatPrice, formatPriceDigits, parsePriceInput } from '@/lib/utils';",
        "import { formatPrice } from '@/lib/utils';",
    )

t = t.replace(
    "  createAndEditCustomService: (\n"
    "    name: string,\n"
    "    initial?: { price?: number; durationMin?: number },\n"
    "  ) => void | Promise<void>;\n"
    "  createFeature: (name: string) => void | Promise<void>;\n"
    "};",
    "  createAndEditCustomService?: (\n"
    "    name: string,\n"
    "    initial?: { price?: number; durationMin?: number },\n"
    "  ) => void | Promise<void>;\n"
    "  createFeature?: (name: string) => void | Promise<void>;\n"
    "};",
)

t = t.replace(
    "              No catalog children at this level.\n",
    "              زیرمجموعه‌ای در این سطح از کاتالوگ نیست. از پنل سوپرادمین خدمات یا زیردسته اضافه کنید.\n",
)

if t == orig:
    print('WARNING: no changes')
else:
    p.write_text(t)
    print('wrote', len(t.splitlines()), 'lines')

text = p.read_text()
assert '        </div>\n      )}\n\n      {rootDirectChildren' not in text
assert 'افزودن ویژگی' not in text
print('sanity ok')

for wf in [
    '.github/workflows/fix-issue29-hours-import.yml',
    '.github/workflows/fix-i30-sv.yml',
    '.github/workflows/apply-issue30.yml',
    '.github/workflows/apply-i30-select.yml',
    '.github/workflows/fix-sv-ci.yml',
    'scripts/i30_sv_a.b64',
    'scripts/i30_sv_b.b64',
    'scripts/i30_p0.txt',
]:
    path = Path(wf)
    if path.exists():
        path.unlink()
        print('removed', wf)
