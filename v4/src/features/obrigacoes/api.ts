import { apiFetch, getToken } from '@/lib/api'

export interface Obrigacao {
  id: number
  titulo: string
  client_name: string
  departamento_nome: string
  vencimento_legal_date: string | null
  meta_interna_date: string | null
  status: string
  prioridade: string
  recorrencia: string
  responsavel_nome: string
  valor_total: number | null
  documento_requerido: boolean
  cliente_id: number
  departamento_id: number | null
  user_id: number | null
  arquivo_path: string | null
  concluido_por: number | null
  concluido_por_nome: string | null
  concluida_em: string | null
  created_at: string
  pode_download?: boolean
}

export interface Modelo {
  id: number
  titulo: string
  recorrencia: string
  prioridade: string
  departamento_id: number | null
  departamento_nome: string | null
  dia_vencimento: number | null
  dia_meta_interna: number | null
  documento_requerido: boolean
  total_clientes?: number
  clientes?: Array<{ id: number; nome: string; cnpj?: string }>
}

export interface AuditoriaItem {
  id: number
  titulo: string
  client_name: string
  departamento_nome: string
  responsavel_nome: string
  concluido_por_nome: string
  concluida_em: string | null
  status: string
  vencimento_legal_date: string | null
  meta_interna_date: string | null
  valor_total: number | null
  dias_em_aberto: number
  documento_requerido: boolean
  arquivo_path: string | null
}

export interface EficienciaMes {
  mes: string
  total: number
  concluidas: number
}

export interface EficienciaColaborador {
  id: number
  nome: string
  serie: EficienciaMes[]
  total: number
  concluidas: number
  eficiencia: number
}

export interface AuditoriaEficiencia {
  meses: string[]
  colaboradores: EficienciaColaborador[]
}

export interface ReuniaoMes {
  mes: string
  horas: number
}

export interface ReuniaoColaborador {
  id: number
  nome: string
  serie: ReuniaoMes[]
  total_horas: number
}

export interface AuditoriaReunioes {
  meses: string[]
  colaboradores: ReuniaoColaborador[]
  total_horas: number
  internas: number
  externas: number
  internas_serie: number[]
  externas_serie: number[]
}

export function listObrigacoes() {
  return apiFetch<Obrigacao[]>('/api/obrigacoes')
}

export function listModelos() {
  return apiFetch<Modelo[]>('/api/modelos')
}

export function getModelo(id: number) {
  return apiFetch<Modelo>(`/api/modelos/${id}`)
}

export function listAuditoria() {
  return apiFetch<AuditoriaItem[]>('/api/obrigacoes/auditoria')
}

export function listAuditoriaEficiencia() {
  return apiFetch<AuditoriaEficiencia>('/api/obrigacoes/auditoria/eficiencia')
}

export function listAuditoriaReunioes() {
  return apiFetch<AuditoriaReunioes>('/api/obrigacoes/auditoria/reunioes')
}

export function listAuditoriaFiltros() {
  return apiFetch<{ clientes: Array<{ id: number; name: string }>; titulos: string[]; colaboradores: Array<{ id: number; name: string }> }>('/api/obrigacoes/auditoria/filtros')
}

async function authFetch(url: string, options: RequestInit = {}) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const r = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t, ...(options.headers || {}) },
  })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export function criarObrigacao(payload: Record<string, unknown>) {
  return authFetch('/api/obrigacoes', { method: 'POST', body: JSON.stringify(payload) })
}

export function atualizarObrigacao(id: number, payload: Record<string, unknown>) {
  return authFetch(`/api/obrigacoes/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function alterarStatus(id: number, status: string) {
  return authFetch(`/api/obrigacoes/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
}

export function excluirObrigacao(id: number) {
  return authFetch(`/api/obrigacoes/${id}`, { method: 'DELETE' })
}

export function atualizarValor(id: number, valor: number | null) {
  return authFetch(`/api/obrigacoes/${id}/valor`, { method: 'PUT', body: JSON.stringify({ valor_total: valor }) })
}

export function criarModelo(payload: Record<string, unknown>) {
  return authFetch('/api/modelos', { method: 'POST', body: JSON.stringify(payload) })
}

export function atualizarModelo(id: number, payload: Record<string, unknown>) {
  return authFetch(`/api/modelos/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function excluirModelo(id: number) {
  return authFetch(`/api/modelos/${id}`, { method: 'DELETE' })
}

export function gerarModelo(id: number) {
  return authFetch(`/api/modelos/${id}/gerar`, { method: 'POST', body: JSON.stringify({}) })
}

export async function uploadAnexo(id: number, file: File) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`/api/obrigacoes/${id}/upload`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t },
    body: form,
  })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export function urlDownloadAnexo(id: number) {
  return `/api/obrigacoes/${id}/arquivo`
}
