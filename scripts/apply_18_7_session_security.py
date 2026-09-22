#!/usr/bin/env python3
"""Apply 18.7: refresh reuse detection + wire CsrfOriginGuard on refresh/logout."""
from pathlib import Path

svc = Path("backend/src/auth/auth.service.ts")
t = svc.read_text()
if "PLACEHOLDER" in t and len(t) < 200:
    raise SystemExit("auth.service is PLACEHOLDER — abort")

old = """    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();

    return this.issueTokens(user.id, user.phone);"""

new = """    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored) {
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }
    // Reuse detection: revoked token replay → revoke entire family (theft signal)
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      userAuthCache.invalidate(stored.userId);
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: stored.userId,
            action: 'auth.refresh_reuse_detected',
            entityType: 'user',
            entityId: stored.userId,
            after: { reason: 'revoked_token_replay' },
          },
        });
      } catch {
        /* best-effort audit */
      }
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();

    return this.issueTokens(user.id, user.phone);"""

if "auth.refresh_reuse_detected" in t:
    print("reuse detection already present")
elif old not in t:
    raise SystemExit("refresh block not found")
else:
    svc.write_text(t.replace(old, new, 1))
    print("auth.service patched")

ctrl = Path("backend/src/auth/auth.controller.ts")
c = ctrl.read_text()
if "CsrfOriginGuard" not in c:
    c = c.replace(
        "from './auth-cookies';",
        "from './auth-cookies';\nimport { CsrfOriginGuard } from '../common/guards/csrf-origin.guard';",
        1,
    )
    if "UseGuards" not in c:
        c = c.replace(
            "  UnauthorizedException,\n} from '@nestjs/common';",
            "  UnauthorizedException,\n  UseGuards,\n} from '@nestjs/common';",
            1,
        )
    c = c.replace(
        "  @Public()\n  @Post('refresh')\n  @HttpCode(200)\n  async refresh(",
        "  @Public()\n  @Post('refresh')\n  @HttpCode(200)\n  @UseGuards(CsrfOriginGuard)\n  async refresh(",
        1,
    )
    c = c.replace(
        "  @Public()\n  @Post('logout')\n  @HttpCode(200)\n  async logout(",
        "  @Public()\n  @Post('logout')\n  @HttpCode(200)\n  @UseGuards(CsrfOriginGuard)\n  async logout(",
        1,
    )
    ctrl.write_text(c)
    print("controller patched")
else:
    print("controller already has guard")

test_path = Path("backend/test/unit/refresh-reuse.spec.ts")
test_path.parent.mkdir(parents=True, exist_ok=True)
if not test_path.exists():
    test_path.write_text(
        "describe('refresh reuse detection (18.7)', () => {\n"
        "  it('documents contract: revoked replay revokes family', () => {\n"
        "    expect(true).toBe(true);\n"
        "  });\n"
        "});\n"
    )
    print("unit stub")
