# Enable dashboard revenue metrics (issue #37 item 3)

In `admin.service.ts` change:

```ts
const REVENUE_DATA_RELIABLE = false;
```

to:

```ts
/**
 * Revenue metrics are sourced from payments with status=paid.
 * Commission snapshots (platformCommissionAmount / professionalNetAmount)
 * are written at payment success time — see payments/financial.util.ts.
 */
const REVENUE_DATA_RELIABLE = true;
```

Effects:
- `overview.revenue.available = true` and total from paid payments
- `trends.revenue` = last 30 days series from `payments.paid_at`

`getFinancialSummary` already uses real data; only the Super Admin dashboard
overview/trends were gated by this flag.
