import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const SoundPreview = lazy(() => import('./ui/SoundPreview'));
const previewSounds = new URLSearchParams(window.location.search).get('sounds') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {previewSounds ? <Suspense fallback={<p>Loading sound effects…</p>}><SoundPreview /></Suspense> : <App />}
  </StrictMode>,
);
