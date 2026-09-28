#!/usr/bin/env python3
"""Patch admin service + controller for platform settings API."""
from pathlib import Path

METHODS = '''
  private platformDefaults() {
    return {
      booking: {
        slotStepMin: 30,
        holdMinutes: 15,
        cancelWindowHours: 2,
        allowSameDay: true,
      },
      commission: { ratePercent: 10 },
      professionals: {
        requireManualReview: true,
        minServicesToPublish: 1,
      },
      reviews: {
        autoPublish: false,
        minCommentLength: 10,
      },
      search: {
        nearMeDefaultRadiusKm: 5,
        featuredBoost: true,
      },
      auth: {
        otpTtlSeconds: 120,
        maxOtpAttempts: 5,
        loginRateLimitPerMinute: 10,
      },
      privacy: {
        defaultLocationPrecision: 'approximate' as const,
        showPhoneToCustomer: false,
      },
      public: {
        siteName: 'Beautijoo',
        supportPhone: '',
        maintenanceMode: false,
      },
    };
  }

  private deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch || {})) {
      if (
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        typeof out[k] === 'object' &&
        out[k] !== null &&
        !Array.isArray(out[k])
      ) {
        out[k] = this.deepMerge(
          out[k] as Record<string, unknown>,
          v as Record<string, unknown>,
        );
      } else if (v !== undefined) {
        out[k] = v;
      }
    }
    return out;
  }

  async getPlatformSettings() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'platform_config' },
    });
    const stored =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    return this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      stored,
    );
  }

  async updatePlatformSettings(
    partial: Record<string, unknown>,
    actorId?: string,
  ) {
    const current = await this.getPlatformSettings();
    const next = this.deepMerge(current as Record<string, unknown>, partial || {});

    const commission = next.commission as { ratePercent?: number } | undefined;
    if (commission && typeof commission.ratePercent === 'number') {
      const rate = Math.min(100, Math.max(0, commission.ratePercent));
      (next.commission as { ratePercent: number }).ratePercent = rate;
      await this.prisma.platformSetting.upsert({
        where: { key: 'commission_rate' },
        create: { key: 'commission_rate', value: rate as unknown as object },
        update: { value: rate as unknown as object },
      });
    }

    await this.prisma.platformSetting.upsert({
      where: { key: 'platform_config' },
      create: { key: 'platform_config', value: next as object },
      update: { value: next as object },
    });

    await this.audit(
      actorId,
      'platform.settings_update',
      'platform_setting',
      'platform_config',
      null,
      { keys: Object.keys(partial || {}) },
    );

    return next;
  }
'''

ENDPOINTS = '''
  /** Platform rules - SUPER_ADMIN only */
  @Roles('SUPER_ADMIN')
  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings (SUPER_ADMIN)' })
  getSettings() {
    return this.service.getPlatformSettings();
  }

  @Roles('SUPER_ADMIN')
  @Put('settings')
  @ApiOperation({ summary: 'Update platform settings section(s) (SUPER_ADMIN)' })
  updateSettings(
    @Body() body: Record<string, unknown>,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updatePlatformSettings(body || {}, actorId);
  }
'''

def main() -> None:
    svc = Path('backend/src/admin/admin.service.ts')
    s = svc.read_text()
    if 'getPlatformSettings' not in s:
        idx = s.rfind('\n}')
        if idx < 0:
            raise SystemExit('service end not found')
        svc.write_text(s[:idx] + METHODS + s[idx:])
        print('service patched')
    else:
        print('service ok')

    ctrl = Path('backend/src/admin/admin.controller.ts')
    c = ctrl.read_text()
    if "@Get('settings')" not in c:
        if 'Roles' not in c.split('export class')[0]:
            c = c.replace(
                "import { RequirePermissions } from '../common/decorators/permissions.decorator';",
                "import { RequirePermissions } from '../common/decorators/permissions.decorator';\n"
                "import { Roles } from '../common/decorators/roles.decorator';",
            )
        idx = c.rfind('\n}')
        if idx < 0:
            raise SystemExit('controller end not found')
        ctrl.write_text(c[:idx] + ENDPOINTS + c[idx:])
        print('controller patched')
    else:
        print('controller ok')


if __name__ == '__main__':
    main()
