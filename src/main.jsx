import React from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.jsx';
import './app.css';

// Keep the installed PWA up to date without deleting the local career save.
if ('serviceWorker' in navigator) {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() { update(true); },
    onRegisteredSW(_url,registration) {
      registration?.update().catch(()=>{});
      document.addEventListener('visibilitychange',()=>{
        if(!document.hidden)registration?.update().catch(()=>{});
      });
    }
  });
}
createRoot(document.getElementById('root')).render(<App />);
