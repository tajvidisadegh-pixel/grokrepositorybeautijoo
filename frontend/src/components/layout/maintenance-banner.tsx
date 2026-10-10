'use client';

/** Shows planned outage notice when NEXT_PUBLIC_MAINTENANCE_MESSAGE is set. */
export function MaintenanceBanner() {
  const msg = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE?.trim();
  if (!msg) return null;
  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950" role="status">
      {msg}
    </div>
  );
}
