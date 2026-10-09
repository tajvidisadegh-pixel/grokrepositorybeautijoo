'use client';
import { useEffect, useState } from 'react';
export function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button type="button" aria-label="بازگشت به بالا"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 left-4 z-40 flex size-11 items-center justify-center rounded-full bg-coral text-white shadow-lg hover:bg-coral-dark sm:bottom-8 sm:left-8">↑</button>
  );
}
