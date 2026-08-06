import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

type Tarefa = {
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

type ClienteOption = { id: number; name: string; razao_social?: string }
type Departamento = { id: number; nome: string }

type TaskForm = {
  titulo: string
  descricao: string
  prioridade: string
  due_date: string
  internal_deadline: string
  cliente_id: string
  departamento_id: string
  concluida_em: string
}

const EMPTY_FORM: TaskForm = {
  titulo: '',
  descricao: '',
  prioridade: 'Média',
  due_date: '',
  internal_deadline: '',
  cliente_id: '',
  departamento_id: '',
  concluida_em: '',
}

const PRIORIDADE_MAP: Record<string, string> = {
  Alta: '#EF4444',
  Média: '#F59E0B',
  Baixa: '#10B981',
}

const PRIORIDADES = ['Baixa', 'Média', 'Alta']

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

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

export default function Tarefas() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'minhas' | 'kanban'>('minhas')
  const [tasks, setTasks] = useState<Tarefa[]>([])
  const [clients, setClients] = useState<ClienteOption[]>([])
  const [departments, setDepartments] = useState<Departamento[]>([])

  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const authHeaders = () => {
    const t = getToken()
    return t ? { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } : undefined
  }

  const loadTasks = async () => {
    const h = authHeaders()
    if (!h) { navigate('/login'); return }
    try {
      const r = await fetch('/api/tarefas-completas', { headers: h })
      const data = await r.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch { setTasks([]) }
    setLoading(false)
  }

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    loadTasks()
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setClients).catch(() => {})
    fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setDepartments).catch(() => {})
  }, [navigate])

  const updateForm = (field: keyof TaskForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const openNewModal = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowNewModal(true)
  }

  const openEditModal = (task: Tarefa) => {
    setForm({
      titulo: task.titulo || '',
      descricao: task.descricao || '',
      prioridade: task.prioridade || 'Média',
      due_date: '',
      internal_deadline: '',
      cliente_id: '',
      departamento_id: '',
      concluida_em: '',
    })
    setEditingId(task.id)
    setShowEditModal(true)
  }

  const handleCreate = async () => {
    const h = authHeaders()
    if (!h) return
    if (!form.titulo.trim()) { alert('Título é obrigatório'); return }
    setSaving(true)
    try {
      const body: Record<string, any> = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        prioridade: form.prioridade,
      }
      if (form.due_date) body.due_date = form.due_date
      if (form.internal_deadline) body.internal_deadline = form.internal_deadline
      if (form.cliente_id) body.cliente_id = parseInt(form.cliente_id)
      if (form.departamento_id) body.departamento_id = parseInt(form.departamento_id)
      await fetch('/api/tarefas', {
        method: 'POST', headers: h,
        body: JSON.stringify(body),
      })
      setShowNewModal(false)
      loadTasks()
    } catch { alert('Erro ao criar tarefa') }
    setSaving(false)
  }

  const handleUpdate = async () => {
    const h = authHeaders()
    if (!h || !editingId) return
    if (!form.titulo.trim()) { alert('Título é obrigatório'); return }
    setSaving(true)
    try {
      const body: Record<string, any> = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        prioridade: form.prioridade,
      }
      if (form.due_date) body.due_date = form.due_date
      if (form.internal_deadline) body.internal_deadline = form.internal_deadline
      if (form.cliente_id) body.cliente_id = parseInt(form.cliente_id)
      if (form.departamento_id) body.departamento_id = parseInt(form.departamento_id)
      if (form.concluida_em) body.concluida_em = form.concluida_em
      await fetch(`/api/tarefas/${editingId}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify(body),
      })
      setShowEditModal(false)
      setEditingId(null)
      loadTasks()
    } catch { alert('Erro ao atualizar tarefa') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta tarefa?')) return
    const h = authHeaders()
    if (!h) return
    try {
      await fetch(`/api/tarefas/${id}`, { method: 'DELETE', headers: h })
      loadTasks()
    } catch { alert('Erro ao excluir tarefa') }
  }

  const handleMarkComplete = async (task: Tarefa) => {
    const h = authHeaders()
    if (!h) return
    const hoje = new Date().toISOString().split('T')[0]
    try {
      await fetch(`/api/tarefas/${task.id}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({
          titulo: task.titulo,
          descricao: task.descricao,
          prioridade: task.prioridade,
          concluida_em: hoje,
        }),
      })
      loadTasks()
    } catch { alert('Erro ao concluir tarefa') }
  }

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', String(taskId))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
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
    const h = authHeaders()
    if (!h) return
    try {
      await fetch(`/api/tarefas/${taskId}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({ status: col.status }),
      })
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, coluna_id: col.status } : t)
      )
    } catch { alert('Erro ao mover tarefa') }
  }

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-'
    try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
  }

  const kanbanTasks = (colKey: string) =>
    tasks.filter(t => getKanbanColumn(t.coluna_id) === colKey)

  if (loading) {
    return (
      <div className="h-screen bg-core-black text-off-white flex items-center justify-center">
        <div className="text-pulse-ash text-sm">Carregando tarefas...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/tarefas" />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Tarefas</h1>
              <p className="text-pulse-ash text-sm">Gestão de tarefas e quadro kanban</p>
            </div>
            <button onClick={openNewModal}
              className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2">
              <span>+</span> Nova Tarefa
            </button>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke">
            <button
              onClick={() => setTab('minhas')}
              className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                tab === 'minhas' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
              }`}>
              Minhas Tarefas
            </button>
            <button
              onClick={() => setTab('kanban')}
              className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                tab === 'kanban' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
              }`}>
              Kanban
            </button>
          </div>

          {tab === 'minhas' && (
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon">
                      <th className="text-left py-3 px-4">Título</th>
                      <th className="text-left py-3 px-4">Cliente</th>
                      <th className="text-center py-3 px-4">Prioridade</th>
                      <th className="text-center py-3 px-4">Origem</th>
                      <th className="text-center py-3 px-4">Status</th>
                      <th className="text-center py-3 px-4 w-28">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-off-white">{task.titulo || '-'}</div>
                          {task.descricao && (
                            <div className="text-pulse-ash text-xs mt-0.5 line-clamp-1">{task.descricao}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-pulse-ash">{task.client_name || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className="px-2 py-0.5 rounded text-xs tracking-wider"
                            style={{
                              backgroundColor: (PRIORIDADE_MAP[task.prioridade] || '#F59E0B') + '18',
                              color: PRIORIDADE_MAP[task.prioridade] || '#F59E0B',
                            }}>
                            {task.prioridade || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                            task.origem === 'processo'
                              ? 'bg-purple-900/30 text-purple-400'
                              : 'bg-electric-teal/10 text-electric-teal'
                          }`}>
                            {task.origem === 'processo' ? 'Processo' : 'Pessoal'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                            task.status === 'Concluída' || task.status === 'concluida'
                              ? 'bg-success/10 text-success'
                              : 'bg-infrared/10 text-infrared'
                          }`}>
                            {task.status || 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(task)}
                              className="text-pulse-ash hover:text-electric-teal transition-colors p-1"
                              title="Editar">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            {task.status !== 'Concluída' && task.status !== 'concluida' && (
                              <button
                                onClick={() => handleMarkComplete(task)}
                                className="text-pulse-ash hover:text-success transition-colors p-1"
                                title="Concluir">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 6 9 17l-5-5"/>
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="text-pulse-ash hover:text-danger transition-colors p-1"
                              title="Excluir">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tasks.length === 0 && (
                  <div className="text-center py-16 text-pulse-ash text-sm">
                    Nenhuma tarefa encontrada. Crie uma nova tarefa para começar.
                  </div>
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
                  <div key={col.key}
                    className={`bg-rich-carbon border rounded-xl flex flex-col transition-all duration-200 ${
                      isOver ? 'border-electric-teal bg-electric-teal/5' : 'border-urban-smoke'
                    }`}
                    onDragOver={e => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, col.key)}>
                    <div className="p-4 border-b border-urban-smoke flex items-center justify-between shrink-0">
                      <h3 className="text-xs tracking-wider text-off-white">{col.label}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-urban-smoke text-pulse-ash">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {colTasks.map(task => (
                        <div key={task.id}
                          draggable="true"
                          onDragStart={e => handleDragStart(e, task.id)}
                          className={`bg-core-black border border-urban-smoke rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-pulse-ash transition-all duration-200 ${
                            expandedCardId === task.id ? 'border-electric-teal/50 ring-1 ring-electric-teal/20' : ''
                          }`}
                          onClick={() => setExpandedCardId(expandedCardId === task.id ? null : task.id)}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-xs text-off-white leading-tight flex-1">{task.titulo || 'Sem título'}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] tracking-wider"
                              style={{
                                backgroundColor: (PRIORIDADE_MAP[task.prioridade] || '#F59E0B') + '18',
                                color: PRIORIDADE_MAP[task.prioridade] || '#F59E0B',
                              }}>
                              {task.prioridade || '-'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] tracking-wider ${
                              task.origem === 'processo'
                                ? 'bg-purple-900/30 text-purple-400'
                                : 'bg-electric-teal/10 text-electric-teal'
                            }`}>
                              {task.origem === 'processo' ? 'Processo' : 'Pessoal'}
                            </span>
                            {task.client_name && (
                              <span className="text-[9px] text-pulse-ash truncate max-w-[80px]">{task.client_name}</span>
                            )}
                          </div>
                          {expandedCardId === task.id && (
                            <div className="mt-3 pt-3 border-t border-urban-smoke/50 space-y-2">
                              {task.descricao && (
                                <div>
                                  <div className="text-[9px] tracking-wider text-pulse-ash mb-0.5">Descrição</div>
                                  <div className="text-xs text-off-white">{task.descricao}</div>
                                </div>
                              )}
                              <div className="flex gap-4">
                                <div>
                                  <div className="text-[9px] tracking-wider text-pulse-ash mb-0.5">Criado em</div>
                                  <div className="text-xs text-pulse-ash">{formatDate(task.created_at)}</div>
                                </div>
                                {task.user_name && (
                                  <div>
                                    <div className="text-[9px] tracking-wider text-pulse-ash mb-0.5">Responsável</div>
                                    <div className="text-xs text-pulse-ash">{task.user_name}</div>
                                  </div>
                                )}
                              </div>
                              {task.blocked_by && (
                                <div className="bg-infrared/5 border border-infrared/10 rounded-lg p-2">
                                  <div className="text-[9px] tracking-wider text-infrared mb-0.5">Bloqueado por</div>
                                  <div className="text-xs text-off-white">{task.blocked_by}</div>
                                </div>
                              )}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={e => { e.stopPropagation(); openEditModal(task) }}
                                  className="flex-1 px-3 py-1.5 rounded text-xs tracking-wider bg-electric-teal/10 text-electric-teal border border-electric-teal/20 hover:bg-electric-teal/20 transition-colors">
                                  Editar
                                </button>
                                {getKanbanColumn(task.coluna_id) !== 'Concluído' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleMarkComplete(task) }}
                                    className="px-3 py-1.5 rounded text-xs tracking-wider bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors">
                                    Concluir
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <div className="text-center py-10 text-pulse-ash text-[11px] italic">
                          Arraste tarefas aqui
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── New Task Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[520px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm tracking-wider mb-6">Nova Tarefa</h3>
            <div className="space-y-4">
              <ModalField label="Título *" value={form.titulo} onChange={v => updateForm('titulo', v)} placeholder="Título da tarefa" />
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => updateForm('descricao', e.target.value)}
                  placeholder="Descreva a tarefa..."
                  rows={3}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prioridade</label>
                <select value={form.prioridade} onChange={e => updateForm('prioridade', e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prazo Final</label>
                  <input type="date" value={form.due_date} onChange={e => updateForm('due_date', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prazo Interno</label>
                  <input type="date" value={form.internal_deadline} onChange={e => updateForm('internal_deadline', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cliente</label>
                  <select value={form.cliente_id} onChange={e => updateForm('cliente_id', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                    <option value="">Nenhum</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.razao_social || c.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
                  <select value={form.departamento_id} onChange={e => updateForm('departamento_id', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                    <option value="">Nenhum</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
              <button onClick={() => setShowNewModal(false)}
                className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
                {saving ? 'Criando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[520px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm tracking-wider mb-6">Editar Tarefa</h3>
            <div className="space-y-4">
              <ModalField label="Título *" value={form.titulo} onChange={v => updateForm('titulo', v)} placeholder="Título da tarefa" />
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => updateForm('descricao', e.target.value)}
                  placeholder="Descreva a tarefa..."
                  rows={3}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prioridade</label>
                <select value={form.prioridade} onChange={e => updateForm('prioridade', e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prazo Final</label>
                  <input type="date" value={form.due_date} onChange={e => updateForm('due_date', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prazo Interno</label>
                  <input type="date" value={form.internal_deadline} onChange={e => updateForm('internal_deadline', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cliente</label>
                  <select value={form.cliente_id} onChange={e => updateForm('cliente_id', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                    <option value="">Nenhum</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.razao_social || c.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
                  <select value={form.departamento_id} onChange={e => updateForm('departamento_id', e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                    <option value="">Nenhum</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-infrared/5 border border-infrared/10 rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.concluida_em !== ''}
                    onChange={e => {
                      if (e.target.checked) {
                        updateForm('concluida_em', new Date().toISOString().split('T')[0])
                      } else {
                        updateForm('concluida_em', '')
                      }
                    }}
                    className="rounded bg-core-black border-urban-smoke text-electric-teal focus:ring-electric-teal"
                  />
                  <span className="text-xs tracking-wider text-off-white">Marcar como concluída hoje</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
              <button onClick={() => { setShowEditModal(false); setEditingId(null) }}
                className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Cancelar
              </button>
              <button onClick={handleUpdate} disabled={saving}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
                {saving ? 'Salvando...' : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs tracking-wider text-pulse-ash mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
      />
    </div>
  )
}
