#!/usr/bin/env python3
"""Additive patch for issue #36 - socialLinks. Safe to re-run."""
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
    # match actual formatting on main
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
        # fallback shorter anchor
        old2 = "  logoUrl?: string | null; selectedCategoryIds?: string[] | null;"
        if old2 in t and "socialLinks?: SocialLinks" not in t:
            t = t.replace(old2, old2 + "\n  socialLinks?: SocialLinks | null;", 1)
        else:
            raise SystemExit("panel-api anchor not found")
    else:
        t = t.replace(old, new, 1)
    p.write_text(t)
    print("panel-api: patched")
    return True

def patch_profile_ui():
    p = Path("frontend/src/app/zibagar/profile/page.tsx")
    if not p.exists():
        print("profile: missing"); return False
    zp = p.read_text()
    if "socialForm" in zp:
        print("profile: already patched"); return False
    if "updateMyProfessional" not in zp:
        zp = zp.replace(
            "  resolveMediaUrl,\n  type OwnProfessional,\n} from '@/lib/panel-api';",
            "  updateMyProfessional,\n  resolveMediaUrl,\n  type OwnProfessional,\n  type SocialLinks,\n} from '@/lib/panel-api';",
        )
    zp = zp.replace(
        "  const [confirm, setConfirm] = useState(false);\n",
        "  const [confirm, setConfirm] = useState(false);\n"
        "  const [socialForm, setSocialForm] = useState<SocialLinks>({});\n"
        "  const [socialBusy, setSocialBusy] = useState(false);\n"
        "  const [socialMsg, setSocialMsg] = useState<string | null>(null);\n",
    )
    zp = zp.replace(
        "        if (!c) setPro(data);\n",
        "        if (!c) {\n"
        "          setPro(data);\n"
        "          const sl = (data as OwnProfessional).socialLinks || {};\n"
        "          setSocialForm({\n"
        "            instagram: sl.instagram || '',\n"
        "            telegram: sl.telegram || '',\n"
        "            website: sl.website || '',\n"
        "            phone: sl.phone || '',\n"
        "            whatsapp: sl.whatsapp || '',\n"
        "          });\n"
        "        }\n",
    )
    if "saveSocialLinks" not in zp:
        handler = (
            "\n  async function saveSocialLinks() {\n"
            "    setSocialBusy(true);\n"
            "    setSocialMsg(null);\n"
            "    setError(null);\n"
            "    try {\n"
            "      const payload: SocialLinks = {};\n"
            "      for (const k of ['instagram', 'telegram', 'website', 'phone', 'whatsapp'] as const) {\n"
            "        const v = (socialForm[k] || '').trim();\n"
            "        if (v) payload[k] = v;\n"
            "      }\n"
            "      const updated = await updateMyProfessional({ socialLinks: payload });\n"
            "      setPro(updated);\n"
            "      setSocialMsg('saved');\n"
            "    } catch (e) {\n"
            "      setError(friendlyApiError(e));\n"
            "    } finally {\n"
            "      setSocialBusy(false);\n"
            "    }\n"
            "  }\n\n"
        )
        zp = zp.replace(
            "  const locations = pro?.locations || [];\n\n  return (",
            "  const locations = pro?.locations || [];\n" + handler + "  return (",
        )
    section = (
        "\n      <Card className=\"space-y-3 border-dashed border-border/70 bg-gray-light/20\">\n"
        "        <div>\n"
        "          <h3 className=\"text-sm font-medium text-gray\">social links (optional)</h3>\n"
        "          <p className=\"mt-0.5 text-xs text-gray-muted\">shown at bottom of public page only</p>\n"
        "        </div>\n"
        "        <div className=\"grid gap-2 sm:grid-cols-2\">\n"
        "          {([['instagram','Instagram'],['telegram','Telegram'],['website','Website'],['phone','Phone'],['whatsapp','WhatsApp']] as const).map(([key,label]) => (\n"
        "            <label key={key} className=\"block text-xs text-gray\">{label}\n"
        "              <input className=\"mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-coral\" dir=\"ltr\"\n"
        "                value={(socialForm as any)[key] || ''} onChange={(e) => setSocialForm((prev) => ({ ...prev, [key]: e.target.value }))} />\n"
        "            </label>\n"
        "          ))}\n"
        "        </div>\n"
        "        <div className=\"flex items-center gap-2\">\n"
        "          <Button size=\"sm\" variant=\"outline\" loading={socialBusy} onClick={saveSocialLinks}>Save links</Button>\n"
        "          {socialMsg && <span className=\"text-xs text-coral\">{socialMsg}</span>}\n"
        "        </div>\n"
        "      </Card>\n"
    )
    if "saveSocialLinks" in zp and "Save links" not in zp:
        pass
    if "Save links" not in zp:
        zp = zp.replace("      {confirm && (", section + "\n      {confirm && (")
    p.write_text(zp)
    print("profile: patched")
    return True

def patch_public_ui():
    p = Path("frontend/src/app/professionals/[slug]/page.tsx")
    if not p.exists():
        print("public: missing"); return False
    pub = p.read_text()
    if "Issue #36" in pub:
        print("public: already patched"); return False
    footer = (
        "\n      {/* Issue #36 */}\n"
        "      {(() => {\n"
        "        const sl = (pro as { socialLinks?: Record<string, string | null> | null }).socialLinks;\n"
        "        if (!sl || typeof sl !== 'object') return null;\n"
        "        const items: { label: string; href: string; text: string }[] = [];\n"
        "        const ig = (sl.instagram || '').trim();\n"
        "        if (ig) { const href = ig.startsWith('http') ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`; items.push({ label: 'IG', href, text: ig }); }\n"
        "        const tg = (sl.telegram || '').trim();\n"
        "        if (tg) { const href = tg.startsWith('http') ? tg : `https://t.me/${tg.replace(/^@/, '')}`; items.push({ label: 'TG', href, text: tg }); }\n"
        "        const web = (sl.website || '').trim();\n"
        "        if (web) { const href = web.startsWith('http') ? web : `https://${web}`; items.push({ label: 'Web', href, text: web }); }\n"
        "        const phone = (sl.phone || '').trim();\n"
        "        if (phone) items.push({ label: 'Tel', href: `tel:${phone}`, text: phone });\n"
        "        const wa = (sl.whatsapp || '').trim();\n"
        "        if (wa) { const num = wa.replace(/\\D/g, ''); items.push({ label: 'WA', href: `https://wa.me/${num.startsWith('98') ? num : num.replace(/^0/, '98')}`, text: wa }); }\n"
        "        if (!items.length) return null;\n"
        "        return (\n"
        "          <p className=\"mt-6 border-t border-border/40 pt-4 text-center text-xs text-gray-muted\">\n"
        "            {items.map((it, i) => (\n"
        "              <span key={it.label}>{i > 0 && <span className=\"mx-2 opacity-40\">.</span>}\n"
        "                <a href={it.href} target=\"_blank\" rel=\"noopener noreferrer\" className=\"hover:text-coral transition-colors\">{it.label}: <span dir=\"ltr\">{it.text}</span></a>\n"
        "              </span>\n"
        "            ))}\n"
        "          </p>\n"
        "        );\n"
        "      })()}\n"
    )
    target = (
        "      {hoursLine && (\n"
        "        <p className=\"mt-8 border-t border-border/60 pt-4 text-center text-sm text-gray\">\n"
        "          \u0633\u0627\u0639\u0627\u062a \u06a9\u0627\u0631\u06cc: {hoursLine}\n"
        "        </p>\n"
        "      )}\n"
        "    </div>\n"
        "  );\n"
        "}"
    )
    # try without unicode hours label
    if target not in pub:
        # softer: insert before final closing of main return
        marker = "    </div>\n  );\n}"
        if marker in pub and "Issue #36" not in pub:
            pub = pub.replace(marker, footer + "\n" + marker, 1)
            p.write_text(pub)
            print("public: patched (soft)")
            return True
        print("public: anchor not found")
        return False
    pub = pub.replace(target, target.replace("    </div>\n  );\n}", footer + "\n    </div>\n  );\n}"), 1)
    p.write_text(pub)
    print("public: patched")
    return True

if __name__ == "__main__":
    patch_service()
    patch_panel()
    patch_profile_ui()
    patch_public_ui()
