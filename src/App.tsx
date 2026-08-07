import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import DashboardPage from './pages/Dashboard'
import InteligenciaPage from './pages/Inteligencia'
import ChatPage from './pages/Chat'
import ClientesPage from './pages/Clientes'
import ObrigacoesPage from './pages/Obrigacoes'
import ProcessosPage from './pages/Processos'
import TarefasPage from './pages/Tarefas'
import CalendarioPage from './pages/Calendario'
import ComunicadosPage from './pages/Comunicados'
import ConfiguracoesPage from './pages/Configuracoes'
import AutomacaoPage from './pages/Automacao'
import SolicitacoesPage from './pages/Solicitacoes'
import AuditoriaPage from './pages/Auditoria'
import SuportePage from './pages/Suporte'
import WhatsAppPage from './pages/WhatsApp'
import ReunioesPage from './pages/Reunioes'
import ImportacaoContabilPage from './pages/ImportacaoContabil'
import QuartelGeneralPage from './pages/QuartelGeneral'
import MonitorClientesPage from './pages/MonitorClientes'
import ChatPoller from './components/ChatPoller'
import QuickSearch from './components/QuickSearch'
import NotificationBell from './components/NotificationBell'
import ComunicadoModal from './components/ComunicadoModal'
import { ToastProvider } from './components/Toast'

function GlobalBell() {
  const location = useLocation()
  if (location.pathname === '/chat' || location.pathname === '/login') return null
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1">
      <NotificationBell />
    </div>
  )
}

export default function App() {
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null)

  useEffect(() => {
    const check = () => {
      try {
        const t = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
        if (t) {
          const payload = JSON.parse(atob(t.split('.')[1]))
          if (payload.exp) setTokenExpiry(payload.exp * 1000)
          else setTokenExpiry(null)
        } else setTokenExpiry(null)
      } catch { setTokenExpiry(null) }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <ChatPoller />
        <QuickSearch />
        <GlobalBell />
        <ComunicadoModal />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/inteligencia" element={<InteligenciaPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/obrigacoes" element={<ObrigacoesPage />} />
          <Route path="/processos" element={<ProcessosPage />} />
          <Route path="/tarefas" element={<TarefasPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/comunicados" element={<ComunicadosPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/automacao" element={<AutomacaoPage />} />
          <Route path="/solicitacoes" element={<SolicitacoesPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/suporte" element={<SuportePage />} />
          <Route path="/reunioes" element={<ReunioesPage />} />
          <Route path="/importacao-contabil" element={<ImportacaoContabilPage />} />
          <Route path="/quartel" element={<QuartelGeneralPage />} />
<Route path="/monitor-clientes" element={<MonitorClientesPage />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        {tokenExpiry && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none">
            <SessionTimer expiry={tokenExpiry} />
          </div>
        )}
      </ToastProvider>
    </BrowserRouter>
  )
}

function SessionTimer({ expiry }: { expiry: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor((expiry - Date.now()) / 60000)))
  const [show, setShow] = useState(false)
  const [col, setCol] = useState('text-pulse-ash')

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, Math.floor((expiry - Date.now()) / 60000))
      setRemaining(r)
      if (r <= 5) { setShow(true); setCol(r <= 2 ? 'text-danger' : 'text-infrared') }
      else setShow(false)
    }, 10000)
    return () => clearInterval(interval)
  }, [expiry])

  if (!show) return null

  return (
    <div className={`px-4 py-2 rounded-full bg-rich-carbon border border-urban-smoke text-xs pointer-events-auto ${col} flex items-center gap-3`}>
      <span>Sessão expira em {remaining}min</span>
      <button onClick={async () => {
        const t = JSON.parse(localStorage.getItem('nfse_token') || '{}')
        if (t.refresh_token) {
          const r = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh_token }) })
          if (r.ok) {
            const d = await r.json()
            localStorage.setItem('nfse_token', JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token || t.refresh_token }))
            window.location.reload()
          }
        }
      }} className="text-electric-teal hover:text-white transition-colors tracking-wider">Renovar</button>
    </div>
  )
}
