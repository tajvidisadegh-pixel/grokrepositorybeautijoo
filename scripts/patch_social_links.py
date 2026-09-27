#!/usr/bin/env python3
"""Additive patch for issue #36 — socialLinks on Professional. Safe to re-run."""
from pathlib import Path

def patch_service():
    p = Path("backend/src/professionals/professionals.service.ts")
    s = p.read_text()
    if "socialLinks?:" in s:
        print("service: already patched")
        return False
    s = s.replace(
        "selectedCategoryIds?: string[];\n  }) {",
        "selectedCategoryIds?: string[];\n"
        "    socialLinks?: { instagram?: string | null; telegram?: string | null; "
        "website?: string | null; phone?: string | null; whatsapp?: string | null } | null;\n"
        "  }) {",
    )
    old = (
        "    if (data.selectedCategoryIds !== undefined) {\n"
        "      proData.selectedCategoryIds = data.selectedCategoryIds as Prisma.InputJsonValue;\n"
        "    }\n"
        "    if (data.logoUrl !== undefined) proData.logoUrl = data.logoUrl.trim() || null;"
    )
    new = (
        "    if (data.selectedCategoryIds !== undefined) {\n"
        "      proData.selectedCategoryIds = data.selectedCategoryIds as Prisma.InputJsonValue;\n"
        "    }\n"
        "    if (data.socialLinks !== undefined) {\n"
        "      if (data.socialLinks === null) {\n"
        "        proData.socialLinks = Prisma.JsonNull;\n"
        "      } else {\n"
        "        const allowed = ['instagram', 'telegram', 'website', 'phone', 'whatsapp'] as const;\n"
        "        const cleaned: Record<string, string> = {};\n"
        "        for (const k of allowed) {\n"
        "          const raw = data.socialLinks[k];\n"
        "          if (raw == null) continue;\n"
        "          const v = String(raw).trim().slice(0, 200);\n"
        "          if (v) cleaned[k] = v;\n"
        "        }\n"
        "        proData.socialLinks = (Object.keys(cleaned).length ? cleaned : Prisma.JsonNull) as Prisma.InputJsonValue;\n"
        "      }\n"
        "    }\n"
        "    if (data.logoUrl !== undefined) proData.logoUrl = data.logoUrl.trim() || null;"
    )
    if old not in s:
        raise SystemExit("service anchor not found")
    p.write_text(s.replace(old, new, 1))
    print("service: patched")
    return True

def patch_panel():
    p = Path("frontend/src/lib/panel-api.ts")
    t = p.read_text()
    if "SocialLinks" in t:
        print("panel-api: already patched")
        return False
    t = t.replace(
        "export type OwnProfessional = {",
        "export type SocialLinks = {\n"
        "  instagram?: string | null;\n"
        "  telegram?: string | null;\n"
        "  website?: string | null;\n"
        "  phone?: string | null;\n"
        "  whatsapp?: string | null;\n"
        "};\n"
        "export type OwnProfessional = {",
    )
    t = t.replace(
        "  logoUrl?: string | null; selectedCategoryIds?: string[] | null;\n"
        "  professionalServices?: ProfessionalServiceItem[];",
        "  logoUrl?: string | null; selectedCategoryIds?: string[] | null;\n"
        "  socialLinks?: SocialLinks | null;\n"
        "  professionalServices?: ProfessionalServiceItem[];",
    )
    p.write_text(t)
    print("panel-api: patched")
    return True

if __name__ == "__main__":
    patch_service()
    patch_panel()
