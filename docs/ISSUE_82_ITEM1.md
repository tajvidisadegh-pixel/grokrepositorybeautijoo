# Issue #82 — Item 1: auth.service.ts

**Status:** Resolved (CI green on main)

## Problem
`backend/src/auth/auth.service.ts` had been reduced to placeholder text (`RESTORE_FROM_LOCAL`), which broke the backend build.

## Fix
- Full `AuthService` restored on `main` and `beautijoo-backend-export`
- Dual-role same-phone login/OTP retained (`candidates` / `otpCandidates`)
- No `PLACEHOLDER` / `RESTORE_FROM_LOCAL` markers
- Size ~25KB; methods present: register, login, requestOtp, verifyOtp, issueTokens, consumeOtp

## Verification
- [x] File contains `export class AuthService`
- [x] Export branch parity with main
- [x] CI workflow badge on `main`: **passing**
