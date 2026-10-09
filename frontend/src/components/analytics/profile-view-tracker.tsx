'use client';
import { useEffect } from 'react';
import { trackFunnel } from '@/lib/funnel';
export function ProfileViewTracker({ proId }: { proId: string }) {
  useEffect(() => { trackFunnel('profile_view', { pro: proId }); }, [proId]);
  return null;
}
