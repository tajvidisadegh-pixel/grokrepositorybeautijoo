#!/usr/bin/env python3
"""Issue #37: detach admin from SUPER_ADMIN full-access; permission-only admin."""
from pathlib import Path

def strip_class_roles(path: Path):
    s = path.read_text()
    # Remove shared class-level @Roles('SUPER_ADMIN', 'admin') so only RequirePermissions apply
    s2 = s.replace("@Roles('SUPER_ADMIN', 'admin')\n", "")
    s2 = s2.replace('@Roles("SUPER_ADMIN", "admin")\n', "")
    if s2 != s:
        path.write_text(s2)
        print(path, "stripped class Roles")
    else:
        print(path, "no class Roles to strip")

def ensure_perm(path: Path, marker: str, perm: str):
    s = path.read_text()
    idx = s.find(marker)
    if idx < 0:
        print("miss", marker[:40])
        return
    if perm in s[max(0, idx - 120):idx]:
        return
    path.write_text(s[:idx] + f"  @RequirePermissions('{perm}')\n" + s[idx:])
    print("added", perm, "before", marker.strip()[:40])

def patch_admin_controller():
    p = Path("backend/src/admin/admin.controller.ts")
    strip_class_roles(p)
    ensure_perm(p, "  @Get('dashboard')\n", "admin.dashboard.read")
    ensure_perm(p, "  @Put('finance/settings/commission')\n", "admin.finance.write")
    ensure_perm(p, "  @Patch('users/:id/status')\n", "admin.users.write")
    # Fix un-indented status line if any
    s = p.read_text()
    s = s.replace("\n@Patch('users/:id/status')", "\n  @Patch('users/:id/status')")
    p.write_text(s)

def patch_ops():
    p = Path("backend/src/admin/admin-ops.controller.ts")
    strip_class_roles(p)
    ensure_perm(p, "  @Put('content')\n", "admin.site_builder.manage")
    ensure_perm(p, "  @Put('site-builder')\n", "admin.site_builder.manage")

def patch_settings():
    strip_class_roles(Path("backend/src/admin/admin-settings.controller.ts"))

def patch_catalog():
    p = Path("backend/src/admin/admin-catalog.controller.ts")
    s = p.read_text()
    s2 = s.replace("@Roles('SUPER_ADMIN', 'admin')\n", "")
    if s2 != s:
        p.write_text(s2)
        print("catalog stripped Roles (kept RequirePermissions)")

def patch_set_user_roles():
    """Only SUPER_ADMIN may assign SUPER_ADMIN role."""
    p = Path("backend/src/admin/admin.service.ts")
    s = p.read_text()
    if "cannot assign SUPER_ADMIN" in s or "نقش SUPER_ADMIN" in s:
        print("setUserRoles already guarded")
        return
    needle = "    if (!normalized.length) {\n      throw new BadRequestException('حداقل یک نقش باید مشخص شود');\n    }"
    insert = """    if (!normalized.length) {
      throw new BadRequestException('حداقل یک نقش باید مشخص شود');
    }

    // Issue #37: only SUPER_ADMIN may grant SUPER_ADMIN; admin is fully separate
    if (normalized.some((r) => r.toLowerCase() === 'super_admin')) {
      if (actorId) {
        const actor = await this.prisma.user.findUnique({
          where: { id: actorId },
          include: { userRoles: { include: { role: true } } },
        });
        const actorRoles = actor?.userRoles.map((ur) => ur.role.name) || [];
        if (!actorRoles.includes('SUPER_ADMIN')) {
          throw new ForbiddenException('فقط سوپر ادمین می‌تواند نقش SUPER_ADMIN را اختصاص دهد');
        }
      } else {
        throw new ForbiddenException('فقط سوپر ادمین می‌تواند نقش SUPER_ADMIN را اختصاص دهد');
      }
    }"""
    if needle not in s:
        print("setUserRoles needle miss")
        return
    p.write_text(s.replace(needle, insert, 1))
    print("setUserRoles SUPER_ADMIN guard")

def patch_auth_service():
    p = Path("backend/src/auth/auth.service.ts")
    s = p.read_text()
    s2 = s.replace(
        "const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN', 'admin']);",
        "const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN']); // admin is NOT privileged (issue #37)",
    )
    if s2 != s:
        p.write_text(s2)
        print("auth.service PRIVILEGED only SUPER_ADMIN")

def patch_frontend():
    # require-auth
    p = Path("frontend/src/components/auth/require-auth.tsx")
    if p.exists():
        s = p.read_text()
        s = s.replace(
            "const PRIVILEGED = new Set(['SUPER_ADMIN', 'admin']);",
            "const PRIVILEGED = new Set(['SUPER_ADMIN']); // admin is separate (issue #37)",
        )
        p.write_text(s)
        print("require-auth")
    # admin layout isFullAdmin
    p = Path("frontend/src/app/admin/layout.tsx")
    if p.exists():
        s = p.read_text()
        s = s.replace(
            "const PRIVILEGED = new Set(['SUPER_ADMIN', 'admin']);",
            "const PRIVILEGED = new Set(['SUPER_ADMIN']); // full nav only for super admin",
        )
        p.write_text(s)
        print("admin layout")
    # auth-context hasRole
    p = Path("frontend/src/contexts/auth-context.tsx")
    if p.exists():
        s = p.read_text()
        old = """      const privileged = new Set(['SUPER_ADMIN', 'admin']);
      if (
        need.some((r) => privileged.has(r)) &&
        user.roles.some((r) => privileged.has(r))
      ) {
        return true;
      }"""
        new = """      // Issue #37: admin is NOT equivalent to SUPER_ADMIN
      if (need.includes('SUPER_ADMIN') && user.roles.includes('SUPER_ADMIN')) {
        return true;
      }"""
        if old in s:
            s = s.replace(old, new)
            p.write_text(s)
            print("auth-context hasRole")
        else:
            print("auth-context pattern miss")

if __name__ == "__main__":
    patch_admin_controller()
    patch_ops()
    patch_settings()
    patch_catalog()
    patch_set_user_roles()
    patch_auth_service()
    patch_frontend()
    print("done separate admin")
