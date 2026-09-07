# Revenue data fix (issue #37 item 3)

In `admin.service.ts` change:

```ts
const REVENUE_DATA_RELIABLE = false;
```

to:

```ts
/** Revenue from payments.status = paid; commission snapshots at payment success. */
const REVENUE_DATA_RELIABLE = true;
```

This enables:
- `overview.revenue.available = true` and total from paid payments
- `trends.revenue` 30-day series from `payments.paid_at`
