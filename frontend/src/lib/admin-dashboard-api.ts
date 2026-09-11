/** Admin dashboard API helpers. */
import { apiClient } from './api';

export type AdminWindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
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
    userGrowth: Array<{ date: string; count: number }>;
    professionalGrowth: Array<{ date: string; count: number }>;
    bookingActivity: Array<{ date: string; total: number; completed: number; cancelled: number }>;
    revenue: Array<{ date: string; amount: number }> | null;
  };
  pending: {
    professionalsAwaitingReview: number;
    pendingPayments: number;
    failedPayments: number;
  };
  recentActivity: Array<{
    id: string;
    actor?: string | null;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
  recent: {
    professionals: Array<{ id: string; title?: string | null; displayName?: string | null; status: string }>;
    users: Array<{ id: string; displayName?: string | null; phone?: string | null; createdAt: string }>;
    bookings: Array<{ id: string; professionalTitle?: string | null; customerName?: string | null; status: string }>;
    reviews: Array<{ id: string; professionalTitle?: string | null; rating: number }>;
  };
};

export async function fetchAdminDashboard() {
  return apiClient.get<AdminDashboard>('/admin/dashboard');
}
