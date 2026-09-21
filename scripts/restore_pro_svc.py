#!/usr/bin/env python3
# Restores professionals.service.ts from scripts/z0..z3.b64 (zlib+base64)
import base64, zlib, pathlib, sys
parts = [pathlib.Path(f"scripts/z{i}.b64").read_text().strip() for i in range(4)]
data = zlib.decompress(base64.b64decode("".join(parts)))
out = pathlib.Path("backend/src/professionals/professionals.service.ts")
out.write_bytes(data)
text = data.decode()
assert "minRating" in text, "missing minRating"
assert "availableDate" in text, "missing availableDate"
assert "getEarnings" in text, "missing getEarnings"
assert "requestPayout" in text, "missing requestPayout"
assert "PLACEHOLDER" not in text, "still PLACEHOLDER"
print("OK", len(data), "bytes")
sys.exit(0)
