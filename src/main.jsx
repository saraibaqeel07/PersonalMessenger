import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/pwa'; // capture the install prompt as early as possible
import App from './App';
import './styles.css';

// Keep --app-h equal to the *visible* height so the composer sits right above
// the on-screen keyboard on iOS as well as Android.
function syncHeight() {
  const h = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${h}px`);
  window.scrollTo(0, 0);
}
syncHeight();
window.visualViewport?.addEventListener('resize', syncHeight);
window.addEventListener('resize', syncHeight);

// block pinch / double-tap zoom so it feels like a native app
document.addEventListener('gesturestart', (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
