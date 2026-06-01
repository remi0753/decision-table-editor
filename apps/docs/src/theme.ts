import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'leverie-theme';
// Cycle order for the header toggle.
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const readPreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
};

// Resolve a preference into the concrete theme to paint. Keeps the <html>
// data-theme attribute and the primed background color (set by the bootstrap
// script in index.html) in sync with React state.
const apply = (preference: ThemePreference) => {
  const dark =
    preference === 'dark' || (preference === 'system' && prefersDark());
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.backgroundColor = dark ? '#0f0e17' : '#faf9ff';
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) meta.content = dark ? '#0f0e17' : '#7c3aed';
};

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    apply(preference);
    if (preference === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  // Follow the OS scheme live while the preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      return next ?? 'system';
    });
  }, []);

  return { preference, setPreference, cycle };
}
