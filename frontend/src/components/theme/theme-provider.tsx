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

type Theme = 'light' | 'dark';

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = 'bj-theme';

function applyDom(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default is always light; dark only if user explicitly chose it.
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark') {
        setThemeState('dark');
        applyDom('dark');
        return;
      }
      // light, missing, or any other value → light (no system preference)
      setThemeState('light');
      applyDom('light');
      if (stored !== 'light') {
        try {
          localStorage.setItem(STORAGE_KEY, 'light');
        } catch {
          /* ignore */
        }
      }
    } catch {
      applyDom('light');
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyDom(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light' as Theme,
      setTheme: (_t: Theme) => undefined,
      toggle: () => undefined,
    };
  }
  return ctx;
}
