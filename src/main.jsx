import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

// Electron loads from file:// — HashRouter handles that correctly.
// Web (Vercel) stays on BrowserRouter for clean URLs.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Router>
  </StrictMode>,
)
