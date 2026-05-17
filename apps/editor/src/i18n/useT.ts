import { useUiStore } from '@/store/uiStore';
import { type Lang, translations } from './translations';

export function useT() {
  const lang = useUiStore((s) => s.lang);
  return translations[lang];
}

export function getT() {
  const lang =
    (typeof window !== 'undefined'
      ? (localStorage.getItem('leverie-lang') as Lang | null)
      : null) ?? 'en';
  return translations[lang] ?? translations.en;
}
