/**
 * Admin dashboard / finance panel API helpers (split from panel-api for maintainability).
 */
import { apiClient } from './api';

type Paginated<T> = { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number };

function unwrapList<T>(res: Paginated<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return res.items ?? res.data ?? [];
}

export type AdminWindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};
export type AdminDayCount = { date: string; count: number };
export type AdminBookingDay = { date: string; total: number; completed: number; cancelled: number };
export type AdminRevenueDay = { date: string; amount: number };
export type AdminRecentActivityItem = {
  id: string;
  type: string;
  title?: string;
  createdAt: string;
  meta?: unknown;
};
export type AdminDashboard = {
  overview: {
    totalUsers: number;
    totalProfessionals: number;
    pendingProfessionals: number;
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalReviews: number;
    revenue: { available: boolean; total?: number };
  };
  timeStats: {
    today: AdminWindowStats;
    last7Days: AdminWindowStats;
    last30Days: AdminWindowStats;
    thisMonth: AdminWindowStats;
  };
  trends: {
    userGrowth: AdminDayCount[];
    professionalGrowth: AdminDayCount[];
    bookingActivity: AdminBookingDay[];
    revenue: AdminRevenueDay[] | null;
  };
  pending: {
    professionalsAwaitingReview: number;
    pendingPayments: number;
    failedPayments: number;
  };
  recentActivity: AdminRecentActivityItem[];
  recent?: {
    users?: unknown[];
    bookings?: unknown[];
    professionals?: unknown[];
  };
};

export async function fetchAdminDashboard() {
  return apiClient.get<AdminDashboard>('/admin/dashboard');
}

export type AdminFinancialPeriod = 'today' | 'this_month' | 'all_time';

export type HourlyFailedAlert = {
  isTriggered: boolean;
  failedCount: number;
  threshold: number;
  timeWindowMinutes: number;
};

export type AdminFinancialSummary = {
  period: AdminFinancialPeriod;
  currency: string;
  providerType: string;
  refundImplemented: boolean;
  grossRevenue: number;
  platformCommission: number;
  professionalPayout: number;
  paidCount: number;
  failedCount: number;
  pendingCount: number;
  refundedCount: number;
};

export type AdminFinancialTransactionsResponse = {
  items: Array<{
    id: string;
    bookingId: string;
    amount: number;
    status: string;
    provider: string;
    providerRef: string | null;
    createdAt: string;
    paidAt?: string | null;
  }>;
  total?: number;
  page?: number;
  limit?: number;
};

export type AdminFinancialTransaction = AdminFinancialTransactionsResponse['items'][number];

export type AdminFinancialTransactionDetail = AdminFinancialTransaction & {
  isCommissionSnapshotted?: boolean;
  platformCommissionRate?: number | null;
  platformCommissionAmount?: number | null;
  professionalNetAmount?: number | null;
  metadata?: unknown;
};

export async function fetchAdminFinancialSummary(period: AdminFinancialPeriod = 'all_time') {
  return apiClient.get<AdminFinancialSummary>(`/admin/finance/summary?period=${period}`);
}

export async function fetchAdminFinancialTransactions(params: {
  page?: number;
  limit?: number;
  status?: string;
  period?: AdminFinancialPeriod;
}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.period) q.set('period', params.period);
  const qs = q.toString();
  return apiClient.get<AdminFinancialTransactionsResponse>(
    `/admin/finance/transactions${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchAdminFinancialTransactionDetail(id: string) {
  return apiClient.get<AdminFinancialTransactionDetail>(`/admin/finance/transactions/${id}`);
}

export async function fetchAdminCommissionSetting() {
  return apiClient.get<{ rate: number }>('/admin/finance/commission');
}

export async function updateAdminCommissionSetting(rate: number) {
  return apiClient.post<{ rate: number }>('/admin/finance/commission', { rate });
}

export async function fetchAdminFailedTransactionsAlert() {
  return apiClient.get<HourlyFailedAlert>('/admin/finance/failed-alert');
}

export async function updateAdminFailedTransactionsThreshold(threshold: number) {
  return apiClient.post<{ success: boolean; threshold: number; updatedAt: string }>(
    '/admin/finance/failed-alert/threshold',
    { threshold },
  );
}
