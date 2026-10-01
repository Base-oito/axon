import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import App from './App'
import '@/index.css'

// No app nativo (Capacitor) o SPA roda em https://localhost e as chamadas relativas
// /api/... precisam apontar para o servidor real. Interceptamos fetch globalmente
// (apenas no nativo e apenas para URLs relativas /api) — no web nada muda.
if (Capacitor.isNativePlatform()) {
  const ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined) || 'https://contador.app.baseoito.org'
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = input
    if (typeof input === 'string' && input.startsWith('/api')) {
      url = `${ORIGIN}${input}`
    } else if (input instanceof URL && input.pathname.startsWith('/api')) {
      url = new URL(input.pathname, ORIGIN)
    }
    return originalFetch(url as RequestInfo, init)
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)