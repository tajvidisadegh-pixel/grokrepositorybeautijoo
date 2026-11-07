# Issue #82 — Item 1: auth.service.ts

**Status:** Resolved

## Problem
`backend/src/auth/auth.service.ts` had been reduced to placeholder text (`RESTORE_FROM_LOCAL`), which broke the backend build.

## Fix (already on main + beautijoo-backend-export)
- Full `AuthService` restored from known-good history
- Dual-role same-phone login/OTP retained (`candidates` / `otpCandidates`)
- No `PLACEHOLDER` / `RESTORE_FROM_LOCAL` markers

## Verification checklist
- [x] File contains `export class AuthService`
- [x] Methods: register, login, requestOtp, verifyOtp, issueTokens, consumeOtp
- [x] Export branch parity with main
- [ ] CI green on this commit
