import type { Etapa, Processo } from './types'

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  Pendente: { label: 'Pendente', color: '#F59E0B' },
  em_execucao: { label: 'Em Execução', color: '#3B82F6' },
  Aguardando_Decisao: { label: 'Aguardando Decisão', color: '#8B5CF6' },
  Aguardando_Cliente: { label: 'Aguardando Cliente', color: '#06B6D4' },
  Concluida: { label: 'Concluída', color: '#10B981' },
  Cancelada: { label: 'Cancelada', color: '#EF4444' },
}

export const SITUACAO_MAP: Record<string, { label: string; color: string }> = {
  em_execucao: { label: 'Em Execução', color: '#10B981' },
  cancelado: { label: 'Cancelado', color: '#EF4444' },
}

export const PRIORIDADE_MAP: Record<string, string> = {
  Alta: '#EF4444',
  Média: '#F59E0B',
  Media: '#F59E0B',
  Baixa: '#10B981',
}

export const STEP_TYPE_COLORS: Record<string, string> = {
  Tarefa: '#3B82F6',
  'Obrigação': '#A78BFA',
  'Decisão': '#F97316',
  'Gatilho': '#F59E0B',
}

export const KANBAN_COLUMNS = [
  { key: 'Pendente', label: 'Pendente', status: 'Pendente' },
  { key: 'em_execucao', label: 'Em Andamento', status: 'em_execucao' },
  { key: 'Aguardando_Decisao', label: 'Aguardando Decisão', status: 'aguardando_decisao' },
  { key: 'Aguardando_Cliente', label: 'Aguardando Cliente', status: 'aguardando_cliente' },
  { key: 'Concluida', label: 'Finalizado', status: 'Concluida' },
]

export const STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'Pendente', label: 'Pendente' },
  { key: 'em_execucao', label: 'Em Andamento' },
  { key: 'Aguardando_Cliente', label: 'Aguardando Cliente' },
  { key: 'Concluida', label: 'Finalizado' },
  { key: 'Cancelada', label: 'Cancelado' },
]

export const RECORRENCIA_OPTIONS = ['semanal', 'mensal', 'trimestral', 'anual']
export const CATEGORIAS = ['Fiscal', 'DP', 'Contábil', 'Legal', 'Geral']
export const PRIORIDADES = ['Baixa', 'Média', 'Alta']
export const VISIBILIDADE_OPTIONS = ['público', 'privado']
export const SITUACAO_OPTIONS = ['em_execucao', 'cancelado']

let _stepCounter = 0
export function genStepId(): string {
  _stepCounter++
  return 'step_' + Date.now() + '_' + _stepCounter
}

let _subtaskCounter = 0
export function genSubtaskId(): string {
  _subtaskCounter++
  return 'sub_' + Date.now() + '_' + _subtaskCounter
}

export function safeEtapas(v: unknown): Etapa[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

export function normalizeOptions(opts: unknown): Etapa['options'] {
  if (!opts) return undefined
  if (Array.isArray(opts)) return opts.length ? opts : undefined
  const o = opts as { simNextStep?: string; naoNextStep?: string }
  const result: Etapa['options'] = []
  if (o.simNextStep) result.push({ label: 'Sim', nextStepId: o.simNextStep })
  if (o.naoNextStep) result.push({ label: 'Não', nextStepId: o.naoNextStep })
  return result.length > 0 ? result : undefined
}

export function getKanbanStatus(p: Processo): string {
  if (p.status === 'Concluida') return 'Concluida'
  if (p.status === 'Pendente') return 'Pendente'
  if (p.status === 'Cancelada') return 'Cancelada'
  if (p.status === 'Aguardando_Cliente') return 'Aguardando_Cliente'
  const etapas = safeEtapas(p.etapas)
  const currentIdx = etapas.findIndex(e => !e.isCompleted)
  if (currentIdx >= 0 && (etapas[currentIdx]?.type === 'Decisão' || etapas[currentIdx]?.type === 'Gatilho')) return 'Aguardando_Decisao'
  return 'em_execucao'
}

export function getCurrentStep(etapas: Etapa[]): { index: number; step: Etapa | null } {
  const idx = etapas.findIndex(e => !e.isCompleted)
  return { index: idx, step: idx >= 0 ? etapas[idx] : null }
}

export function countCompleted(etapas: Etapa[]): number {
  return etapas.filter(e => e.isCompleted).length
}

export function hasUnmetDependencies(etapa: Etapa, allEtapas: Etapa[]): boolean {
  if (!etapa.dependsOn || etapa.dependsOn.length === 0) return false
  return etapa.dependsOn.some(depId => {
    const dep = allEtapas.find(e => e.id === depId)
    return dep && !dep.isCompleted
  })
}

export function getDependencyNames(etapa: Etapa, allEtapas: Etapa[]): string {
  if (!etapa.dependsOn || etapa.dependsOn.length === 0) return ''
  return etapa.dependsOn
    .map(depId => allEtapas.find(e => e.id === depId)?.title || depId)
    .filter(Boolean)
    .join(', ')
}

export function hasIncompleteSubtasks(etapa: Etapa): boolean {
  if (!etapa.subtasks || etapa.subtasks.length === 0) return false
  return etapa.subtasks.some(st => !st.isCompleted)
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Calcula a duração total do processo (em dias) considerando paralelismo.
 * Cada etapa com dependsOn inicia após TODAS as suas dependências terminarem;
 * etapas independentes rodam em paralelo. Retorna o caminho crítico (máximo).
 */
export function calculaDuracaoProcesso(etapas: Etapa[]): number {
  if (!etapas || etapas.length === 0) return 0
  const fimPorId: Record<string, number> = {}
  for (const e of etapas) {
    const dias = e.dias || 0
    const deps = e.dependsOn || []
    let inicio = 0
    if (deps.length > 0) {
      inicio = Math.max(...deps.map(d => fimPorId[d] ?? 0))
    } else if (etapas.indexOf(e) > 0) {
      // Sem dependência explícita: pode rodar em paralelo, mas respeita a anterior que a precede na ordem
      const anterior = etapas[etapas.indexOf(e) - 1]
      inicio = fimPorId[anterior.id] ?? 0
    }
    fimPorId[e.id] = inicio + dias
  }
  return Math.max(0, ...Object.values(fimPorId))
}

export function fmtDateBR(d?: string | null): string {
  if (!d) return '-'
  try {
    const hasTime = d.includes('T') || d.includes(' ')
    return new Date(hasTime ? d : d + 'T00:00:00').toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

export function fmtDateTimeBR(d?: string | null): string {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return d
  }
}

export function getDisplayName(): string {
  try {
    const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
    if (tok) return JSON.parse(atob(tok.split('.')[1])).display_name || 'Usuário'
  } catch {
    // ignore
  }
  return 'Usuário'
}
