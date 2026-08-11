import { apiFetch, getToken } from '@/lib/api'

export interface Obrigacao {
  id: number
  titulo: string
  client_name: string
  status: string
  prioridade: string
  meta_interna_date: string | null
  vencimento_legal_date: string | null
  departamento_nome: string
  responsavel_nome: string
  valor_total: number | null
  documento_requerido: boolean
  cliente_id: number
  arquivo_path: string | null
  user_id?: number | null
}

export interface TarefaCal {
  id: number
  titulo: string
  client_name?: string
  status: string
  prioridade: string
  vencimento_em?: string | null
  due_date?: string | null
  created_at: string
  user_name?: string
  departamento_nome?: string
  is_completed?: boolean
  blocked_by?: string[] | null
  coluna_id?: string | null
}

export interface Reuniao {
  id: number
  titulo: string
  descricao: string
  data: string
  hora_inicio: string
  hora_fim: string
  cliente_id: number | null
  cliente_nome: string | null
  sala: string
  created_by: number | null
  criado_por_nome: string | null
  participantes: Array<{ id: number; display_name: string }>
}

export interface UsuarioSimples {
  id: number
  display_name: string
  departamento_id: number | null
}

export function listObrigacoes() {
  return apiFetch<Obrigacao[]>('/api/obrigacoes')
}

export function listTarefasCal() {
  return apiFetch<TarefaCal[]>('/api/tarefas-completas')
}

export function listReunioes(dataInicio?: string, dataFim?: string) {
  const qs = dataInicio && dataFim ? `?data_inicio=${dataInicio}&data_fim=${dataFim}` : ''
  return apiFetch<Reuniao[]>(`/api/reunioes${qs}`)
}

export function listAllReunioes() {
  return apiFetch<Reuniao[]>('/api/reunioes')
}

export function listUsuariosReuniao() {
  return apiFetch<UsuarioSimples[]>('/api/reunioes/usuarios')
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

export function concluirTarefa(id: number) {
  return authFetch(`/api/tarefas/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ concluida_em: new Date().toISOString().split('T')[0] }),
  })
}

export async function concluirObrigacao(id: number, arquivo?: File | null) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const body: Record<string, unknown> = {
    status: 'Concluida',
    concluida_em: new Date().toISOString(),
    concluido_por: (() => {
      try {
        const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
        return tok ? Number(JSON.parse(atob(tok.split('.')[1])).sub) : null
      } catch {
        return null
      }
    })(),
  }
  if (arquivo) {
    const fd = new FormData()
    fd.append('file', arquivo)
    const r = await fetch(`/api/obrigacoes/${id}/upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t },
      body: fd,
    })
    if (!r.ok) throw new Error('Erro ao fazer upload do arquivo')
    const up = await r.json()
    body.arquivo_path = up.path
  }
  return authFetch(`/api/obrigacoes/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function salvarReuniao(payload: Record<string, unknown>, id?: number) {
  return id
    ? authFetch(`/api/reunioes/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : authFetch('/api/reunioes', { method: 'POST', body: JSON.stringify(payload) })
}

export function excluirReuniao(id: number) {
  return authFetch(`/api/reunioes/${id}`, { method: 'DELETE' })
}
