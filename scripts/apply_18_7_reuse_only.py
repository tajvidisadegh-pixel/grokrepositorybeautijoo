#!/usr/bin/env python3
import re
from pathlib import Path

svc = Path("backend/src/auth/auth.service.ts")
t = svc.read_text()
if "auth.refresh_reuse_detected" in t:
    print("already present")
    raise SystemExit(0)

pattern = re.compile(
    r"const hash = this\.hashToken\(refreshToken\);\s*"
    r"const stored = await this\.prisma\.refreshToken\.findUnique\(\{ where: \{ tokenHash: hash \} \}\);\s*"
    r"if \(!stored \|\| stored\.revokedAt \|\| stored\.expiresAt < new Date\(\)\) \{\s*"
    r"throw new UnauthorizedException\('توکن منقضی یا باطل شده است'\);\s*"
    r"\}",
    re.MULTILINE,
)

replacement = """const hash = this.hashToken(refreshToken);
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
    }"""

m = pattern.search(t)
if not m:
    raise SystemExit("pattern not found")
t2 = pattern.sub(replacement, t, count=1)
svc.write_text(t2)
print("reuse detection applied, len", len(t2))
