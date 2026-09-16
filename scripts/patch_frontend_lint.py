#!/usr/bin/env python3
from pathlib import Path
import re

cp = Path("frontend/src/app/zibagar/profile/complete/page.tsx")
ct = cp.read_text()

ct = ct.replace("  setMySelectedCategories,\n  createCategoryNode,\n", "  setMySelectedCategories,\n")
ct = ct.replace("createCategoryNode,\n  ", "")
ct = ct.replace("createCategoryNode, ", "")

ct = ct.replace("const FEATURED_ROOT_NAMES = ['پوست', 'مو', 'ناخن', 'میکاپ', 'مردانه'];\n\n", "")
ct = ct.replace("  const [specialtyMoreOpen, setSpecialtyMoreOpen] = useState(false);\n", "")

# mapSelected -> discard first element
ct = ct.replace(
    "const [mapSelected, setMapSelected] = useState(false);",
    "const [, setMapSelected] = useState(false);",
)

def strip_useMemo(src: str, name: str) -> str:
    lines = src.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        if f"const {name} = useMemo" in lines[i]:
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count("(") - lines[j].count(")")
                depth += lines[j].count("{") - lines[j].count("}")
                j += 1
                if j > i and depth <= 0:
                    break
            i = j
            continue
        out.append(lines[i])
        i += 1
    return "".join(out)

ct = strip_useMemo(ct, "featuredRootCategories")
ct = strip_useMemo(ct, "specialtySearchResults")
cp.write_text(ct)
print("complete ok")

sp = Path("frontend/src/app/zibagar/services/page.tsx")
st = sp.read_text()
for name in ["deactivateMyAddOn,", "resolveMediaUrl,", "deleteMyPriceRule,", "deleteMyDurationRule,"]:
    st = st.replace(f"  {name}\n", "")
st = st.replace("  type ServiceAddOnItem,\n", "")
st = st.replace("import { Button } from '@/components/ui/button';\n", "")
st = st.replace(", priceToWords", "")
st = st.replace("priceToWords, ", "")
st = st.replace("  FEATURED_ROOT_NAMES,\n", "")
sp.write_text(st)
print("services ok")
print("DONE")
