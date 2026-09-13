/**
 * Typed helpers for customer / professional / admin panel endpoints.
 * Production policy: Admin helpers NEVER fall back to mock data.
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
export type PriceRuleItem = { id: string; label: string; price: number; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type DurationRuleItem = { id: string; label: string; durationMin: number; durationMaxMin?: number | null; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type MediaAssetItem = { id: string; kind: string; publicUrl: string; mimeType: string; status: string; title?: string | null; sortOrder?: number };
export type ProfessionalServiceItem = {
  id: string; serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string | null; isActive?: boolean;
  service?: { id: string; name: string; slug?: string; category?: { name?: string; id?: string; slug?: string; parentId?: string | null } | null };
  priceRules?: PriceRuleItem[];
  durationRules?: DurationRuleItem[];
  addOns?: ServiceAddOnItem[];
  mediaAssets?: MediaAssetItem[];
};
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
  id: string; phone?: string | null; email?: string | null; status?: string; accountType?: string; roles?: string[];
  profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null;
  createdAt?: string; lastLoginAt?: string | null; bookingCount?: number; city?: string | null;
  favoritesCount?: number | null; reviewsCount?: number | null;
};
export type AdminUserBooking = {
  id: string; status?: string; startAt?: string; totalPrice?: number | null;
  professional?: { id?: string; title?: string | null; slug?: string | null } | null;
  payment?: { amount?: number | null; status?: string } | null;
};
export type AdminUserReview = {
  id: string; rating?: number; comment?: string | null; createdAt?: string;
  professional?: { id?: string; title?: string | null } | null;
};
export type AdminUserDetail = AdminUser & {
  stats?: { totalBookings?: number; successfulBookings?: number; cancelledBookings?: number; totalPaid?: number; paidTransactions?: number; professionalsUsed?: number; reviewsCount?: number };
  bookings?: AdminUserBooking[];
  reviews?: AdminUserReview[];
  auditLogs?: { id: string; action?: string; entity?: string; entityId?: string; actorId?: string; meta?: unknown; createdAt: string }[];
};
export type AdminProfessional = {
  id: string; slug: string; title?: string | null; status: string; isFeatured?: boolean;
  ratingAvg?: number | string | null; ratingCount?: number | null; createdAt?: string; publishedAt?: string | null;
  city?: string | null; specialties?: string[]; bookingCount?: number; reviewCount?: number; mediaCount?: number;
  user?: { phone?: string | null; profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null } | null;
};
export type AdminProfessionalsQueue = {
  pendingProfessionals?: number; pendingMedia?: number; incompleteProfiles?: number; draftProfessionals?: number; suspendedProfessionals?: number;
};
export type AdminProfessionalDetail = AdminProfessional & {
  bio?: string | null; coverImageUrl?: string | null; logoUrl?: string | null;
  locations?: Array<{ isPrimary?: boolean; location?: { city?: string; address?: string; province?: string | null } }>;
  professionalServices?: Array<{ id: string; serviceId: string; price: number; durationMin: number; isActive?: boolean; service?: { name?: string; category?: { name?: string } | null } | null }>;
  mediaAssets?: Array<{ id: string; kind: string; status: string; publicUrl?: string; url?: string; title?: string | null }>;
  bookings?: Array<{ id: string; status?: string; startAt?: string; totalPrice?: number | null; customer?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null; payment?: { amount?: number | null; status?: string } | null }>;
  reviews?: Array<{ id: string; rating?: number; comment?: string | null; customer?: { profile?: { displayName?: string | null } | null } | null }>;
  stats?: { total?: number; successful?: number; cancelled?: number; pending?: number; revenue?: number; ratingAvg?: number | string | null; ratingCount?: number | null; reviewCount?: number; serviceCount?: number; mediaCount?: number };
};
export type AdminProfessionalsQuery = {
  page?: number; limit?: number; search?: string; status?: string; city?: string; specialty?: string; categoryId?: string;
  minRating?: number; registeredFrom?: string; registeredTo?: string; sortBy?: string; sortOrder?: string;
};
export type AuditLogItem = { id: string; action?: string; entity?: string; entityId?: string; actorId?: string; meta?: unknown; createdAt: string };
export type CompletionField = { key: string; label: string; done: boolean };
export type ProfileCompletion = { percent: number; complete: boolean; fields: CompletionField[] };
export type OwnProfessional = {
  id: string; userId: string; slug: string; title: string; bio?: string | null; status: string;
  coverImageUrl?: string | null; publishedAt?: string | null; verifiedAt?: string | null;
  user?: { phone?: string | null; profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null; avatarUrl?: string | null; bio?: string | null } | null } | null;
  locations?: Array<{ isPrimary?: boolean; location: { id: string; name: string; address: string; city: string; province?: string | null; latitude?: number | null; longitude?: number | null } }>;
  logoUrl?: string | null; selectedCategoryIds?: string[] | null;
  professionalServices?: ProfessionalServiceItem[]; workingHours?: WorkingHourItem[]; completion?: ProfileCompletion;
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
  if (mediaBase && !trimmed.startsWith('/')) return `${mediaBase}/${trimmed.replace(/^\/+/, '')}`;
  const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const origin = api.replace(/\/api\/v1$/i, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

export function withResolvedMediaUrls<T extends OwnProfessional>(pro: T): T {
  if (!pro) return pro;
  const profile = pro.user?.profile
    ? { ...pro.user.profile, avatarUrl: resolveMediaUrl(pro.user.profile.avatarUrl) || pro.user.profile.avatarUrl || null }
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
export type ProBookingFilters = { q?: string; status?: string; from?: string; to?: string; serviceId?: string };
export async function fetchProBookings(page = 1, limit = 20, filters?: ProBookingFilters) {
  const params = new URLSearchParams();
  params.set('page', String(page)); params.set('limit', String(limit));
  if (filters?.q) params.set('q', filters.q);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.serviceId) params.set('serviceId', filters.serviceId);
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/professional?${params.toString()}`);
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
    dayOfWeek: hour.dayOfWeek, startTime: hour.startTime, endTime: hour.endTime,
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
  const allowedMime = new Set(['image/jpeg','image/jpg','image/pjpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/heic-sequence','image/heif-sequence']);
  const allowedExt = new Set(['jpg','jpeg','png','webp','gif','heic','heif']);
  if (mime && allowedMime.has(mime)) return true;
  if (ext && allowedExt.has(ext)) return true;
  if (!mime) return true;
  return false;
}

export async function uploadMyMedia(file: File, kind: string, professionalServiceId?: string) {
  const { getAccessToken } = await import('./auth-storage');
  const { ApiError, tryRefresh } = await import('./api');
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  if (!isAllowedImageFile(file) && !(file.type || '').startsWith('video/')) {
    throw new ApiError(400, 'این فایل تصویر/ویدیو قابل قبول نیست.');
  }
  if (!file.size) throw new ApiError(400, 'فایل خالی است.');
  let token = getAccessToken();
  if (!token && typeof window !== 'undefined') token = await tryRefresh();
  if (!token) throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (professionalServiceId) form.append('professionalServiceId', professionalServiceId);
  const res = await fetch(`${API_URL}/professionals/me/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as any)?.message || 'آپلود ناموفق بود');
  }
  return res.json();
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
  return apiClient.get<AdminStats>('/admin/stats');
}
export type AdminUsersQuery = {
  page?: number; limit?: number; search?: string; status?: string; role?: string; accountType?: string; city?: string;
  bookingPresence?: 'any' | 'none' | 'has'; bookingStatus?: string; registeredFrom?: string; registeredTo?: string;
  neverNotified?: string | boolean; hasPaid?: string | boolean;
};
export type AdminNotifyResult = {
  success: boolean;
  notified: number;
  smsSent: number;
  campaignId?: string;
  failed?: number;
};
export type AdminNotificationCampaign = {
  campaignId: string;
  title: string;
  body: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  read: number;
};
export type AdminCampaignRecipient = {
  id: string;
  userId: string;
  phone?: string | null;
  displayName?: string | null;
  status: string;
  createdAt?: string;
  error?: string | null;
};
export async function fetchAdminUsers(q: AdminUsersQuery | number = 1, limitArg = 20) {
  const params = new URLSearchParams();
  if (typeof q === 'number') { params.set('page', String(q)); params.set('limit', String(limitArg)); }
  else {
    params.set('page', String(q.page || 1)); params.set('limit', String(q.limit || 20));
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    if (q.role) params.set('role', q.role);
    if (q.accountType) params.set('accountType', q.accountType);
    if (q.city) params.set('city', q.city);
    if (q.bookingPresence) params.set('bookingPresence', q.bookingPresence);
    if (q.bookingStatus) params.set('bookingStatus', q.bookingStatus);
    if (q.registeredFrom) params.set('registeredFrom', q.registeredFrom);
    if (q.registeredTo) params.set('registeredTo', q.registeredTo);
    if (q.neverNotified != null) params.set('neverNotified', String(q.neverNotified));
    if (q.hasPaid != null) params.set('hasPaid', String(q.hasPaid));
  }
  const res = await apiClient.get<Paginated<AdminUser> & { meta?: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/users?${params.toString()}`);
  const items = unwrapList(res as Paginated<AdminUser>);
  const meta = (res as { meta?: { page: number; limit: number; total: number; totalPages: number } }).meta || { page: 1, limit: 20, total: items.length, totalPages: 1 };
  return { items, meta, raw: res };
}
export async function fetchAdminUserDetail(id: string) {
  return apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
}
export async function adminNotifyUsers(payload: { userIds: string[]; title: string; body: string; sms?: boolean; campaignId?: string }) {
  return apiClient.post<AdminNotifyResult>('/admin/notifications/notify', payload);
}
export async function adminNotifyByFilter(payload: { title: string; body: string; sms?: boolean; limit?: number; filters?: Record<string, unknown> }) {
  return apiClient.post<AdminNotifyResult>('/admin/notifications/notify-by-filter', payload);
}
export async function fetchAdminNotificationCampaigns(page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams();
  params.set('page', String(page)); params.set('limit', String(limit));
  if (search) params.set('search', search);
  const res = await apiClient.get<Paginated<AdminNotificationCampaign> & { meta?: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/notifications/campaigns?${params.toString()}`);
  const items = unwrapList(res as Paginated<AdminNotificationCampaign>);
  const meta = (res as { meta?: { page: number; limit: number; total: number; totalPages: number } }).meta || { page: 1, limit: 20, total: items.length, totalPages: 1 };
  return { items, meta, raw: res };
}
export async function fetchAdminCampaignRecipients(campaignId: string, opts?: { status?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  params.set('page', String(opts?.page || 1)); params.set('limit', String(opts?.limit || 50));
  if (opts?.status) params.set('status', opts.status);
  return apiClient.get<{ campaignId: string; items: AdminCampaignRecipient[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/notifications/campaigns/${encodeURIComponent(campaignId)}?${params.toString()}`);
}
export async function adminRetryFailedCampaign(campaignId: string) {
  return apiClient.post<{ success: boolean; retried: number; campaignId: string; totalFailed?: number }>(`/admin/notifications/campaigns/${encodeURIComponent(campaignId)}/retry-failed`, {});
}
export async function fetchAdminProfessionals(query: AdminProfessionalsQuery | number = 1, limit = 20, status?: string) {
  const params = new URLSearchParams();
  if (typeof query === 'number') {
    params.set('page', String(query));
    params.set('limit', String(limit));
    if (status) params.set('status', status);
  } else {
    const q = query;
    params.set('page', String(q.page || 1));
    params.set('limit', String(q.limit || 20));
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    if (q.city) params.set('city', q.city);
    if (q.specialty) params.set('specialty', q.specialty);
    if (q.categoryId) params.set('categoryId', q.categoryId);
    if (q.minRating != null) params.set('minRating', String(q.minRating));
    if (q.registeredFrom) params.set('registeredFrom', q.registeredFrom);
    if (q.registeredTo) params.set('registeredTo', q.registeredTo);
    if (q.sortBy) params.set('sortBy', q.sortBy);
    if (q.sortOrder) params.set('sortOrder', q.sortOrder);
  }
  const path = '/admin/professionals';
  const res = await apiClient.get<Paginated<AdminProfessional> & { meta?: { page: number; limit: number; total: number; totalPages: number } }>(`${path}?${params.toString()}`);
  const items = unwrapList(res as Paginated<AdminProfessional>);
  const meta = (res as { meta?: { page: number; limit: number; total: number; totalPages: number } }).meta || { page: 1, limit: 20, total: items.length, totalPages: 1 };
  return { items, meta, raw: res };
}
export async function fetchAdminProfessionalsQueue() {
  return apiClient.get<AdminProfessionalsQueue>('/admin/professionals-queue');
}
export async function fetchAdminProfessionalDetail(id: string) {
  return apiClient.get<AdminProfessionalDetail>(`/admin/professionals/${id}`);
}
export async function adminUpdateProfessional(id: string, payload: { title?: string; bio?: string; isFeatured?: boolean; selectedCategoryIds?: string[] }) {
  return apiClient.patch<AdminProfessionalDetail>(`/admin/professionals/${id}/profile`, payload);
}
export async function adminSetProfessionalFeatured(id: string, isFeatured: boolean) {
  return apiClient.patch(`/admin/professionals/${id}/feature`, { isFeatured });
}
export async function adminSetMediaStatus(id: string, status: string) {
  return apiClient.patch(`/admin/media/${id}/status`, { status });
}
export async function fetchAdminBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/admin/bookings?page=${page}&limit=${limit}`);
  return { items: unwrapList(res as Paginated<BookingListItem>), raw: res };
}
export async function fetchAuditLogs(page = 1, limit = 30) {
  const res = await apiClient.get<Paginated<AuditLogItem> | AuditLogItem[]>(`/admin/audit-logs?page=${page}&limit=${limit}`);
  return { items: unwrapList(res as Paginated<AuditLogItem>), raw: res };
}
export async function adminSetProfessionalStatus(id: string, status: string, reason?: string) {
  return apiClient.patch(`/admin/professionals/${id}/status`, reason ? { status, reason } : { status });
}
export async function adminSetUserStatus(id: string, status: string, reason?: string) {
  return apiClient.patch(`/admin/users/${id}/status`, { status, reason });
}
