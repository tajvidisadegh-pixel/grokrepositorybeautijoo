#!/usr/bin/env python3
"""Minimal fix: AdminService CMS uploads via STORAGE_PROVIDER (S3/local)."""
from pathlib import Path

p = Path('backend/src/admin/admin.service.ts')
text = p.read_text()

# --- imports ---
old_imports = """import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaStatus,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';"""

new_imports = """import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaStatus,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider';"""

if old_imports in text:
    text = text.replace(old_imports, new_imports, 1)
elif 'STORAGE_PROVIDER' not in text:
    # already partially patched or different formatting
    if 'Inject' not in text.split('from \'@nestjs/common\'')[0]:
        text = text.replace(
            "  BadRequestException,\n} from '@nestjs/common';",
            "  Inject,\n  BadRequestException,\n} from '@nestjs/common';",
            1,
        )
    if "from '../storage/storage.provider'" not in text:
        text = text.replace(
            "import * as fs from 'fs';\nimport * as path from 'path';",
            "import * as fs from 'fs';\nimport {\n  STORAGE_PROVIDER,\n  type StorageProvider,\n} from '../storage/storage.provider';",
            1,
        )
        text = text.replace("import * as path from 'path';\n", '')

# --- constructor ---
if 'STORAGE_PROVIDER' not in text.split('constructor')[1][:300]:
    text = text.replace(
        '  constructor(private readonly prisma: PrismaService) {}',
        '''  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}''',
        1,
    )

# --- replace uploadSiteCmsImage and any trailing garbage through class end ---
start = text.find('  async uploadSiteCmsImage(')
if start < 0:
    raise SystemExit('uploadSiteCmsImage not found')

new_method = '''  async uploadSiteCmsImage(
    file: {
      buffer?: Buffer;
      path?: string;
      mimetype: string;
      originalname: string;
      size: number;
    },
    slot?: string,
    actorId?: string,
  ) {
    if (!file) throw new BadRequestException('فایل ارسال نشده است');
    let buffer: Buffer;
    if (file.buffer?.length) {
      buffer = file.buffer;
    } else if (file.path) {
      buffer = fs.readFileSync(file.path);
    } else {
      throw new BadRequestException('فایل خالی است');
    }
    const safeName = (file.originalname || 'img').replace(/[^\\w.\\-]+/g, '_').slice(0, 80);
    const ext = (safeName.split('.').pop() || 'jpg').toLowerCase();
    const key = `cms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const mime = file.mimetype || 'application/octet-stream';
    let storageKey: string;
    try {
      storageKey = await this.storage.upload(key, buffer, mime);
    } catch (e) {
      this.logger.warn(`CMS upload via storage provider failed: ${(e as Error)?.message || e}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود. تنظیمات ذخیره‌سازی را بررسی کنید.');
    }
    const url = this.storage.getPublicUrl(storageKey);
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', storageKey, null, {
      url,
      slot: slot || 'generic',
      size: file.size,
    });
    return {
      url,
      key: storageKey,
      slot: slot || 'generic',
      mimeType: mime,
      size: file.size,
    };
  }
}
'''

text = text[:start] + new_method
p.write_text(text)

assert 'this.storage.upload' in text
assert 'fs.writeFileSync' not in text
assert text.count('async uploadSiteCmsImage') == 1
assert text.count('{') == text.count('}')
print('OK braces', text.count('{'))
print('DONE')
