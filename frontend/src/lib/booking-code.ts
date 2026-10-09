/** #40 item 74 */
export function shortBookingCode(id: string): string {
  return (id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}
export async function copyBookingCode(id: string): Promise<boolean> {
  const code = shortBookingCode(id);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
