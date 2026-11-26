import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import './ux.css';
import './polish.css';
import './brand.css';
import DeferredExperienceLayer from './components/DeferredExperienceLayer.jsx';
import './responsive.css';
import './experience.css';
import './global-responsive.css';

const CHUNK_RECOVERY_KEY = 'sdc-chunk-recovery';
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  try {
    if (!sessionStorage.getItem(CHUNK_RECOVERY_KEY)) {
      sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
      window.location.reload();
      return;
    }
  } catch {
    window.location.reload();
    return;
  }
  console.error('A route module could not be loaded after automatic recovery.');
});

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
    <DeferredExperienceLayer />
  </BrowserRouter>
);
