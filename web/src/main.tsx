import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted fonts (bundled by Vite) — no third-party Google Fonts requests.
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/geist';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
