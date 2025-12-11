import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes data remains "fresh"
      gcTime: 1000 * 60 * 30,   // 30 minutes garbage collection
      refetchOnWindowFocus: false,
    },
  },
})

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
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
} catch (e) {
  document.body.innerHTML = `<h1>Fatal Error: ${e.message}</h1>`;
}
