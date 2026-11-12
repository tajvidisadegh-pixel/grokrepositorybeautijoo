#!/usr/bin/env python3
"""Patch backend/src/auth/auth.service.ts for phone variants + OTP-only login."""
from pathlib import Path
import re
import sys

p = Path('backend/src/auth/auth.service.ts')
if not p.is_file():
    print('missing', p)
    sys.exit(1)
t = p.read_text()

if 'phoneLookupVariants' not in t:
    old = """  private resolveAccountType(raw?: string | null): AccountType {
    if (raw === 'professional') return AccountType.professional;
    return AccountType.customer;
  }

  private isPrivileged(roles: string[]): boolean {
    return roles.some((r) => PRIVILEGED_ROLES.has(r));
  }"""
    new = """  private resolveAccountType(raw?: string | null): AccountType {
    if (raw === 'professional') return AccountType.professional;
    return AccountType.customer;
  }

  private normalizePhone(raw?: string | null): string {
    let s = String(raw || '').trim().replace(/[\\s-]/g, '');
    s = s.replace(/^\\+/, '');
    if (s.startsWith('0098')) s = s.slice(4);
    else if (s.startsWith('98') && s.length >= 12) s = s.slice(2);
    if (s.startsWith('9') && s.length === 10) s = '0' + s;
    return s;
  }

  private phoneLookupVariants(phone: string): string[] {
    const n = this.normalizePhone(phone);
    const set = new Set<string>();
    if (phone) set.add(String(phone).trim());
    if (n) set.add(n);
    if (n.startsWith('0') && n.length === 11) {
      set.add('98' + n.slice(1));
      set.add('+98' + n.slice(1));
    }
    return [...set].filter(Boolean);
  }

  private isPrivileged(roles: string[]): boolean {
    return roles.some((r) => PRIVILEGED_ROLES.has(r));
  }"""
    if old not in t:
        print('resolve block missing')
        sys.exit(1)
    t = t.replace(old, new, 1)
    print('normalize added')
else:
    print('normalize exists')

if 'phoneLookupVariants(dto.phone)' not in t:
    start = t.find('  async login(dto: LoginDto) {')
    m = re.search(
        r'const ok = await argon2\.verify\(user\.passwordHash, dto\.password\);\n    if \(!ok\) \{\n      throw new UnauthorizedException\([^;]+;\n    \}',
        t[start:],
    )
    if start < 0 or not m:
        print('login block missing')
        sys.exit(1)
    end_at = start + m.end()
    # Persian via unicode escapes only
    z = '\u0632\u06cc\u0628\u0627\u06af\u0631'
    k = '\u06a9\u0627\u0631\u0628\u0631\u06cc'
    new_login = f'''  async login(dto: LoginDto) {{
    const accountType = this.resolveAccountType(dto.accountType);
    const roleWanted = accountType === AccountType.professional ? 'professional' : 'customer';
    const phones = this.phoneLookupVariants(dto.phone);
    const candidates = await this.prisma.user.findMany({{
      where: {{ phone: {{ in: phones }} }},
      include: {{ profile: true, userRoles: {{ include: {{ role: true }} }} }},
    }});
    let user =
      candidates.find((u) => u.accountType === accountType && u.passwordHash) ||
      candidates.find((u) => u.accountType === accountType) ||
      candidates.find((u) => u.userRoles.some((ur) => ur.role.name === roleWanted) && u.passwordHash) ||
      candidates.find((u) => u.userRoles.some((ur) => ur.role.name === roleWanted)) ||
      null;

    if (!user) {{
      if (candidates.length > 0) {{
        const otherType = candidates[0].accountType;
        const other = otherType === AccountType.professional ? '{z}' : '{k}';
        const want = roleWanted === 'professional' ? '{z}' : '{k}';
        throw new UnauthorizedException(
          '\u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u0634\u0645\u0627\u0631\u0647 \u062d\u0633\u0627\u0628 ' +
            want +
            ' \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f. \u0627\u06af\u0631 \u062d\u0633\u0627\u0628 ' +
            other +
            ' \u062f\u0627\u0631\u06cc\u062f \u0646\u0648\u0639 \u0648\u0631\u0648\u062f \u0631\u0627 \u0639\u0648\u0636 \u06a9\u0646\u06cc\u062f.',
        );
      }}
      throw new UnauthorizedException('\u0634\u0645\u0627\u0631\u0647 \u06cc\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u062f\u0631\u0633\u062a \u0627\u0633\u062a');
    }}

    if (!user.passwordHash) {{
      const want = roleWanted === 'professional' ? '{z}' : '{k}';
      throw new UnauthorizedException(
        '\u0627\u06cc\u0646 \u062d\u0633\u0627\u0628 ' +
          want +
          ' \u0641\u0642\u0637 \u0628\u0627 \u06a9\u062f \u067e\u06cc\u0627\u0645\u06a9\u06cc \u0642\u0627\u0628\u0644 \u0648\u0631\u0648\u062f \u0627\u0633\u062a. \u0628\u0631\u0627\u06cc \u0648\u0631\u0648\u062f \u0628\u0627 \u0631\u0645\u0632 \u0627\u0632 \u0641\u0631\u0627\u0645\u0648\u0634\u06cc \u0631\u0645\u0632 \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u06a9\u0646\u06cc\u062f.',
      );
    }}

    if (user.status !== UserStatus.active) {{
      throw new UnauthorizedException('\u062d\u0633\u0627\u0628 \u06a9\u0627\u0631\u0628\u0631\u06cc \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062a');
    }}
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {{
      throw new UnauthorizedException('\u0634\u0645\u0627\u0631\u0647 \u06cc\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u062f\u0631\u0633\u062a \u0627\u0633\u062a');
    }}'''
    t = t[:start] + new_login + t[end_at:]
    print('login replaced')
else:
    print('login already')

p.write_text(t)
print('ok', p.stat().st_size)
