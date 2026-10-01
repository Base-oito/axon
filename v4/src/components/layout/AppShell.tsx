import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import NotificationBell from '@/features/notificacoes/NotificationBell'
import ChatPoller from '@/features/notificacoes/ChatPoller'
import ComunicadoModal from '@/features/notificacoes/ComunicadoModal'
import UserMenu from '@/features/perfil/UserMenu'
import VoiceProvider from '@/features/chat/voice/VoiceProvider'
import { useIsMobile } from '@/hooks/useMediaQuery'

const HEADER_HINTS: Record<string, string> = {
  '/dashboard/nfe': 'NF-e de entrada — valores, status e imposto do período',
  '/dashboard/nfse': 'NFS-e de saída — emissões, valores e tributos do período',
  '/calendario': 'Calendário — obrigações, tarefas e reuniões',
  '/obrigacoes': 'Obrigações — modelos e controle por lista',
  '/dashboard/processos': 'Processos e tarefas — andamentos e pendências em foco',
  '/dashboard/resultados': 'Resultados de projetos — KPIs, progresso e indicadores',
  '/documentos': 'Documentos fiscais — pesquise, filtre e exporte notas',
  '/documentos/relatorios': 'Relatórios em segundo plano — acompanhe o status e baixe',
  '/documentos/eventos': 'Eventos das notas — histórico e consulta',
  '/chat': 'Conversas em tempo real — canais, DMs e anexos',
  '/clientes': 'Cadastro de clientes — pesquise e edite em linha',
  '/clientes/documentos-recebidos': 'Documentos recebidos — envios dos clientes (folha, notas, boletos…)',
  '/projetos': 'Projetos — objetivos, tarefas ponderadas e progresso',
  '/portal-recepcao': 'Portal de atendimento — solicitações e pedidos dos clientes',
  '/tarefas': 'Tarefas — minhas tarefas e quadro kanban',
  '/automacao': 'Automação — saúde, agentes, certificados, OCR e processamento',
  '/ia': 'IA — OCR, classificação contábil e assistente',
  '/configuracoes': 'Configurações — usuários, plano de contas e integrações',
  '/crm': 'CRM — funil de vendas, oportunidades e fechamento de serviços',
}

export default function AppShell() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)
  const hint = HEADER_HINTS[location.pathname] || 'Bem-vindo ao Axon'

  // Fecha o drawer ao navegar
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Trava o scroll do body quando o drawer está aberto em mobile
  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, mobileOpen])

  return (
    <VoiceProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <ChatPoller />
        <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="divider-header relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 bg-background/80 px-3 backdrop-blur-md sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              {isMobile && (
                <button
                  onClick={() => setMobileOpen(true)}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <div className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                {hint}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 pb-24 sm:p-6">
            <Outlet />
          </main>
        </div>
        <ComunicadoModal />
      </div>
    </VoiceProvider>
  )
}