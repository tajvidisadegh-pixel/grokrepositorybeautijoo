#!/usr/bin/env python3
"""Finish #36: panel-api SocialLinks + Persian UI labels. Idempotent."""
from pathlib import Path

def patch_panel():
    p = Path("frontend/src/lib/panel-api.ts")
    t = p.read_text()
    if "SocialLinks" in t:
        print("panel: already")
        return
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
    old = (
        "  logoUrl?: string | null; selectedCategoryIds?: string[] | null;\n"
        "  professionalServices?: ProfessionalServiceItem[]; workingHours?: WorkingHourItem[]; completion?: ProfileCompletion;"
    )
    new = (
        "  logoUrl?: string | null; selectedCategoryIds?: string[] | null;\n"
        "  socialLinks?: SocialLinks | null;\n"
        "  professionalServices?: ProfessionalServiceItem[]; workingHours?: WorkingHourItem[]; completion?: ProfileCompletion;"
    )
    if old not in t:
        raise SystemExit("panel anchor missing")
    p.write_text(t.replace(old, new, 1))
    print("panel: patched")

def polish_profile():
    p = Path("frontend/src/app/zibagar/profile/page.tsx")
    t = p.read_text()
    reps = [
        ("social links (optional)", "\u0644\u06cc\u0646\u06a9\u200c\u0647\u0627\u06cc \u0627\u0631\u062a\u0628\u0627\u0637\u06cc (\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc)"),
        ("shown at bottom of public page only", "\u0641\u0642\u0637 \u062f\u0631 \u067e\u0627\u06cc\u06cc\u0646 \u0635\u0641\u062d\u0647 \u0639\u0645\u0648\u0645\u06cc \u0646\u0645\u0627\u06cc\u0634 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f"),
        ("Save links", "\u0630\u062e\u06cc\u0631\u0647 \u0644\u06cc\u0646\u06a9\u200c\u0647\u0627"),
        ("setSocialMsg('saved')", "setSocialMsg('\u0644\u06cc\u0646\u06a9\u200c\u0647\u0627 \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f')"),
        ("['instagram','Instagram'],['telegram','Telegram'],['website','Website'],['phone','Phone'],['whatsapp','WhatsApp']",
         "['instagram','\u0627\u06cc\u0646\u0633\u062a\u0627\u06af\u0631\u0627\u0645'],['telegram','\u062a\u0644\u06af\u0631\u0627\u0645'],['website','\u0648\u0628\u200c\u0633\u0627\u06cc\u062a'],['phone','\u0634\u0645\u0627\u0631\u0647 \u062a\u0645\u0627\u0633'],['whatsapp','\u0648\u0627\u062a\u0633\u0627\u067e']"),
    ]
    for a, b in reps:
        t = t.replace(a, b)
    p.write_text(t)
    print("profile polish done")

def polish_public():
    p = Path("frontend/src/app/professionals/[slug]/page.tsx")
    t = p.read_text()
    for a, b in [
        ("label: 'IG'", "label: '\u0627\u06cc\u0646\u0633\u062a\u0627\u06af\u0631\u0627\u0645'"),
        ("label: 'TG'", "label: '\u062a\u0644\u06af\u0631\u0627\u0645'"),
        ("label: 'Web'", "label: '\u0648\u0628\u200c\u0633\u0627\u06cc\u062a'"),
        ("label: 'Tel'", "label: '\u062a\u0645\u0627\u0633'"),
        ("label: 'WA'", "label: '\u0648\u0627\u062a\u0633\u0627\u067e'"),
    ]:
        t = t.replace(a, b)
    p.write_text(t)
    print("public polish done")

if __name__ == "__main__":
    patch_panel()
    polish_profile()
    polish_public()
