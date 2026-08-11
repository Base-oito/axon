import { apiFetch, getToken } from '@/lib/api'

async function authFetch(url: string, options: RequestInit = {}) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const r = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + t,
      ...(options.headers || {}),
    },
  })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export function listAgentes() {
  return apiFetch<import('./types').Agente[]>('/api/agentes')
}

export function listAgenteTarefas(agentId: number) {
  return apiFetch<import('./types').AgenteTask[]>(`/api/agentes/${agentId}/tarefas`)
}

export function listClientesCert() {
  return apiFetch<import('./types').ClienteCert[]>('/api/clientes?limit=5000')
}

export function instalarCertificado(agentId: number, clientId: number) {
  return authFetch(`/api/agentes/${agentId}/instalar`, {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId }),
  })
}

export function editarAgente(
  agentId: number,
  payload: { machine_name: string; operator_name: string; cliente_id: number | null; active: boolean }
) {
  return authFetch(`/api/agentes/${agentId}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function excluirAgente(agentId: number) {
  return authFetch(`/api/agentes/${agentId}`, { method: 'DELETE' })
}

export async function uploadCertificado(file: File, password: string, clientId: number) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const form = new FormData()
  form.append('certificate_file', file)
  form.append('certificate_password', password)
  form.append('client_id', String(clientId))
  const r = await fetch('/api/upload/certificate', {
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

export function listModelos() {
  return apiFetch<import('./types').Modelo[]>('/api/modelos')
}

export function getParser(modeloId: number) {
  return apiFetch<{ codigo_js: string }>(`/api/modelos/${modeloId}/parser`)
}

export function saveParser(modeloId: number, codigo_js: string) {
  return authFetch(`/api/modelos/${modeloId}/parser`, { method: 'PUT', body: JSON.stringify({ codigo_js }) })
}

export function testarParser(codigo_js: string, texto: string) {
  return authFetch('/api/parsers/testar', { method: 'POST', body: JSON.stringify({ codigo_js, texto, blocos: [] }) })
}

export function listTreinos() {
  return apiFetch<import('./types').OcrTreino[]>('/api/ocr-treinos')
}

export function deleteTreino(id: number) {
  return authFetch(`/api/ocr-treinos/${id}`, { method: 'DELETE' })
}

export async function detectarAreas(file: File, modeloId: string, areas: Array<Record<string, unknown>>) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const form = new FormData()
  form.append('file', file)
  form.append('modelo_id', modeloId)
  form.append('areas', JSON.stringify(areas))
  const r = await fetch('/api/ocr-detect-areas', {
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

export async function salvarTreino(file: File, modeloId: string, nome: string, areas: Array<Record<string, unknown>>) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const form = new FormData()
  form.append('file', file)
  form.append('modelo_id', modeloId)
  form.append('nome', nome)
  form.append('areas', JSON.stringify(areas))
  form.append('rules', JSON.stringify([]))
  const r = await fetch('/api/upload/ocr-training', {
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

export async function processarLote(files: File[]) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const r = await fetch('/api/processar-lote', {
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
