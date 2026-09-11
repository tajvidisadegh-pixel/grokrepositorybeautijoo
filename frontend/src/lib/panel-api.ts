/**
 * Typed helpers for customer / professional / admin panel endpoints.
 *
 * Production policy (step 9):
 * - Admin helpers NEVER fall back to mock / sample / static data.
 * - On API failure callers must surface errors (PanelError / toast), not invent rows.
 * - NEXT_PUBLIC_USE_MOCK is unsupported and treated as off.
 */
if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_USE_MOCK is not allowed in production');
  }
}
import { apiClient } from './api';

export type Paginated<T> = { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number };
export type BookingListItem = {
  id: string; status: string; startAt: string; endAt?: string; notes?: string | null; totalPrice?: number | null;
  professional?: { id: string; slug?: string; title?: string | null; user?: { profile?: { displayName?: string | null } | null } | null } | null;
  customer?: { id: string; phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  services?: { id: string; name?: string; price?: number }[];
  items?: { service?: { id?: string; name?: string } | null; price?: number }[];
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
export type AdminUser = {
  id: string;
  phone?: string | null;
  email?: string | null;
  status?: string;
  accountType?: string;
  roles?: string[];
  profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  bookingCount?: number;
  favoritesCount?: number;
  reviewsCount?: number;
  successfulBookings?: number;
  cancelledBookings?: number;
  pendingBookings?: number;
  totalPaid?: number;
  city?: string | null;
  lastBooking?: {
    id?: string;
    startAt?: string;
    status?: string;
    totalPrice?: number | null;
    city?: string | null;
  } | null;
  lastNotification?: {
    id?: string;
    title?: string;
    createdAt?: string;
  } | null;
};
export type AdminUserBooking = {
  id: string;
  status?: string;
  startAt?: string;
  totalPrice?: number | null;
  professional?: { id?: string; title?: string | null; slug?: string | null } | null;
  payment?: { amount?: number | null; status?: string } | null;
};
export type AdminUserReview = {
  id: string;
  rating?: number;
  comment?: string | null;
  createdAt?: string;
  professional?: { id?: string; title?: string | null } | null;
};
export type AdminUserFavorite = {
  id: string;
  createdAt?: string;
  professionalId?: string;
  professional?: {
    id?: string;
    title?: string | null;
    slug?: string | null;
    status?: string;
    user?: { profile?: { displayName?: string | null; avatarUrl?: string | null } | null } | null;
  } | null;
};
export type AdminUserActivity = {
  at: string;
  kind: string;
  label: string;
  meta?: Record<string, unknown>;
};
export type AdminUserDetail = AdminUser & {
  stats?: {
    totalBookings?: number;
    successfulBookings?: number;
    cancelledBookings?: number;
    pendingBookings?: number;
    totalPaid?: number;
    paidTransactions?: number;
    professionalsUsed?: number;
    reviewsCount?: number;
    favoritesCount?: number;
  };
  bookings?: AdminUserBooking[];
  reviews?: AdminUserReview[];
  favorites?: AdminUserFavorite[];
  notifications?: { id: string; type?: string; title?: string; body?: string; readAt?: string | null; createdAt: string }[];
  activity?: AdminUserActivity[];
  auditLogs?: { id: string; action?: string; entityType?: string; entityId?: string; actorId?: string; before?: unknown; after?: unknown; createdAt: string }[];
};
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

export type ProBookingFilters = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  serviceId?: string;
};

export async function fetchProBookings(page = 1, limit = 20, filters?: ProBookingFilters) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (filters?.q) params.set('q', filters.q);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.serviceId) params.set('serviceId', filters.serviceId);
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(
    `/bookings/professional?${params.toString()}`,
  );
  return { items: unwrapList(res), raw: res };
}

export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {
  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);
}

export async function reportBookingToAdmin(id: string, message: string) {
  return apiClient.post<{ message: string; notified: number }>(`/bookings/${id}/report`, { message });
}

export async function fetchFavorites() {
  const res = await apiClient.get<FavoriteItem[] | Paginated<FavoriteItem>>('/favorites');
  return unwrapList(res as Paginated<FavoriteItem>);
}
export async function removeFavorite(professionalId: string) {
  return apiClient.delete(`/favorites/${professionalId}`);
}

export async function fetchNotifications(page = 1) {
  const res = await apiClient.get<NotificationItem[] | Paginated<NotificationItem>>(`/notifications?page=${page}`);
  return { items: unwrapList(res as Paginated<NotificationItem>), raw: res };
}
export async function fetchUnreadCount() {
  return apiClient.get<{ count: number }>('/notifications/unread-count');
}
export async function markNotificationRead(id: string) {
  return apiClient.patch(`/notifications/${id}/read`);
}
export async function createReview(payload: { bookingId: string; rating: number; comment?: string }) {
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
export async function patchMyService(id: string, payload: { durationMin?: number; price?: number; bufferMin?: number; description?: string; isActive?: boolean }) {
  return apiClient.patch(`/professionals/me/services/${id}`, payload);
}
export async function renameMyService(id: string, name: string) {
  return apiClient.patch(`/professionals/me/services/${id}/name`, { name });
}
export async function createCategoryNode(payload: { name: string; parentId?: string; slug?: string; description?: string; sortOrder?: number }) {
  return apiClient.post<CatalogCategory>('/categories', payload);
}
export async function createServiceNode(payload: { name: string; categoryId: string; slug?: string; description?: string }) {
  return apiClient.post<{ id: string; name: string; slug: string; categoryId: string }>('/services', payload);
}
export async function fetchMyAddOns(psId: string) {
  const res = await apiClient.get<ServiceAddOnItem[] | Paginated<ServiceAddOnItem>>(`/professionals/me/services/${psId}/add-ons`);
  return unwrapList(res as Paginated<ServiceAddOnItem>);
}
export async function upsertMyAddOn(psId: string, payload: { id?: string; name: string; description?: string; price: number; extraDurationMin?: number; sortOrder?: number; isActive?: boolean }) {
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
export async function addMyLocation(payload: { name?: string; address?: string; city: string; province?: string; latitude?: number; longitude?: number; isPrimary?: boolean }) {
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
export async function addTimeOff(payload: { startAt: string; endAt: string; reason?: string }) {
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
  const { getAccessToken, setTokens, clearTokens } = await import('./auth-storage');
  const { ApiError, tryRefresh } = await import('./api');
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  if (!isAllowedImageFile(file) && !(file.type || '').startsWith('video/')) {
    throw new ApiError(400, 'این فایل تصویر/ویدیو قابل قبول نیست. JPG، PNG، WEBP یا HEIC امتحان کنید.');
  }
  if (!file.size) throw new ApiError(400, 'فایل خالی است.');
  let token = getAccessToken();
  if (!token && typeof window !== 'undefined') token = await tryRefresh();
  if (!token) throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (professionalServiceId) form.append('professionalServiceId', professionalServiceId);
  const doUpload = async (access: string) =>
    fetch(`${API_URL}/professionals/me/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
      body: form,
      credentials: 'include',
    });
  let res: Response;
  try { res = await doUpload(token); } catch { throw new ApiError(0, 'ارتباط با سرور برقرار نشد.'); }
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) { clearTokens(); throw new ApiError(401, 'نشست منقضی شده. دوباره وارد شوید.'); }
    token = refreshed;
    try { res = await doUpload(token); } catch { throw new ApiError(0, 'ارتباط با سرور برقرار نشد.'); }
  }
  if (!res.ok) {
    let msg = 'آپلود ناموفق بود';
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

// Admin helpers
export async function fetchAdminStats() {
  return apiClient.get<AdminStats>('/admin/stats');
}

export async function fetchAdminUsers(opts: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  accountType?: string;
  city?: string;
} = {}) {
  const { page = 1, limit = 20, search, status, accountType, city } = opts;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (accountType) params.set('accountType', accountType);
  if (city) params.set('city', city);
  type UsersResponse = {
    items?: AdminUser[];
    data?: AdminUser[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
    total?: number;
  };
  const res = await apiClient.get<UsersResponse>(`/admin/users?${params.toString()}`);
  const items = unwrapList(res);
  const total = res.meta?.total ?? res.total ?? items.length;
  const meta = res.meta ?? {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
  return { items, meta, raw: res };
}

export async function fetchAdminUserDetail(id: string) {
  return apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
}

export async function adminNotifyUsers(payload: {
  userIds: string[];
  title: string;
  body: string;
  sms?: boolean;
}) {
  return apiClient.post<{ success: boolean; notified: number; smsSent: number }>(
    '/admin/notifications/notify',
    payload,
  );
}

export async function fetchAdminProfessionals(page = 1, limit = 20, status?: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  const res = await apiClient.get<Paginated<AdminProfessional> | AdminProfessional[]>(`/admin/professionals?${params.toString()}`);
  return { items: unwrapList(res as Paginated<AdminProfessional>), raw: res };
}

export async function adminSetProfessionalStatus(id: string, status: string) {
  return apiClient.patch(`/admin/professionals/${id}/status`, { status });
}
export async function adminSetUserStatus(id: string, status: string, reason?: string) {
  return apiClient.patch(`/admin/users/${id}/status`, { status, reason });
}
