import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './app.css';

// Development builds intentionally do not register a Service Worker.
// Unregister an older Football Life worker without touching localStorage.
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations()
    .then(registrations=>registrations.filter(reg=>{
      try{return new URL(reg.scope).pathname.startsWith('/Game/');}catch{return false;}
    }).forEach(reg=>reg.unregister()))
    .catch(error=>console.warn('Old worker cleanup unavailable',error));
}
createRoot(document.getElementById('root')).render(<App/>);
