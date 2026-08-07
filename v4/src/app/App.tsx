import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from '@/app/LoadingScreen'
import AppShell from '@/components/layout/AppShell'
import PlaceholderPage from '@/components/PlaceholderPage'

const Login = lazy(() => import('@/features/auth/Login'))
const NFeDashboard = lazy(() => import('@/features/dashboard/NFeDashboard'))
const NfseDashboard = lazy(() => import('@/features/dashboard/NfseDashboard'))
const ObrigacoesDashboard = lazy(() => import('@/features/dashboard/ObrigacoesDashboard'))
const ProcessosDashboard = lazy(() => import('@/features/dashboard/ProcessosDashboard'))
const DocumentsPage = lazy(() => import('@/features/documentos/DocumentsPage'))

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

          {/* Área de documentos */}
          <Route path="documentos" element={<DocumentsPage />} />
          <Route path="documentos/relatorios" element={<PlaceholderPage title="Relatórios" description="Exportação de relatórios fiscais (Excel, PDF e XML) — em construção." />} />
          <Route path="documentos/eventos" element={<PlaceholderPage title="Eventos" description="Eventos fiscais: cancelamentos, correções e substituições — em construção." />} />

          {/* Demais seções do menu */}
          <Route path="chat" element={<PlaceholderPage title="Chat" description="Conversas internas e IA de atendimento — em construção." />} />
          <Route path="clientes" element={<PlaceholderPage title="Clientes" description="Cadastro e fichas de clientes — em construção." />} />
          <Route path="obrigacoes" element={<ObrigacoesDashboard />} />
          <Route path="processos" element={<ProcessosDashboard />} />
          <Route path="agentes" element={<PlaceholderPage title="Agentes" description="Saúde e versões dos agentes Windows — em construção." />} />
          <Route path="ia" element={<PlaceholderPage title="IA" description="OCR, classificação contábil e assistente — em construção." />} />
          <Route path="configuracoes" element={<PlaceholderPage title="Configurações" description="Usuários, plano de contas e integrações — em construção." />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
