# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess

# Restore clean settings from pre-corruption commit
sha = 'e855474fdb19a42a7a8a1e184d73933a901b8677'
path = 'frontend/src/app/panel/settings/page.tsx'
raw = subprocess.check_output(['git', 'show', f'{sha}:{path}'], text=True)
Path(path).write_text(raw, encoding='utf-8')
print('restored settings from', sha, 'lines', raw.count(chr(10))+1)

t = Path(path).read_text(encoding='utf-8')

# 1) imports
t = t.replace(
    "  deleteAccount,\n  type SessionItem,\n} from '@/lib/panel-api';",
    "  deleteAccount,\n  requestChangePhone,\n  verifyChangePhone,\n  type SessionItem,\n} from '@/lib/panel-api';",
    1,
)

# 2) state after delLoading
t = t.replace(
    'const [delLoading, setDelLoading] = useState(false);',
    '''const [delLoading, setDelLoading] = useState(false);

  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code'>('idle');
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);''',
    1,
)

# 3) handlers before onLogout
handlers = '''
  async function onRequestPhoneChange() {
    setPhoneMsg(null);
    setPhoneErr(null);
    setPhoneLoading(true);
    try {
      await requestChangePhone(newPhone.trim());
      setPhoneStep('code');
      setPhoneMsg('کد تأیید به شماره جدید ارسال شد');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'خطا در ارسال کد';
      setPhoneErr(String(msg));
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
      setPhoneMsg(res?.message || 'شماره موبایل با موفقیت تغییر کرد');
      setPhoneStep('idle');
      setPhoneCode('');
      setNewPhone('');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'کد نامعتبر است';
      setPhoneErr(String(msg));
    } finally {
      setPhoneLoading(false);
    }
  }

'''
t = t.replace('  async function onLogout() {', handlers + '  async function onLogout() {', 1)

# 4) UI before danger zone
card = '''
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">تغییر شماره موبایل</h2>
        <p className="text-xs text-gray">
          شماره فعلی: <span dir="ltr">{user?.phone || '—'}</span> — شماره جدید فقط با کد تأیید OTP عوض می‌شود.
        </p>
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
            placeholder="کد تأیید"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            dir="ltr"
          />
        )}
        {phoneMsg && <p className="text-sm text-emerald-700">{phoneMsg}</p>}
        {phoneErr && <p className="text-sm text-red-600">{phoneErr}</p>}
        <div className="flex gap-2">
          {phoneStep === 'idle' ? (
            <Button
              size="sm"
              loading={phoneLoading}
              onClick={() => void onRequestPhoneChange()}
              disabled={newPhone.trim().length < 11}
            >
              ارسال کد
            </Button>
          ) : (
            <Button
              size="sm"
              loading={phoneLoading}
              onClick={() => void onVerifyPhoneChange()}
              disabled={phoneCode.trim().length < 4}
            >
              تأیید و تغییر
            </Button>
          )}
        </div>
      </Card>

'''

if 'منطقه خطر' in t:
    idx = t.find('منطقه خطر')
    cs = t.rfind('<Card', 0, idx)
    if cs > 0:
        t = t[:cs] + card + t[cs:]
        print('inserted phone card before danger zone')
    else:
        raise SystemExit('could not find Card before danger zone')
else:
    raise SystemExit('danger zone not found')

Path(path).write_text(t, encoding='utf-8')
print('settings ok, titles', t.count('تغییر شماره موبایل'))
print('brace', t.count('{') - t.count('}'))
print('has handlers', 'onRequestPhoneChange' in t and 'onVerifyPhoneChange' in t)
print('has onLogout', 'async function onLogout' in t)
print('has onDelete', 'async function onDeleteAccount' in t)
