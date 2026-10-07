# -*- coding: utf-8 -*-
from pathlib import Path
import urllib.request

url = "https://raw.githubusercontent.com/tajvidisadegh-pixel/grokrepositorybeautijoo/e855474fdb19a42a7a8a1e184d73933a901b8677/frontend/src/app/panel/settings/page.tsx"
req = urllib.request.Request(url, headers={"User-Agent": "patcher"})
with urllib.request.urlopen(req, timeout=30) as r:
    t = r.read().decode("utf-8")
assert "async function onLogout" in t
assert "async function onDeleteAccount" in t

t = t.replace(
    "  deleteAccount,\n  type SessionItem,\n} from '@/lib/panel-api';",
    "  deleteAccount,\n  requestChangePhone,\n  verifyChangePhone,\n  type SessionItem,\n} from '@/lib/panel-api';",
    1,
)
t = t.replace(
    "const [delLoading, setDelLoading] = useState(false);",
    """const [delLoading, setDelLoading] = useState(false);

  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code'>('idle');
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);""",
    1,
)
handlers = """
  async function onRequestPhoneChange() {
    setPhoneMsg(null);
    setPhoneErr(null);
    setPhoneLoading(true);
    try {
      await requestChangePhone(newPhone.trim());
      setPhoneStep('code');
      setPhoneMsg('\u06a9\u062f \u062a\u0623\u06cc\u06cc\u062f \u0628\u0647 \u0634\u0645\u0627\u0631\u0647 \u062c\u062f\u06cc\u062f \u0627\u0631\u0633\u0627\u0644 \u0634\u062f');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || '\u062e\u0637\u0627 \u062f\u0631 \u0627\u0631\u0633\u0627\u0644 \u06a9\u062f';
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
      setPhoneMsg(res?.message || '\u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f');
      setPhoneStep('idle');
      setPhoneCode('');
      setNewPhone('');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || '\u06a9\u062f \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a';
      setPhoneErr(String(msg));
    } finally {
      setPhoneLoading(false);
    }
  }

"""
t = t.replace("  async function onLogout() {", handlers + "  async function onLogout() {", 1)
card = """
      <Card className=\"space-y-3 p-4\">
        <h2 className=\"text-base font-semibold\">\u062a\u063a\u06cc\u06cc\u0631 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644</h2>
        <p className=\"text-xs text-gray\">
          \u0634\u0645\u0627\u0631\u0647 \u0641\u0639\u0644\u06cc: <span dir=\"ltr\">{user?.phone || '\u2014'}</span> \u2014 \u0634\u0645\u0627\u0631\u0647 \u062c\u062f\u06cc\u062f \u0641\u0642\u0637 \u0628\u0627 \u06a9\u062f \u062a\u0623\u06cc\u06cc\u062f OTP \u0639\u0648\u0636 \u0645\u06cc\u200c\u0634\u0648\u062f.
        </p>
        <input
          className=\"h-11 w-full rounded-2xl border border-border px-3 text-sm\"
          placeholder=\"09xxxxxxxxx\"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          dir=\"ltr\"
        />
        {phoneStep === 'code' && (
          <input
            className=\"h-11 w-full rounded-2xl border border-border px-3 text-sm\"
            placeholder=\"\u06a9\u062f \u062a\u0623\u06cc\u06cc\u062f\"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            dir=\"ltr\"
          />
        )}
        {phoneMsg && <p className=\"text-sm text-emerald-700\">{phoneMsg}</p>}
        {phoneErr && <p className=\"text-sm text-red-600\">{phoneErr}</p>}
        <div className=\"flex gap-2\">
          {phoneStep === 'idle' ? (
            <Button
              size=\"sm\"
              loading={phoneLoading}
              onClick={() => void onRequestPhoneChange()}
              disabled={newPhone.trim().length < 11}
            >
              \u0627\u0631\u0633\u0627\u0644 \u06a9\u062f
            </Button>
          ) : (
            <Button
              size=\"sm\"
              loading={phoneLoading}
              onClick={() => void onVerifyPhoneChange()}
              disabled={phoneCode.trim().length < 4}
            >
              \u062a\u0623\u06cc\u06cc\u062f \u0648 \u062a\u063a\u06cc\u06cc\u0631
            </Button>
          )}
        </div>
      </Card>

"""
idx = t.find("\u0645\u0646\u0637\u0642\u0647 \u062e\u0637\u0631")
if idx < 0:
    raise SystemExit("danger not found")
cs = t.rfind("<Card", 0, idx)
if cs < 0:
    raise SystemExit("card not found")
t = t[:cs] + card + t[cs:]
Path("frontend/src/app/panel/settings/page.tsx").write_text(t, encoding="utf-8")
print("OK", "onLogout" in t, "onRequestPhoneChange" in t, t.count("{") - t.count("}"))
