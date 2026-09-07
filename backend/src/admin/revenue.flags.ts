/**
 * Dashboard revenue metrics flag.
 * When true, overview.total and trends.revenue use payments with status=paid.
 * Commission snapshots are written at payment success (see financial.util.ts).
 */
export const REVENUE_DATA_RELIABLE = true;
