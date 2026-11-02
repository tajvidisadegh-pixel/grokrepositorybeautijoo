/**
 * #65.5 — Public professional URLs use Latin (English) slug only.
 * Never expose internal UUID in public path segments.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True if value looks like a UUID (must not be used as public URL segment). */
export function isUuidLike(value: string): boolean {
  return UUID_RE.test(String(value || '').trim());
}

/**
 * Normalize user/input into a public URL slug:
 * - lowercase Latin letters, digits, hyphens only
 * - collapse separators, trim edges
 * - max 80 chars
 */
export function toPublicSlug(input: string): string {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    // strip combining marks (accents)
    .replace(/[\u0300-\u036f]/g, '');

  // Keep only a-z, 0-9, spaces/underscores/hyphens → hyphens
  let s = raw
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (s.length > 80) s = s.slice(0, 80).replace(/-$/, '');
  return s;
}

/** Valid public slug: 3–80 chars, Latin, not a pure number, not UUID. */
export function isValidPublicSlug(slug: string): boolean {
  const s = String(slug || '').trim();
  if (s.length < 3 || s.length > 80) return false;
  if (isUuidLike(s)) return false;
  if (/^\d+$/.test(s)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}
