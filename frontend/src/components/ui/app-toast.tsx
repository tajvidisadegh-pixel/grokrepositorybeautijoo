'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

export type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const text = (message || '').trim();
    if (!text) return;
    const id = ++seq;
    setItems((prev) => [...prev.slice(-4), { id, kind, message: text }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m) => toast(m, 'success'),
      error: (m) => toast(m, 'error'),
      info: (m) => toast(m, 'info'),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-4 md:pb-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur',
              t.kind === 'success' && 'border-blue/30 bg-blue/10 text-blue',
              t.kind === 'error' && 'border-coral/40 bg-coral/10 text-coral',
              t.kind === 'info' && 'border-border bg-white/95 text-foreground',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-6">{t.message}</p>
              <button
                type="button"
                className="shrink-0 text-xs opacity-60 hover:opacity-100"
                onClick={() => dismiss(t.id)}
                aria-label="بستن"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op outside provider (SSR / tests)
    return {
      toast: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return ctx;
}
