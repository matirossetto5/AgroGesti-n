import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register'

// Register service worker
if (typeof window !== 'undefined') {
  registerSW({ immediate: true })
}

console.log("main.tsx: Rendering App");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
