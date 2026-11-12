#!/usr/bin/env python3
"""Unify password-reset OTP purpose to password_reset:<accountType>."""
from pathlib import Path
import sys

helpers = Path('backend/src/auth/password-reset.helpers.ts')
auth = Path('backend/src/auth/auth.service.ts')

if not helpers.is_file() or not auth.is_file():
    print('missing files')
    sys.exit(1)

h = helpers.read_text()
# forgot: purpose reset_password -> password_reset
h2 = h.replace(
    "purpose: 'reset_password'",
    "purpose: 'password_reset'",
)
h2 = h2.replace(
    "const purpose = `reset_password:${accountType}`;",
    "const purpose = `password_reset:${accountType}`;",
)
if h2 == h:
    print('helpers: no change or already fixed')
else:
    helpers.write_text(h2)
    print('helpers patched')

a = auth.read_text()
# allow both names for safety
old = """    const allowedPurposes = new Set([
      'login',
      'register',
      'password_reset',
      'change_phone',
      'delete_account',
    ]);"""
new = """    const allowedPurposes = new Set([
      'login',
      'register',
      'password_reset',
      'reset_password', // alias — normalized below
      'change_phone',
      'delete_account',
    ]);"""
if old in a and "'reset_password', // alias" not in a:
    a = a.replace(old, new, 1)
    print('auth whitelist patched')
else:
    print('auth whitelist skip')

# normalize purposeBase after whitelist check
needle = "    if (!allowedPurposes.has(purposeBase)) {\n      throw new BadRequestException('هدف درخواست کد نامعتبر است');\n    }"
insert = """    if (!allowedPurposes.has(purposeBase)) {
      throw new BadRequestException('هدف درخواست کد نامعتبر است');
    }
    // Unify legacy reset_password -> password_reset (forgot-password OTP)
    if (purposeBase === 'reset_password') {
      purposeBase = 'password_reset';
    }"""
if "purposeBase === 'reset_password'" not in a:
    if needle not in a:
        print('auth normalize insert point missing')
        sys.exit(1)
    a = a.replace(needle, insert, 1)
    print('auth normalize patched')
else:
    print('auth normalize exists')

auth.write_text(a)
print('done')
