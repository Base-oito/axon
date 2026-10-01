import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingScreen from '@/app/LoadingScreen'
import AppShell from '@/components/layout/AppShell'
import PlaceholderPage from '@/components/PlaceholderPage'
import { applyTheme, getInitialTheme } from '@/lib/theme'
import { storageGet, storageHydrateFromNative } from '@/lib/storage'

const Login = lazy(() => import('@/features/auth/Login'))
const PortalLogin = lazy(() => import('@/features/portal/PortalLogin'))
const PortalPainel = lazy(() => import('@/features/portal/PortalPainel'))
const PortalAdmin = lazy(() => import('@/features/portal/PortalAdmin'))
const DocRecebidos = lazy(() => import('@/features/portal/DocRecebidos'))
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
const ProcessoDetalhePage = lazy(() => import('@/features/processos/ProcessoDetalhePage'))
const TarefasPage = lazy(() => import('@/features/tarefas/TarefasPage'))
const AutomacaoPage = lazy(() => import('@/features/automacao/AutomacaoPage'))
const ConfiguracoesPage = lazy(() => import('@/features/configuracoes/ConfiguracoesPage'))
const CalendarioPage = lazy(() => import('@/features/calendario/CalendarioPage'))
const ObrigacoesPage = lazy(() => import('@/features/obrigacoes/ObrigacoesPage'))
const ComunicadosPage = lazy(() => import('@/features/comunicados/ComunicadosPage'))
const ProjetosPage = lazy(() => import('@/features/projetos/ProjetosPage'))
const CrmPage = lazy(() => import('@/features/crm/CrmPage'))
const ProjetosResultados = lazy(() => import('@/features/dashboard/ProjetosResultados'))

function RequireClient({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null
  try {
    const t = JSON.parse(localStorage.getItem('nfse_client_token') || '{}').access_token
    if (!t) return <Navigate to="/login" replace />
  } catch { return <Navigate to="/login" replace /> }
  return <>{children}</>
}

function getToken(): string | null {
  try {
    return JSON.parse(storageGet('nfse_token') || '{}').access_token
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
    storageHydrateFromNative()
  }, [])

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<RequireClient><PortalPainel /></RequireClient>} />
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
          <Route path="comunicados" element={<ComunicadosPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="obrigacoes" element={<ObrigacoesPage />} />
          <Route path="calendario" element={<CalendarioPage />} />
          <Route path="processos" element={<ProcessosPage />} />
          <Route path="processos/:id" element={<ProcessoDetalhePage />} />
          <Route path="tarefas" element={<TarefasPage />} />
          <Route path="projetos" element={<ProjetosPage />} />
          <Route path="projetos/:id" element={<ProjetosPage />} />
          <Route path="dashboard/resultados" element={<ProjetosResultados />} />
          <Route path="automacao" element={<AutomacaoPage />} />
          <Route path="agentes" element={<Navigate to="/automacao" replace />} />
          <Route path="portal-recepcao" element={<PortalAdmin />} />
          <Route path="clientes/documentos-recebidos" element={<DocRecebidos />} />
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
