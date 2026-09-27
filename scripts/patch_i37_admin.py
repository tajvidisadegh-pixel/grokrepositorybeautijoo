#!/usr/bin/env python3
"""Issue #37 — apply RequirePermissions + me() permissions. Idempotent."""
from pathlib import Path

def patch_me():
    p = Path("backend/src/auth/auth.service.ts")
    s = p.read_text()
    if "permissions: Array.from(permissions)" in s:
        print("me: already"); return
    old = """    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: { select: { id: true, status: true, title: true, slug: true } },
      },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('\u06a9\u0627\u0631\u0628\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    }
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      accountType: user.accountType,
      phoneVerified: user.phoneVerified,
      displayName: user.profile?.displayName,
      avatarUrl: user.profile?.avatarUrl,
      roles: user.userRoles.map((ur) => ur.role.name),
      professional: user.professional,
      isImpersonating: opts?.isImpersonating || false,
      impersonatorId: opts?.impersonatorId || null,
    };
  }"""
    new = """    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        professional: { select: { id: true, status: true, title: true, slug: true } },
      },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('\u06a9\u0627\u0631\u0628\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    }
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role?.rolePermissions || []) {
        if (rp.permission?.code) permissions.add(rp.permission.code);
      }
    }
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      accountType: user.accountType,
      phoneVerified: user.phoneVerified,
      displayName: user.profile?.displayName,
      avatarUrl: user.profile?.avatarUrl,
      roles,
      permissions: Array.from(permissions),
      professional: user.professional,
      isImpersonating: opts?.isImpersonating || false,
      impersonatorId: opts?.impersonatorId || null,
    };
  }"""
    if old not in s:
        raise SystemExit("me() anchor missing")
    p.write_text(s.replace(old, new, 1))
    print("me: patched")

def ensure_import(path: Path):
    s = path.read_text()
    if "permissions.decorator" in s:
        return
    if "from '../common/decorators/roles.decorator'" in s:
        s = s.replace(
            "from '../common/decorators/roles.decorator';",
            "from '../common/decorators/roles.decorator';\nimport { RequirePermissions } from '../common/decorators/permissions.decorator';",
            1,
        )
        path.write_text(s)

def add_perm_before(path: Path, marker: str, perm: str):
    s = path.read_text()
    idx = s.find(marker)
    if idx < 0:
        print("skip missing", marker[:50])
        return False
    if perm in s[max(0, idx - 100):idx]:
        return False
    deco = f"  @RequirePermissions('{perm}')\n"
    path.write_text(s[:idx] + deco + s[idx:])
    return True

def patch_admin_main():
    p = Path("backend/src/admin/admin.controller.ts")
    ensure_import(p)
    pairs = [
        ("  @Get('stats')\n", "admin.dashboard.read"),
        ("  @Get('dashboard')\n", "admin.dashboard.read"),
        ("  @Get('finance/summary')\n", "admin.finance.read"),
        ("  @Get('finance/transactions')\n", "admin.finance.read"),
        ("  @Get('finance/transactions/:id')\n", "admin.finance.read"),
        ("  @Get('finance/settings/commission')\n", "admin.finance.read"),
        ("  @Get('finance/failed-alert')\n", "admin.finance.read"),
        ("  @Post('finance/settings/commission')\n", "admin.finance.write"),
        ("  @Post('finance/failed-alert/threshold')\n", "admin.finance.write"),
        ("  @Get('users')\n", "admin.users.read"),
        ("  @Get('customers/stats')\n", "admin.users.read"),
        ("  @Get('users/:id')\n", "admin.users.read"),
        ("  @Patch('users/:id/status')\n", "admin.users.write"),
        ("  @Patch('users/:id/roles')\n", "admin.users.write"),
        ("  @Delete('users/:id')\n", "admin.users.write"),
        ("  @Post('users/bulk-delete')\n", "admin.users.write"),
        ("  @Get('professionals')\n", "admin.professionals.read"),
        ("  @Get('professionals/:id')\n", "admin.professionals.read"),
        ("  @Delete('professionals/:id')\n", "admin.professionals.write"),
        ("  @Patch('professionals/:id/status')\n", "admin.professionals.write"),
        ("  @Patch('professionals/:id/featured')\n", "admin.professionals.write"),
        ("  @Get('bookings-stats')\n", "admin.bookings.read"),
        ("  @Get('bookings')\n", "admin.bookings.read"),
        ("  @Get('bookings/:id')\n", "admin.bookings.read"),
        ("  @Patch('bookings/:id/status')\n", "admin.bookings.write"),
        ("  @Get('reviews')\n", "admin.reviews.moderate"),
        ("  @Patch('reviews/:id/publish')\n", "admin.reviews.moderate"),
        ("  @Delete('reviews/:id')\n", "admin.reviews.moderate"),
        ("  @Get('media')\n", "admin.media.moderate"),
        ("  @Get('media-stats')\n", "admin.media.moderate"),
        ("  @Patch('media/:id/status')\n", "admin.media.moderate"),
        ("  @Delete('media/:id')\n", "admin.media.moderate"),
        ("  @Get('audit-logs')\n", "admin.audit.read"),
        ("  @Get('notifications')\n", "admin.notifications.send"),
    ]
    n = sum(1 for m, perm in pairs if add_perm_before(p, m, perm))
    print("admin.controller", n)

def patch_ops():
    p = Path("backend/src/admin/admin-ops.controller.ts")
    ensure_import(p)
    pairs = [
        ("  @Get('content')\n", "admin.site_builder.manage"),
        ("  @Get('site-builder')\n", "admin.site_builder.manage"),
        ("  @Post('users')\n", "admin.users.write"),
        ("  @Patch('users/:id/profile')\n", "admin.users.write"),
        ("  @Post('notifications/notify')\n", "admin.notifications.send"),
        ("  @Post('notifications/notify-by-filter')\n", "admin.notifications.send"),
        ("  @Get('notifications/campaigns')\n", "admin.notifications.send"),
        ("  @Get('notifications/campaigns/:campaignId')\n", "admin.notifications.send"),
        ("  @Post('notifications/campaigns/:campaignId/retry-failed')\n", "admin.notifications.send"),
        ("  @Patch('professionals/:id/feature')\n", "admin.professionals.write"),
        ("  @Post('professionals/create')\n", "admin.professionals.write"),
    ]
    n = sum(1 for m, perm in pairs if add_perm_before(p, m, perm))
    print("ops", n)

def patch_catalog():
    p = Path("backend/src/admin/admin-catalog.controller.ts")
    ensure_import(p)
    s = p.read_text()
    if "@RequirePermissions('admin.catalog.manage')" not in s:
        s = s.replace(
            "@Roles('SUPER_ADMIN', 'admin')\n@Controller('admin')",
            "@Roles('SUPER_ADMIN', 'admin')\n@RequirePermissions('admin.catalog.manage')\n@Controller('admin')",
            1,
        )
        p.write_text(s)
        print("catalog: ok")
    else:
        print("catalog: already")

def patch_settings():
    p = Path("backend/src/admin/admin-settings.controller.ts")
    ensure_import(p)
    add_perm_before(p, "  @Get('nav-badges')\n", "admin.dashboard.read")
    add_perm_before(p, "  @Get('settings')\n", "admin.settings.read")
    add_perm_before(p, "  @Get('settings/defaults')\n", "admin.settings.read")
    s = p.read_text()
    if "admin.settings.write" not in s and "  @Put(" in s:
        s = s.replace("  @Put(", "  @RequirePermissions('admin.settings.write')\n  @Put(", 1)
        p.write_text(s)
    print("settings done")

if __name__ == "__main__":
    patch_me()
    patch_admin_main()
    patch_ops()
    patch_catalog()
    patch_settings()
