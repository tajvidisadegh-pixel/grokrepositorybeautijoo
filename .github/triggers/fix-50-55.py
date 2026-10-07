# -*- coding: utf-8 -*-
from pathlib import Path

def write(p, t):
    Path(p).write_text(t, encoding='utf-8')
    print('wrote', p)

# ===== 51 duration format =====
wiz = Path('frontend/src/components/booking/booking-wizard.tsx')
t = wiz.read_text(encoding='utf-8')
if 'function formatDurationFa' not in t:
    helper = "\nfunction formatDurationFa(totalMin: number): string {\n  const m = Math.max(0, Math.round(totalMin || 0));\n  if (m < 60) return `\u062d\u062f\u0648\u062f ${m.toLocaleString('fa-IR')} \u062f\u0642\u06cc\u0642\u0647`;\n  const h = Math.floor(m / 60);\n  const r = m % 60;\n  if (r === 0) return `\u062d\u062f\u0648\u062f ${h.toLocaleString('fa-IR')} \u0633\u0627\u0639\u062a`;\n  return `\u062d\u062f\u0648\u062f ${h.toLocaleString('fa-IR')} \u0633\u0627\u0639\u062a \u0648 ${r.toLocaleString('fa-IR')} \u062f\u0642\u06cc\u0642\u0647`;\n}\n\n"
    t = t.replace("type Step = 'service' | 'datetime' | 'summary' | 'done';", helper + "type Step = 'service' | 'datetime' | 'summary' | 'done';", 1)
# replace duration displays
t = t.replace('{totalDuration} \u062f\u0642\u06cc\u0642\u0647 \u2014 {formatPrice(displayPrice)}', '{formatDurationFa(totalDuration)} \u2014 {formatPrice(displayPrice)}')
t = t.replace('{totalDuration} \u062f\u0642\u06cc\u0642\u0647 \u2014 {formatPrice(displayPrice)}', '{formatDurationFa(totalDuration)} \u2014 {formatPrice(displayPrice)}')
# em-dash variants
for a,b in [
    ('{totalDuration} \u062f\u0642\u06cc\u0642\u0647 \u2014 {formatPrice(displayPrice)}', '{formatDurationFa(totalDuration)} \u2014 {formatPrice(displayPrice)}'),
    ('{totalDuration} \u062f\u0642\u06cc\u0642\u0647 \u2013 {formatPrice(displayPrice)}', '{formatDurationFa(totalDuration)} \u2013 {formatPrice(displayPrice)}'),
    ('{totalDuration} \u062f\u0642\u06cc\u0642\u0647 \u2014 {formatPrice(displayPrice)}', '{formatDurationFa(totalDuration)} \u2014 {formatPrice(displayPrice)}'),
]:
    t = t.replace(a,b)
# simpler: regex-like sequential
if '{formatDurationFa(totalDuration)}' not in t:
    t = t.replace('{totalDuration} \u062f\u0642\u06cc\u0642\u0647', '{formatDurationFa(totalDuration)}')
else:
    # still replace remaining raw minutes labels that are totalDuration
    import re
    t = re.sub(r'\{totalDuration\} \u062f\u0642\u06cc\u0642\u0647', '{formatDurationFa(totalDuration)}', t)
write(str(wiz), t)
print('51 has formatDurationFa', 'formatDurationFa' in t)

# ===== 53 beforeunload on services =====
svc = Path('frontend/src/app/zibagar/services/page.tsx')
t = svc.read_text(encoding='utf-8')
if 'beforeunload' not in t:
    # add dirty state after busy
    if 'const [editDirty, setEditDirty]' not in t:
        t = t.replace(
            "const [busy, setBusy] = useState(false);",
            "const [busy, setBusy] = useState(false);\n  const [editDirty, setEditDirty] = useState(false);",
            1,
        )
    # mark dirty when price/duration change in edit mode - wrap setters is hard; use effect on price/durationMin when mode==edit
    if 'window.addEventListener(\x27beforeunload\x27' not in t and 'beforeunload' not in t:
        effect = '''
  useEffect(() => {
    if (mode !== 'edit') {
      setEditDirty(false);
      return;
    }
    setEditDirty(true);
  }, [price, durationMin, priceRules, durationRules, mode]);

  useEffect(() => {
    if (!editDirty || mode !== 'edit') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editDirty, mode]);
'''
        # insert after state declarations - find first useEffect or load callback
        marker = 'const selectedPs = useMemo'
        if marker in t:
            t = t.replace(marker, effect + '\n  ' + marker, 1)
        else:
            # after showModels state block
            t = t.replace(
                "const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);",
                "const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);" + effect,
                1,
            )
    # clear dirty on successful save
    t = t.replace(
        'async function onSavePs() {',
        'async function onSavePs() {\n    // #40 item 53',
        1,
    )
    if 'setEditDirty(false)' not in t:
        # try to clear after successful save - look for setMsg after save
        t = t.replace(
            "setMsg('ذخیره شد')",
            "setMsg('\u0630\u062e\u06cc\u0631\u0647 \u0634\u062f');\n      setEditDirty(false)",
            1,
        )
        t = t.replace(
            'setMsg("\u0630\u062e\u06cc\u0631\u0647 \u0634\u062f")',
            'setMsg("\u0630\u062e\u06cc\u0631\u0647 \u0634\u062f");\n      setEditDirty(false)',
            1,
        )
write(str(svc), t)
print('53 services beforeunload', 'beforeunload' in t)

# ===== 53 profile social form dirty =====
prof = Path('frontend/src/app/zibagar/profile/page.tsx')
t = prof.read_text(encoding='utf-8')
if 'beforeunload' not in t:
    if 'const [socialDirty' not in t:
        t = t.replace(
            "const [socialMsg, setSocialMsg] = useState<string | null>(null);",
            "const [socialMsg, setSocialMsg] = useState<string | null>(null);\n  const [socialDirty, setSocialDirty] = useState(false);",
            1,
        )
    effect = '''
  useEffect(() => {
    if (!socialDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [socialDirty]);
'''
    if 'socialDirty' in t and 'beforeunload' not in t:
        t = t.replace(
            "const [socialDirty, setSocialDirty] = useState(false);",
            "const [socialDirty, setSocialDirty] = useState(false);" + effect,
            1,
        )
    # mark dirty when social form changes - patch setSocialForm calls is hard; intercept via wrapper on onChange
    # simpler: after setSocialForm in onChange patterns
    t = t.replace(
        'setSocialForm({',
        'setSocialDirty(true); setSocialForm({',
    )
    # avoid marking dirty on initial load - the initial setSocialForm in useEffect
    # fix: only the load one shouldn't set dirty. Revert load path
    t = t.replace(
        "setSocialDirty(true); setSocialForm({\n            instagram:",
        "setSocialForm({\n            instagram:",
        1,
    )
    # clear on save
    if 'saveSocialLinks' in t and 'setSocialDirty(false)' not in t:
        t = t.replace(
            'async function saveSocialLinks() {',
            'async function saveSocialLinks() {\n    // clear dirty after save',
            1,
        )
        # after success message
        for msg in ['\u0644\u06cc\u0646\u06a9\u200c\u0647\u0627 \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f', 'saved', '\u0630\u062e\u06cc\u0631\u0647']:
            pass
        import re
        t = re.sub(
            r"(setSocialMsg\([^)]+\);)",
            r"\1\n      setSocialDirty(false);",
            t,
            count=1,
        )
write(str(prof), t)
print('53 profile beforeunload', 'beforeunload' in t)

# ===== 55 change phone API =====
svc_auth = Path('backend/src/auth/auth.service.ts')
t = svc_auth.read_text(encoding='utf-8')
if 'requestChangePhone' not in t:
    methods = '''

  /** #40 item 55 — change phone with OTP on the new number */
  async requestChangePhone(userId: string, newPhoneRaw: string) {
    const newPhone = (newPhoneRaw || '').trim();
    if (!/^09\d{9}$/.test(newPhone)) {
      throw new BadRequestException('\u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644 \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a');
    }
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new UnauthorizedException();
    if (me.phone === newPhone) {
      throw new BadRequestException('\u0627\u06cc\u0646 \u0647\u0645\u0627\u0646 \u0634\u0645\u0627\u0631\u0647 \u0641\u0639\u0644\u06cc \u0634\u0645\u0627\u0633\u062a');
    }
    const taken = await this.prisma.user.findFirst({
      where: { phone: newPhone, id: { not: userId }, status: { not: UserStatus.deleted } },
    });
    if (taken) {
      throw new BadRequestException('\u0627\u06cc\u0646 \u0634\u0645\u0627\u0631\u0647 \u0642\u0628\u0644\u0627\u064b \u062b\u0628\u062a\u200c\u0646\u0627\u0645 \u0634\u062f\u0647 \u0627\u0633\u062a');
    }
    // reuse OTP pipeline with purpose change_phone
    return this.requestOtp({ phone: newPhone, purpose: 'change_phone', accountType: me.accountType } as any);
  }

  async verifyChangePhone(userId: string, newPhoneRaw: string, code: string) {
    const newPhone = (newPhoneRaw || '').trim();
    if (!/^09\d{9}$/.test(newPhone) || !code?.trim()) {
      throw new BadRequestException('\u062f\u0627\u062f\u0647\u200c\u0647\u0627 \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a');
    }
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new UnauthorizedException();
    const purpose = `change_phone:${me.accountType}`;
    await this.consumeOtp(newPhone, code.trim(), purpose);
    const taken = await this.prisma.user.findFirst({
      where: { phone: newPhone, id: { not: userId }, status: { not: UserStatus.deleted } },
    });
    if (taken) {
      throw new BadRequestException('\u0627\u06cc\u0646 \u0634\u0645\u0627\u0631\u0647 \u0642\u0628\u0644\u0627\u064b \u062b\u0628\u062a\u200c\u0646\u0627\u0645 \u0634\u062f\u0647 \u0627\u0633\u062a');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: newPhone, phoneVerified: true },
    });
    userAuthCache.invalidate(userId);
    return { message: '\u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f', phone: newPhone };
  }
'''
    # insert before final closing brace of class
    if t.rstrip().endswith('}'):
        # last line is closing of class
        idx = t.rfind('}\n')
        if idx < 0:
            idx = t.rfind('}')
        t = t[:idx] + methods + '\n}\n'
        write(str(svc_auth), t)
        print('55 auth.service methods added')
    else:
        print('WARN auth.service structure')
else:
    print('55 auth methods already present')

# controller endpoints
ctl = Path('backend/src/auth/auth.controller.ts')
t = ctl.read_text(encoding='utf-8')
if 'change-phone' not in t:
    block = '''
  @Post('change-phone/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestChangePhone(
    @CurrentUser('id') userId: string,
    @Body() body: { newPhone?: string },
  ) {
    return this.auth.requestChangePhone(userId, body?.newPhone || '');
  }

  @Post('change-phone/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyChangePhone(
    @CurrentUser('id') userId: string,
    @Body() body: { newPhone?: string; code?: string },
  ) {
    return this.auth.verifyChangePhone(userId, body?.newPhone || '', body?.code || '');
  }
'''
    # insert before delete-account or at end of class
    if "@Post('delete-account')" in t:
        t = t.replace("@Post('delete-account')", block + "\n  @Post('delete-account')", 1)
    else:
        idx = t.rfind('}')
        t = t[:idx] + block + '\n}\n'
    write(str(ctl), t)
    print('55 controller endpoints added')
else:
    print('55 controller already')

# panel-api helpers
api = Path('frontend/src/lib/panel-api.ts')
t = api.read_text(encoding='utf-8')
if 'requestChangePhone' not in t:
    helpers = '''
export async function requestChangePhone(newPhone: string) {
  return apiClient.post<{ message: string; expiresIn?: number }>('/auth/change-phone/request', { newPhone });
}

export async function verifyChangePhone(newPhone: string, code: string) {
  return apiClient.post<{ message: string; phone: string }>('/auth/change-phone/verify', { newPhone, code });
}
'''
    t = t + helpers
    write(str(api), t)
    print('55 panel-api helpers')

# settings UI
sett = Path('frontend/src/app/panel/settings/page.tsx')
t = sett.read_text(encoding='utf-8')
if 'requestChangePhone' not in t:
    t = t.replace(
        "  deleteAccount,\n  type SessionItem,\n} from '@/lib/panel-api';",
        "  deleteAccount,\n  requestChangePhone,\n  verifyChangePhone,\n  type SessionItem,\n} from '@/lib/panel-api';",
        1,
    )
    # state
    state = '''
  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code'>('idle');
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
'''
    t = t.replace(
        'const [delLoading, setDelLoading] = useState(false);',
        'const [delLoading, setDelLoading] = useState(false);' + state,
        1,
    )
    # handlers before return - find onChangePassword or similar
    handlers = '''
  async function onRequestPhoneChange() {
    setPhoneMsg(null);
    setPhoneErr(null);
    setPhoneLoading(true);
    try {
      await requestChangePhone(newPhone.trim());
      setPhoneStep('code');
      setPhoneMsg('\u06a9\u062f \u062a\u0623\u06cc\u06cc\u062f \u0628\u0647 \u0634\u0645\u0627\u0631\u0647 \u062c\u062f\u06cc\u062f \u0627\u0631\u0633\u0627\u0644 \u0634\u062f');
    } catch (e: unknown) {
      setPhoneErr(e instanceof Error ? e.message : '\u062e\u0637\u0627 \u062f\u0631 \u0627\u0631\u0633\u0627\u0644 \u06a9\u062f');
    } finally {
      setPhoneLoading(false);
    }
  }

  async function onVerifyPhoneChange() {
    setPhoneMsg(null);
    setPhoneErr(null);
    setPhoneLoading(true);
    try {
      const res = await verifyChangePhone(newPhone.trim(), phoneCode.trim());
      setPhoneMsg(res.message || '\u0634\u0645\u0627\u0631\u0647 \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f');
      setPhoneStep('idle');
      setPhoneCode('');
      setNewPhone('');
    } catch (e: unknown) {
      setPhoneErr(e instanceof Error ? e.message : '\u06a9\u062f \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a');
    } finally {
      setPhoneLoading(false);
    }
  }
'''
    t = t.replace(
        'async function onLogout() {',
        handlers + '\n  async function onLogout() {',
        1,
    )
    # UI section after password card - find change password heading area end
    # Insert after first Card closing is hard; insert before delete account section
    ui = '''
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">\u062a\u063a\u06cc\u06cc\u0631 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644</h2>
        <p className="text-xs text-gray">\u0634\u0645\u0627\u0631\u0647 \u0641\u0639\u0644\u06cc: {user?.phone || '\u2014'} \u2014 \u0634\u0645\u0627\u0631\u0647 \u062c\u062f\u06cc\u062f \u0628\u0627 \u06a9\u062f \u062a\u0623\u06cc\u06cc\u062f \u0645\u06cc\u200c\u0634\u0648\u062f.</p>
        <input
          className="h-11 w-full rounded-2xl border border-border px-3 text-sm"
          placeholder="09xxxxxxxxx"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          dir="ltr"
        />
        {phoneStep === 'code' && (
          <input
            className="h-11 w-full rounded-2xl border border-border px-3 text-sm"
            placeholder="\u06a9\u062f \u062a\u0623\u06cc\u06cc\u062f"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            dir="ltr"
          />
        )}
        {phoneMsg && <p className="text-sm text-emerald-700">{phoneMsg}</p>}
        {phoneErr && <p className="text-sm text-red-600">{phoneErr}</p>}
        <div className="flex gap-2">
          {phoneStep === 'idle' ? (
            <Button size="sm" loading={phoneLoading} onClick={() => void onRequestPhoneChange()} disabled={newPhone.trim().length < 11}>
              \u0627\u0631\u0633\u0627\u0644 \u06a9\u062f
            </Button>
          ) : (
            <Button size="sm" loading={phoneLoading} onClick={() => void onVerifyPhoneChange()} disabled={phoneCode.trim().length < 4}>
              \u062a\u0623\u06cc\u06cc\u062f \u0648 \u062a\u063a\u06cc\u06cc\u0631
            </Button>
          )}
        </div>
      </Card>
'''
    if '\u062d\u0630\u0641 \u062d\u0633\u0627\u0628' in t:
        t = t.replace('\u062d\u0630\u0641 \u062d\u0633\u0627\u0628', ui + '\u062d\u0630\u0641 \u062d\u0633\u0627\u0628', 1)
    elif 'deleteConfirm' in t:
        # insert before delete section - look for delMsg or حذف
        import re
        m = re.search(r'(<Card[^>]*>\s*<h2[^>]*>[^<]*\u062d\u0630\u0641)', t)
        if m:
            t = t[:m.start()] + ui + t[m.start():]
        else:
            # before last Card
            idx = t.rfind('<Card')
            if idx > 0:
                t = t[:idx] + ui + t[idx:]
    write(str(sett), t)
    print('55 settings UI')
else:
    print('55 settings already')

print('ALL DONE')
