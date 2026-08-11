import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from '@/app/LoadingScreen'
import AppShell from '@/components/layout/AppShell'
import PlaceholderPage from '@/components/PlaceholderPage'
import { applyTheme, getInitialTheme } from '@/lib/theme'

const Login = lazy(() => import('@/features/auth/Login'))
const NFeDashboard = lazy(() => import('@/features/dashboard/NFeDashboard'))
const NfseDashboard = lazy(() => import('@/features/dashboard/NfseDashboard'))
const ObrigacoesDashboard = lazy(() => import('@/features/dashboard/ObrigacoesDashboard'))
const ProcessosDashboard = lazy(() => import('@/features/dashboard/ProcessosDashboard'))
const DocumentsPage = lazy(() => import('@/features/documentos/DocumentsPage'))
const RelatoriosPage = lazy(() => import('@/features/documentos/RelatoriosPage'))
const EventosPage = lazy(() => import('@/features/documentos/EventosPage'))
const ClientesPage = lazy(() => import('@/features/clientes/ClientesPage'))
const ChatPage = lazy(() => import('@/features/chat/ChatPage'))
const ProcessosPage = lazy(() => import('@/features/processos/ProcessosPage'))
const TarefasPage = lazy(() => import('@/features/tarefas/TarefasPage'))
const AutomacaoPage = lazy(() => import('@/features/automacao/AutomacaoPage'))
const ConfiguracoesPage = lazy(() => import('@/features/configuracoes/ConfiguracoesPage'))
const CalendarioPage = lazy(() => import('@/features/calendario/CalendarioPage'))
const ObrigacoesPage = lazy(() => import('@/features/obrigacoes/ObrigacoesPage'))

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
  useEffect(() => {
    applyTheme(getInitialTheme())
  }, [])

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
          <Route path="documentos/relatorios" element={<RelatoriosPage />} />
          <Route path="documentos/eventos" element={<EventosPage />} />

          {/* Demais seções do menu */}
          <Route path="chat" element={<ChatPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="obrigacoes" element={<ObrigacoesPage />} />
          <Route path="calendario" element={<CalendarioPage />} />
          <Route path="processos" element={<ProcessosPage />} />
          <Route path="tarefas" element={<TarefasPage />} />
          <Route path="automacao" element={<AutomacaoPage />} />
          <Route path="agentes" element={<Navigate to="/automacao" replace />} />
          <Route path="ia" element={<PlaceholderPage title="IA" description="OCR, classificação contábil e assistente — em construção." />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
          <Route path="configuracoes/plano-contas" element={<PlaceholderPage title="Plano de contas" description="Plano de contas — em construção." />} />
          <Route path="configuracoes/integracoes" element={<PlaceholderPage title="Integrações" description="Integrações — em construção." />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
