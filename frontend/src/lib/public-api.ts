/** Server-safe public API helpers (no auth headers). */
import type {
  ProfessionalDetail,
  ProfessionalsSearchResponse,
  ServiceCategory,
  ServiceItem,
} from '@/types/public';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3000/api/v1';

/** Prevent Liara/CI `next build` hanging forever on Collecting page data */
const FETCH_TIMEOUT_MS = Number(process.env.PUBLIC_API_TIMEOUT_MS || 12_000);

export class PublicApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

async function publicGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
      : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: init?.signal ?? timeoutSignal,
      headers: { Accept: 'application/json', ...(init?.headers || {}) },
      next: init?.next ?? { revalidate: 60 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    throw new PublicApiError(0, `API unreachable (${FETCH_TIMEOUT_MS}ms): ${msg}`);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new PublicApiError(res.status, msg);
  }
  return data as T;
}

export type SearchParams = {
  q?: string;
  city?: string;
  category?: string;
  filterCategory?: boolean;
  page?: number;
  limit?: number;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  minDuration?: number;
  maxDuration?: number;
  sort?: string;
  availableDate?: string;
  lat?: number | string;
  lng?: number | string;
  radiusKm?: number | string;
  verifiedOnly?: boolean;
  gender?: string;
};

export function searchProfessionals(params: SearchParams = {}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.city) sp.set('city', params.city);
  if (params.category) sp.set('category', params.category);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.minRating != null) sp.set('minRating', String(params.minRating));
  if (params.minPrice != null) sp.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) sp.set('maxPrice', String(params.maxPrice));
  if (params.minDuration != null) sp.set('minDuration', String(params.minDuration));
  if (params.maxDuration != null) sp.set('maxDuration', String(params.maxDuration));
  if (params.sort) sp.set('sort', params.sort);
  if (params.availableDate) sp.set('availableDate', params.availableDate);
  if (params.lat != null) sp.set('lat', String(params.lat));
  if (params.lng != null) sp.set('lng', String(params.lng));
  if (params.radiusKm != null) sp.set('radiusKm', String(params.radiusKm));
  if (params.verifiedOnly) sp.set('verifiedOnly', 'true');
  if (params.gender) sp.set('gender', params.gender);
  if (params.filterCategory) sp.set('filterCategory', 'true');
  const qs = sp.toString();
  return publicGet<ProfessionalsSearchResponse>(`/professionals${qs ? `?${qs}` : ''}`);
}

export function listCategories() {
  return publicGet<ServiceCategory[]>('/categories');
}

export function getCategoryBySlug(slug: string) {
  return publicGet<ServiceCategory>(`/categories/${encodeURIComponent(slug)}`);
}

export function getProfessionalBySlug(slug: string) {
  return publicGet<ProfessionalDetail>(`/professionals/by-slug/${encodeURIComponent(slug)}`);
}

export function listServices(categorySlug?: string) {
  const qs = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
  return publicGet<ServiceItem[]>(`/services${qs}`);
}

export type PublishedSiteConfig = {
  content?: Record<string, unknown> & {
    hero?: Record<string, unknown>;
    texts?: Record<string, unknown>;
    features?: Record<string, unknown>;
  };
  sections?: { id: string; label?: string; enabled?: boolean; sortOrder: number }[];
};

export function getPublishedSiteConfig() {
  return publicGet<PublishedSiteConfig>('/site/published');
}
