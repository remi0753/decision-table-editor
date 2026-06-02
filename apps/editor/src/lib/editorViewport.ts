export const EDITOR_VIEWPORT_QUERY =
  '(min-width: 768px) and (min-height: 640px)';

export function isEditorViewportSupported() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(EDITOR_VIEWPORT_QUERY).matches;
}
