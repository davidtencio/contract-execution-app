
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global Error Handler for debugging
window.addEventListener('error', (event) => {
  const errorRoot = document.getElementById('root');
  if (errorRoot) {
    errorRoot.innerHTML = `
      <div style="color: red; padding: 20px; font-family: monospace; background: white;">
        <h1>Runtime Error</h1>
        <p>${event.message}</p>
        <pre>${event.error?.stack}</pre>
      </div>
    `;
  }
});

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  document.body.innerHTML = `<h1>Fatal Error: ${e.message}</h1>`;
}
