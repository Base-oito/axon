import type { LucideIcon } from 'lucide-react'
import {
  FileText, MessageSquare, LayoutDashboard, Users, CalendarClock,
  Workflow, MonitorSmartphone, Sparkles, Settings,
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
    ],
  },
  {
    label: 'Documentos',
    icon: FileText,
    items: [
      { label: 'Documentos', icon: FileText, path: '/documentos' },
      { label: 'Relatórios', icon: FileText, path: '/documentos/relatorios' },
      { label: 'Eventos', icon: FileText, path: '/documentos/eventos' },
    ],
  },
  {
    label: 'Chat',
    icon: MessageSquare,
    items: [
      { label: 'Conversas', icon: MessageSquare, path: '/chat' },
      { label: 'IA de atendimento', icon: Sparkles, path: '/chat/ia' },
    ],
  },
  {
    label: 'Clientes',
    icon: Users,
    items: [
      { label: 'Cadastro', icon: Users, path: '/clientes' },
      { label: 'Fichas', icon: Users, path: '/clientes/fichas' },
    ],
  },
  {
    label: 'Obrigações',
    icon: CalendarClock,
    items: [
      { label: 'Calendário', icon: CalendarClock, path: '/obrigacoes' },
      { label: 'Pendências', icon: CalendarClock, path: '/obrigacoes/pendencias' },
    ],
  },
  {
    label: 'Processos',
    icon: Workflow,
    items: [
      { label: 'Andamentos', icon: Workflow, path: '/processos' },
    ],
  },
  {
    label: 'Agentes',
    icon: MonitorSmartphone,
    items: [
      { label: 'Saúde', icon: MonitorSmartphone, path: '/agentes' },
      { label: 'Versões', icon: MonitorSmartphone, path: '/agentes/versoes' },
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
