#!/usr/bin/env python3
"""Apply advanced search method patches for issue #7."""
import base64, re, pathlib, sys

root = pathlib.Path(__file__).resolve().parents[1]
pro = root / "backend/src/professionals/professionals.service.ts"
sf = root / "backend/src/service-filters/service-filters.service.ts"
scripts = root / "scripts"

def load_b64(prefix):
    parts = sorted(scripts.glob(f"{prefix}.p*.b64"))
    if not parts:
        raise SystemExit(f"missing {prefix} parts")
    data = "".join(p.read_text().strip() for p in parts)
    return base64.b64decode(data).decode()

# --- professionals.service.ts ---
pro_text = pro.read_text()
new_search = load_b64("patch_search")
# Replace from "  async search(" through just before "  async findBySlug"
pat = re.compile(r"  async search\(params:[\s\S]*?(?=  async findBySlug)")
if not pat.search(pro_text):
    raise SystemExit("search method not found in professionals.service.ts")
pro_text2 = pat.sub(new_search, pro_text, count=1)
if "minRating" not in pro_text2 or "availableDate" not in pro_text2:
    raise SystemExit("patch did not introduce minRating/availableDate")
pro.write_text(pro_text2)
print("patched", pro, "bytes", pro.stat().st_size)

# --- service-filters.service.ts ---
sf_text = sf.read_text()
new_sf = load_b64("patch_sf_search")
pat2 = re.compile(r"  async searchProfessionalsByFilter\([\s\S]*?(?=\n\}\n?\Z)")
if not pat2.search(sf_text):
    # try without trailing
    pat2 = re.compile(r"  async searchProfessionalsByFilter\([\s\S]*\n\}")
m = pat2.search(sf_text)
if not m:
    raise SystemExit("searchProfessionalsByFilter not found")
# replace only the method, keep final class brace
sf_text2 = sf_text[:m.start()] + new_sf.rstrip() + "\n}\n"
if "minRating" not in sf_text2:
    raise SystemExit("sf patch missing minRating")
sf.write_text(sf_text2)
print("patched", sf, "bytes", sf.stat().st_size)
print("OK")
