import type { LucideIcon } from 'lucide-react'
import {
  FileText, MessageSquare, LayoutDashboard, Users, CalendarClock,
  Workflow, MonitorSmartphone, Sparkles, Settings, ClipboardCheck, Megaphone,
  FolderKanban, Inbox, Target,
} from 'lucide-react'

export interface NavItem {
  label: string
  icon: LucideIcon
  path: string
}

export interface NavSection {
  label: string
  icon: LucideIcon
  items: NavItem[]
  /** Se presente, a seção só aparece para usuários com "role" no token. */
  roles?: string[]
}

export function getTokenRole(): string {
  try {
    const raw = localStorage.getItem('nfse_token')
    if (!raw) return ''
    const obj = JSON.parse(raw)
    const token = obj?.access_token || obj?.token || ''
    if (!token) return ''
    const p = JSON.parse(atob(token.split('.')[1]))
    return p.role || ''
  } catch { return '' }
}

export function mencionaComercial(deptName: string): boolean {
  return (deptName || '').toLowerCase().replace('ç', 'c').replace('Ç', 'C').includes('omercial')
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'NF-e (entradas)', icon: FileText, path: '/dashboard/nfe' },
      { label: 'NFS-e (serviços)', icon: FileText, path: '/dashboard/nfse' },
      { label: 'Obrigações', icon: CalendarClock, path: '/dashboard/obrigacoes' },
      { label: 'Processos & Tarefas', icon: Workflow, path: '/dashboard/processos' },
      { label: 'Resultados de Projetos', icon: FolderKanban, path: '/dashboard/resultados' },
    ],
  },
  {
    label: 'Documentos',
    icon: FileText,
    items: [
      { label: 'Relatórios', icon: FileText, path: '/documentos' },
      { label: 'Eventos', icon: FileText, path: '/documentos/eventos' },
    ],
  },  {
    label: 'Chat',
    icon: MessageSquare,
    items: [
      { label: 'Conversas', icon: MessageSquare, path: '/chat' },
      { label: 'Comunicados', icon: Megaphone, path: '/comunicados' },
      { label: 'IA de atendimento', icon: Sparkles, path: '/chat/ia' },
    ],
  },
  {
    label: 'Clientes',
    icon: Users,
    items: [
      { label: 'Clientes', icon: Users, path: '/clientes' },
      { label: 'Documentos Recebidos', icon: Inbox, path: '/clientes/documentos-recebidos' },
      { label: 'Portal de atendimento', icon: MessageSquare, path: '/portal-recepcao' },
    ],
  },
  {
    label: 'CRM',
    icon: Target,
    items: [
      { label: 'Funil de vendas', icon: Target, path: '/crm' },
    ],
    roles: ['administrador', 'super_admin'],
  },
  {
    label: 'Calendário',
    icon: CalendarClock,
    items: [
      { label: 'Calendário', icon: CalendarClock, path: '/calendario' },
    ],
  },
  {
    label: 'Obrigações',
    icon: ClipboardCheck,
    items: [
      { label: 'Modelos e Controle', icon: ClipboardCheck, path: '/obrigacoes' },
    ],
  },
  {
    label: 'Processos',
    icon: Workflow,
    items: [
      { label: 'Andamentos', icon: Workflow, path: '/processos' },
      { label: 'Tarefas', icon: Workflow, path: '/tarefas' },
    ],
  },
  {
    label: 'Projetos',
    icon: FolderKanban,
    items: [
      { label: 'Projetos', icon: FolderKanban, path: '/projetos' },
    ],
  },
  {
    label: 'Automação',
    icon: MonitorSmartphone,
    items: [
      { label: 'Automação', icon: MonitorSmartphone, path: '/automacao' },
    ],
  },
  {
    label: 'IA',
    icon: Sparkles,
    items: [
      { label: 'OCR', icon: Sparkles, path: '/ia/ocr' },
      { label: 'Classificação contábil', icon: Sparkles, path: '/ia/classificacao' },
    ],
  },
  {
    label: 'Configurações',
    icon: Settings,
    items: [
      { label: 'Usuários', icon: Settings, path: '/configuracoes' },
      { label: 'Plano de contas', icon: Settings, path: '/configuracoes/plano-contas' },
      { label: 'Integrações', icon: Settings, path: '/configuracoes/integracoes' },
    ],
  },
]
