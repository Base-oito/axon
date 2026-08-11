export interface Agente {
  id: number
  machine_name: string
  machine_id: string
  last_heartbeat: string | null
  active: number | boolean
  operator_name: string
  cliente_id: number | null
  client_name: string | null
  heartbeat_interval: number
  tenant_id: number
  agent_version: string
  online: boolean
}

export interface AgenteTask {
  id: number
  agent_id: number
  client_id: number | null
  client_name: string | null
  task_type: string
  status: string
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ClienteCert {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  certificate_expires_at?: string | null
  certificate_path?: string | null
}

export interface Modelo {
  id: number
  titulo: string
  recorrencia?: string
  prioridade?: string
  departamento_id?: number | null
  departamento_nome?: string | null
  dia_vencimento?: number | null
  dia_meta_interna?: number | null
  documento_requerido?: boolean
  total_clientes?: number
  clientes?: Array<{ id: number; nome: string; cnpj?: string }>
}

export interface OcrTreino {
  id: number
  modelo_id: number | null
  nome: string
  campos: string | Array<Record<string, unknown>>
  uid: string
  created_at: string
}

export interface OcrRegion {
  id: string
  fieldName: string
  x: number
  y: number
  w: number
  h: number
  pageNum: number
  detectedValue?: string
}

export interface LoteResult {
  filename: string
  size?: number
  error?: string
  matched: boolean
  modelo_id?: number | null
  modelo_nome?: string
  treino_nome?: string
  fields?: Array<{ fieldName: string; value: string; source: string }>
  parser_results?: unknown
  has_parser?: boolean
}
