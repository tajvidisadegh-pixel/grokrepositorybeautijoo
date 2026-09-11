/** Admin finance panel API helpers (split to keep panel-api lean). */
import { apiClient } from './api';

export type AdminFinancialPeriod = 'today' | 'this_month' | 'all_time';

export type AdminFinancialSummary = {
  grossRevenue: number;
  platformCommission: number;
  professionalNet: number;
  transactions: { paid: number; failed: number; pending?: number; cancelled?: number };
  period?: AdminFinancialPeriod;
};

export type AdminFinancialTransaction = {
  id: string;
  amount: number;
  status: string;
  provider: string;
  providerRef?: string | null;
  createdAt?: string;
  paidAt?: string | null;
  failedAt?: string | null;
  booking?: {
    id?: string;
    customer?: {
      phone?: string | null;
      profile?: { displayName?: string | null } | null;
    } | null;
    professional?: { title?: string | null } | null;
  } | null;
};

export type AdminFinancialTransactionDetail = AdminFinancialTransaction & {
  providerNote?: string | null;
  platformCommissionRate?: number | null;
  platformCommissionAmount?: number | null;
  professionalNetAmount?: number | null;
  metadata?: unknown;
};

export type AdminCommissionSetting = {
  rate: number;
  notice?: string | null;
};

export type HourlyFailedAlert = {
  failedCount: number;
  threshold: number;
  isTriggered: boolean;
  recentFailed?: Array<{
    id: string;
    amount: number;
    failedAt?: string | null;
    customerName?: string;
    professionalTitle?: string | null;
  }>;
};

export async function fetchAdminFinancialSummary(period: AdminFinancialPeriod = 'all_time') {
  return apiClient.get<AdminFinancialSummary>(
    `/admin/finance/summary?period=${encodeURIComponent(period)}`,
  );
}

export async function fetchAdminFinancialTransactions(params: {
  page?: number;
  limit?: number;
  status?: string;
  provider?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.provider) q.set('provider', params.provider);
  if (params.search) q.set('search', params.search);
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  const res = await apiClient.get<{
    items?: AdminFinancialTransaction[];
    data?: AdminFinancialTransaction[];
    meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
  }>(`/admin/finance/transactions?${q.toString()}`);
  const items = res.items ?? res.data ?? [];
  return { items, meta: res.meta ?? { page: params.page || 1, total: items.length, totalPages: 1 } };
}

export async function fetchAdminFinancialTransactionDetail(id: string) {
  return apiClient.get<AdminFinancialTransactionDetail>(`/admin/finance/transactions/${id}`);
}

export async function fetchAdminCommissionSetting() {
  return apiClient.get<AdminCommissionSetting>('/admin/finance/settings/commission');
}

export async function updateAdminCommissionSetting(rate: number) {
  return apiClient.post<AdminCommissionSetting & { notice?: string }>(
    '/admin/finance/settings/commission',
    { rate },
  );
}

export async function fetchAdminFailedTransactionsAlert() {
  return apiClient.get<HourlyFailedAlert>('/admin/finance/failed-alert');
}

export async function updateAdminFailedTransactionsThreshold(threshold: number) {
  return apiClient.post<HourlyFailedAlert>('/admin/finance/failed-alert/threshold', {
    threshold,
  });
}
