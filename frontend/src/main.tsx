import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import './index.css'

// Apply persisted theme before first paint to avoid flash
const applyInitialTheme = () => {
  try {
    const stored = localStorage.getItem('releaseiq-ui')
    const theme = stored ? JSON.parse(stored)?.state?.theme : 'light'
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    } else if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.add('light')
    }
  } catch {
    document.documentElement.classList.add('light')
  }
}

applyInitialTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,              // always fetch fresh data — no stale cache
      gcTime: 0,                 // don't keep data in cache after component unmounts
      refetchOnWindowFocus: true,// re-fetch when user returns to the tab
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
