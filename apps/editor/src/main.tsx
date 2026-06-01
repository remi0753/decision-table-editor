import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Routing here is path-based and decided once at load (no client-side history
// API), so every in-app navigation is a full document load that re-runs the
// route logic. The back/forward cache breaks that assumption: it restores a
// page with whatever store state and in-flight requests it had when the user
// left it. A page navigated away from mid-init comes back stuck on "Checking
// cloud session..." because its frozen request never settles and effects don't
// re-run. Force a fresh load on bfcache restore so initialization runs again.
// The local draft (sessionStorage) and the auth cookie both survive the reload.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No root element found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
