'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-2 text-2xl font-bold text-gray-dark">خطایی رخ داد</h2>
      <p className="mb-6 max-w-md text-sm text-gray">
        متأسفانه در پردازش درخواست شما مشکلی پیش آمد. می‌توانید دوباره تلاش کنید.
      </p>
      <Button onClick={() => reset()}>تلاش مجدد</Button>
    </div>
  );
}
