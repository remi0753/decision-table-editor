import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { defaultPage, pageHref } from './docs/metadata';
import './styles.css';

const basePrefix = new URL(
  import.meta.env.BASE_URL,
  window.location.origin,
).pathname.replace(/\/$/, '');
const currentPath = window.location.pathname.replace(/\/$/, '');

if (currentPath === basePrefix) {
  window.location.replace(
    `${pageHref(defaultPage.slug)}${window.location.search}${window.location.hash}`,
  );
} else {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element not found.');
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
