import { apiFetch, getToken } from '@/lib/api'
import type { AprovacaoPendente, Etapa, Processo, ProcessoComentario, RecurrenciaMap, Template, VinculosData } from './types'

export async function listTemplates(): Promise<Template[]> {
  return apiFetch<Template[]>('/api/processo-templates')
}

export async function listProcessos(meus?: boolean): Promise<Processo[]> {
  const q = meus ? '?meus=true' : ''
  return apiFetch<Processo[]>(`/api/processos${q}`)
}

export async function getProcesso(id: number): Promise<Processo> {
  return apiFetch<Processo>(`/api/processos/${id}`)
}

export async function listVinculos(): Promise<VinculosData> {
  return apiFetch<VinculosData>('/api/processos/vinculos')
}

export async function listRecorrencias(): Promise<RecurrenciaMap> {
  return apiFetch<RecurrenciaMap>('/api/processo-templates/recorrencias')
}

async function authPost(url: string, body?: unknown) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

async function authPut(url: string, body: unknown) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

async function authDelete(url: string) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const r = await fetch(url, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export function saveTemplate(id: number | null, payload: {
  titulo: string
  categoria: string
  departamento_id: number | null
  recorrente: boolean
  recorrencia_padrao: string
  recorrencia_dia_mes?: number | null
  recorrencia_dia_semana?: number | null
  etapas: Etapa[]
}) {
  return id
    ? authPut(`/api/processo-templates/${id}`, payload)
    : authPost('/api/processo-templates', payload)
}

export function deleteTemplate(id: number) {
  return authDelete(`/api/processo-templates/${id}`)
}

export function createProcesso(payload: Record<string, unknown>) {
  return authPost('/api/processos', payload)
}

export function updateProcesso(id: number, payload: Record<string, unknown>) {
  return authPut(`/api/processos/${id}`, payload)
}

export function deleteProcesso(id: number) {
  return authDelete(`/api/processos/${id}`)
}

export function updateSituacao(id: number, situacao: string) {
  return authPut(`/api/processos/${id}/situacao`, { situacao })
}

export function solicitarAprovacao(processoId: number, stepId: string) {
  return authPost(`/api/processos/${processoId}/etapas/${encodeURIComponent(stepId)}/solicitar-aprovacao`)
}

export function aprovarEtapa(processoId: number, stepId: string, comentario?: string) {
  return authPost(`/api/processos/${processoId}/etapas/${encodeURIComponent(stepId)}/aprovar`, { comentario: comentario || '' })
}

export function reprovarEtapa(processoId: number, stepId: string, comentario: string) {
  return authPost(`/api/processos/${processoId}/etapas/${encodeURIComponent(stepId)}/reprovar`, { comentario })
}

export function cienciaReprovacao(processoId: number, stepId: string) {
  return authPost(`/api/processos/${processoId}/etapas/${encodeURIComponent(stepId)}/ciencia-reprovacao`)
}

export function listAprovacoesPendentes(): Promise<AprovacaoPendente[]> {
  return apiFetch<AprovacaoPendente[]>('/api/processos/aprovacoes/pendentes')
}

export function iniciarRecorrencia(templateId: number, clienteIds: number[]) {
  return authPost(`/api/processo-templates/${templateId}/iniciar-recorrencia`, { cliente_ids: clienteIds })
}

export function encerrarRecorrencia(templateId: number) {
  return authPost(`/api/processo-templates/${templateId}/encerrar-recorrencia`)
}

export function gerarRecorrentes(): Promise<{ gerados: number }> {
  return authPost('/api/processos/gerar-recorrentes')
}

export async function listComentarios(processoId: number): Promise<ProcessoComentario[]> {
  return apiFetch<ProcessoComentario[]>(`/api/processos/${processoId}/comentarios`)
}

export async function addComentario(processoId: number, conteudo: string, anexos: unknown[]): Promise<ProcessoComentario> {
  return authPost(`/api/processos/${processoId}/comentarios`, { conteudo, anexos })
}

export async function uploadProcessoAnexo(processoId: number, file: File) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`/api/processos/${processoId}/anexos`, {
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
