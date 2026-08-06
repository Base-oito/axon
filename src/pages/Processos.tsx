import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

// ── Types ──
type BranchOption = { label: string; nextStepId: string }

type SubtaskItem = { id: string; title: string; isCompleted: boolean }

type Etapa = {
  id: string
  title: string
  type: 'Tarefa' | 'Obrigação' | 'Decisão' | 'Gatilho'
  assignee?: string
  isCompleted?: boolean
  completedBy?: string
  completedAt?: string
  order: number
  options?: BranchOption[]
  selectedOptionId?: string
  dependsOn?: string[]
  subtasks?: SubtaskItem[]
  dias?: number
  dueDate?: string
  notificar_todos?: boolean
}

type Template = {
  id: number
  titulo: string
  categoria: string
  departamento_id: number | null
  recorrente: boolean
  recorrencia_padrao: string
  etapas: Etapa[]
}

type Processo = {
  id: number
  titulo: string
  cliente_nome: string
  cliente_id?: number
  status: string
  prioridade: string
  etapa_atual: string
  data_inicio?: string
  etapas: Etapa[]
  situacao: string
  visibilidade?: string
  created_at: string
  user_id?: number
}

type Departamento = { id: number; nome: string }
type Cliente = { id: number; name: string; razao_social?: string }

type RecurrenciaData = Record<number, { ativo: boolean; clientes: number[]; ultima_geracao: string }>

// ── Auth helpers ──
function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

// ── Etapas safety ──
function safeEtapas(v: any): Etapa[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

// ── Options normalization ──
function normalizeOptions(opts: any): BranchOption[] | undefined {
  if (!opts) return undefined
  if (Array.isArray(opts)) return opts.length ? opts : undefined
  const result: BranchOption[] = []
  if (opts.simNextStep) result.push({ label: 'Sim', nextStepId: opts.simNextStep })
  if (opts.naoNextStep) result.push({ label: 'Não', nextStepId: opts.naoNextStep })
  return result.length > 0 ? result : undefined
}

// ── Status / Priority / Step helpers ──
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  Pendente: { label: 'Pendente', color: '#F59E0B' },
  em_execucao: { label: 'Em Execução', color: '#3B82F6' },
  Aguardando_Decisao: { label: 'Aguardando Decisão', color: '#8B5CF6' },
  Concluida: { label: 'Concluída', color: '#10B981' },
  Cancelada: { label: 'Cancelada', color: '#EF4444' },
}

const SITUACAO_MAP: Record<string, { label: string; color: string }> = {
  em_execucao: { label: 'Em Execução', color: '#10B981' },
  cancelado: { label: 'Cancelado', color: '#EF4444' },
}

const PRIORIDADE_MAP: Record<string, string> = {
  Alta: '#EF4444',
  Média: '#F59E0B',
  Baixa: '#10B981',
}

const STEP_TYPE_COLORS: Record<string, string> = {
  Tarefa: '#3B82F6',
  'Obrigação': '#A78BFA',
  'Decisão': '#F97316',
  'Gatilho': '#F59E0B',
}

const KANBAN_COLUMNS = [
  { key: 'Pendente', label: 'Pendente', status: 'Pendente' },
  { key: 'em_execucao', label: 'Em Andamento', status: 'em_execucao' },
  { key: 'Aguardando_Decisao', label: 'Aguardando Decisão', status: 'aguardando_decisao' },
  { key: 'Concluida', label: 'Finalizado', status: 'Concluida' },
]

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'Pendente', label: 'Pendente' },
  { key: 'em_execucao', label: 'Em Andamento' },
  { key: 'Concluida', label: 'Finalizado' },
  { key: 'Cancelada', label: 'Cancelado' },
]

const RECORRENCIA_OPTIONS = ['semanal', 'mensal', 'trimestral', 'anual']
const CATEGORIAS = ['Fiscal', 'DP', 'Contábil', 'Legal', 'Geral']
const PRIORIDADES = ['Baixa', 'Média', 'Alta']
const VISIBILIDADE_OPTIONS = ['público', 'privado']
const SITUACAO_OPTIONS = ['em_execucao', 'cancelado']

// ── Step ID generator ──
let _stepCounter = 0
function genStepId(): string {
  _stepCounter++
  return 'step_' + Date.now() + '_' + _stepCounter
}

let _subtaskCounter = 0
function genSubtaskId(): string {
  _subtaskCounter++
  return 'sub_' + Date.now() + '_' + _subtaskCounter
}

// ── Badge component ──
function MiniBadge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs tracking-wider whitespace-nowrap"
      style={{ backgroundColor: color + '18', color, border: '1px solid ' + color + '35' }}
    >
      {text}
    </span>
  )
}

// ── Progress bar ──
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-urban-smoke rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: pct + '%', backgroundColor: pct === 100 ? '#10B981' : '#5C939F' }}
        />
      </div>
      <span className="text-xs text-pulse-ash">{done}/{total}</span>
    </div>
  )
}

// ── Get status for kanban ──
function getKanbanStatus(p: Processo): string {
  if (p.status === 'Concluida') return 'Concluida'
  if (p.status === 'Pendente') return 'Pendente'
  if (p.status === 'Cancelada') return 'Cancelada'
  const etapas = safeEtapas(p.etapas)
  const currentIdx = etapas.findIndex(e => !e.isCompleted)
  if (currentIdx >= 0 && (etapas[currentIdx]?.type === 'Decisão' || etapas[currentIdx]?.type === 'Gatilho')) return 'Aguardando_Decisao'
  return 'em_execucao'
}

// ── Find current step ──
function getCurrentStep(etapas: Etapa[]): { index: number; step: Etapa | null } {
  const idx = etapas.findIndex(e => !e.isCompleted)
  return { index: idx, step: idx >= 0 ? etapas[idx] : null }
}

// ── Count completed steps ──
function countCompleted(etapas: Etapa[]): number {
  return etapas.filter(e => e.isCompleted).length
}

// ── Check unmet dependencies ──
function hasUnmetDependencies(etapa: Etapa, allEtapas: Etapa[]): boolean {
  if (!etapa.dependsOn || etapa.dependsOn.length === 0) return false
  return etapa.dependsOn.some(depId => {
    const dep = allEtapas.find(e => e.id === depId)
    return dep && !dep.isCompleted
  })
}

// ── Get dependency step names ──
function getDependencyNames(etapa: Etapa, allEtapas: Etapa[]): string {
  if (!etapa.dependsOn || etapa.dependsOn.length === 0) return ''
  return etapa.dependsOn
    .map(depId => allEtapas.find(e => e.id === depId)?.title || depId)
    .filter(Boolean)
    .join(', ')
}

// ── Check incomplete subtasks ──
function hasIncompleteSubtasks(etapa: Etapa): boolean {
  if (!etapa.subtasks || etapa.subtasks.length === 0) return false
  return etapa.subtasks.some(st => !st.isCompleted)
}

// ── Add days helper ──
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Main component ──
export default function Processos() {
  const navigate = useNavigate()
  const [subTab, setSubTab] = useState<'modelos' | 'instancias' | 'kanban' | 'recorrencias'>('modelos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Data ──
  const [templates, setTemplates] = useState<Template[]>([])
  const [processos, setProcessos] = useState<Processo[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [recorrencias, setRecorrencias] = useState<RecurrenciaData>({})

  // ── Template modal ──
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [tfTitulo, setTfTitulo] = useState('')
  const [tfCategoria, setTfCategoria] = useState('')
  const [tfDepto, setTfDepto] = useState('')
  const [tfRecorrente, setTfRecorrente] = useState(false)
  const [tfRecorrencia, setTfRecorrencia] = useState('mensal')
  const [tfEtapas, setTfEtapas] = useState<Etapa[]>([])

  // ── Instance modal ──
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [instanceSaving, setInstanceSaving] = useState(false)
  const [ifTemplateId, setIfTemplateId] = useState('')
  const [ifTitulo, setIfTitulo] = useState('')
  const [ifCliente, setIfCliente] = useState('')
  const [ifPrioridade, setIfPrioridade] = useState('Média')
  const [ifDataInicio, setIfDataInicio] = useState('')
  const [ifVisibilidade, setIfVisibilidade] = useState('público')
  const [ifEtapas, setIfEtapas] = useState<Etapa[]>([])

  // ── Instância detail ──
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)
  const [kanbanProcesso, setKanbanProcesso] = useState<Processo | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [editingSituacao, setEditingSituacao] = useState<{ id: number; situacao: string } | null>(null)

  // ── Kanban modal ──
  const [showKanbanModal, setShowKanbanModal] = useState(false)
  const [kfTemplateId, setKfTemplateId] = useState('')
  const [kfSelectedClients, setKfSelectedClients] = useState<number[]>([])
  const [kfCreating, setKfCreating] = useState(false)

  // ── Recorrência ──
  const [recurrenciaOpen, setRecurrenciaOpen] = useState<number | null>(null)
  const [recurrenciaClientes, setRecurrenciaClientes] = useState<number[]>([])
  const [recurrenciaSaving, setRecurrenciaSaving] = useState(false)

  // ── Load data ──
  const loadData = async (silent = false) => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    if (!silent) setLoading(true)
    try {
      const headers = { Authorization: 'Bearer ' + t }
      const [tRes, pRes, dRes, cRes, rRes] = await Promise.all([
        fetch('/api/processo-templates', { headers }).then(r => r.json()),
        fetch('/api/processos', { headers }).then(r => r.json()),
        fetch('/api/departamentos', { headers }).then(r => r.json()),
        fetch('/api/clientes?limit=5000', { headers }).then(r => r.json()),
        fetch('/api/processo-templates/recorrencias', { headers }).then(r => r.json()).catch(() => ({})),
      ])
      setTemplates(Array.isArray(tRes) ? tRes : [])
      setProcessos(Array.isArray(pRes) ? pRes : [])
      setDepartamentos(Array.isArray(dRes) ? dRes : [])
      setClientes(Array.isArray(cRes) ? cRes : [])
      setRecorrencias(typeof rRes === 'object' && !Array.isArray(rRes) ? rRes : {})
    } catch (e) { console.error(e) }
    if (!silent) setLoading(false)
  }

  useEffect(() => { loadData() }, [navigate])

  // ── Status / priority display ──
  const statusLabel = (s: string) => STATUS_MAP[s]?.label || s
  const statusColor = (s: string) => STATUS_MAP[s]?.color || '#535353'
  const situacaoLabel = (s: string) => SITUACAO_MAP[s]?.label || s
  const situacaoColor = (s: string) => SITUACAO_MAP[s]?.color || '#535353'

  // ─── Template CRUD ──
  const openCreateTemplate = () => {
    setEditingTemplateId(null)
    setTfTitulo('')
    setTfCategoria('')
    setTfDepto('')
    setTfRecorrente(false)
    setTfRecorrencia('mensal')
    setTfEtapas([])
    setShowTemplateModal(true)
  }

  const openEditTemplate = (tmpl: Template) => {
    setEditingTemplateId(tmpl.id)
    setTfTitulo(tmpl.titulo || '')
    setTfCategoria(tmpl.categoria || '')
    setTfDepto(tmpl.departamento_id != null ? String(tmpl.departamento_id) : '')
    setTfRecorrente(!!tmpl.recorrente)
    setTfRecorrencia(tmpl.recorrencia_padrao || 'mensal')
    setTfEtapas(safeEtapas(tmpl.etapas).map((e, i) => ({
      ...e,
      type: (['Tarefa', 'Obrigação', 'Decisão', 'Gatilho'].includes(e.type) ? e.type : 'Tarefa') as Etapa['type'],
      order: e.order ?? i,
      options: normalizeOptions(e.options),
      dependsOn: e.dependsOn || [],
      subtasks: e.subtasks || [],
      dias: e.dias || undefined,
      notificar_todos: e.notificar_todos || false,
    })))
    setShowTemplateModal(true)
  }

  const saveTemplate = async () => {
    const t = getToken()
    if (!t) return
    setTemplateSaving(true)
    try {
      const etapasWithOrder = tfEtapas.map((e, i) => ({ ...e, order: i }))
      const body = {
        titulo: tfTitulo,
        categoria: tfCategoria,
        departamento_id: tfDepto ? Number(tfDepto) : null,
        recorrente: tfRecorrente,
        recorrencia_padrao: tfRecorrencia,
        etapas: etapasWithOrder,
      }
      const url = editingTemplateId
        ? '/api/processo-templates/' + editingTemplateId
        : '/api/processo-templates'
      const method = editingTemplateId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Falha ao salvar')
      setShowTemplateModal(false)
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar template')
    }
    setTemplateSaving(false)
  }

  const deleteTemplate = async (id: number) => {
    if (!confirm('Excluir este modelo de processo?')) return
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/processo-templates/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!r.ok) throw new Error('Falha ao excluir')
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir template')
    }
  }

  const duplicateTemplate = async (tmpl: Template) => {
    const t = getToken()
    if (!t) return
    try {
      const body = {
        titulo: tmpl.titulo + ' (Cópia)',
        categoria: tmpl.categoria || '',
        departamento_id: tmpl.departamento_id,
        recorrente: !!tmpl.recorrente,
        recorrencia_padrao: tmpl.recorrencia_padrao || 'mensal',
        etapas: safeEtapas(tmpl.etapas),
      }
      const r = await fetch('/api/processo-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Falha ao duplicar')
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao duplicar template')
    }
  }

  // ─── Step builder helpers ──
  const addStep = (type: Etapa['type'] = 'Tarefa') => {
    setTfEtapas(prev => [...prev, {
      id: genStepId(),
      title: '',
      type,
      assignee: '',
      order: prev.length,
      options: (type === 'Decisão' || type === 'Gatilho') ? [] : undefined,
      dependsOn: [],
      subtasks: [],
      dias: undefined,
      notificar_todos: false,
    }])
  }

  const removeStep = (index: number) => {
    setTfEtapas(prev => {
      const removed = prev[index]
      let next = prev.filter((_, i) => i !== index)
      if (removed) {
        next = next.map(s => {
          let changed = false
          const newOptions = (s.options || []).filter(o => o.nextStepId !== removed.id)
          if (newOptions.length !== (s.options || []).length) changed = true
          const newDependsOn = (s.dependsOn || []).filter(depId => depId !== removed.id)
          if (newDependsOn.length !== (s.dependsOn || []).length) changed = true
          if (!changed) return s
          return { ...s, options: newOptions.length > 0 ? newOptions : undefined, dependsOn: newDependsOn.length > 0 ? newDependsOn : [] }
        })
      }
      return next.map((s, i) => ({ ...s, order: i }))
    })
  }

  const moveStepUp = (index: number) => {
    if (index === 0) return
    setTfEtapas(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next.map((s, i) => ({ ...s, order: i }))
    })
  }

  const moveStepDown = (index: number) => {
    setTfEtapas(prev => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next.map((s, i) => ({ ...s, order: i }))
    })
  }

  const updateStepField = (index: number, field: string, value: any) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== index) return s
      return { ...s, [field]: value }
    }))
  }

  const toggleDependsOn = (stepIndex: number, depStepId: string) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      const current = s.dependsOn || []
      const next = current.includes(depStepId)
        ? current.filter(id => id !== depStepId)
        : [...current, depStepId]
      return { ...s, dependsOn: next }
    }))
  }

  // ─── Subtask helpers (builder) ──
  const addSubtask = (stepIndex: number) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      return { ...s, subtasks: [...(s.subtasks || []), { id: genSubtaskId(), title: '', isCompleted: false }] }
    }))
  }

  const removeSubtask = (stepIndex: number, subtaskId: string) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      return { ...s, subtasks: (s.subtasks || []).filter(st => st.id !== subtaskId) }
    }))
  }

  const updateSubtaskField = (stepIndex: number, subtaskId: string, field: string, value: any) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      return {
        ...s,
        subtasks: (s.subtasks || []).map(st => st.id === subtaskId ? { ...st, [field]: value } : st),
      }
    }))
  }

  // ─── Branch option helpers ──
  const addBranchOption = (stepIndex: number) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      return { ...s, options: [...(s.options || []), { label: '', nextStepId: '' }] }
    }))
  }

  const removeBranchOption = (stepIndex: number, optionIndex: number) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      const next = (s.options || []).filter((_, oi) => oi !== optionIndex)
      return { ...s, options: next.length > 0 ? next : undefined }
    }))
  }

  const updateBranchOption = (stepIndex: number, optionIndex: number, field: 'label' | 'nextStepId', value: string) => {
    setTfEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      return {
        ...s,
        options: (s.options || []).map((o, oi) => oi === optionIndex ? { ...o, [field]: value } : o),
      }
    }))
  }

  // ─── Instance handlers ──
  const openCreateInstance = () => {
    setIfTemplateId('')
    setIfTitulo('')
    setIfCliente('')
    setIfPrioridade('Média')
    setIfDataInicio(new Date().toISOString().slice(0, 10))
    setIfVisibilidade('público')
    setIfEtapas([])
    setShowInstanceModal(true)
  }

  const handleTemplateSelect = (id: string) => {
    setIfTemplateId(id)
    const tmpl = templates.find(t => String(t.id) === id)
    if (tmpl) {
      setIfTitulo(tmpl.titulo || '')
      setIfEtapas(safeEtapas(tmpl.etapas).map((e, i) => ({
        ...e,
        type: (['Tarefa', 'Obrigação', 'Decisão', 'Gatilho'].includes(e.type) ? e.type : 'Tarefa') as Etapa['type'],
        order: e.order ?? i,
        isCompleted: false,
        selectedOptionId: undefined,
        options: normalizeOptions(e.options),
        dependsOn: e.dependsOn || [],
        subtasks: (e.subtasks || []).map(st => ({ ...st, isCompleted: false })),
        dias: e.dias || undefined,
        dueDate: undefined,
        notificar_todos: e.notificar_todos || false,
      })))
    } else {
      setIfTitulo('')
      setIfEtapas([])
    }
  }

  const saveInstance = async () => {
    const t = getToken()
    if (!t) return
    setInstanceSaving(true)
    const cliente = clientes.find(c => String(c.id) === ifCliente)
    try {
      const etapasWithDue = ifEtapas.map(e => ({
        ...e,
        dueDate: e.dias && ifDataInicio ? addDays(ifDataInicio, e.dias) : undefined,
      }))
      const firstStep = etapasWithDue[0]?.title || ''
      const body: any = {
        titulo: ifTitulo,
        cliente_nome: cliente ? (cliente.name || cliente.razao_social || '') : '',
        cliente_id: ifCliente ? Number(ifCliente) : null,
        prioridade: ifPrioridade,
        data_inicio: ifDataInicio,
        visibilidade: ifVisibilidade,
        etapas: etapasWithDue,
        etapa_atual: firstStep,
        status: 'Pendente',
      }
      if (ifTemplateId) body.template_id = Number(ifTemplateId)
      const r = await fetch('/api/processos', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Falha ao criar instância')
      setShowInstanceModal(false)
      setSelectedProcesso(null)
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao criar instância')
    }
    setInstanceSaving(false)
  }

  const deleteProcesso = async (id: number) => {
    const p = processos.find(pp => pp.id === id)
    if (!confirm('Excluir processo ' + (p?.titulo || '#' + id) + ' de cliente ' + (p?.cliente_nome || '?') + '?')) return
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/processos/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!r.ok) throw new Error('Falha ao excluir')
      setSelectedProcesso(null)
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir instância')
    }
  }

  const saveSituacao = async () => {
    if (!editingSituacao) return
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/processos/' + editingSituacao.id + '/situacao', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ situacao: editingSituacao.situacao }),
      })
      if (!r.ok) throw new Error('Falha ao atualizar')
      if (selectedProcesso && selectedProcesso.id === editingSituacao.id) {
        setSelectedProcesso({ ...selectedProcesso, situacao: editingSituacao.situacao })
      }
      setEditingSituacao(null)
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar situação')
    }
  }

  // ─── Complete step ──
  const completeStep = async (processoId: number, optionLabel?: string) => {
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const p = processos.find(pp => pp.id === processoId)
      if (!p) return
      const etapas = safeEtapas(p.etapas).map(e => ({ ...e }))
      const { index, step: current } = getCurrentStep(etapas)
      if (!current || index < 0) return

      // Check dependencies
      const unmet = hasUnmetDependencies(current, etapas)
      if (unmet) {
        alert('Bloqueado! Esta etapa depende de: ' + getDependencyNames(current, etapas))
        setSaving(false)
        return
      }

      // Check subtasks
      const incompleteSubs = hasIncompleteSubtasks(current)
      if (incompleteSubs) {
        alert('Conclua todas as subtarefas primeiro!')
        setSaving(false)
        return
      }

      current.isCompleted = true
      current.completedBy = (() => { try { const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token; if (tok) { return JSON.parse(atob(tok.split('.')[1])).display_name || 'Usuário' } } catch {} return 'Usuário' })()
      current.completedAt = new Date().toISOString()
      current.dueDate = current.dias && p.data_inicio ? addDays(p.data_inicio, current.dias) : current.dueDate

      if (optionLabel && (current.type === 'Decisão' || current.type === 'Gatilho')) {
        current.selectedOptionId = optionLabel
      }

      let nextIdx = index + 1
      if ((current.type === 'Decisão' || current.type === 'Gatilho') && current.options && optionLabel) {
        const chosen = current.options.find(o => o.label === optionLabel)
        if (chosen?.nextStepId) {
          nextIdx = etapas.findIndex(e => e.id === chosen.nextStepId)
          if (nextIdx < 0) nextIdx = index + 1
        }
      }

      const nextStep = etapas[nextIdx]
      const isFinished = nextIdx >= etapas.length || !nextStep
      const newStatus = isFinished ? 'Concluida' : 'em_execucao'
      const newEtapaAtual = isFinished ? current.title : (nextStep?.title || current.title)

      const body = {
        etapas,
        status: newStatus,
        etapa_atual: newEtapaAtual,
      }

      const r = await fetch('/api/processos/' + processoId, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Falha ao concluir etapa')

      if (current.notificar_todos) {
        alert('Notificações enviadas para todos os usuários.')
      }

      if (selectedProcesso?.id === processoId) {
        const updated = await r.json()
        setSelectedProcesso(updated)
      }
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao concluir etapa')
    }
    setSaving(false)
  }

  // ─── Toggle subtask in instance ──
  const toggleInstanceSubtask = async (processoId: number, stepId: string, subtaskId: string) => {
    const t = getToken()
    if (!t) return
    try {
      const p = processos.find(pp => pp.id === processoId)
      if (!p) return
      const etapas = safeEtapas(p.etapas).map(e => ({ ...e }))
      const step = etapas.find(e => e.id === stepId)
      if (!step || !step.subtasks) return
      step.subtasks = step.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st)
      const r = await fetch('/api/processos/' + processoId, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapas }),
      })
      if (!r.ok) throw new Error('Falha ao atualizar subtarefa')
      if (selectedProcesso?.id === processoId) {
        const updated = await r.json()
        setSelectedProcesso(updated)
      }
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar subtarefa')
    }
  }

  // ─── Update process status ──
  const updateProcessoStatus = async (processoId: number, newStatus: string) => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/processos/' + processoId, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!r.ok) throw new Error('Falha ao atualizar status')
      if (selectedProcesso?.id === processoId) {
        setSelectedProcesso({ ...selectedProcesso, status: newStatus })
      }
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar status')
    }
  }

  // ─── Kanban drag and drop ──
  const handleDragStart = (e: React.DragEvent, processoId: number) => {
    e.dataTransfer.setData('text/plain', String(processoId))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    if (!id) return
    if (targetStatus === 'aguardando_decisao') return
    updateProcessoStatus(id, targetStatus)
  }

  // ─── Kanban flow creation ──
  const openKanbanFlow = () => {
    setKfTemplateId('')
    setKfSelectedClients([])
    setShowKanbanModal(true)
  }

  const toggleKanbanClient = (clientId: number) => {
    setKfSelectedClients(prev =>
      prev.includes(clientId) ? prev.filter(c => c !== clientId) : [...prev, clientId]
    )
  }

  const createKanbanFlows = async () => {
    const t = getToken()
    if (!t) return
    if (!kfTemplateId || kfSelectedClients.length === 0) return
    setKfCreating(true)
    try {
      const tmpl = templates.find(tm => String(tm.id) === kfTemplateId)
      const etapas = tmpl ? safeEtapas(tmpl.etapas).map((e, i) => ({
        ...e,
        type: (['Tarefa', 'Obrigação', 'Decisão', 'Gatilho'].includes(e.type) ? e.type : 'Tarefa') as Etapa['type'],
        order: e.order ?? i,
        isCompleted: false,
        selectedOptionId: undefined,
        options: normalizeOptions(e.options),
        dependsOn: e.dependsOn || [],
        subtasks: (e.subtasks || []).map(st => ({ ...st, isCompleted: false })),
        dias: e.dias || undefined,
        dueDate: undefined,
        notificar_todos: e.notificar_todos || false,
      })) : []
      const firstStep = etapas[0]?.title || ''

      for (const cid of kfSelectedClients) {
        const cli = clientes.find(c => c.id === cid)
        const titulo = tmpl ? tmpl.titulo + ' - ' + (cli?.name || cli?.razao_social || 'Cliente') : 'Processo - ' + (cli?.name || cli?.razao_social || 'Cliente')
        await fetch('/api/processos', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: Number(kfTemplateId),
            titulo,
            cliente_nome: cli?.name || cli?.razao_social || '',
            cliente_id: cid,
            prioridade: 'Média',
            data_inicio: new Date().toISOString().slice(0, 10),
            visibilidade: 'público',
            etapas,
            etapa_atual: firstStep,
            status: 'Pendente',
          }),
        })
      }
      setShowKanbanModal(false)
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao criar fluxos')
    }
    setKfCreating(false)
  }

  // ─── Recurrence handlers ──
  const iniciarRecorrencia = async (templateId: number, clientIds: number[]) => {
    if (clientIds.length === 0) { alert('Selecione ao menos um cliente'); return }
    const t = getToken()
    if (!t) return
    setRecurrenciaSaving(true)
    try {
      const r = await fetch('/api/processo-templates/' + templateId + '/iniciar-recorrencia', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_ids: clientIds }),
      })
      if (!r.ok) throw new Error('Falha ao iniciar recorrência')
      setRecurrenciaOpen(null)
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao iniciar recorrência')
    }
    setRecurrenciaSaving(false)
  }

  const encerrarRecorrencia = async (templateId: number) => {
    if (!confirm('Encerrar recorrência deste template?')) return
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/processo-templates/' + templateId + '/encerrar-recorrencia', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!r.ok) throw new Error('Falha ao encerrar recorrência')
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao encerrar recorrência')
    }
  }

  const gerarRecorrentes = async () => {
    if (!confirm('Gerar instâncias para todas as recorrências pendentes?')) return
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const r = await fetch('/api/processos/gerar-recorrentes', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
      })
      const j = await r.json()
      alert((j.gerados || 0) + ' instancia(s) gerada(s).')
      await loadData(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar recorrências')
    }
    setSaving(false)
  }

  // ─── Expand process detail ──
  const toggleProcessoDetail = (p: Processo) => {
    setSelectedProcesso(selectedProcesso?.id === p.id ? null : p)
    setEditingSituacao(null)
  }

  // ─── Filters ──
  const filteredProcessos = statusFilter
    ? processos.filter(p => p.status === statusFilter)
    : processos

  const getKanbanProcesses = (col: string) => {
    return processos.filter(p => getKanbanStatus(p) === col)
  }

  // ─── Recurrence template entries ──
  const recurrenciaEntries = templates
    .filter(tmpl => tmpl.recorrente)
    .map(tmpl => {
      const rc = recorrencias[tmpl.id]
      return {
        template: tmpl,
        ativo: !!rc?.ativo,
        clientes: rc?.clientes || [],
        ultima_geracao: rc?.ultima_geracao || '',
      }
    })

  // ── Render ──
  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/processos" />

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Processos</h1>
              <p className="text-pulse-ash text-sm">Modelos, instancias, fluxos de trabalho e recorrencias</p>
            </div>
          </div>

          {/* ── Sub-tabs ── */}
          <div className="flex gap-1 mb-8 border-b border-urban-smoke">
            {(['modelos', 'instancias', 'kanban', 'recorrencias'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setSubTab(tab); setSelectedProcesso(null); setEditingSituacao(null) }}
                className={'px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ' +
                  (subTab === tab
                    ? 'text-electric-teal border-electric-teal'
                    : 'text-pulse-ash border-transparent hover:text-off-white')
                }
              >
                {tab === 'modelos' ? 'Modelos' : tab === 'instancias' ? 'Instâncias' : tab === 'kanban' ? 'Kanban' : 'Recorrências'}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Carregando...</div>
            </div>
          )}

          {/* ==================== MODELOS TAB ==================== */}
          {!loading && subTab === 'modelos' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-xs text-pulse-ash">{templates.length} modelo(s) cadastrado(s)</div>
                <button
                  onClick={openCreateTemplate}
                  className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors"
                >
                  + Novo Modelo
                </button>
              </div>

              <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
                {templates.length === 0 ? (
                  <div className="text-center py-16 text-pulse-ash text-sm">
                    Nenhum modelo de processo cadastrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                          <th className="text-left py-3 px-4">Titulo</th>
                          <th className="text-left py-3 px-4">Categoria</th>
                          <th className="text-center py-3 px-4">Etapas</th>
                          <th className="text-center py-3 px-4">Recorrente</th>
                          <th className="text-right py-3 px-4">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.map(tmpl => (
                          <tr key={tmpl.id} className="border-b border-urban-smoke/30 hover:bg-urban-smoke/30 transition-colors cursor-pointer"
                            onClick={() => openEditTemplate(tmpl)}>
                            <td className="py-3 px-4">{tmpl.titulo}</td>
                            <td className="py-3 px-4 text-pulse-ash">{tmpl.categoria || '-'}</td>
                            <td className="py-3 px-4 text-center text-pulse-ash">
                              {safeEtapas(tmpl.etapas).length}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {tmpl.recorrente ? (
                                <span className="inline-flex items-center gap-1 text-xs text-electric-teal">
                                  <span>+</span> {tmpl.recorrencia_padrao || 'mensal'}
                                </span>
                              ) : (
                                <span className="text-xs text-pulse-ash">--</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => duplicateTemplate(tmpl)}
                                  className="px-3 py-1 rounded text-xs tracking-wider text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/10 transition-colors"
                                >
                                  Duplicar
                                </button>
                                <button
                                  onClick={() => openEditTemplate(tmpl)}
                                  className="px-3 py-1 rounded text-xs tracking-wider text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => deleteTemplate(tmpl.id)}
                                  className="px-3 py-1 rounded text-xs tracking-wider text-infrared border border-infrared/30 hover:bg-infrared/10 transition-colors"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== INSTANCIAS TAB ==================== */}
          {!loading && subTab === 'instancias' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1">
                  {STATUS_FILTERS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setStatusFilter(s.key)}
                      className={'px-3 py-1.5 rounded text-xs tracking-wider transition-colors ' +
                        (statusFilter === s.key
                          ? 'bg-electric-teal/20 text-electric-teal border border-electric-teal/30'
                          : 'text-pulse-ash border border-transparent hover:text-off-white hover:bg-urban-smoke/50')
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={openCreateInstance}
                  className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors"
                >
                  + Nova Instancia
                </button>
              </div>

              <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
                {filteredProcessos.length === 0 ? (
                  <div className="text-center py-16 text-pulse-ash text-sm">
                    Nenhum processo encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                          <th className="text-left py-3 px-4">Titulo</th>
                          <th className="text-left py-3 px-4">Cliente</th>
                          <th className="text-center py-3 px-4">Status</th>
                          <th className="text-center py-3 px-4">Prioridade</th>
                          <th className="text-center py-3 px-4">Data Inicio</th>
                          <th className="text-right py-3 px-4">Criado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProcessos.map(p => (
                          <tr
                            key={p.id}
                            onClick={() => toggleProcessoDetail(p)}
                            className={'border-b border-urban-smoke/30 hover:bg-urban-smoke/30 transition-colors cursor-pointer ' +
                              (selectedProcesso?.id === p.id ? 'bg-electric-teal/10' : '')
                            }
                          >
                            <td className="py-3 px-4">{p.titulo}</td>
                            <td className="py-3 px-4 text-pulse-ash">{p.cliente_nome || '-'}</td>
                            <td className="py-3 px-4 text-center">
                              <MiniBadge text={statusLabel(p.status)} color={statusColor(p.status)} />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className="text-xs tracking-wider font-roc"
                                style={{ color: PRIORIDADE_MAP[p.prioridade] || '#535353', fontWeight: 500 }}
                              >
                                {p.prioridade}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-pulse-ash">
                              {p.data_inicio ? new Date(p.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="py-3 px-4 text-right text-pulse-ash">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Selected processo detail panel ── */}
              {selectedProcesso && (() => {
                const etapas = safeEtapas(selectedProcesso.etapas)
                const completed = countCompleted(etapas)
                const total = etapas.length
                const { index: currIdx, step: currentStep } = getCurrentStep(etapas)
                const isBranchStep = currentStep && (currentStep.type === 'Decisão' || currentStep.type === 'Gatilho') && !currentStep.selectedOptionId
                return (
                  <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-roc" style={{ fontWeight: 500 }}>{selectedProcesso.titulo}</h3>
                        <div className="text-xs text-pulse-ash mt-1">
                          {selectedProcesso.cliente_nome} · Criado em{' '}
                          {selectedProcesso.created_at ? new Date(selectedProcesso.created_at).toLocaleString('pt-BR') : '-'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MiniBadge text={statusLabel(selectedProcesso.status)} color={statusColor(selectedProcesso.status)} />
                        <span
                          className="text-xs tracking-wider font-roc"
                          style={{ color: PRIORIDADE_MAP[selectedProcesso.prioridade] || '#535353', fontWeight: 500 }}
                        >
                          {selectedProcesso.prioridade}
                        </span>
                        <button
                          onClick={() => deleteProcesso(selectedProcesso.id)}
                          className="px-3 py-1 rounded text-xs tracking-wider text-infrared border border-infrared/30 hover:bg-infrared/10 transition-colors"
                        >
                          Excluir
                        </button>
                        <button
                          onClick={() => setKanbanProcesso(selectedProcesso)}
                          className="px-3 py-1 rounded text-xs tracking-wider text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                        >
                          Abrir Kanban
                        </button>
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs tracking-wider text-pulse-ash">Progresso</span>
                        <span className="text-xs text-pulse-ash">{completed}/{total} etapas</span>
                      </div>
                      <ProgressBar done={completed} total={total} />
                    </div>

                    {/* Visibilidade */}
                    {selectedProcesso.visibilidade && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs tracking-wider text-pulse-ash">Visibilidade:</span>
                        <span className="text-xs text-off-white capitalize">{selectedProcesso.visibilidade}</span>
                      </div>
                    )}

                    {/* Situacao */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs tracking-wider text-pulse-ash">Situacao:</span>
                      {editingSituacao && editingSituacao.id === selectedProcesso.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editingSituacao.situacao}
                            onChange={e => setEditingSituacao({ ...editingSituacao, situacao: e.target.value })}
                            className="bg-core-black border border-urban-smoke rounded-lg px-3 py-1.5 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                          >
                            {SITUACAO_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{SITUACAO_MAP[opt]?.label || opt}</option>
                            ))}
                          </select>
                          <button
                            onClick={saveSituacao}
                            className="px-3 py-1 rounded text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingSituacao(null)}
                            className="px-3 py-1 rounded text-xs tracking-wider text-pulse-ash hover:text-off-white transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <MiniBadge text={situacaoLabel(selectedProcesso.situacao)} color={situacaoColor(selectedProcesso.situacao)} />
                          <button
                            onClick={() => setEditingSituacao({ id: selectedProcesso.id, situacao: selectedProcesso.situacao || 'em_execucao' })}
                            className="text-xs text-electric-teal hover:text-off-white transition-colors tracking-wider"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div>
                      <h4 className="text-xs tracking-wider text-pulse-ash mb-4">Etapas</h4>
                      {etapas.length === 0 ? (
                        <div className="text-xs text-pulse-ash py-4">Nenhuma etapa definida.</div>
                      ) : (
                        <div className="space-y-0">
                          {etapas.map((etapa, idx) => {
                            const isDone = etapa.isCompleted
                            const isCurrent = idx === currIdx
                            const unmet = hasUnmetDependencies(etapa, etapas)
                            const blocked = !isDone && unmet
                            const incompleteSubs = hasIncompleteSubtasks(etapa)
                            const dueDate = etapa.dias && selectedProcesso.data_inicio
                              ? addDays(selectedProcesso.data_inicio, etapa.dias)
                              : etapa.dueDate || undefined
                            const isAtrasado = !isDone && dueDate && new Date(dueDate + 'T00:00:00') < new Date()
                            let circleColor = '#535353'
                            if (isDone) circleColor = '#10B981'
                            else if (blocked) circleColor = '#F97316'
                            else if (isAtrasado) circleColor = '#EF4444'
                            else if (isCurrent) circleColor = '#3B82F6'
                            const bgOpacity = isDone ? '15' : (blocked ? '15' : (isAtrasado ? '15' : (isCurrent ? '15' : '05')))
                            return (
                              <div key={etapa.id || idx} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 relative"
                                    style={{
                                      backgroundColor: circleColor + bgOpacity,
                                      border: '2px solid ' + circleColor,
                                    }}
                                  >
                                    {isDone ? (
                                      <span style={{ color: '#10B981', fontSize: '10px' }}>+</span>
                                    ) : isAtrasado ? (
                                      <span className="animate-pulse" style={{ color: '#EF4444', fontSize: '10px' }}>!</span>
                                    ) : isCurrent ? (
                                      <span style={{ color: '#3B82F6', fontSize: '10px' }}>*</span>
                                    ) : blocked ? (
                                      <span style={{ color: '#F97316', fontSize: '10px' }}>L</span>
                                    ) : (
                                      <span style={{ color: '#535353', fontSize: '10px' }}>{idx + 1}</span>
                                    )}
                                  </div>
                                  {idx < etapas.length - 1 && (
                                    <div
                                      className="w-0.5 flex-1 min-h-[20px]"
                                      style={{ backgroundColor: isDone ? '#10B98135' : '#53535335' }}
                                    />
                                  )}
                                </div>
                                <div className="flex-1 pb-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs" style={{ color: isDone ? '#10B981' : isAtrasado ? '#EF4444' : blocked ? '#F97316' : isCurrent ? '#3B82F6' : '#9CA3AF' }}>
                                      {etapa.title || '(sem titulo)'}
                                    </span>
                                    <MiniBadge text={etapa.type} color={STEP_TYPE_COLORS[etapa.type] || '#535353'} />
                                    {isCurrent && !isDone && etapa.notificar_todos && (
                                      <span className="text-xs text-pulse-ash" title="Notificar todos ao concluir">*</span>
                                    )}
                                    {isAtrasado && (
                                      <span className="text-xs text-red-400 font-roc" style={{ fontWeight: 500 }}>
                                        Atrasado
                                      </span>
                                    )}
                                  </div>

                                  {/* Due date */}
                                  {dueDate && (
                                    <div className="mt-1">
                                      <span
                                        className="text-xs"
                                        style={{ color: isAtrasado ? '#EF4444' : '#9CA3AF' }}
                                      >
                                        Vencimento: {new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                        {etapa.dias ? ' (' + etapa.dias + ' dias)' : ''}
                                      </span>
                                    </div>
                                  )}

                                   {/* Completed info */}
                                   {isDone && (
                                     <div className="mt-1 text-xs" style={{ color: '#10B981' }}>
                                       (,p,{' '}
                                       {etapa.completedBy || 'Usuário'}
                                       {etapa.completedAt ? (
                                         <span style={{ color: '#6B7280' }}>
                                           {' '}-{' '}
                                           {new Date(etapa.completedAt).toLocaleDateString('pt-BR')}{' '}
                                           {new Date(etapa.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                         </span>
                                       ) : null}
                                       )
                                     </div>
                                   )}

                                   {/* Dependencies badges */}
                                  {etapa.dependsOn && etapa.dependsOn.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      <span className="text-xs text-pulse-ash">Depende:</span>
                                      {etapa.dependsOn.map(depId => {
                                        const depStep = etapas.find(e => e.id === depId)
                                        const depDone = depStep?.isCompleted
                                        return (
                                          <span
                                            key={depId}
                                            className="px-1.5 py-0.5 rounded text-[9px] tracking-wider"
                                            style={{
                                              backgroundColor: depDone ? '#10B98118' : '#53535318',
                                              color: depDone ? '#10B981' : '#9CA3AF',
                                              border: '1px solid ' + (depDone ? '#10B98135' : '#53535335'),
                                            }}
                                          >
                                            {depStep?.title || depId}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {/* Blocked warning */}
                                  {blocked && (
                                    <div className="mt-1.5 text-xs text-orange-400">
                                      (Bloqueado por: {getDependencyNames(etapa, etapas)})
                                    </div>
                                  )}

                                  {/* Subtasks */}
                                  {etapa.subtasks && etapa.subtasks.length > 0 && (
                                    <div className="mt-2 ml-1 space-y-1">
                                      {etapa.subtasks.map(st => (
                                        <label
                                          key={st.id}
                                          className="flex items-center gap-2 text-xs cursor-pointer"
                                          style={{ color: st.isCompleted ? '#10B981' : '#9CA3AF' }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={st.isCompleted}
                                            onChange={() => toggleInstanceSubtask(selectedProcesso.id, etapa.id, st.id)}
                                            className="rounded w-3 h-3"
                                          />
                                          <span style={{ textDecoration: st.isCompleted ? 'line-through' : 'none' }}>
                                            {st.title}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {/* Conclude step button */}
                                  {isCurrent && !isDone && !isBranchStep && (
                                    <div className="mt-2 flex items-center gap-2">
                                      {blocked ? (
                                        <span className="text-xs text-orange-400">(Etapa bloqueada)</span>
                                      ) : incompleteSubs ? (
                                        <span className="text-xs text-pulse-ash">Conclua todas as subtarefas primeiro!</span>
                                      ) : (
                                        <button
                                          onClick={() => completeStep(selectedProcesso.id)}
                                          disabled={saving}
                                          className="px-3 py-0.5 rounded text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50"
                                        >
                                          {saving ? '...' : 'Concluir Etapa'}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Branch step buttons */}
                                  {isCurrent && !isDone && isBranchStep && (
                                    <div className="mt-2">
                                      {blocked ? (
                                        <span className="text-xs text-orange-400">(Etapa bloqueada)</span>
                                      ) : incompleteSubs ? (
                                        <span className="text-xs text-pulse-ash">Conclua todas as subtarefas primeiro!</span>
                                      ) : etapa.options && etapa.options.length > 0 ? (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs text-pulse-ash">{etapa.type === 'Gatilho' ? 'Disparar:' : 'Decisao:'}</span>
                                          {etapa.options.map((opt, oi) => {
                                            const nextStep = etapas.find(e => e.id === opt.nextStepId)
                                            const bgClass = oi === 0
                                              ? 'bg-green-700/30 text-green-400 border border-green-500/30 hover:bg-green-700/50'
                                              : 'bg-red-700/30 text-red-400 border border-red-500/30 hover:bg-red-700/50'
                                            return (
                                              <button
                                                key={oi}
                                                onClick={() => completeStep(selectedProcesso.id, opt.label)}
                                                disabled={saving}
                                                className={'px-3 py-0.5 rounded text-xs tracking-wider transition-colors disabled:opacity-50 ' + bgClass}
                                              >
                                                {opt.label} {nextStep ? '-> ' + (nextStep.title || '?') : ''}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-pulse-ash">(sem opcoes de ramificacao)</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Completed decision label */}
                                  {isDone && etapa.selectedOptionId && (
                                    <div className="mt-1">
                                      <span className="text-xs text-pulse-ash">
                                        ({etapa.selectedOptionId})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Inline status change */}
                    <div className="pt-3 border-t border-urban-smoke flex items-center gap-3">
                      <span className="text-xs tracking-wider text-pulse-ash">Alterar status:</span>
                      <select
                        value={selectedProcesso.status}
                        onChange={e => updateProcessoStatus(selectedProcesso.id, e.target.value)}
                        className="bg-core-black border border-urban-smoke rounded px-3 py-1.5 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                      >
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ==================== KANBAN TAB ==================== */}
          {!loading && subTab === 'kanban' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-xs text-pulse-ash">
                  {processos.length} processo(s)
                </div>
                <button
                  onClick={openKanbanFlow}
                  className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors"
                >
                  + Iniciar Novo Fluxo
                </button>
              </div>

               <div className="grid grid-cols-4 gap-4" style={{ minHeight: '60vh' }}>
                {KANBAN_COLUMNS.map(col => {
                  const colProcesses = getKanbanProcesses(col.key)
                  return (
                    <div
                      key={col.key}
                      className="bg-rich-carbon border border-urban-smoke rounded-xl flex flex-col"
                      onDragOver={handleDragOver}
                      onDrop={e => handleDrop(e, col.status)}
                    >
                      <div className="p-3 border-b border-urban-smoke">
                        <div className="flex items-center justify-between">
                          <span className="text-xs tracking-wider text-pulse-ash">{col.label}</span>
                          <span className="text-xs text-pulse-ash">{colProcesses.length}</span>
                        </div>
                      </div>
                      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                        {colProcesses.length === 0 ? (
                          <div className="flex items-center justify-center h-24 border border-dashed border-urban-smoke rounded-lg">
                            <span className="text-xs text-pulse-ash">Sem processos</span>
                          </div>
                        ) : (
                          colProcesses.map(p => {
                            const etapas = safeEtapas(p.etapas)
                            const completed = countCompleted(etapas)
                            const total = etapas.length
                            const { step: current } = getCurrentStep(etapas)
                            const borderColor = STATUS_MAP[col.key]?.color || '#535353'
                            const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                            return (
                              <div
                                key={p.id}
                                draggable={true}
                                onDragStart={e => handleDragStart(e, p.id)}
                                className="bg-core-black border border-urban-smoke rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-electric-teal/30 transition-colors"
                                style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-pulse-ash truncate">{p.cliente_nome || '-'}</span>
                                  <select
                                    value={p.status}
                                    onChange={e => { e.stopPropagation(); updateProcessoStatus(p.id, e.target.value) }}
                                    onClick={e => e.stopPropagation()}
                                    className="bg-transparent text-xs text-pulse-ash border border-urban-smoke rounded px-1 py-0.5 focus:outline-none"
                                  >
                                    {Object.keys(STATUS_MAP).map(s => (
                                      <option key={s} value={s}>{STATUS_MAP[s].label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div
                                  className="text-xs mb-2 cursor-pointer hover:text-electric-teal transition-colors"
                                  onClick={() => { setSubTab('instancias'); setSelectedProcesso(p) }}
                                  style={{ fontWeight: 500 }}
                                >
                                  {p.titulo}
                                </div>
                                <div className="mb-1.5">
                                  <div className="flex-1 h-1 bg-urban-smoke rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: pct + '%', backgroundColor: pct === 100 ? '#10B981' : '#5C939F' }}
                                    />
                                  </div>
                                </div>
                                {current && (
                                  <div className="flex items-center gap-1.5">
                                    <MiniBadge text={current.type} color={STEP_TYPE_COLORS[current.type] || '#535353'} />
                                    <span className="text-xs text-pulse-ash truncate">{current.title}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ==================== RECORRENCIAS TAB ==================== */}
          {!loading && subTab === 'recorrencias' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="text-xs text-pulse-ash">
                  {recurrenciaEntries.filter(e => e.ativo).length} recorrencia(s) ativa(s)
                </div>
                <button
                  onClick={gerarRecorrentes}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Gerando...' : 'Gerar Recorrentes'}
                </button>
              </div>

              {recurrenciaEntries.length === 0 ? (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-16 text-center">
                  <div className="text-pulse-ash text-sm mb-2">
                    Nenhum template com recorrencia configurada.
                  </div>
                  <div className="text-pulse-ash text-xs">
                    Marque um modelo como "Recorrente" na aba Modelos para ativar recorrencias.
                  </div>
                </div>
              ) : (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                        <th className="text-left py-3 px-4">Template</th>
                        <th className="text-left py-3 px-4">Frequencia</th>
                        <th className="text-center py-3 px-4">Status</th>
                        <th className="text-center py-3 px-4">Clientes</th>
                        <th className="text-center py-3 px-4">Ultima Geracao</th>
                        <th className="text-right py-3 px-4">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurrenciaEntries.map(entry => (
                        <tr key={entry.template.id} className="border-b border-urban-smoke/30 hover:bg-urban-smoke/30 transition-colors">
                          <td className="py-3 px-4">{entry.template.titulo}</td>
                          <td className="py-3 px-4 text-pulse-ash capitalize">{entry.template.recorrencia_padrao || 'mensal'}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs tracking-wider"
                              style={{
                                backgroundColor: entry.ativo ? '#10B98118' : '#53535318',
                                color: entry.ativo ? '#10B981' : '#535353',
                                border: '1px solid ' + (entry.ativo ? '#10B98135' : '#53535335'),
                              }}
                            >
                              {entry.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-pulse-ash">{entry.clientes.length}</td>
                          <td className="py-3 px-4 text-center text-pulse-ash">
                            {entry.ultima_geracao ? new Date(entry.ultima_geracao).toLocaleDateString('pt-BR') : 'Nunca'}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {entry.ativo ? (
                                <button
                                  onClick={() => encerrarRecorrencia(entry.template.id)}
                                  className="px-3 py-1 rounded text-xs tracking-wider text-infrared border border-infrared/30 hover:bg-infrared/10 transition-colors"
                                >
                                  Encerrar
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setRecurrenciaOpen(entry.template.id)
                                    setRecurrenciaClientes(entry.clientes)
                                  }}
                                  className="px-3 py-1 rounded text-xs tracking-wider text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                                >
                                  Iniciar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Iniciar recorrencia modal */}
              {recurrenciaOpen !== null && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
                  <div className="absolute inset-0 bg-core-black/80" onClick={() => setRecurrenciaOpen(null)} />
                  <div className="relative bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4">
                    <div className="p-6 border-b border-urban-smoke">
                      <h3 className="text-sm font-roc tracking-wider" style={{ fontWeight: 500 }}>
                        Iniciar Recorrencia
                      </h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="text-xs text-pulse-ash">
                        Template: <span className="text-off-white">{templates.find(t => t.id === recurrenciaOpen)?.titulo}</span>
                      </div>
                      <div>
                        <label className="block text-xs tracking-wider text-pulse-ash mb-2">
                          Selecione os clientes ({recurrenciaClientes.length})
                        </label>
                        <div className="max-h-64 overflow-y-auto border border-urban-smoke rounded-lg bg-core-black p-2 space-y-1">
                          {clientes.length === 0 ? (
                            <div className="text-xs text-pulse-ash py-4 text-center">Nenhum cliente disponivel.</div>
                          ) : (
                            clientes.map(c => (
                              <label
                                key={c.id}
                                className="flex items-center gap-2 py-1.5 px-2 hover:bg-urban-smoke/30 rounded cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={recurrenciaClientes.includes(c.id)}
                                  onChange={() => setRecurrenciaClientes(prev =>
                                    prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                  )}
                                  className="rounded"
                                />
                                <span className="text-off-white">{c.name || c.razao_social || 'Cliente #' + c.id}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-urban-smoke flex items-center justify-end gap-3">
                      <button
                        onClick={() => setRecurrenciaOpen(null)}
                        className="px-4 py-2 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => iniciarRecorrencia(recurrenciaOpen, recurrenciaClientes)}
                        disabled={recurrenciaSaving || recurrenciaClientes.length === 0}
                        className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {recurrenciaSaving ? 'Iniciando...' : 'Iniciar Recorrencia'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ==================== TEMPLATE BUILDER MODAL ==================== */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8">
          <div className="absolute inset-0 bg-core-black/80" onClick={() => setShowTemplateModal(false)} />
          <div className="relative bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-5xl max-h-[90vh] mx-4 flex flex-col">
            <div className="p-6 border-b border-urban-smoke shrink-0">
              <h3 className="text-sm font-roc tracking-wider" style={{ fontWeight: 500 }}>
                {editingTemplateId ? 'Editar Modelo' : 'Novo Modelo de Processo'}
              </h3>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar */}
              <div className="w-72 shrink-0 border-r border-urban-smoke p-5 space-y-5 overflow-y-auto">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Titulo</label>
                  <input
                    type="text"
                    value={tfTitulo}
                    onChange={e => setTfTitulo(e.target.value)}
                    placeholder="Nome do processo"
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Categoria</label>
                  <select
                    value={tfCategoria}
                    onChange={e => setTfCategoria(e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                  >
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Departamento</label>
                  <select
                    value={tfDepto}
                    onChange={e => setTfDepto(e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                  >
                    <option value="">Nenhum</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Recorrente toggle */}
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-2">Recorrente</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTfRecorrente(!tfRecorrente)}
                      className={'relative w-10 h-5 rounded-full transition-colors ' +
                        (tfRecorrente ? 'bg-electric-teal' : 'bg-urban-smoke')
                      }
                    >
                      <span
                        className={'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ' +
                          (tfRecorrente ? 'translate-x-5' : 'translate-x-0.5')
                        }
                      />
                    </button>
                    <span className="text-xs text-pulse-ash">
                      {tfRecorrente ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {tfRecorrente && (
                    <div className="mt-3">
                      <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Frequencia</label>
                      <select
                        value={tfRecorrencia}
                        onChange={e => setTfRecorrencia(e.target.value)}
                        className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                      >
                        {RECORRENCIA_OPTIONS.map(o => (
                          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: step builder */}
              <div className="flex-1 p-5 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs tracking-wider text-pulse-ash">Fluxo de Etapas</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addStep('Tarefa')}
                      className="px-3 py-1 rounded text-xs tracking-wider border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      + Tarefa
                    </button>
                    <button
                      onClick={() => addStep('Obrigação')}
                      className="px-3 py-1 rounded text-xs tracking-wider border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors"
                    >
                      + Obrigacao
                    </button>
                    <button
                      onClick={() => addStep('Decisão')}
                      className="px-3 py-1 rounded text-xs tracking-wider border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors"
                    >
                      + Decisao
                    </button>
                    <button
                      onClick={() => addStep('Gatilho')}
                      className="px-3 py-1 rounded text-xs tracking-wider border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      + Gatilho
                    </button>
                  </div>
                </div>

                {tfEtapas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-urban-smoke rounded-lg">
                    <span className="text-pulse-ash text-sm mb-2">Nenhuma etapa definida</span>
                    <span className="text-pulse-ash text-xs">Adicione etapas para compor o fluxo do processo.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tfEtapas.map((etapa, idx) => (
                      <div
                        key={etapa.id || idx}
                        className="bg-core-black border border-urban-smoke rounded-lg p-3"
                      >
                        <div className="flex items-start gap-3">
                          {/* Order + move buttons */}
                          <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                            <button
                              onClick={() => moveStepUp(idx)}
                              disabled={idx === 0}
                              className="text-xs text-pulse-ash hover:text-off-white disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                            >
                              ^
                            </button>
                            <span className="text-xs text-pulse-ash font-mono w-5 text-center">{idx + 1}</span>
                            <button
                              onClick={() => moveStepDown(idx)}
                              disabled={idx >= tfEtapas.length - 1}
                              className="text-xs text-pulse-ash hover:text-off-white disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                            >
                              v
                            </button>
                          </div>

                          {/* Content */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <MiniBadge text={etapa.type} color={STEP_TYPE_COLORS[etapa.type] || '#535353'} />
                              <input
                                type="text"
                                value={etapa.title}
                                onChange={e => updateStepField(idx, 'title', e.target.value)}
                                placeholder="Titulo da etapa"
                                className="flex-1 bg-transparent border border-urban-smoke rounded px-2 py-1.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                              />
                              <button
                                onClick={() => removeStep(idx)}
                                className="px-2 py-1 rounded text-xs text-infrared hover:bg-infrared/10 transition-colors shrink-0"
                                title="Remover etapa"
                              >
                                x
                              </button>
                            </div>

                            {/* Dias (due date) */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-pulse-ash tracking-wider">Dias para vencer:</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={etapa.dias ?? ''}
                                  onChange={e => updateStepField(idx, 'dias', e.target.value ? Number(e.target.value) : undefined)}
                                  placeholder="0"
                                  className="w-16 bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal text-center"
                                />
                              </div>

                              {/* Notificar todos */}
                              <label className="flex items-center gap-1.5 text-xs text-pulse-ash cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={etapa.notificar_todos || false}
                                  onChange={e => updateStepField(idx, 'notificar_todos', e.target.checked)}
                                  className="rounded w-3 h-3"
                                />
                                <span>Notificar todos ao concluir</span>
                              </label>
                            </div>

                            {/* DependsOn multi-select */}
                            <div className="border-t border-urban-smoke pt-3 mt-3">
                              <label className="block text-xs text-off-white font-medium tracking-wider mb-2">
                                Dependências
                              </label>
                              {idx === 0 ? (
                                <span className="text-xs text-pulse-ash italic">Primeira etapa — não possui dependências.</span>
                              ) : (
                                <div>
                                  <div className="text-[11px] text-pulse-ash mb-2">
                                    Etapas anteriores que devem estar concluídas antes desta:
                                  </div>
                                  <div className="space-y-1">
                                    {tfEtapas.filter((_, i) => i < idx).map(dep => {
                                      const originalIdx = tfEtapas.indexOf(dep)
                                      const isSelected = (etapa.dependsOn || []).includes(dep.id)
                                      return (
                                        <label
                                          key={dep.id}
                                          onClick={() => toggleDependsOn(idx, dep.id)}
                                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                            isSelected
                                              ? 'bg-electric-teal/15 border border-electric-teal/30'
                                              : 'bg-core-black border border-urban-smoke hover:border-electric-teal/30'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            className="accent-electric-teal"
                                          />
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                                              isSelected ? 'bg-electric-teal/20 text-electric-teal' : 'bg-urban-smoke text-pulse-ash'
                                            }`}>
                                              #{originalIdx + 1}
                                            </span>
                                            <span className={`text-xs truncate ${isSelected ? 'text-off-white' : 'text-off-white'}`}>
                                              {dep.title || '(sem titulo)'}
                                            </span>
                                          </div>
                                          {isSelected && (
                                            <svg className="ml-auto shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5">
                                              <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                          )}
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Subtasks */}
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <label className="text-xs text-pulse-ash tracking-wider">Subtarefas</label>
                                <button
                                  onClick={() => addSubtask(idx)}
                                  className="px-2 py-0.5 rounded text-xs text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                                >
                                  + Adicionar
                                </button>
                              </div>
                              {(etapa.subtasks || []).length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  {(etapa.subtasks || []).map(st => (
                                    <div key={st.id} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={st.title}
                                        onChange={e => updateSubtaskField(idx, st.id, 'title', e.target.value)}
                                        placeholder="Subtarefa..."
                                        className="flex-1 bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                                      />
                                      <button
                                        onClick={() => removeSubtask(idx, st.id)}
                                        className="text-xs text-infrared hover:text-red-400 transition-colors shrink-0"
                                      >
                                        x
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Decision / Gatilho branching options */}
                            {(etapa.type === 'Decisão' || etapa.type === 'Gatilho') && (
                              <div className="pl-2 border-l-2 border-orange-500/20 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-pulse-ash tracking-wider">
                                    {etapa.type === 'Gatilho' ? 'Opcoes de Disparo' : 'Opcoes de Decisao'}
                                  </span>
                                  <button
                                    onClick={() => addBranchOption(idx)}
                                    className="px-2 py-0.5 rounded text-xs text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                                  >
                                    + Opcao
                                  </button>
                                </div>
                                {(etapa.options || []).length === 0 ? (
                                  <span className="text-xs text-pulse-ash">Nenhuma opcao de ramificacao. Adicione ao menos uma.</span>
                                ) : (
                                  <div className="space-y-2">
                                    {(etapa.options || []).map((opt, oi) => (
                                      <div key={oi} className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={opt.label}
                                          onChange={e => updateBranchOption(idx, oi, 'label', e.target.value)}
                                          placeholder="Rotulo (ex: Sim, Nao)"
                                          className="w-24 bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                                        />
                                        <span className="text-xs text-pulse-ash">{'→'}</span>
                                        <select
                                          value={opt.nextStepId}
                                          onChange={e => updateBranchOption(idx, oi, 'nextStepId', e.target.value)}
                                          className="flex-1 bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                                        >
                                          <option value="">Proxima sequencial</option>
                                          {tfEtapas.filter((_, i) => i !== idx).map(s => (
                                            <option key={s.id} value={s.id}>
                                              #{tfEtapas.indexOf(s) + 1} {s.title || '(sem titulo)'}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() => removeBranchOption(idx, oi)}
                                          className="text-xs text-infrared hover:text-red-400 transition-colors shrink-0"
                                        >
                                          x
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-urban-smoke flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveTemplate}
                disabled={templateSaving || !tfTitulo.trim()}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {templateSaving ? 'Salvando...' : editingTemplateId ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== INSTANCE MODAL ==================== */}
      {showInstanceModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-core-black/80" onClick={() => setShowInstanceModal(false)} />
          <div className="relative bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4">
            <div className="p-6 border-b border-urban-smoke">
              <h3 className="text-sm font-roc tracking-wider" style={{ fontWeight: 500 }}>
                Nova Instancia de Processo
              </h3>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Modelo (template)</label>
                <select
                  value={ifTemplateId}
                  onChange={e => handleTemplateSelect(e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                >
                  <option value="">Selecione um modelo...</option>
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.titulo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Titulo</label>
                <input
                  type="text"
                  value={ifTitulo}
                  onChange={e => setIfTitulo(e.target.value)}
                  placeholder="Nome da instancia"
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                />
              </div>

              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Cliente</label>
                <select
                  value={ifCliente}
                  onChange={e => setIfCliente(e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.razao_social || 'Cliente #' + c.id}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Prioridade</label>
                  <select
                    value={ifPrioridade}
                    onChange={e => setIfPrioridade(e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                  >
                    {PRIORIDADES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Data de Inicio</label>
                  <input
                    type="date"
                    value={ifDataInicio}
                    onChange={e => setIfDataInicio(e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                  />
                </div>
              </div>

              {/* Visibilidade */}
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Visibilidade</label>
                <select
                  value={ifVisibilidade}
                  onChange={e => setIfVisibilidade(e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                >
                  {VISIBILIDADE_OPTIONS.map(v => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>

              {ifEtapas.length > 0 && (
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-2">
                    Etapas ({ifEtapas.length})
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {ifEtapas.map((etapa, i) => (
                      <div key={etapa.id || i} className="flex items-center gap-2 text-xs bg-core-black border border-urban-smoke rounded-lg px-3 py-2">
                        <span className="text-xs text-pulse-ash font-mono w-5">{i + 1}</span>
                        <MiniBadge text={etapa.type} color={STEP_TYPE_COLORS[etapa.type] || '#535353'} />
                        <span className="flex-1">{etapa.title}</span>
                        {etapa.dias ? (
                          <span className="text-xs text-pulse-ash">{etapa.dias}d</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-urban-smoke flex items-center justify-end gap-3">
              <button
                onClick={() => setShowInstanceModal(false)}
                className="px-4 py-2 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveInstance}
                disabled={instanceSaving || !ifTitulo.trim() || !ifCliente}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {instanceSaving ? 'Criando...' : 'Criar Instancia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== KANBAN FLOW MODAL ==================== */}
      {showKanbanModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-core-black/80" onClick={() => setShowKanbanModal(false)} />
          <div className="relative bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4">
            <div className="p-6 border-b border-urban-smoke">
              <h3 className="text-sm font-roc tracking-wider" style={{ fontWeight: 500 }}>
                Iniciar Novo Fluxo
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Modelo (template)</label>
                <select
                  value={kfTemplateId}
                  onChange={e => setKfTemplateId(e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
                >
                  <option value="">Selecione um modelo...</option>
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.titulo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-2">
                  Clientes ({kfSelectedClients.length} selecionado(s))
                </label>
                <div className="max-h-64 overflow-y-auto border border-urban-smoke rounded-lg bg-core-black p-2 space-y-1">
                  {clientes.length === 0 ? (
                    <div className="text-xs text-pulse-ash py-4 text-center">Nenhum cliente disponivel.</div>
                  ) : (
                    clientes.map(c => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-urban-smoke/30 rounded cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={kfSelectedClients.includes(c.id)}
                          onChange={() => toggleKanbanClient(c.id)}
                          className="rounded"
                        />
                        <span className="text-off-white">{c.name || c.razao_social || 'Cliente #' + c.id}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-urban-smoke flex items-center justify-end gap-3">
              <button
                onClick={() => setShowKanbanModal(false)}
                className="px-4 py-2 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createKanbanFlows}
                disabled={kfCreating || !kfTemplateId || kfSelectedClients.length === 0}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {kfCreating ? 'Criando...' : 'Criar ' + kfSelectedClients.length + ' Fluxo(s)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-process Kanban modal */}
      {kanbanProcesso && <KanbanPorProcesso processo={kanbanProcesso} onClose={() => { setKanbanProcesso(null); loadData(true) }} />}
    </div>
  )
}

/* ────────────────────────────────────────────
   KANBAN POR PROCESSO (step-level board)
   matches V2 exactly: 4 cols, same rules, validations
   ──────────────────────────────────────────── */
function KanbanPorProcesso({ processo, onClose }: {
  processo: Processo
  onClose: () => void
}) {
  const [current, setCurrent] = useState(processo)

  const reload = async () => {
    const t = getToken(); if (!t) return
    try {
      const r = await fetch(`/api/processos/${processo.id}`, { headers: { Authorization: 'Bearer ' + t } })
      if (r.ok) { const p = await r.json(); setCurrent(p) }
    } catch {}
  }

  useEffect(() => { setCurrent(processo) }, [processo])

  const etapas = safeEtapas(current.etapas)
  const currIdx = getCurrentStep(etapas).index

  const getStepStatus = (s: Etapa, idx: number) => {
    if (s.isCompleted) return 'Concluida'
    const dueDate = s.dias && current.data_inicio ? addDays(current.data_inicio, s.dias) : s.dueDate
    const isOverdue = !s.isCompleted && dueDate && new Date(dueDate + 'T00:00:00') < new Date()
    if (isOverdue) return 'Atrasado'
    if (idx === currIdx) return 'Em Andamento'
    return 'Pendente'
  }

  const columns = [
    { key: 'Pendente', label: 'Pendente', color: '#94A3B8', steps: etapas.filter((s, i) => getStepStatus(s, i) === 'Pendente') },
    { key: 'Em Andamento', label: 'Em Andamento', color: '#3B82F6', steps: etapas.filter((s, i) => getStepStatus(s, i) === 'Em Andamento') },
    { key: 'Atrasado', label: 'Atrasado', color: '#EF4444', steps: etapas.filter((s, i) => getStepStatus(s, i) === 'Atrasado') },
    { key: 'Concluida', label: 'Concluída', color: '#10B981', steps: etapas.filter(s => s.isCompleted) },
  ]

  const handleDragStart = (e: React.DragEvent, stepId: string, fromCol: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ stepId, fromCol }))
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  const handleDrop = async (e: React.DragEvent, toCol: string) => {
    e.preventDefault()
    const { stepId, fromCol } = JSON.parse(e.dataTransfer.getData('text/plain'))
    if (fromCol === toCol) return

    if (toCol === 'Concluida' && (fromCol === 'Em Andamento' || fromCol === 'Atrasado')) {
      if (current.situacao && current.situacao !== 'em_execucao') {
        alert("Processo precisa estar 'Em Execução'"); return
      }
      const step = etapas.find(s => s.id === stepId)
      if (step) {
        if (hasUnmetDependencies(step, etapas)) {
          alert('Etapas pendentes: ' + getDependencyNames(step, etapas)); return
        }
        if (hasIncompleteSubtasks(step)) {
          alert('Conclua todas as subtarefas primeiro!'); return
        }
      }
      await completeStepLocal(stepId)
    } else if ((toCol === 'Pendente' || toCol === 'Em Andamento') && fromCol === 'Concluida') {
      await undoStep(stepId, 'em_execucao')
    } else if (toCol === 'Pendente' && fromCol === 'Atrasado') {
      await undoStep(stepId)
    }
  }

  const completeStepLocal = async (stepId: string) => {
    try {
      const t = getToken(); if (!t) return
      const updatedEtapas = etapas.map(e => {
        if (e.id !== stepId) return e
        const userName = (() => { try { const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token; return JSON.parse(atob(tok.split('.')[1])).display_name || 'Usuário' } catch {} return 'Usuário' })()
        return { ...e, isCompleted: true, completedBy: userName, completedAt: new Date().toISOString() }
      })
      const allDone = updatedEtapas.every(e => e.isCompleted)
      const newStatus = allDone ? 'Concluida' : 'em_execucao'
      await fetch('/api/processos/' + current.id, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapas: updatedEtapas, status: newStatus }),
      })
      await reload()
    } catch (e: any) { alert(e.message || 'Erro') }
  }

  const undoStep = async (stepId: string, newStatus?: string) => {
    const t = getToken(); if (!t) return
    const updatedEtapas = etapas.map(e => e.id === stepId ? { ...e, isCompleted: false, completedBy: undefined, completedAt: undefined } : e)
    await fetch('/api/processos/' + current.id, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapas: updatedEtapas, status: newStatus || 'em_execucao' }),
    }).catch(() => {})
    await reload()
  }

  // V2-style inline status dropdown
  const changeStepStatus = async (stepId: string, newStatus: string) => {
    if (newStatus === 'Concluida') {
      if (current.situacao && current.situacao !== 'em_execucao') {
        alert("Processo precisa estar 'Em Execução'"); return
      }
      const step = etapas.find(s => s.id === stepId)
      if (step && hasUnmetDependencies(step, etapas)) {
        alert('Etapas pendentes: ' + getDependencyNames(step, etapas)); return
      }
      if (step && hasIncompleteSubtasks(step)) {
        alert('Conclua todas as subtarefas primeiro!'); return
      }
      await completeStepLocal(stepId)
    } else if (newStatus === 'Pendente') {
      await undoStep(stepId, 'em_execucao')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80" onClick={onClose}>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-[95vw] max-w-[1400px] max-h-[92vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-urban-smoke">
          <div>
            <h3 className="text-sm tracking-wider">{processo.titulo}</h3>
            <p className="text-xs text-pulse-ash mt-0.5">{processo.cliente_nome} · {processo.status} · {etapas.filter(e => e.isCompleted).length}/{etapas.length} etapas</p>
          </div>
          <button onClick={onClose} className="text-pulse-ash hover:text-off-white transition-colors p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-x-auto p-5">
          <div className="grid grid-cols-4 gap-4" style={{ minWidth: '900px' }}>
            {columns.map(col => (
              <div key={col.key} className="flex flex-col" style={{ minHeight: '500px' }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <h4 className="text-xs tracking-wider" style={{ color: col.color }}>{col.label}</h4>
                  </div>
                  <span className="text-xs text-pulse-ash bg-urban-smoke/50 px-2 py-0.5 rounded-full">{col.steps.length}</span>
                </div>
                <div
                  className="flex-1 rounded-lg border-2 border-dashed transition-colors p-2 space-y-2 overflow-y-auto"
                  style={{ borderColor: col.key === 'Em Andamento' || col.key === 'Atrasado' ? col.color + '30' : '#1B1B1B', backgroundColor: col.key === 'Atrasado' ? '#EF444408' : 'transparent' }}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, col.key)}
                >
                  {col.steps.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-pulse-ash italic">Vazio</div>
                  ) : (
                    col.steps.map(s => {
                      const dueDate = s.dias && current.data_inicio ? addDays(current.data_inicio, s.dias) : s.dueDate
                      const isOverdue = col.key === 'Atrasado'
                      const incompleteSubs = hasIncompleteSubtasks(s)
                      const unmet = hasUnmetDependencies(s, etapas)
                      const blocked = !s.isCompleted && unmet
                      return (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={e => handleDragStart(e, s.id, col.key)}
                          className="bg-core-black border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-urban-smoke transition-colors"
                          style={{ borderColor: col.key === 'Em Andamento' || col.key === 'Atrasado' ? col.color + '40' : '#1B1B1B' }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs px-1.5 py-0.5 rounded tracking-wider"
                              style={{ backgroundColor: (STEP_TYPE_COLORS[s.type] || '#535353') + '18', color: STEP_TYPE_COLORS[s.type] || '#535353', border: '1px solid ' + (STEP_TYPE_COLORS[s.type] || '#535353') + '35' }}>
                              {s.type}
                            </span>
                            {/* V2-style inline status dropdown */}
                            <select
                              value={col.key}
                              onChange={e => { if (e.target.value !== col.key) changeStepStatus(s.id, e.target.value) }}
                              onClick={ev => ev.stopPropagation()}
                              className="bg-transparent border border-urban-smoke/50 rounded text-[9px] text-pulse-ash px-1 py-0.5 focus:outline-none cursor-pointer"
                              style={{ maxWidth: '80px' }}
                            >
                              <option value="Pendente">Pendente</option>
                              <option value="Em Andamento">Em Andam.</option>
                              <option value="Concluida">Concluída</option>
                            </select>
                          </div>
                          <div className="text-xs font-medium mb-1.5">{s.title || '(sem titulo)'}</div>
                          {isOverdue && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-xs text-red-400 font-roc" style={{ fontWeight: 500 }}>Atrasado</span>
                            </div>
                          )}
                          {dueDate && (
                            <div className="text-xs mb-1.5" style={{ color: isOverdue ? '#EF4444' : '#9CA3AF' }}>
                              Vence: {new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                              {s.dias ? <span className="text-pulse-ash ml-1">({s.dias}d)</span> : null}
                            </div>
                          )}
                          {s.dependsOn && s.dependsOn.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {s.dependsOn.map(did => {
                                const dep = etapas.find(e => e.id === did)
                                return <span key={did} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: dep?.isCompleted ? '#10B98118' : '#EF444418', color: dep?.isCompleted ? '#10B981' : '#EF4444' }}>{dep?.title || did}</span>
                              })}
                            </div>
                          )}
                          {s.subtasks && s.subtasks.length > 0 && (
                            <div className="text-xs text-pulse-ash mb-1.5">
                              Subtarefas: {s.subtasks.filter(st => st.isCompleted).length}/{s.subtasks.length}
                            </div>
                          )}
                          {blocked && (
                            <div className="text-xs text-orange-400 mb-1">(Bloqueado: {getDependencyNames(s, etapas)})</div>
                          )}
                          {incompleteSubs && col.key !== 'Concluida' && (
                            <div className="text-xs text-pulse-ash mb-1">(Subtarefas pendentes)</div>
                          )}
                          {s.isCompleted && (
                            <div className="text-xs mt-1 pt-1 border-t border-urban-smoke/30" style={{ color: '#10B981' }}>
                              (,p, {' '}{s.completedBy || 'Usuário'}
                              {s.completedAt && <span style={{ color: '#6B7280' }}> - {new Date(s.completedAt).toLocaleDateString('pt-BR')} {new Date(s.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                              )
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
