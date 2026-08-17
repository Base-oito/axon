export type StepType = 'Tarefa' | 'Obrigação' | 'Decisão' | 'Gatilho'

export interface BranchOption {
  label: string
  nextStepId: string
}

export interface SubtaskItem {
  id: string
  title: string
  isCompleted: boolean
}

export interface Etapa {
  id: string
  title: string
  type: StepType
  assignee?: string
  departamento_id?: number | null
  isCompleted?: boolean
  completedBy?: string
  completedAt?: string
  order: number
  options?: BranchOption[]
  selectedOptionId?: string
  dependsOn?: string[]
  subtasks?: SubtaskItem[]
  dias?: number
  dueDate?: string
  notificar_todos?: boolean
  user_id?: string
  dispara_template_id?: number | string | null
}

export interface Template {
  id: number
  titulo: string
  categoria: string
  departamento_id: number | null
  recorrente: boolean
  recorrencia_padrao: string
  etapas: Etapa[]
  created_at?: string
}

export interface Processo {
  id: number
  template_id?: number | null
  titulo: string
  cliente_nome: string
  cliente_id?: number | null
  status: string
  prioridade: string
  etapa_atual: string
  data_inicio?: string
  etapas: Etapa[]
  situacao: string
  visibilidade?: string
  recorrente?: number
  recorrencia?: string
  user_id?: number
  created_at?: string
  updated_at?: string
}

export interface RecurrenciaData {
  ativo: boolean
  clientes: number[]
  ultima_geracao?: string | null
}

export type RecurrenciaMap = Record<string, RecurrenciaData>

export interface GatilhoInfo {
  id?: string
  title?: string
}

export interface Vinculo {
  pai: Processo
  gatilho: GatilhoInfo
  dispara_template_id: number | string
  filho: Processo[] | null
}

export interface VinculosData {
  vinculos: Vinculo[]
}
