import type { MetadataRoute } from 'next';
import { listCategories, searchProfessionals } from '@/lib/public-api';
import { absoluteUrl } from '@/lib/seo';

const PRO_PAGE_SIZE = 100;
const PRO_MAX_PAGES = 20; // up to ~2000 profiles

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/search',
    '/professionals',
    '/services',
    '/privacy',
    '/terms',
    '/refund',
    '/cookies',
  ].map((path) => ({
    url: absoluteUrl(path || '/'),
    changeFrequency:
      path === ''
        ? 'daily'
        : path === '/privacy' ||
            path === '/terms' ||
            path === '/refund' ||
            path === '/cookies'
          ? 'monthly'
          : 'weekly',
    priority:
      path === ''
        ? 1
        : path === '/professionals' || path === '/search'
          ? 0.9
          : path === '/privacy' ||
              path === '/terms' ||
              path === '/refund' ||
              path === '/cookies'
            ? 0.3
            : 0.8,
  }));

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let proRoutes: MetadataRoute.Sitemap = [];
  let cityRoutes: MetadataRoute.Sitemap = [];

  try {
    const cats = await listCategories();
    categoryRoutes = (cats || []).map((c) => ({
      url: absoluteUrl(`/categories/${c.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    /* API unavailable at build — static only */
  }

  try {
    const cities = new Set<string>();
    const seenSlugs = new Set<string>();

    for (let page = 1; page <= PRO_MAX_PAGES; page++) {
      const pros = await searchProfessionals({ page, limit: PRO_PAGE_SIZE });
      const items = pros?.items || [];
      if (items.length === 0) break;

      for (const p of items) {
        if (!p.slug || seenSlugs.has(p.slug)) continue;
        seenSlugs.add(p.slug);
        proRoutes.push({
          url: absoluteUrl(`/professionals/${p.slug}`),
          changeFrequency: 'weekly',
          priority: 0.9,
        });
        const city = p.locations?.[0]?.location?.city;
        if (city) cities.add(city);
      }

      const total = pros?.meta?.total;
      if (total != null && page * PRO_PAGE_SIZE >= total) break;
      if (items.length < PRO_PAGE_SIZE) break;
    }

    cityRoutes = [...cities].map((city) => ({
      url: absoluteUrl(`/locations/${encodeURIComponent(city)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    /* ignore */
  }

  return [...staticRoutes, ...categoryRoutes, ...proRoutes, ...cityRoutes];
}
