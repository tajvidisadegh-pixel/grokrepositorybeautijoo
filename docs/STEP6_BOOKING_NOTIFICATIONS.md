# Step 6 — Booking notifications + SMS

## Behavior

| Event | In-app (customer) | In-app (professional) | SMS |
|-------|-------------------|------------------------|-----|
| create | yes | yes | professional |
| confirm | yes | yes | customer |
| reject | yes | yes | customer |
| cancel | yes | yes | both |
| complete | yes | yes | both |

Notifications are best-effort and never fail the booking transaction.
SMS uses `SMS_PROVIDER` (currently `MockSmsProvider` logs in non-prod).

Implemented via `NotificationsService.notify()` and `BookingsService` hooks.
