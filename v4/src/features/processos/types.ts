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

export interface ChecklistItem {
  id: string
  nome: string
  anexo?: { nome: string; path: string; url: string } | null
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
  exige_documento?: boolean
  anexo?: { nome: string; path: string; url: string } | null
  user_id?: string
  dispara_template_id?: number | string | null
  // Aprovação
  exige_aprovacao?: boolean
  aprovador_id?: number | string | null
  documentos_exigidos?: Array<{ id: string; nome: string }>
  checklist?: ChecklistItem[]
  aprovacao_status?: 'pendente' | 'aprovada' | 'reprovada' | null
  aprovacao_solicitada_em?: string
  aprovacao_solicitada_por?: number | null
  aprovacao_decidida_em?: string
  aprovacao_decidida_por?: number | null
  aprovacao_comentario?: string
  ciencia_reprovacao?: { confirmado_por?: number | null; confirmado_em?: string }
}

export interface Template {
  id: number
  titulo: string
  categoria: string
  departamento_id: number | null
  recorrente: boolean
  recorrencia_padrao: string
  recorrencia_dia_mes?: number | null
  recorrencia_dia_semana?: number | null
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
  mostrar_ao_cliente?: boolean
  created_by_user_id?: number
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

export interface ProcessoAnexo {
  nome: string
  path: string
  url?: string
}

export interface AprovacaoPendente {
  processo_id: number
  processo_titulo: string
  cliente_nome: string
  etapa_id: string
  etapa_titulo: string
  solicitado_em?: string
  solicitado_por?: string
  aprovador_id?: number | null
  aprovador_nome?: string
  checklist: ChecklistItem[]
  documentos_exigidos: Array<{ id: string; nome: string }>
}

export interface ProcessoComentario {
  id: number
  processo_id: number
  user_id?: number
  user_nome?: string
  user_avatar?: string
  conteudo: string
  anexos?: ProcessoAnexo[]
  created_at?: string
}
