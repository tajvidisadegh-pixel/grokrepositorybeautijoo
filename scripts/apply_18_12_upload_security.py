#!/usr/bin/env python3
"""Wire upload-security into media.controller + media.service."""
from pathlib import Path
import re

# --- controller: fileSize limit ---
ctrl = Path('backend/src/media/media.controller.ts')
c = ctrl.read_text()
if 'uploadMaxBytes' not in c:
    if "from './media.service';" in c:
        c = c.replace(
            "from './media.service';",
            "from './media.service';\nimport { uploadMaxBytes } from './upload-security';",
            1,
        )
    else:
        raise SystemExit('controller import media.service not found')

if 'fileSize: Number.MAX_SAFE_INTEGER' in c:
    c = c.replace(
        'limits: { fileSize: Number.MAX_SAFE_INTEGER },',
        'limits: { fileSize: uploadMaxBytes(), files: 1 },',
        1,
    )
    print('controller limits patched')
elif 'uploadMaxBytes()' in c:
    print('controller limits already ok')
else:
    raise SystemExit('limits line not found')

ctrl.write_text(c)
print('controller', len(c))

# --- service: size + suspicious + portfolio cap ---
svc = Path('backend/src/media/media.service.ts')
s = svc.read_text()
if 'PLACEHOLDER' in s and len(s) < 200:
    raise SystemExit('service PLACEHOLDER')

if "from './upload-security'" not in s:
    if "from './image-sniff';" in s:
        s = s.replace(
            "from './image-sniff';",
            "from './image-sniff';\n"
            "import {\n"
            "  assertNotSuspicious,\n"
            "  assertUploadSize,\n"
            "  uploadMaxPortfolio,\n"
            "} from './upload-security';",
            1,
        )
    else:
        raise SystemExit('image-sniff import not found')

# inject checks after reading raw
needle = '''      const raw = await this.readFileBytes(file);
      if (!raw.length) {
        throw new BadRequestException('فایل خالی است');
      }

      const processed = await this.processImage(raw);'''

insert = '''      const raw = await this.readFileBytes(file);
      if (!raw.length) {
        throw new BadRequestException('فایل خالی است');
      }

      assertUploadSize(raw.length);
      assertNotSuspicious(raw);

      const processed = await this.processImage(raw);'''

if 'assertUploadSize(raw.length)' in s:
    print('service size checks already present')
elif needle in s:
    s = s.replace(needle, insert, 1)
    print('service size+suspicious injected')
else:
    raise SystemExit('upload raw block not found')

# portfolio count cap before create — after pro resolved and before replaceOldAssets
cap_needle = '''      await this.replaceOldAssets(pro.id, kind);

      const key = `professionals/${pro.id}/${kind}/'''

cap_insert = '''      if (kind === MediaKind.portfolio) {
        const count = await this.prisma.mediaAsset.count({
          where: { professionalId: pro.id, kind: MediaKind.portfolio },
        });
        if (count >= uploadMaxPortfolio()) {
          throw new BadRequestException(
            `تعداد تصاویر نمونه کار به سقف مجاز (${uploadMaxPortfolio()}) رسیده است`,
          );
        }
      }

      await this.replaceOldAssets(pro.id, kind);

      const key = `professionals/${pro.id}/${kind}/'''

if 'uploadMaxPortfolio()' in s and 'MediaKind.portfolio' in s and 'count >=' in s:
    print('portfolio cap already present')
elif cap_needle in s:
    s = s.replace(cap_needle, cap_insert, 1)
    print('portfolio cap injected')
else:
    # softer match
    if 'await this.replaceOldAssets(pro.id, kind);' in s and 'uploadMaxPortfolio()' not in s:
        s = s.replace(
            '      await this.replaceOldAssets(pro.id, kind);\n',
            '''      if (kind === MediaKind.portfolio) {
        const count = await this.prisma.mediaAsset.count({
          where: { professionalId: pro.id, kind: MediaKind.portfolio },
        });
        if (count >= uploadMaxPortfolio()) {
          throw new BadRequestException(
            `تعداد تصاویر نمونه کار به سقف مجاز (${uploadMaxPortfolio()}) رسیده است`,
          );
        }
      }

      await this.replaceOldAssets(pro.id, kind);
''',
            1,
        )
        print('portfolio cap injected soft')
    else:
        print('WARN portfolio cap skip')

svc.write_text(s)
print('service', len(s))
