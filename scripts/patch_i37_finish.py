#!/usr/bin/env python3
"""Issue #37 finish: cache invalidate, getUserDetail.roles, panel-api helper."""
from pathlib import Path

def patch_admin_service():
    p = Path("backend/src/admin/admin.service.ts")
    s = p.read_text()
    if "userAuthCache" not in s:
        s = s.replace(
            "import { AppCacheService } from '../cache/app-cache.service';",
            "import { AppCacheService } from '../cache/app-cache.service';\nimport { userAuthCache } from '../auth/user-auth-cache';",
        )
    if "userAuthCache.invalidate(id)" not in s:
        needle = "      { roles: roleRows.map((r) => r.name) },\n    );\n\n    return updated;\n  }\n\n  async listProfessionals"
        repl = "      { roles: roleRows.map((r) => r.name) },\n    );\n\n    userAuthCache.invalidate(id);\n    return updated;\n  }\n\n  async listProfessionals"
        if needle not in s:
            raise SystemExit("setUserRoles return anchor missing")
        s = s.replace(needle, repl, 1)
    if "return { ...u, roles }" not in s:
        old = """  async getUserDetail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }"""
        new = """  async getUserDetail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!u) throw new NotFoundException('User not found');
    const roles = u.userRoles.map((ur) => ur.role.name);
    return { ...u, roles };
  }"""
        if old not in s:
            raise SystemExit("getUserDetail anchor missing")
        s = s.replace(old, new, 1)
    p.write_text(s)
    print("admin.service ok")

def patch_panel_api():
    p = Path("frontend/src/lib/panel-api.ts")
    t = p.read_text()
    if "adminSetUserRoles" in t:
        print("panel-api already")
        return
    old = "export async function adminSetUserStatus(id: string, status: string, reason?: string) {\n  return apiClient.patch(`/admin/users/${id}/status`, { status, reason });\n}"
    new = old + "\nexport async function adminSetUserRoles(id: string, roles: string[]) {\n  return apiClient.patch(`/admin/users/${id}/roles`, { roles });\n}"
    if old not in t:
        raise SystemExit("panel-api anchor missing")
    p.write_text(t.replace(old, new, 1))
    print("panel-api ok")

if __name__ == "__main__":
    patch_admin_service()
    patch_panel_api()
