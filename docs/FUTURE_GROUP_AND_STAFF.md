# Future: Group Services & Multi-Staff (Issue #18 Gap 17)

**Status:** Deferred (priority: low / future phase)  
**Date:** 2026-09-23  
**Constraint:** No big rewrite, no destructive migration, keep current single-professional booking green.

## Current model (production)

| Concept | Reality today |
|--------|----------------|
| Professional | One user account = one bookable calendar |
| Slot capacity | Implicit **1** (exclusive interval per professional) |
| Double-booking | Overlapping `Booking` rows for the same `professionalId` are rejected |
| Staff / team | **Not modeled** |
| Group / party size | **Not modeled** |

Relevant tables: `Professional`, `Booking`, `BookingItem`, `WorkingHour`, `TimeOff`, `ManualReservation`.

There is **no** `Staff`, `capacity`, or `partySize` field in Prisma schema.

## Why not implement in this pass

1. Availability engine assumes one exclusive resource (the professional).
2. Race / double-booking tests and SQL exclusion depend on that invariant.
3. Booking wizard, payment, notifications, and payouts all assume one calendar owner.
4. Introducing staff or capacity > 1 without rewriting slot generation would create **false free slots** or **silent overbooking**.

Per project rules: **NO BIG REWRITE**, **NO DATA DELETE**, additive-only hardening.

## Recommended phases (when product needs it)

### Phase A — Capacity on a single professional (smallest change)

Goal: same professional can take N concurrent bookings of the **same** service type (e.g. group class), still one calendar owner.

1. Additive columns (defaults preserve today’s behavior):
   - `ProfessionalService.maxConcurrent Int @default(1)`
   - Optional `Booking.partySize Int @default(1)`
2. Availability: count overlapping non-cancelled bookings; free if `count + partySize <= maxConcurrent`.
3. Keep existing exclusion logic for `maxConcurrent = 1` (all current data).
4. UI: optional “تعداد نفرات” only when `maxConcurrent > 1`.

**Migration:** additive nullable/default columns only; no backfill required beyond defaults.

### Phase B — Staff / multi-stylist under one brand

Goal: salon brand profile with several bookable people.

1. New tables (additive):
   - `Staff` (`id`, `professionalId` brand owner, `userId?`, `displayName`, `isActive`, …)
   - `StaffWorkingHour`, `StaffService` (or assign services to staff)
2. `Booking.staffId` optional; when null, behave as today (owner calendar).
3. Availability keyed by `staffId` (or professional when staff absent).
4. Public UX: “انتخاب زیباگر / استایلیست” after service, before slot.

**Do not** map multiple staff onto one professional calendar without `staffId` — that breaks fairness and payouts.

### Phase C — True group booking product UX

- Shared start time, multiple seats, waitlist, deposit rules.
- Notification copy for host vs guests.
- Commission / payout rules for multi-seat bookings.

## Explicit non-goals for now

- No half-implemented `Staff` table that nothing reads.
- No change to EXCLUDE / overlap rules until Phase A engine work lands with tests.
- No “سالن” wording in UI (product language remains **زیباگر**).

## Acceptance criteria when Phase A starts

- [ ] Unit tests: capacity 1 unchanged; capacity 2 allows two non-conflicting overlaps.
- [ ] E2E race test still passes for capacity 1.
- [ ] Booking wizard shows party size only when service allows it.
- [ ] Existing bookings and payouts untouched.
- [ ] CI green (unit + e2e).

## Summary for Gap 18.17

| Item | Outcome |
|------|--------|
| Full staff + group booking | **Deferred** |
| Runtime / schema change this commit | **None** |
| Design locked | This document |
| Safe next step | Phase A only, with tests first |
