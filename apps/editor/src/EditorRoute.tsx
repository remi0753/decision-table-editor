import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import {
  EDITOR_VIEWPORT_QUERY,
  isEditorViewportSupported,
} from '@/lib/editorViewport';
import { useUiStore } from '@/store/uiStore';

// The full editor (table, graph, dnd-kit, evaluation panel, …) is a heavy
// chunk; the mobile gate is a small, mostly-static page. We split them here —
// above the viewport decision — so a phone visitor downloads only the gate
// chunk instead of the entire editor. The URL stays `/edit` (it identifies the
// resource, not the device), and a viewport-driven resize still flips between
// the two without any navigation.
const EditorApp = lazy(() => import('@/EditorApp'));
const MobileEditorGate = lazy(() =>
  import('@/components/layout/MobileEditorGate').then((m) => ({
    default: m.MobileEditorGate,
  })),
);

function useEditorViewportSupported() {
  const [supported, setSupported] = useState(isEditorViewportSupported);

  useEffect(() => {
    const query = window.matchMedia(EDITOR_VIEWPORT_QUERY);
    const update = () => setSupported(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return supported;
}

export default function EditorRoute({
  forceLocal = false,
}: {
  forceLocal?: boolean;
}) {
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const viewportSupported = useEditorViewportSupported();
  // Lets a mobile visitor dismiss the gate and use the editor anyway for the
  // current session (large phones, landscape, foldables, power users).
  const [forceEditor, setForceEditor] = useState(false);
  const editorActive = viewportSupported || forceEditor;

  return (
    <Suspense fallback={null}>
      {editorActive ? (
        <EditorApp forceLocal={forceLocal} />
      ) : (
        <>
          <Toaster position="top-right" richColors />
          <MobileEditorGate
            lang={lang}
            setLang={setLang}
            onContinueAnyway={() => setForceEditor(true)}
          />
        </>
      )}
    </Suspense>
  );
}
