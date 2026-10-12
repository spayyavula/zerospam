import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'zs-theme';

function readTheme(): Theme {
  if (typeof document !== 'undefined') {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
  }
  return 'light';
}

function persist(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

/**
 * Theme state shared by every toggle. The inline script in index.html sets
 * data-theme before first paint (saved choice, else the device's light/dark setting),
 * so we initialize from that DOM truth. The choice is saved only when the person
 * actually picks one, so until then the page keeps following their device.
 */
export function useTheme(): [Theme, (t: Theme) => void, () => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Other toggles on the page (or another tab) change the theme: stay in sync.
  useEffect(() => {
    const sync = () => setThemeState(readTheme());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((next: Theme) => {
    persist(next);
    setThemeState(next);
  }, []);
  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      persist(next);
      return next;
    });
  }, []);

  return [theme, setTheme, toggle];
}
