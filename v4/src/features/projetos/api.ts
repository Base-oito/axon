import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'

export interface Projeto {
  id: number
  titulo: string
  descricao: string
  prazo?: string | null
  responsavel_id?: number | null
  responsavel_nome?: string | null
  status: string
  prioridade: string
  cor?: string
  peso_total?: number
  peso_realizado?: number
  progresso?: number
  horas?: number
  qtd_objetivos?: number
}

export interface TarefaProjeto {
  id: number
  titulo: string
  esforco: number
  status: string
  responsavel_id?: number | null
  prazo?: string | null
  justificativa_atraso?: string | null
}

export interface Indicador { id: number; indicador: string; tipo: string; unidade: string; base?: number|null; meta?: number|null; atual?: number|null; direcao: string }
export interface Ganho { id: number; descricao: string; tipo: string; indicador: string; base: string }
export interface Tempo { id: number; data?: string|null; horas: number; descricao: string; user_name?: string|null }

export interface Objetivo {
  id: number
  titulo: string
  descricao: string
  prazo?: string | null
  responsavel_id?: number | null
  peso: number
  status: string
  qtd_tarefas?: number
  peso_total?: number
  peso_realizado?: number
  progresso?: number
  horas?: number
  tarefas: TarefaProjeto[]
  indicadores: Indicador[]
  ganhos: Ganho[]
  tempo: Tempo[]
}

async function auth(props: any, extra: RequestInit = {}) {
  const t = getToken()
  if (!t) throw new Error('Sem token')
  const url = props.url || props
  const r = await fetch(url, { ...extra, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t, ...(extra.headers || {}) } })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export function useProjetos() {
  return useQuery({ queryKey: ['projetos'], queryFn: () => apiFetch<Projeto[]>('/api/projetos'), staleTime: 30_000 })
}

export function useObjetivos(projetoId: number) {
  return useQuery({ queryKey: ['projetos-objetivos', projetoId], queryFn: () => apiFetch<Objetivo[]>(`/api/projetos/${projetoId}/objetivos`), enabled: !!projetoId, staleTime: 20_000 })
}

export function useMutationProjeto() {
  const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['projetos'] }); qc.invalidateQueries({ queryKey: ['projetos-objetivos'] }) }
  return {
    create: useMutation({ mutationFn: (p: any) => auth('/api/projetos', { method: 'POST', body: JSON.stringify(p) }), onSuccess: inv }),
    upd: useMutation({ mutationFn: ({ id, ...p }: any) => auth(`/api/projetos/${id}`, { method: 'PUT', body: JSON.stringify(p) }), onSuccess: inv }),
    del: useMutation({ mutationFn: (id: number) => auth(`/api/projetos/${id}`, { method: 'DELETE' }), onSuccess: inv }),
  }
}

export function useObjetivoMutations(projetoId: number) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['projetos-objetivos', projetoId] })
  return {
    create: useMutation({ mutationFn: (o: any) => auth(`/api/projetos/${projetoId}/objetivos`, { method: 'POST', body: JSON.stringify(o) }), onSuccess: inv }),
    upd: useMutation({ mutationFn: ({ id, ...o }: any) => auth(`/api/projetos/objetivos/${id}`, { method: 'PUT', body: JSON.stringify(o) }), onSuccess: inv }),
    del: useMutation({ mutationFn: (id: number) => auth(`/api/projetos/objetivos/${id}`, { method: 'DELETE' }), onSuccess: inv }),
    indicador: useMutation({ mutationFn: ({ objetivoId, ...i }: any) => auth(`/api/projetos/objetivos/${objetivoId}/indicadores`, { method: 'POST', body: JSON.stringify(i) }), onSuccess: inv }),
    indicadorUpd: useMutation({ mutationFn: ({ id, ...i }: any) => auth(`/api/projetos/indicadores/${id}`, { method: 'PUT', body: JSON.stringify(i) }), onSuccess: inv }),
    indicadorDel: useMutation({ mutationFn: (id: number) => auth(`/api/projetos/indicadores/${id}`, { method: 'DELETE' }), onSuccess: inv }),
    ganho: useMutation({ mutationFn: ({ objetivoId, ...g }: any) => auth(`/api/projetos/objetivos/${objetivoId}/ganhos`, { method: 'POST', body: JSON.stringify(g) }), onSuccess: inv }),
    ganhoDel: useMutation({ mutationFn: (id: number) => auth(`/api/projetos/ganhos/${id}`, { method: 'DELETE' }), onSuccess: inv }),
  }
}

export function useTarefaMutations(projetoId: number) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['projetos-objetivos', projetoId] })
  return {
    create: useMutation({ mutationFn: ({ objetivoId, ...t }: any) => auth(`/api/projetos/objetivos/${objetivoId}/tarefas`, { method: 'POST', body: JSON.stringify(t) }), onSuccess: inv }),
    upd: useMutation({ mutationFn: ({ id, ...t }: any) => auth(`/api/projetos/tarefas/${id}`, { method: 'PUT', body: JSON.stringify(t) }), onSuccess: inv }),
    del: useMutation({ mutationFn: (id: number) => auth(`/api/projetos/tarefas/${id}`, { method: 'DELETE' }), onSuccess: inv }),
  }
}

export function useComentarios(projetoId: number) {
  return useQuery({ queryKey: ['projetos-comentarios', projetoId], queryFn: () => apiFetch<any[]>(`/api/projetos/${projetoId}/comentarios`), enabled: !!projetoId, staleTime: 15_000 })
}

export function useComentarioMutations(projetoId: number) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['projetos-comentarios', projetoId] })
  return {
    create: useMutation({ mutationFn: (c: any) => auth(`/api/projetos/${projetoId}/comentarios`, { method: 'POST', body: JSON.stringify(c) }), onSuccess: inv }),
    del: useMutation({ mutationFn: (id: number) => auth(`/api/projetos/comentarios/${id}`, { method: 'DELETE' }), onSuccess: inv }),
  }
}

export function useIndicadorLogs(indicadorId: number | undefined) {
  return useQuery({
    queryKey: ['projetos-ind-logs', indicadorId],
    queryFn: () => apiFetch<any[]>(`/api/projetos/indicadores/${indicadorId}/logs`),
    enabled: !!indicadorId,
    staleTime: 15_000,
  })
}