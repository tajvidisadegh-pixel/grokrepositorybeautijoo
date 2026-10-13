from pathlib import Path

p = Path('backend/src/payments/payments.service.ts')
t = p.read_text()
assert 'class PaymentsService' in t and 'PLACEHOLDER' not in t

if 'assertAllowedCallbackUrl' in t and '#64.5' in t:
    print('already applied', p.stat().st_size)
    raise SystemExit(0)

helper = r'''
  /** #64.5 — Only allow callback URLs on configured frontend origins (CORS_ORIGINS). */
  private allowedCallbackOrigins(): string[] {
    const fromEnv = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const extras: string[] = [];
    for (const key of ['FRONTEND_URL', 'PUBLIC_APP_URL', 'APP_URL'] as const) {
      const raw = (process.env[key] || '').trim();
      if (!raw) continue;
      try {
        extras.push(new URL(raw).origin);
      } catch {
        /* ignore invalid */
      }
    }
    const list = [...fromEnv, ...extras];
    if (process.env.NODE_ENV !== 'production') {
      list.push(
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      );
    }
    const origins: string[] = [];
    for (const item of list) {
      try {
        origins.push(new URL(item).origin);
      } catch {
        try {
          origins.push(new URL(`https://${item}`).origin);
        } catch {
          /* skip */
        }
      }
    }
    return [...new Set(origins)];
  }

  private assertAllowedCallbackUrl(callbackUrl: string): void {
    if (!callbackUrl || typeof callbackUrl !== 'string') {
      throw new BadRequestException('آدرس بازگشت پرداخت الزامی است');
    }
    let parsed: URL;
    try {
      parsed = new URL(callbackUrl.trim());
    } catch {
      throw new BadRequestException('آدرس بازگشت پرداخت نامعتبر است');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('آدرس بازگشت پرداخت باید http یا https باشد');
    }
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && parsed.protocol !== 'https:') {
      throw new BadRequestException('در محیط عملیاتی آدرس بازگشت باید HTTPS باشد');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('آدرس بازگشت پرداخت مجاز نیست');
    }
    const allowed = this.allowedCallbackOrigins();
    if (allowed.length === 0) {
      throw new BadRequestException(
        'هیچ دامنهٔ مجازی برای بازگشت پرداخت پیکربندی نشده است (CORS_ORIGINS)',
      );
    }
    if (!allowed.includes(parsed.origin)) {
      throw new BadRequestException(
        'آدرس بازگشت پرداخت خارج از دامنه‌های مجاز است',
      );
    }
  }

'''

marker = """  private providerName(): string {
    return this.provider.name || 'disabled';
  }
"""
if marker not in t:
    raise SystemExit('providerName marker missing')
t = t.replace(marker, marker + helper, 1)

old_init = """  async initiate(userId: string, bookingId: string, callbackUrl: string) {
    const providerKey = this.providerName();
"""
new_init = """  async initiate(userId: string, bookingId: string, callbackUrl: string) {
    // #64.5 — lock callback to allowed frontend origins before talking to gateway
    this.assertAllowedCallbackUrl(callbackUrl);
    const providerKey = this.providerName();
"""
if old_init not in t:
    raise SystemExit('initiate marker missing')
t = t.replace(old_init, new_init, 1)

p.write_text(t)
assert 'assertAllowedCallbackUrl' in p.read_text()
print('patched', p.stat().st_size)
