# Issue #82.9 — Repository exposure & secret hygiene

## Owner actions (cannot be done from CI alone)
1. **Make the repository private** on GitHub (Settings → General → Danger zone), or move secrets out of any public fork.
2. Run a history scan on a trusted machine:
   ```bash
   # gitleaks
   gitleaks detect --source . --verbose
   # or trufflehog
   trufflehog git file://. --only-verified
   ```
3. If any secret is found in history: **rotate** the credential immediately, then purge history (BFG / git filter-repo) if required.

## App-side hygiene already expected
- Never commit `.env`, Liara tokens, SMS API keys, or payment merchant keys.
- Production must set real `PAYMENT_PROVIDER` / SMS provider; mock/disabled are fail-safe defaults only.
- Prefer short-lived tokens and DB-backed role assignment over embedding privileges in git.

## Docs to review for oversharing
- Deployment runbooks under `docs/` (URLs, phone numbers for SUPER_ADMIN seed are OK; passwords are not).
- Old issue comments that may quote production env samples.

This item is **process + owner configuration**; code changes for #82.5–#82.8 do not require making the repo private but production safety assumes the owner completes the scan.
