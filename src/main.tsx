import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initializeSentry } from './lib/sentry';

// Initialize Sentry for error tracking
initializeSentry();

// Register service worker (Disabled in preview to avoid fetch/getter errors)
/*
if (typeof window !== 'undefined') {
  registerSW({ immediate: true })
}
*/

console.log("main.tsx: Rendering App");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
