import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted fonts (bundled by Vite) — no third-party Google Fonts requests.
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/geist';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import LegalPage from './LegalPage';
import './styles.css';

function Root() {
  const path = window.location.pathname;
  if (path === '/privacy-policy') return <LegalPage kind="privacy" />;
  if (path === '/terms-of-service') return <LegalPage kind="terms" />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
