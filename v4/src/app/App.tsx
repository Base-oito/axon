import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from '@/app/LoadingScreen'
import AppShell from '@/components/layout/AppShell'
import Login from '@/features/auth/Login'

const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'))

function getToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
  } catch {
    return null
  }
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null
  if (!getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
