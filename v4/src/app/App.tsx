import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from '@/app/LoadingScreen'
import AppShell from '@/components/layout/AppShell'

const Login = lazy(() => import('@/features/auth/Login'))
const NFeDashboard = lazy(() => import('@/features/dashboard/NFeDashboard'))
const NfseDashboard = lazy(() => import('@/features/dashboard/NfseDashboard'))
const ObrigacoesDashboard = lazy(() => import('@/features/dashboard/ObrigacoesDashboard'))
const ProcessosDashboard = lazy(() => import('@/features/dashboard/ProcessosDashboard'))

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
          <Route index element={<Navigate to="/dashboard/nfe" replace />} />
          <Route path="dashboard/nfe" element={<NFeDashboard />} />
          <Route path="dashboard/nfse" element={<NfseDashboard />} />
          <Route path="dashboard/obrigacoes" element={<ObrigacoesDashboard />} />
          <Route path="dashboard/processos" element={<ProcessosDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
