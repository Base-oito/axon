import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch, getToken } from '@/lib/api'
import { useClientesOperacionais, useDepartamentos } from '@/features/processos/hooks/useShared'
import { PRIORIDADE_MAP, getDependencyNames, getDisplayName, hasIncompleteSubtasks, hasUnmetDependencies, safeEtapas, pedirAnexo } from '@/features/processos/helpers'
import { getProcesso, updateProcesso, uploadProcessoAnexo } from '@/features/processos/api'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'
import {
  DndContext, PointerSensor, TouchSensor, closestCorners, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface Tarefa {
  id: number
  titulo: string
  descricao: string
  prioridade: string
  status: string
  tipo: string
  origem: string
  client_name: string
  user_name: string
  created_at: string
  vencimento?: string | null
  is_completed?: boolean
  blocked_by: string | null
  coluna_id: string | null
  processo_id: number | null
  step_id: string | null
  projeto_tarefa_id?: number | null
  user_id?: number | string | null
  cliente_id?: number | null
  departamento_id?: number | null
  responsavel_id?: number | null
}

type TaskForm = {
  titulo: string
  descricao: string
  prioridade: string
  cliente_id: string
  departamento_id: string
  vencimento_em: string
  concluida_em: string
}

const EMPTY_FORM: TaskForm = { titulo: '', descricao: '', prioridade: 'Média', cliente_id: '', departamento_id: '', vencimento_em: '', concluida_em: '' }

/** Tarefa clássica (id numérico) gerenciável nesta página; as de processo/projeto têm id com prefixo. */
function isLocalTask(t: { id: number }): boolean {
  return /^\d+$/.test(String(t.id))
}

/** Dados do usuário logado a partir do token. */
function getMe(): { id: number; role: string; display_name: string } {
  try {
    const tok = getToken()
    if (!tok) return { id: 0, role: '', display_name: '' }
    const p = JSON.parse(atob(tok.split('.')[1]))
    return { id: Number(p.sub) || 0, role: p.role || '', display_name: p.display_name || p.username || '' }
  } catch {
    return { id: 0, role: '', display_name: '' }
  }
}

/** Pode concluir: tarefa numérica, etapa de processo ou tarefa de projeto. */
function canComplete(t: Tarefa): boolean {
  return /^\d+$/.test(String(t.id))
    || (t.origem === 'processo' && !!t.processo_id && !!t.step_id)
    || (t.origem === 'projeto' && !!t.projeto_tarefa_id)
}

const PRIORIDADES = ['Baixa', 'Média', 'Alta']

function getKanbanColumn(colunaId: string | null): string {
  if (colunaId === 'pending') return 'Pendente'
  if (colunaId === 'blocked') return 'Bloqueado'
  if (colunaId === 'done') return 'Concluído'
  return 'Em Andamento'
}

const KANBAN_COLS = [
  { key: 'Pendente', label: 'Pendente', status: 'pending' },
  { key: 'Em Andamento', label: 'Em Andamento', status: 'em_andamento' },
  { key: 'Bloqueado', label: 'Bloqueado', status: 'blocked' },
  { key: 'Concluído', label: 'Concluído', status: 'done' },
]

function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
}

function isOverdue(d: string | null | undefined) {
  if (!d) return false
  try { return new Date(d.slice(0, 10) + 'T00:00:00') < new Date() } catch { return false }
}

function isConcluida(task: Tarefa) {
  return task.coluna_id === 'done' || task.status === 'Concluída' || task.status === 'concluida' || task.is_completed
}

function TaskCard({ task, expanded, onToggleExpand, onEdit, onComplete, canConclude, canEdit }: {
  task: Tarefa
  expanded: boolean
  onToggleExpand: () => void
  onEdit: (t: Tarefa) => void
  onComplete: (t: Tarefa) => void
  canConclude: (t: Tarefa) => boolean
  canEdit: (t: Tarefa) => boolean
}) {
  const draggable = canComplete(task) || isLocalTask(task)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(task.id), disabled: !draggable })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      draggable={false}
      onClick={onToggleExpand}
      className={`cursor-grab rounded-lg border border-border bg-background p-3 transition-all duration-200 hover:border-muted-foreground/50 active:cursor-grabbing ${
        expanded ? 'border-[#0078d4]/50 ring-1 ring-[#0078d4]/20' : ''
      }`}
      style={{ opacity: isDragging ? 0.4 : 1, transform: CSS.Translate.toString(transform), touchAction: 'none' }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="flex-1 text-xs leading-tight text-foreground">{task.titulo || 'Sem título'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] tracking-wider"
          style={{ backgroundColor: (PRIORIDADE_MAP[task.prioridade] || '#F59E0B') + '18', color: PRIORIDADE_MAP[task.prioridade] || '#F59E0B' }}
        >
          {task.prioridade || '-'}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] tracking-wider ${
          task.origem === 'processo' ? 'bg-violet-100 text-violet-700'
          : task.origem === 'projeto' ? 'bg-amber-100 text-amber-700'
          : 'bg-cyan-50 text-cyan-700'
        }`}>
          {task.origem === 'processo' ? 'Processo' : task.origem === 'projeto' ? 'Projeto' : 'Pessoal'}
        </span>
        {task.client_name && <span className="max-w-[80px] truncate text-[9px] text-muted-foreground">{task.client_name}</span>}
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          {task.descricao && (
            <div>
              <div className="mb-0.5 text-[9px] tracking-wider text-muted-foreground">Descrição</div>
              <div className="text-xs text-foreground">{task.descricao}</div>
            </div>
          )}
          <div className="flex gap-4">
            <div>
              <div className="mb-0.5 text-[9px] tracking-wider text-muted-foreground">Criado em</div>
              <div className="text-xs text-muted-foreground">{fmtDate(task.created_at)}</div>
            </div>
            <div>
              <div className="mb-0.5 text-[9px] tracking-wider text-muted-foreground">Vencimento</div>
              <div className={`text-xs ${isOverdue(task.vencimento) && !isConcluida(task) ? 'font-medium text-rose-600' : 'text-muted-foreground'}`}>{fmtDate(task.vencimento)}</div>
            </div>
            {task.user_name && (
              <div>
                <div className="mb-0.5 text-[9px] tracking-wider text-muted-foreground">Responsável</div>
                <div className="text-xs text-muted-foreground">{task.user_name}</div>
              </div>
            )}
          </div>
          {task.blocked_by && (
            <div className="rounded-lg border border-rose-500/10 bg-rose-50 p-2">
              <div className="mb-0.5 text-[9px] tracking-wider text-rose-700">Bloqueado por</div>
              <div className="text-xs text-foreground">{task.blocked_by}</div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {canEdit(task) && (
              <button
                onClick={e => { e.stopPropagation(); onEdit(task) }}
                className="flex-1 rounded border border-[#0078d4]/20 bg-[#0078d4]/10 px-3 py-1.5 text-xs tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
              >
                Editar
              </button>
            )}
            {getKanbanColumn(task.coluna_id) !== 'Concluído' && canComplete(task) && canConclude(task) && (
              <button
                onClick={e => { e.stopPropagation(); onComplete(task) }}
                className="flex-1 rounded border border-emerald-500/20 bg-emerald-50 px-3 py-1.5 text-xs tracking-wider text-emerald-600 transition-colors hover:bg-emerald-100"
              >
                Concluir
              </button>
            )}
            {!canConclude(task) && getKanbanColumn(task.coluna_id) !== 'Concluído' && (
              <div className="flex-1 rounded border border-border/50 bg-muted/20 px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                Somente o responsável conclui
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskColumn({ col, tasks, expandedCardId, onToggleExpand, onEdit, onComplete, canConclude, canEdit }: {
  col: (typeof KANBAN_COLS)[number]
  tasks: Tarefa[]
  expandedCardId: number | null
  onToggleExpand: (id: number) => void
  onEdit: (t: Tarefa) => void
  onComplete: (t: Tarefa) => void
  canConclude: (t: Tarefa) => boolean
  canEdit: (t: Tarefa) => boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border bg-card transition-all duration-200 ${isOver ? 'border-[#0078d4] bg-[#0078d4]/5' : 'border-border'}`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 p-4">
        <h3 className="text-xs tracking-wider text-foreground">{col.label}</h3>
        <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            expanded={expandedCardId === task.id}
            onToggleExpand={() => onToggleExpand(task.id)}
            onEdit={onEdit}
            onComplete={onComplete}
            canConclude={canConclude}
            canEdit={canEdit}
          />
        ))}
        {tasks.length === 0 && (
          <div className="py-10 text-center text-[11px] italic text-muted-foreground">Arraste tarefas aqui</div>
        )}
      </div>
    </div>
  )
}

export default function TarefasPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'minhas' | 'kanban'>('minhas')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'abertas' | 'atrasadas' | 'concluidas'>('abertas')
  const [somenteMinhas, setSomenteMinhas] = useState(false)
  const me = getMe()
  const isAdmin = ['administrador', 'super_admin'].includes(me.role)
  const isLider = me.role === 'lider'
  const isGestor = isAdmin || isLider

  // Filtros avançados
  const [busca, setBusca] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')

  /** Pode concluir: admin/super sempre; demais somente a própria (responsável). */
  const podeConcluir = (t: Tarefa) => isAdmin || String((t as any).user_id ?? '') === String(me.id)
  const temFiltro = busca.trim() !== '' || filtroResponsavel !== '' || filtroCliente !== '' ||
    filtroDepartamento !== '' || filtroPrioridade !== '' || filtroOrigem !== ''
  const limparFiltros = () => {
    setBusca(''); setFiltroResponsavel(''); setFiltroCliente(''); setFiltroDepartamento(''); setFiltroPrioridade(''); setFiltroOrigem('')
  }

  const { data: tasks = [] } = useQuery({
    queryKey: ['tarefas-completas'],
    queryFn: () => apiFetch<Tarefa[]>('/api/tarefas-completas'),
    staleTime: 30_000,
  })
  const { data: clientes = [] } = useClientesOperacionais()
  const { data: departamentos = [] } = useDepartamentos()
  const { data: usuarios = [] } = useQuery({
    queryKey: ['tarefas-usuarios'],
    queryFn: () => apiFetch<any[]>('/api/usuarios?limit=500'),
    staleTime: 5 * 60_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tarefas-completas'] })

  const authFetch = async (url: string, options: RequestInit = {}) => {
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

  const handleCreate = async () => {
    if (!form.titulo.trim()) { setError('Título é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { titulo: form.titulo.trim(), descricao: form.descricao.trim(), prioridade: form.prioridade }
      if (form.cliente_id) body.cliente_id = Number(form.cliente_id)
      if (form.departamento_id) body.departamento_id = Number(form.departamento_id)
      if (form.vencimento_em) body.vencimento_em = form.vencimento_em
      await authFetch('/api/tarefas', { method: 'POST', body: JSON.stringify(body) })
      setShowModal(false)
      invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar tarefa')
    }
    setSaving(false)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    if (!form.titulo.trim()) { setError('Título é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { titulo: form.titulo.trim(), descricao: form.descricao.trim(), prioridade: form.prioridade }
      if (form.cliente_id) body.cliente_id = Number(form.cliente_id)
      if (form.departamento_id) body.departamento_id = Number(form.departamento_id)
      if (form.vencimento_em) body.vencimento_em = form.vencimento_em
      if (form.concluida_em) body.concluida_em = form.concluida_em
      await authFetch(`/api/tarefas/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
      setShowModal(false)
      setEditingId(null)
      invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar tarefa')
    }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!/^\d+$/.test(String(id))) {
      alert('Essa tarefa pertence a um processo/projeto. Gerencie-a no módulo correspondente.')
      return
    }
    if (!confirm('Excluir esta tarefa?')) return
    try {
      await authFetch(`/api/tarefas/${id}`, { method: 'DELETE' })
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir tarefa')
    }
  }

  const handleMarkComplete = async (task: Tarefa) => {
    // Tarefa de PROCESSO: concluir a etapa via módulo de processos (valida dependências/doc)
    if (task.origem === 'processo' && task.processo_id && task.step_id) {
      await completeProcessStep(task.processo_id, task.step_id)
      return
    }
    // Tarefa de PROJETO: concluir via endpoint de tarefa de projeto
    if (task.origem === 'projeto' && task.projeto_tarefa_id) {
      await completeProjectTask(task.projeto_tarefa_id)
      return
    }
    // Tarefa clássica (numérica)
    if (!/^\d+$/.test(String(task.id))) return
    const hoje = new Date().toISOString().split('T')[0]
    try {
      await authFetch(`/api/tarefas/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ titulo: task.titulo, descricao: task.descricao, prioridade: task.prioridade, concluida_em: hoje }),
      })
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir tarefa')
    }
  }

  /** Conclui uma tarefa de PROJETO via endpoint do módulo de projetos. */
  const completeProjectTask = async (projeto_tarefa_id: number) => {
    const t = getToken()
    try {
      const r = await fetch(`/api/projetos/tarefas/${projeto_tarefa_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ status: 'concluido' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d?.detail && typeof d.detail === 'string' ? d.detail : '') || `HTTP ${r.status}`)
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir tarefa do projeto')
    }
  }

  /** Conclui uma etapa de processo pelo kanban/lista de tarefas. */
  const completeProcessStep = async (pid: number, stepId: string) => {
    try {
      const processo = await getProcesso(pid)
      const etapas = safeEtapas(processo.etapas).map(e => ({ ...e }))
      const step = etapas.find(e => e.id === stepId)
      if (!step) { alert('Etapa não encontrada no processo.'); return }
      if (step.isCompleted) { invalidate(); return }
      if (hasUnmetDependencies(step, etapas)) {
        alert('Bloqueado! Esta etapa depende de: ' + getDependencyNames(step, etapas))
        return
      }
      if (hasIncompleteSubtasks(step)) { alert('Conclua todas as subtarefas primeiro!'); return }
      if (step.exige_documento && !step.anexo) {
        const file = await pedirAnexo()
        if (!file) return
        const anexo = await uploadProcessoAnexo(pid, file)
        step.anexo = anexo
      }
      step.isCompleted = true
      step.completedBy = getDisplayName()
      step.completedAt = new Date().toISOString()
      const allDone = etapas.every(e => e.isCompleted)
      await updateProcesso(pid, { etapas, status: allDone ? 'Concluida' : 'em_execucao', etapa_atual: allDone ? step.title : (etapas.find(e => !e.isCompleted)?.title || step.title) })
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir etapa do processo')
    }
  }

  const applyDrop = async (task: Tarefa, colKey: string) => {
    // Etapa de processo: só permite arrastar para "Concluído" (conclui a etapa)
    if (task.origem === 'processo' && task.processo_id && task.step_id) {
      if (getKanbanColumn(task.coluna_id) === 'Concluído') return
      if (colKey === 'Concluído') {
        await completeProcessStep(task.processo_id, task.step_id)
      } else {
        alert('Etapas de processo são concluídas apenas ao mover para "Concluído".')
      }
      return
    }
    // Tarefa de PROJETO: arrastar para "Concluído" conclui a tarefa
    if (task.origem === 'projeto' && task.projeto_tarefa_id) {
      if (getKanbanColumn(task.coluna_id) === 'Concluído') return
      if (colKey === 'Concluído') {
        await completeProjectTask(task.projeto_tarefa_id)
      } else {
        alert('Tarefas de projeto são concluídas apenas ao mover para "Concluído".')
      }
      return
    }
    if (!/^\d+$/.test(String(task.id))) {
      alert('Tarefa não reconhecida para esta operação.')
      return
    }
    const taskId = parseInt(String(task.id))
    const currentCol = getKanbanColumn(task.coluna_id)
    if (currentCol === colKey) return
    const col = KANBAN_COLS.find(c => c.key === colKey)
    if (!col) return
    try {
      await authFetch(`/api/tarefas/${taskId}`, { method: 'PUT', body: JSON.stringify({ status: col.status }) })
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao mover tarefa')
    }
  }

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setError(''); setShowModal(true) }
  const openEdit = (task: Tarefa) => {
    setForm({
      titulo: task.titulo || '',
      descricao: task.descricao || '',
      prioridade: task.prioridade || 'Média',
      cliente_id: '',
      departamento_id: '',
      vencimento_em: (task.vencimento || '').slice(0, 10),
      concluida_em: '',
    })
    setEditingId(task.id)
    setError('')
    setShowModal(true)
  }

  const kanbanTasks = (colKey: string) => filtradas.filter(t => getKanbanColumn(t.coluna_id) === colKey)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const task = tasks.find(t => String(t.id) === String(e.active.id))
    if (!task) return
    const colKey = String(e.over.id)
    if (!KANBAN_COLS.some(c => c.key === colKey)) return
    if (getKanbanColumn(task.coluna_id) === colKey) return
    void applyDrop(task, colKey)
  }

  const s = useSortable('titulo')
  const sortedTasks = sortItems(tasks, s.sortKey, s.sortDir, t => {
    if (s.sortKey === 'cliente') return t.client_name || ''
    if (s.sortKey === 'prioridade') return t.prioridade || ''
    if (s.sortKey === 'origem') return t.origem || ''
    if (s.sortKey === 'status') return t.status || ''
    if (s.sortKey === 'data') return t.created_at || ''
    if (s.sortKey === 'vencimento') return t.vencimento || ''
    return t.titulo || ''
  })

  // Filtro "somente minhas" (para admin/super que veem tudo)
  const baseTasks = somenteMinhas ? sortedTasks.filter(t => {
    const uid = String(me.id)
    const dono = (t as any).user_id ?? (t as any).responsavel_id
    if (dono !== undefined && dono !== null && String(dono) === uid) return true
    // fallback por nome (tarefas de processo/projeto usam user_name/responsavel_nome)
    const nomes = [String((t as any).user_name || ''), String((t as any).responsavel_nome || '')]
    if (me.display_name && nomes.some(n => n && n.toLowerCase() === me.display_name.toLowerCase())) return true
    return false
  }) : sortedTasks

  // Filtros avançados (busca, responsável, cliente, departamento, prioridade, origem)
  const filtradas = baseTasks.filter(t => {
    if (busca.trim()) {
      const b = busca.trim().toLowerCase()
      const hay = [t.titulo || '', t.client_name || '', t.descricao || ''].join(' ').toLowerCase()
      if (!hay.includes(b)) return false
    }
    if (filtroResponsavel && String((t as any).user_id ?? '') !== filtroResponsavel) return false
    if (filtroCliente && String((t as any).cliente_id ?? '') !== filtroCliente) return false
    if (filtroDepartamento && String((t as any).departamento_id ?? '') !== filtroDepartamento) return false
    if (filtroPrioridade && (t.prioridade || '') !== filtroPrioridade) return false
    if (filtroOrigem && (t.origem || '') !== filtroOrigem) return false
    return true
  })

  // Contagem por status
  const atrasada = (t: Tarefa) =>
    !isConcluida(t) && t.vencimento && String(t.vencimento).slice(0, 10) < new Date().toISOString().slice(0, 10)
  const qtdAbertas = filtradas.filter(t => !isConcluida(t)).length
  const qtdAtrasadas = filtradas.filter(atrasada).length
  const qtdConcluidas = filtradas.filter(t => isConcluida(t)).length

  const tasksVisiveis = filtradas.filter(t => {
    if (filtroStatus === 'concluidas') return isConcluida(t)
    if (filtroStatus === 'atrasadas') return atrasada(t)
    return !isConcluida(t)
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestão de tarefas e quadro kanban</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
        >
          + Nova Tarefa
        </button>
      </div>

      <div className="flex gap-1 border-b border-border/60">
        {(['minhas', 'kanban'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-5 py-3 text-xs tracking-wider transition-all duration-200 ${
              tab === t ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'minhas' ? 'Minhas Tarefas' : 'Kanban'}
          </button>
        ))}
      </div>

      {tab === 'minhas' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1">
              {([
                { k: 'abertas', label: `Abertas (${qtdAbertas})` },
                { k: 'atrasadas', label: `Atrasadas (${qtdAtrasadas})` },
                { k: 'concluidas', label: `Concluídas (${qtdConcluidas})` },
              ] as const).map(f => (
                <button
                  key={f.k}
                  onClick={() => setFiltroStatus(f.k)}
                  className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    filtroStatus === f.k ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {isAdmin && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={somenteMinhas}
                  onChange={e => setSomenteMinhas(e.target.checked)}
                  className="h-4 w-4 accent-[#0078d4]"
                />
                Exibir somente as minhas tarefas
              </label>
            )}
          </div>

          {/* Filtros avançados */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, cliente, descrição..."
              className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {isGestor && (
              <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todos responsáveis</option>
                {usuarios.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username || u.id}</option>
                ))}
              </select>
            )}
            {isGestor && (
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                className="h-9 max-w-[220px] rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todos clientes</option>
                {clientes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
                ))}
              </select>
            )}
            {isGestor && (
              <select value={filtroDepartamento} onChange={e => setFiltroDepartamento(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todos departamentos</option>
                {departamentos.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            )}
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Todas prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Media">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
            <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Todas origens</option>
              <option value="pessoal">Pessoal</option>
              <option value="processo">Processo</option>
              <option value="projeto">Projeto</option>
            </select>
            {temFiltro && (
              <button onClick={limparFiltros}
                className="h-9 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Limpar filtros
              </button>
            )}
          </div>

          <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <SortableTh k="titulo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Título</SortableTh>
                  <SortableTh k="cliente" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Cliente</SortableTh>
                  <SortableTh k="prioridade" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Prioridade</SortableTh>
                  <SortableTh k="origem" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Origem</SortableTh>
                  <SortableTh k="status" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Status</SortableTh>
                  <SortableTh k="data" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Criada</SortableTh>
                  <SortableTh k="vencimento" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Vencimento</SortableTh>
                  <th className="w-28 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tasksVisiveis.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa nesta categoria.</td></tr>
                )}
                {tasksVisiveis.map(task => (
                  <tr key={task.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="text-foreground">{task.titulo || '-'}</div>
                      {task.descricao && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.descricao}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{task.client_name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="rounded px-2 py-0.5 text-xs tracking-wider"
                        style={{ backgroundColor: (PRIORIDADE_MAP[task.prioridade] || '#F59E0B') + '18', color: PRIORIDADE_MAP[task.prioridade] || '#F59E0B' }}
                      >
                        {task.prioridade || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded px-2 py-0.5 text-xs tracking-wider ${
                        task.origem === 'processo' ? 'bg-violet-100 text-violet-700'
                        : task.origem === 'projeto' ? 'bg-amber-100 text-amber-700'
                        : 'bg-cyan-50 text-cyan-700'
                      }`}>
                        {task.origem === 'processo' ? 'Processo' : task.origem === 'projeto' ? 'Projeto' : 'Pessoal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded px-2 py-0.5 text-xs tracking-wider ${
                        task.status === 'Concluída' || task.status === 'concluida'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {task.status || 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">{fmtDate(task.created_at)}</td>
                    <td className={`px-4 py-3 text-center text-xs ${isOverdue(task.vencimento) && !isConcluida(task) ? 'font-medium text-rose-600' : 'text-muted-foreground'}`}>
                      {fmtDate(task.vencimento)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(task)} disabled={!isAdmin && String((task as any).user_id ?? '') !== String(me.id)} className="p-1 text-muted-foreground transition-colors hover:text-[#0078d4] disabled:opacity-30 disabled:hover:text-muted-foreground" title="Editar">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {task.status !== 'Concluída' && task.status !== 'concluida' && canComplete(task) && podeConcluir(task) && (
                          <button onClick={() => handleMarkComplete(task)} className="p-1 text-muted-foreground transition-colors hover:text-emerald-600" title="Concluir">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </button>
                        )}
                        {isLocalTask(task) && (
                          <button onClick={() => handleDelete(task.id)} className="p-1 text-muted-foreground transition-colors hover:text-red-500" title="Excluir">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {tab === 'kanban' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
            {KANBAN_COLS.map(col => (
              <TaskColumn
                key={col.key}
                col={col}
                tasks={kanbanTasks(col.key)}
                expandedCardId={expandedCardId}
                onToggleExpand={id => setExpandedCardId(expandedCardId === id ? null : id)}
                onEdit={openEdit}
                onComplete={handleMarkComplete}
                canConclude={podeConcluir}
                canEdit={t => isAdmin || String((t as any).user_id ?? '') === String(me.id)}
              />
            ))}
          </div>
        </DndContext>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[520px] max-w-full rounded-xl border border-border bg-card shadow-lg">
            <div className="border-b border-border/60 p-6">
              <h3 className="text-sm font-semibold tracking-wider text-foreground">{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Título da tarefa"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva a tarefa..."
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Prioridade</label>
                <select
                  value={form.prioridade}
                  onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
                  <select
                    value={form.cliente_id}
                    onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Nenhum</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Departamento</label>
                  <select
                    value={form.departamento_id}
                    onChange={e => setForm(f => ({ ...f, departamento_id: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Nenhum</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Vencimento</label>
                <input
                  type="date"
                  value={form.vencimento_em}
                  onChange={e => setForm(f => ({ ...f, vencimento_em: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {editingId && (
                <div className="rounded-lg border border-rose-500/10 bg-rose-50 p-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.concluida_em !== ''}
                      onChange={e => setForm(f => ({ ...f, concluida_em: e.target.checked ? new Date().toISOString().split('T')[0] : '' }))}
                      className="h-4 w-4 rounded accent-[#0078d4]"
                    />
                    <span className="text-xs tracking-wider text-foreground">Marcar como concluída hoje</span>
                  </label>
                </div>
              )}
              {error && <div className="text-xs text-rose-600">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
