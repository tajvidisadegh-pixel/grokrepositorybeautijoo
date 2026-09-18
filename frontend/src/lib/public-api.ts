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
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    next: init?.next ?? { revalidate: 60 },
  });
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
  sort?: string;
  availableDate?: string;
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
  if (params.sort) sp.set('sort', params.sort);
  if (params.availableDate) sp.set('availableDate', params.availableDate);
  const qs = sp.toString();
  const path = params.filterCategory
    ? `/service-filters/professionals${qs ? `?${qs}` : ''}`
    : `/professionals${qs ? `?${qs}` : ''}`;
  return publicGet<ProfessionalsSearchResponse>(path);
}

export function getProfessionalBySlug(slug: string) {
  return publicGet<ProfessionalDetail>(`/professionals/${encodeURIComponent(slug)}`, {
    next: { revalidate: 30 },
  });
}

export function listCategories() {
  return publicGet<ServiceCategory[]>('/categories');
}

export function listFilterCategories() {
  return publicGet<ServiceCategory[]>('/service-filters/categories');
}

export function listServices(categorySlug?: string) {
  return publicGet<ServiceItem[]>(
    `/services${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ''}`,
  );
}

/** Published homepage CMS (draft is never returned). */
export type PublishedSiteConfig = {
  content: {
    hero?: {
      enabled?: boolean;
      title?: string;
      subtitle?: string;
      description?: string;
      ctaText?: string;
      ctaLink?: string;
      badge?: string;
      desktopImageUrl?: string | null;
      mobileImageUrl?: string | null;
    };
    texts?: {
      categoriesTitle?: string;
      categoriesLinkText?: string;
      featuredTitle?: string;
      featuredLinkText?: string;
      ctaTitle?: string;
      ctaDescription?: string;
      ctaPrimaryText?: string;
      ctaPrimaryLink?: string;
      ctaSecondaryText?: string;
      ctaSecondaryLink?: string;
    };
    features?: {
      showCategories?: boolean;
      showFeaturedProfessionals?: boolean;
      showBottomCta?: boolean;
      showSearchInHero?: boolean;
    };
    publishedAt?: string | null;
  };
  sections: Array<{ id: string; label: string; enabled: boolean; sortOrder: number }>;
};

export function getPublishedSiteConfig() {
  return publicGet<PublishedSiteConfig>('/public/site-config', {
    next: { revalidate: 30, tags: ['site-cms'] },
  });
}

export { API_URL };
