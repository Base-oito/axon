import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'
import NotificationBell from '@/features/notificacoes/NotificationBell'
import ChatPoller from '@/features/notificacoes/ChatPoller'
import UserMenu from '@/features/perfil/UserMenu'
import VoiceProvider from '@/features/chat/voice/VoiceProvider'

const HEADER_HINTS: Record<string, string> = {
  '/dashboard/nfe': 'NF-e de entrada — valores, status e imposto do período',
  '/dashboard/nfse': 'NFS-e de saída — emissões, valores e tributos do período',
  '/calendario': 'Calendário — obrigações, tarefas e reuniões',
  '/obrigacoes': 'Obrigações — modelos e controle por lista',
  '/dashboard/processos': 'Processos e tarefas — andamentos e pendências em foco',
  '/documentos': 'Documentos fiscais — pesquise, filtre e exporte notas',
  '/documentos/relatorios': 'Relatórios em segundo plano — acompanhe o status e baixe',
  '/documentos/eventos': 'Eventos das notas — histórico e consulta',
  '/chat': 'Conversas em tempo real — canais, DMs e anexos',
  '/clientes': 'Cadastro de clientes — pesquise e edite em linha',
  '/processos': 'Processos — modelos, instâncias, kanban e recorrências',
  '/tarefas': 'Tarefas — minhas tarefas e quadro kanban',
  '/automacao': 'Automação — saúde, agentes, certificados, OCR e processamento',
  '/ia': 'IA — OCR, classificação contábil e assistente',
  '/configuracoes': 'Configurações — usuários, plano de contas e integrações',
}

export default function AppShell() {
  const location = useLocation()
  const hint = HEADER_HINTS[location.pathname] || 'Bem-vindo ao Axon'

  return (
    <VoiceProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <ChatPoller />
        <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="divider-header relative z-20 flex h-16 shrink-0 items-center justify-between bg-background/80 px-6 backdrop-blur-md">
          <div className="min-w-0 truncate text-sm text-muted-foreground">
            {hint}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      </div>
    </VoiceProvider>
  )
}
