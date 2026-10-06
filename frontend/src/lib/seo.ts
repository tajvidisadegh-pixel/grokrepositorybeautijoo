const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Beautijoo';
const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export function absoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${APP_URL}${p}`;
}

export function siteName() {
  return APP_NAME;
}

export function appUrl() {
  return APP_URL;
}

/** Make media/CDN paths absolute for Open Graph (WhatsApp/Telegram need absolute URLs). */
export function absoluteMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_URL || '').trim().replace(/\/$/, '');
  if (mediaBase) {
    return `${mediaBase}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }
  // Fall back to site origin for same-host paths
  if (trimmed.startsWith('/')) return absoluteUrl(trimmed);
  return absoluteUrl(`/${trimmed}`);
}

/** Shared metadata for public pages: canonical + Open Graph + Twitter */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: string | null;
}): import('next').Metadata {
  const url = absoluteUrl(opts.path);
  const image = absoluteMediaUrl(opts.image);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: APP_NAME,
      title: opts.title,
      description: opts.description,
      url,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: opts.title,
      description: opts.description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** Minimal LocalBusiness/Person-style JSON-LD from real professional data */
export function professionalJsonLd(pro: {
  slug: string;
  title: string;
  bio?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  user?: { profile?: { displayName?: string | null; avatarUrl?: string | null } | null } | null;
  locations?: { location: { city: string; address: string; name: string } }[];
}) {
  const name =
    pro.user?.profile?.displayName || pro.title || 'زیباگر';
  const loc = pro.locations?.[0]?.location;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: pro.bio || pro.title,
    url: absoluteUrl(`/professionals/${pro.slug}`),
  };
  const img = absoluteMediaUrl(pro.user?.profile?.avatarUrl);
  if (img) data.image = img;
  if (pro.ratingAvg != null && pro.ratingCount && pro.ratingCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(pro.ratingAvg),
      reviewCount: pro.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (loc) {
    data.address = {
      '@type': 'PostalAddress',
      addressLocality: loc.city,
      streetAddress: loc.address,
      name: loc.name,
      addressCountry: 'IR',
    };
  }
  return data;
}
