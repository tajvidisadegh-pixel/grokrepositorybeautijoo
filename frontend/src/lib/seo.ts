/** Site SEO helpers (#69 CI recheck) */
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
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  try {
    // relative path from our app or storage
    if (url.startsWith('/')) return absoluteUrl(url);
    return absoluteUrl(`/${url}`);
  } catch {
    return undefined;
  }
}
