/**
 * Emit one JSON line for structured logging (production-friendly).
 * Nest Logger still works elsewhere; this is additive for HTTP/metrics.
 */
export function logJson(
  level: 'log' | 'warn' | 'error' | 'debug',
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...payload,
  });
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
