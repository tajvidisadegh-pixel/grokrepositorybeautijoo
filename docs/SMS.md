# SMS / OTP (Beautijoo)

## Providers

| `SMS_PROVIDER` | Behavior |
|----------------|----------|
| `mock` (default in dev) | Logs OTP locally; **blocked in production** unless `ALLOW_MOCK_SMS=true` |
| `smsir` | Real delivery via [SMS.ir](https://sms.ir) REST API |

Interface: `backend/src/sms/sms.provider.ts`  
Wiring: `backend/src/sms/sms.module.ts` (factory selects implementation)

## SMS.ir setup (production)

1. In SMS.ir panel, create a **verify template** with a parameter for the code (e.g. `کد تأیید شما: #CODE#`).
2. Set Liara / host env (never commit values):

```bash
SMS_PROVIDER=smsir
SMSIR_API_KEY=...          # from SMS.ir panel
SMSIR_OTP_TEMPLATE_ID=123456
SMSIR_OTP_PARAM_NAME=CODE  # must match template parameter name
SMSIR_LINE_NUMBER=3000...  # optional; required only for free-text notification SMS
```

3. Restart backend. OTP uses `POST /v1/send/verify`; notifications use `POST /v1/send` when line number is set.

## Security

- API key only from environment / Liara variables.
- Real provider never logs the OTP code.
- Existing OTP rate limits (cooldown, max attempts, hourly/daily) still apply in `AuthService`.

## Architecture note

Existing `SmsProvider` injection is reused — **no rewrite** of auth or notifications required.
