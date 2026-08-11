import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch, getToken } from '@/lib/api'
import { useClientes, useDepartamentos } from '@/features/processos/hooks/useShared'
import { PRIORIDADE_MAP } from '@/features/processos/helpers'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

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
  blocked_by: string | null
  coluna_id: string | null
  processo_id: number | null
  step_id: string | null
}

type TaskForm = {
  titulo: string
  descricao: string
  prioridade: string
  cliente_id: string
  departamento_id: string
  concluida_em: string
}

const EMPTY_FORM: TaskForm = { titulo: '', descricao: '', prioridade: 'Média', cliente_id: '', departamento_id: '', concluida_em: '' }

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

export default function TarefasPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'minhas' | 'kanban'>('minhas')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const { data: tasks = [] } = useQuery({
    queryKey: ['tarefas-completas'],
    queryFn: () => apiFetch<Tarefa[]>('/api/tarefas-completas'),
    staleTime: 30_000,
  })
  const { data: clientes = [] } = useClientes()
  const { data: departamentos = [] } = useDepartamentos()

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
    if (!confirm('Excluir esta tarefa?')) return
    try {
      await authFetch(`/api/tarefas/${id}`, { method: 'DELETE' })
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir tarefa')
    }
  }

  const handleMarkComplete = async (task: Tarefa) => {
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

  const handleDrop = async (e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const taskId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!taskId) return
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
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
      concluida_em: '',
    })
    setEditingId(task.id)
    setError('')
    setShowModal(true)
  }

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '-'
    try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
  }

  const kanbanTasks = (colKey: string) => tasks.filter(t => getKanbanColumn(t.coluna_id) === colKey)

  const s = useSortable('titulo')
  const sortedTasks = sortItems(tasks, s.sortKey, s.sortDir, t => {
    if (s.sortKey === 'cliente') return t.client_name || ''
    if (s.sortKey === 'prioridade') return t.prioridade || ''
    if (s.sortKey === 'origem') return t.origem || ''
    if (s.sortKey === 'status') return t.status || ''
    if (s.sortKey === 'data') return t.created_at || ''
    return t.titulo || ''
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
                  <th className="w-28 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map(task => (
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
                        task.origem === 'processo' ? 'bg-violet-100 text-violet-700' : 'bg-cyan-50 text-cyan-700'
                      }`}>
                        {task.origem === 'processo' ? 'Processo' : 'Pessoal'}
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
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(task)} className="p-1 text-muted-foreground transition-colors hover:text-[#0078d4]" title="Editar">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {task.status !== 'Concluída' && task.status !== 'concluida' && (
                          <button onClick={() => handleMarkComplete(task)} className="p-1 text-muted-foreground transition-colors hover:text-emerald-600" title="Concluir">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </button>
                        )}
                        <button onClick={() => handleDelete(task.id)} className="p-1 text-muted-foreground transition-colors hover:text-red-500" title="Excluir">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada. Crie uma nova tarefa para começar.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'kanban' && (
        <div className="grid grid-cols-4 gap-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
          {KANBAN_COLS.map(col => {
            const colTasks = kanbanTasks(col.key)
            const isOver = dragOverCol === col.key
            return (
              <div
                key={col.key}
                className={`flex flex-col rounded-xl border bg-card transition-all duration-200 ${isOver ? 'border-[#0078d4] bg-[#0078d4]/5' : 'border-border'}`}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.key) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, col.key)}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border/60 p-4">
                  <h3 className="text-xs tracking-wider text-foreground">{col.label}</h3>
                  <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); e.dataTransfer.effectAllowed = 'move' }}
                      onClick={() => setExpandedCardId(expandedCardId === task.id ? null : task.id)}
                      className={`cursor-grab rounded-lg border border-border bg-background p-3 transition-all duration-200 hover:border-muted-foreground/50 active:cursor-grabbing ${
                        expandedCardId === task.id ? 'border-[#0078d4]/50 ring-1 ring-[#0078d4]/20' : ''
                      }`}
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
                          task.origem === 'processo' ? 'bg-violet-100 text-violet-700' : 'bg-cyan-50 text-cyan-700'
                        }`}>
                          {task.origem === 'processo' ? 'Processo' : 'Pessoal'}
                        </span>
                        {task.client_name && <span className="max-w-[80px] truncate text-[9px] text-muted-foreground">{task.client_name}</span>}
                      </div>
                      {expandedCardId === task.id && (
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
                            <button
                              onClick={e => { e.stopPropagation(); openEdit(task) }}
                              className="flex-1 rounded border border-[#0078d4]/20 bg-[#0078d4]/10 px-3 py-1.5 text-xs tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
                            >
                              Editar
                            </button>
                            {getKanbanColumn(task.coluna_id) !== 'Concluído' && (
                              <button
                                onClick={e => { e.stopPropagation(); handleMarkComplete(task) }}
                                className="rounded border border-emerald-500/20 bg-emerald-50 px-3 py-1.5 text-xs tracking-wider text-emerald-600 transition-colors hover:bg-emerald-100"
                              >
                                Concluir
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="py-10 text-center text-[11px] italic text-muted-foreground">Arraste tarefas aqui</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
