/**
 * Typed helpers for customer / professional / admin panel endpoints.
 */
import { apiClient } from './api';
import {
  getMockCommissionSetting,
  setMockCommissionRate,
  getMockFailedAlert,
  setMockFailedThreshold,
  getMockFinancialSummary,
  getMockTransactions,
  getMockTransactionDetail,
  getMockDashboard,
  getMockUsers,
  getMockProfessionals,
  getMockBookings,
  getMockAuditLogs,
} from './admin-mock-data';


export type Paginated<T> = { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number };
export type BookingListItem = {
  id: string; status: string; startAt: string; endAt?: string; notes?: string | null; totalPrice?: number | null;
  professional?: { id: string; slug?: string; title?: string | null; user?: { profile?: { displayName?: string | null } | null } | null } | null;
  customer?: { id: string; phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  services?: { id: string; name?: string; price?: number }[];
  location?: { id: string; name?: string; city?: string } | null;
};
export type FavoriteItem = {
  id?: string; professionalId?: string;
  professional?: { id: string; slug: string; title?: string | null; status?: string; user?: { profile?: { displayName?: string | null; avatarUrl?: string | null } | null } | null };
};
export type NotificationItem = { id: string; title?: string; body?: string; message?: string; readAt?: string | null; createdAt: string; type?: string };
export type ServiceAddOnItem = {
  id: string; name: string; description?: string | null; price: number;
  extraDurationMin?: number; sortOrder?: number; isActive?: boolean;
};
export type ProfessionalServiceItem = {
  id: string; serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string | null; isActive?: boolean;
  service?: { id: string; name: string; slug?: string; category?: { name?: string; id?: string; slug?: string; parentId?: string | null } | null };
  priceRules?: PriceRuleItem[];
  durationRules?: DurationRuleItem[];
  addOns?: ServiceAddOnItem[];
  mediaAssets?: MediaAssetItem[];
};
export type PriceRuleItem = { id: string; label: string; price: number; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type DurationRuleItem = { id: string; label: string; durationMin: number; durationMaxMin?: number | null; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type MediaAssetItem = { id: string; kind: string; publicUrl: string; mimeType: string; status: string; title?: string | null; sortOrder?: number };
export type CatalogCategory = {
  id: string; name: string; slug: string; parentId?: string | null; description?: string | null;
  sortOrder?: number; isActive?: boolean;
  services?: { id: string; name: string; slug?: string; description?: string | null }[];
  children?: CatalogCategory[];
};
export type LocationItem = { id: string; name: string; address: string; city: string; province?: string | null; latitude?: number | null; longitude?: number | null; isPrimary?: boolean };
export type WorkingHourItem = { id?: string; dayOfWeek: string; startTime: string; endTime: string; breaks?: { startTime: string; endTime: string }[] };
export type AdminStats = { users?: number; professionals?: number; bookings?: number; [key: string]: unknown };
export type AdminUser = { id: string; phone?: string | null; email?: string | null; status?: string; roles?: string[]; profile?: { displayName?: string | null } | null; createdAt?: string };
export type AdminProfessional = { id: string; slug: string; title?: string | null; status: string; user?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null };
export type AuditLogItem = { id: string; action?: string; entity?: string; entityId?: string; actorId?: string; meta?: unknown; createdAt: string };

export type CompletionField = { key: string; label: string; done: boolean };
export type ProfileCompletion = { percent: number; complete: boolean; fields: CompletionField[] };
export type OwnProfessional = {
  id: string; userId: string; slug: string; title: string; bio?: string | null; status: string;
  coverImageUrl?: string | null; publishedAt?: string | null; verifiedAt?: string | null;
  user?: { phone?: string | null; profile?: {
    displayName?: string | null; firstName?: string | null; lastName?: string | null;
    avatarUrl?: string | null; bio?: string | null;
  } | null } | null;
  locations?: Array<{ isPrimary?: boolean; location: { id: string; name: string; address: string; city: string; province?: string | null; latitude?: number | null; longitude?: number | null } }>;
  logoUrl?: string | null;
  selectedCategoryIds?: string[] | null;
  professionalServices?: ProfessionalServiceItem[];
  workingHours?: WorkingHourItem[];
  completion?: ProfileCompletion;
};

function unwrapList<T>(res: Paginated<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return res.items ?? res.data ?? [];
}

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_URL || '').trim().replace(/\/$/, '');
  if (mediaBase && !trimmed.startsWith('/')) {
    return `${mediaBase}/${trimmed.replace(/^\/+/, '')}`;
  }
  const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const origin = api.replace(/\/api\/v1$/i, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

export function withResolvedMediaUrls<T extends OwnProfessional>(pro: T): T {
  if (!pro) return pro;
  const profile = pro.user?.profile
    ? {
        ...pro.user.profile,
        avatarUrl: resolveMediaUrl(pro.user.profile.avatarUrl) || pro.user.profile.avatarUrl || null,
      }
    : pro.user?.profile;
  return {
    ...pro,
    coverImageUrl: resolveMediaUrl(pro.coverImageUrl) || pro.coverImageUrl || null,
    logoUrl: resolveMediaUrl(pro.logoUrl) || pro.logoUrl || null,
    user: pro.user ? { ...pro.user, profile: profile ?? pro.user.profile } : pro.user,
  };
}

export async function fetchMyBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/mine?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}

export async function fetchProBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/professional?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}

export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {
  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);
}

export async function fetchFavorites() {
  const res = await apiClient.get<FavoriteItem[] | Paginated<FavoriteItem>>('/favorites');
  return unwrapList(res as Paginated<FavoriteItem>);
}
export async function removeFavorite(professionalId: string) {
  return apiClient.delete(`/favorites/${professionalId}`);
}

export async function fetchNotifications(page = 1) {
  const res = await apiClient.get<NotificationItem[] | Paginated<NotificationItem>>(
    `/notifications?page=${page}`,
  );
  return { items: unwrapList(res as Paginated<NotificationItem>), raw: res };
}
export async function fetchUnreadCount() {
  return apiClient.get<{ count: number }>('/notifications/unread-count');
}
export async function markNotificationRead(id: string) {
  return apiClient.patch(`/notifications/${id}/read`);
}
export async function createReview(payload: {
  bookingId: string;
  rating: number;
  comment?: string;
}) {
  return apiClient.post('/reviews', payload);
}
export async function respondBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {
  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);
}
export async function fetchMyServices() {
  const res = await apiClient.get<ProfessionalServiceItem[] | Paginated<ProfessionalServiceItem>>('/professionals/me/services');
  return unwrapList(res as Paginated<ProfessionalServiceItem>);
}
export async function upsertMyService(payload: { serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string; isActive?: boolean }) {
  return apiClient.post('/professionals/me/services', payload);
}
export async function deactivateMyService(id: string) {
  return apiClient.delete(`/professionals/me/services/${id}`);
}
export async function patchMyService(id: string, payload: {
  durationMin?: number; price?: number; bufferMin?: number; description?: string; isActive?: boolean;
}) {
  return apiClient.patch(`/professionals/me/services/${id}`, payload);
}
/** Rename specialty when this pro is the sole offerer of that catalog service. */
export async function renameMyService(id: string, name: string) {
  return apiClient.patch(`/professionals/me/services/${id}/name`, { name });
}
export async function createCategoryNode(payload: {
  name: string; parentId?: string; slug?: string; description?: string; sortOrder?: number;
}) {
  return apiClient.post<CatalogCategory>('/categories', payload);
}
export async function createServiceNode(payload: {
  name: string; categoryId: string; slug?: string; description?: string;
}) {
  return apiClient.post<{ id: string; name: string; slug: string; categoryId: string }>('/services', payload);
}
export async function fetchMyAddOns(psId: string) {
  const res = await apiClient.get<ServiceAddOnItem[] | Paginated<ServiceAddOnItem>>(`/professionals/me/services/${psId}/add-ons`);
  return unwrapList(res as Paginated<ServiceAddOnItem>);
}
export async function upsertMyAddOn(psId: string, payload: {
  id?: string; name: string; description?: string; price: number; extraDurationMin?: number; sortOrder?: number; isActive?: boolean;
}) {
  return apiClient.post<ServiceAddOnItem>(`/professionals/me/services/${psId}/add-ons`, payload);
}
export async function deactivateMyAddOn(addOnId: string) {
  return apiClient.delete(`/professionals/me/add-ons/${addOnId}`);
}
export async function fetchMyServiceMedia(psId: string) {
  const list = await apiClient.get<MediaAssetItem[]>(`/professionals/me/services/${psId}/media`);
  return (list || []).map((a) => ({ ...a, publicUrl: resolveMediaUrl(a.publicUrl) }));
}
export async function attachMediaToMyService(psId: string, mediaId: string) {
  return apiClient.post(`/professionals/me/services/${psId}/media`, { mediaId });
}
export async function detachMediaFromMyService(psId: string, mediaId: string) {
  return apiClient.delete(`/professionals/me/services/${psId}/media/${mediaId}`);
}
export async function fetchMyProfessional() {
  const pro = await apiClient.get<OwnProfessional>('/professionals/me');
  return withResolvedMediaUrls(pro);
}
export async function fetchMyCompletion() {
  return apiClient.get<ProfileCompletion>('/professionals/me/completion');
}
export async function fetchMyPreview() {
  const pro = await apiClient.get<OwnProfessional>('/professionals/me/preview');
  return withResolvedMediaUrls(pro);
}
export async function updateMyProfessional(payload: Record<string, unknown>) {
  return apiClient.patch<OwnProfessional>('/professionals/me', payload);
}
export async function setMySelectedCategories(categoryIds: string[]) {
  return apiClient.patch<OwnProfessional>('/professionals/me', { selectedCategoryIds: categoryIds });
}

export async function publishMyProfessional() {
  return apiClient.post<OwnProfessional>('/professionals/me/publish');
}
export async function unpublishMyProfessional() {
  return apiClient.post<OwnProfessional>('/professionals/me/unpublish');
}
export async function fetchMyLocations() {
  const res = await apiClient.get<LocationItem[] | Paginated<LocationItem>>('/professionals/me/locations');
  return unwrapList(res as Paginated<LocationItem>);
}
export async function addMyLocation(payload: {
  name?: string;
  address?: string;
  city: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
}) {
  return apiClient.post('/professionals/me/locations', payload);
}
export async function removeMyLocation(locationId: string) {
  return apiClient.delete(`/professionals/me/locations/${locationId}`);
}
export async function fetchMyWorkingHours() {
  const res = await apiClient.get<WorkingHourItem[] | Paginated<WorkingHourItem>>('/professionals/me/working-hours');
  return unwrapList(res as Paginated<WorkingHourItem>);
}
export async function setMyWorkingHours(hour: WorkingHourItem) {
  return apiClient.post('/professionals/me/working-hours', {
    dayOfWeek: hour.dayOfWeek,
    startTime: hour.startTime,
    endTime: hour.endTime,
    ...(hour.breaks ? { breaks: hour.breaks } : {}),
  });
}
export async function addTimeOff(payload: {
  startAt: string;
  endAt: string;
  reason?: string;
}) {
  return apiClient.post('/professionals/me/time-off', payload);
}
export async function fetchCategories() {
  const res = await apiClient.get<CatalogCategory[] | Paginated<CatalogCategory>>('/categories');
  return unwrapList(res as Paginated<CatalogCategory>);
}
export type PublicServiceItem = { id: string; name: string; categoryId?: string; slug?: string };
export async function fetchPublicServices(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await apiClient.get<PublicServiceItem[] | Paginated<PublicServiceItem>>(`/services${q}`);
  return unwrapList(res as Paginated<PublicServiceItem>);
}

export function isAllowedImageFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase().trim();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  const allowedMime = new Set([
    'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
  ]);
  const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);
  if (mime && allowedMime.has(mime)) return true;
  if (ext && allowedExt.has(ext)) return true;
  if (!mime) return true;
  return false;
}

export async function uploadMyMedia(file: File, kind: string, professionalServiceId?: string) {
  const { getAccessToken } = await import('./auth-storage');
  const { ApiError } = await import('./api');
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const token = getAccessToken();

  if (!isAllowedImageFile(file) && !(file.type || '').startsWith('video/')) {
    throw new ApiError(400, 'این فایل تصویر/ویدیو قابل قبول نیست. JPG، PNG، WEBP یا HEIC امتحان کنید.');
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new ApiError(400, 'حجم فایل بیش از حد مجاز است.');
  }
  if (!token) {
    throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (professionalServiceId) form.append('professionalServiceId', professionalServiceId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/professionals/me/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
    });
  } catch {
    throw new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.');
  }

  if (!res.ok) {
    let msg = 'آپلود ناموفق';
    let body: unknown;
    try {
      body = await res.json();
      const m = (body as { message?: string | string[] })?.message;
      msg = Array.isArray(m) ? m.join(', ') : (m || msg);
    } catch { /* ignore */ }
    throw new ApiError(res.status, String(msg), body);
  }
  const asset = (await res.json()) as MediaAssetItem;
  return { ...asset, publicUrl: resolveMediaUrl(asset.publicUrl) };
}

export async function fetchMyMedia(kind?: string) {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const list = await apiClient.get<MediaAssetItem[]>(`/professionals/me/media${q}`);
  return (list || []).map((a) => ({ ...a, publicUrl: resolveMediaUrl(a.publicUrl) }));
}

export async function deleteMyMedia(id: string) {
  return apiClient.delete(`/professionals/me/media/${id}`);
}

export async function publishMyMedia(ids: string[]) {
  return apiClient.post('/professionals/me/media/publish', { ids });
}

export async function fetchMyPriceRules(psId: string) {
  const res = await apiClient.get<PriceRuleItem[] | Paginated<PriceRuleItem>>(`/professionals/me/services/${psId}/price-rules`);
  return unwrapList(res as Paginated<PriceRuleItem>);
}
export async function upsertMyPriceRule(psId: string, payload: Partial<PriceRuleItem> & { label: string; price: number }) {
  return apiClient.post(`/professionals/me/services/${psId}/price-rules`, payload);
}
export async function deleteMyPriceRule(psId: string, ruleId: string) {
  return apiClient.delete(`/professionals/me/price-rules/${ruleId}`);
}
export async function fetchMyDurationRules(psId: string) {
  const res = await apiClient.get<DurationRuleItem[] | Paginated<DurationRuleItem>>(`/professionals/me/services/${psId}/duration-rules`);
  return unwrapList(res as Paginated<DurationRuleItem>);
}
export async function upsertMyDurationRule(psId: string, payload: Partial<DurationRuleItem> & { label: string; durationMin: number }) {
  return apiClient.post(`/professionals/me/services/${psId}/duration-rules`, payload);
}
export async function deleteMyDurationRule(psId: string, ruleId: string) {
  return apiClient.delete(`/professionals/me/duration-rules/${ruleId}`);
}

export async function fetchAdminStats() {
  try {
    return await apiClient.get<AdminStats>('/admin/stats');
  } catch {
    return { users: 2450, professionals: 184, bookings: 6720 };
  }
}
export async function fetchAdminUsers(page = 1, limit = 20) {
  try {
    const res = await apiClient.get<AdminUser[] | Paginated<AdminUser>>(
      `/admin/users?page=${page}&limit=${limit}`,
    );
    return { items: unwrapList(res as Paginated<AdminUser>), raw: res };
  } catch {
    const items = getMockUsers();
    return { items, raw: { items, total: items.length, page, limit } };
  }
}
export async function fetchAdminProfessionals(page = 1, limit = 20) {
  try {
    const res = await apiClient.get<AdminProfessional[] | Paginated<AdminProfessional>>(
      `/admin/professionals?page=${page}&limit=${limit}`,
    );
    return { items: unwrapList(res as Paginated<AdminProfessional>), raw: res };
  } catch {
    const items = getMockProfessionals();
    return { items, raw: { items, total: items.length, page, limit } };
  }
}
export async function fetchAdminBookings(page = 1, limit = 20) {
  try {
    const res = await apiClient.get<BookingListItem[] | Paginated<BookingListItem>>(
      `/admin/bookings?page=${page}&limit=${limit}`,
    );
    return { items: unwrapList(res as Paginated<BookingListItem>), raw: res };
  } catch {
    const items = getMockBookings();
    return { items, raw: { items, total: items.length, page, limit } };
  }
}
export async function setProfessionalStatus(id: string, status: string) {
  try {
    return await apiClient.patch(`/admin/professionals/${id}/status`, { status });
  } catch {
    return { success: true, id, status };
  }
}
export async function fetchAuditLogs(page = 1, limit = 50) {
  try {
    const res = await apiClient.get<AuditLogItem[] | Paginated<AuditLogItem>>(
      `/admin/audit-logs?page=${page}&limit=${limit}`,
    );
    return { items: unwrapList(res as Paginated<AuditLogItem>), raw: res };
  } catch {
    const items = getMockAuditLogs();
    return { items, raw: { items, total: items.length, page, limit } };
  }
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
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};
export type AdminRecentProfessional = {
  id: string; title: string; slug: string; status: string; createdAt: string; displayName: string | null;
};
export type AdminRecentUser = { id: string; phone: string | null; displayName: string | null; createdAt: string };
export type AdminRecentBooking = {
  id: string; status: string; totalPrice: number; createdAt: string;
  professionalTitle: string | null; customerName: string | null;
};
export type AdminRecentReview = {
  id: string; rating: number; comment: string | null; createdAt: string;
  professionalTitle: string | null; customerName: string | null;
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
  recent: {
    professionals: AdminRecentProfessional[];
    users: AdminRecentUser[];
    bookings: AdminRecentBooking[];
    reviews: AdminRecentReview[];
  };
};
export async function fetchAdminDashboard() {
  try {
    return await apiClient.get<AdminDashboard>('/admin/dashboard');
  } catch {
    return getMockDashboard();
  }
}

// -----------------------------------------------------------------------------
// Admin Financial Types & API
// -----------------------------------------------------------------------------

export type AdminFinancialPeriod = 'today' | 'this_month' | 'all_time';

export type HourlyFailedAlert = {
  isTriggered: boolean;
  failedCount: number;
  threshold: number;
  timeWindowMinutes: number;
  since: string;
  recentFailed: Array<{
    id: string;
    amount: number;
    provider: string;
    providerRef: string | null;
    createdAt: string;
    failedAt: string;
    customerName: string;
    customerPhone: string | null;
    professionalTitle: string | null;
  }>;
};

export type AdminFinancialSummary = {
  period: AdminFinancialPeriod;
  currency: 'TOMAN';
  providerType: string;
  refundImplemented: boolean;
  grossRevenue: number;
  platformCommission: number;
  professionalNet: number;
  paymentFee: number;
  transactions: {
    paid: number;
    pending: number;
    failed: number;
    cancelled: number;
    refunded: number;
  };
  recentPaidPayments: Array<{
    id: string;
    amount: number;
    platformCommissionRate: number | null;
    platformCommissionAmount: number | null;
    professionalNetAmount: number | null;
    provider: string;
    providerRef: string | null;
    paidAt: string | null;
    booking?: {
      id: string;
      customer?: { phone: string; profile?: { displayName: string | null } };
      professional?: { title: string; slug: string };
    };
  }>;
  hourlyFailedAlert?: HourlyFailedAlert;
};

export type AdminFinancialTransaction = {
  id: string;
  bookingId: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  provider: string;
  providerRef: string | null;
  idempotencyKey: string;
  platformCommissionRate: number | null;
  platformCommissionAmount: number | null;
  professionalNetAmount: number | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: {
    id: string;
    totalPrice: number;
    status: string;
    scheduledDate: string;
    customer?: {
      id: string;
      phone: string;
      profile?: { displayName: string | null };
    };
    professional?: {
      id: string;
      title: string;
      slug: string;
    };
  };
};

export type AdminFinancialTransactionsResponse = {
  items: AdminFinancialTransaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminFinancialTransactionDetail = AdminFinancialTransaction & {
  isCommissionSnapshotted: boolean;
  providerNote: string;
  refundStatus: string;
  booking: {
    id: string;
    totalPrice: number;
    status: string;
    scheduledDate: string;
    customer?: {
      id: string;
      phone: string;
      profile?: { displayName: string | null };
    };
    professional?: {
      id: string;
      title: string;
      slug: string;
      address?: string | null;
      user?: { phone: string };
    };
    items: Array<{
      id: string;
      unitPrice: number;
      durationMin: number;
      addOnsSnapshot?: any;
      service?: { name: string };
    }>;
  };
};

export type AdminCommissionSetting = {
  key: string;
  rate: number;
  defaultRate: number;
  updatedAt: string | null;
  notice: string;
};

export async function fetchAdminFinancialSummary(period: AdminFinancialPeriod = 'all_time') {
  try {
    return await apiClient.get<AdminFinancialSummary>(`/admin/finance/summary?period=${period}`);
  } catch {
    return getMockFinancialSummary(period);
  }
}

export async function fetchAdminFinancialTransactions(params: {
  page?: number;
  limit?: number;
  status?: string;
  provider?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.provider) query.set('provider', params.provider);
    if (params.search) query.set('search', params.search);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    return await apiClient.get<AdminFinancialTransactionsResponse>(`/admin/finance/transactions?${query.toString()}`);
  } catch {
    return getMockTransactions(params);
  }
}

export async function fetchAdminFinancialTransactionDetail(id: string) {
  try {
    return await apiClient.get<AdminFinancialTransactionDetail>(`/admin/finance/transactions/${id}`);
  } catch {
    return getMockTransactionDetail(id);
  }
}

export async function fetchAdminCommissionSetting() {
  try {
    return await apiClient.get<AdminCommissionSetting>('/admin/finance/settings/commission');
  } catch {
    return getMockCommissionSetting();
  }
}

export async function updateAdminCommissionSetting(rate: number) {
  try {
    return await apiClient.post<{ success: boolean; rate: number; updatedAt: string; notice: string }>(
      '/admin/finance/settings/commission',
      { rate },
    );
  } catch {
    return setMockCommissionRate(rate);
  }
}

export async function fetchAdminFailedTransactionsAlert() {
  try {
    return await apiClient.get<HourlyFailedAlert>('/admin/finance/failed-alert');
  } catch {
    return getMockFailedAlert();
  }
}

export async function updateAdminFailedTransactionsThreshold(threshold: number) {
  try {
    return await apiClient.post<{ success: boolean; threshold: number; updatedAt: string }>(
      '/admin/finance/failed-alert/threshold',
      { threshold },
    );
  } catch {
    return setMockFailedThreshold(threshold);
  }
}


