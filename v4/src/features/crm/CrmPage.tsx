import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import {
  DndContext, PointerSensor, TouchSensor, closestCorners, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Target, Plus, X, Trash2, Pencil, Loader2, CheckCircle2, RefreshCw,
} from 'lucide-react'

type Fase = 'novo' | 'qualificado' | 'proposta' | 'negociacao' | 'ganho' | 'perdido'

type Servico = {
  id: number; nome: string; valor: number; template_processo_id?: number | null
  template_nome?: string; ativo?: number
}

type Negocio = {
  id: number; cliente_id: number; cliente_nome: string; titulo: string
  crm_servico_id?: number | null; servico_nome?: string; servico_valor?: number
  fase: Fase; valor_estimado?: number; desconto?: number; valor_fechado?: number
  probabilidade?: number; responsavel_user_id?: number; responsavel_nome?: string
  origem?: string; observacao?: string; processo_id?: number | null
  processo_titulo?: string; processo_status?: string
  processo_etapa_atual?: string; processo_pct?: number; processo_atrasado?: boolean
  tarefa_atual?: string
}

type Atividade = { id: number; tipo: string; descricao: string; user_nome?: string; criado_em?: string }

const FASES: { k: Fase; label: string; cor: string }[] = [
  { k: 'novo', label: 'Novo', cor: '#94a3b8' },
  { k: 'qualificado', label: 'Qualificado', cor: '#38bdf8' },
  { k: 'proposta', label: 'Proposta', cor: '#f5a623' },
  { k: 'negociacao', label: 'Negociação', cor: '#a855f7' },
  { k: 'ganho', label: 'Ganho', cor: '#10b981' },
  { k: 'perdido', label: 'Perdido', cor: '#ef4444' },
]
const PROB: Record<Fase, number> = { novo: 10, qualificado: 30, proposta: 60, negociacao: 80, ganho: 100, perdido: 0 }

function fmtBRL(v?: number) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CrmCard({ n, onOpen }: { n: Negocio; onOpen: (n: Negocio) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(n.id) })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      draggable={false}
      onClick={() => onOpen(n)}
      className="card-soft cursor-grab rounded-lg bg-card p-2.5 transition-shadow hover:shadow-md active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.4 : 1, transform: CSS.Translate.toString(transform), touchAction: 'none' }}
    >
      <p className="text-xs font-semibold text-foreground">{n.titulo}</p>
      <p className="text-[11px] text-muted-foreground">{n.cliente_nome}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-bold text-[#0078d4]">{fmtBRL((n.valor_estimado || 0) - (n.desconto || 0))}</span>
        <span className="rounded bg-[#0078d4]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#0078d4]">{n.probabilidade || PROB[n.fase]}%</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {n.servico_nome && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">⚙ {n.servico_nome}</span>}
        {n.processo_id && (
          <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">
            <CheckCircle2 className="h-2.5 w-2.5" /> processo #{n.processo_id}
          </span>
        )}
      </div>
    </div>
  )
}

function CrmColumn({ col, itens, onOpen }: {
  col: { k: Fase; label: string; cor: string }
  itens: Negocio[]
  onOpen: (n: Negocio) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.k })
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[240px] rounded-xl border p-2 transition-colors md:min-w-0 ${isOver ? 'border-[#0078d4]/50 bg-[#0078d4]/5' : 'border-border/60 bg-muted/10'}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: col.cor }}>{col.label}</span>
        <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{itens.length}</span>
      </div>
      <div className="space-y-2">
        {itens.map(n => <CrmCard key={n.id} n={n} onOpen={onOpen} />)}
        {itens.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">Vazio</p>}
      </div>
    </div>
  )
}

export default function CrmPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'funil' | 'servicos' | 'minhas'>('funil')
  const [showServico, setShowServico] = useState(false)
  const [showNovoNegocio, setShowNovoNegocio] = useState(false)
  const [aberto, setAberto] = useState<Negocio | null>(null)

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['crm-negocios'] })
    qc.invalidateQueries({ queryKey: ['crm-servicos'] })
    qc.invalidateQueries({ queryKey: ['crm-funnel'] })
  }
  const { data: negocios = [] } = useQuery({ queryKey: ['crm-negocios'], queryFn: () => apiFetch<Negocio[]>('/api/crm/negocios'), staleTime: 15_000 })
  const { data: servicos = [] } = useQuery({ queryKey: ['crm-servicos'], queryFn: () => apiFetch<Servico[]>('/api/crm/servicos'), staleTime: 30_000 })
  const { data: funnel } = useQuery({ queryKey: ['crm-funnel'], queryFn: () => apiFetch<Record<string, { qtde: number; total: number }>>('/api/crm/funnel'), staleTime: 20_000 })
  const { data: clientes = [] } = useQuery({ queryKey: ['crm-clientes'], queryFn: () => apiFetch<Array<{ id: number; name?: string; nome?: string; status?: string }>>('/api/clientes?limit=5000'), staleTime: 60_000 })
  const { data: templates = [] } = useQuery({ queryKey: ['crm-templates'], queryFn: () => apiFetch<Array<{ id: number; titulo: string }>>('/api/processo-templates'), staleTime: 60_000 })

  const moverFase = async (id: number, fase: Fase) => {
    const t = getToken()
    await fetch(`/api/crm/negocios/${id}/fase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ fase }) })
    inv()
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const id = Number(e.active.id)
    const fase = String(e.over.id) as Fase
    if (!FASES.some(f => f.k === fase)) return
    const n = negocios.find(x => x.id === id)
    if (n && n.fase !== fase) moverFase(id, fase)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><Target className="h-6 w-6 text-[#0078d4]" /> CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Leads, oportunidades e fechamento de funil — com disparo automático de processos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={inv} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={() => setShowNovoNegocio(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> Nova negociação
          </button>
          <button onClick={() => setShowServico(true)} className="flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85">
            <Plus className="h-4 w-4" /> Novo serviço
          </button>
        </div>
      </div>

      {/* Resumo do funil */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FASES.map(f => (
          <div key={f.k} className="card-soft rounded-lg bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: f.cor }}>{f.label}</p>
            <p className="mt-1 text-lg font-bold text-foreground">{funnel?.[f.k]?.qtde || 0}</p>
            <p className="text-[11px] text-muted-foreground">{fmtBRL(funnel?.[f.k]?.total)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {(['funil', 'minhas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {t === 'funil' ? 'Funil' : 'Minhas oportunidades'}
          </button>
        ))}
        <button onClick={() => setTab('servicos')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'servicos' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
          Serviços ({servicos.length})
        </button>
      </div>

      {tab === 'funil' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-2 md:overflow-visible xl:grid-cols-6">
            {FASES.map(col => (
              <CrmColumn key={col.k} col={col} itens={negocios.filter(n => n.fase === col.k)} onOpen={setAberto} />
            ))}
          </div>
        </DndContext>
      )}

      {tab === 'minhas' && <MinhasNegociacoes negocios={negocios} onOpen={setAberto} />}

      {tab === 'servicos' && <ServicosLista servicos={servicos} onNovo={() => setShowServico(true)} onSaved={inv} templates={templates} />}

      {showServico && (
        <ServicoModal templates={templates} onClose={() => setShowServico(false)} onSaved={() => { setShowServico(false); inv() }} />
      )}

      {showNovoNegocio && (
        <NovoNegocioModal
          clientes={clientes}
          servicos={servicos}
          onClose={() => setShowNovoNegocio(false)}
          onSaved={() => { setShowNovoNegocio(false); inv() }}
        />
      )}

      {aberto && (
        <NegocioModal
          negocio={aberto}
          onClose={() => setAberto(null)}
          onSaved={() => { inv() }}
        />
      )}
    </div>
  )
}

function MinhasNegociacoes({ negocios, onOpen }: { negocios: Negocio[]; onOpen: (n: Negocio) => void }) {
  return (
    <div className="card-soft overflow-hidden rounded-lg bg-card">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-3">Negócio</th>
            <th className="py-2 pr-3">Cliente</th>
            <th className="py-2 pr-3">Fase</th>
            <th className="py-2 pr-3">Serviço</th>
            <th className="py-2 pr-3 text-right">Valor</th>
            <th className="py-2 pr-3">Processo</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Tarefa</th>
            <th className="py-2 pr-4 text-center">Conclusão</th>
          </tr>
        </thead>
        <tbody>
          {negocios.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Nenhuma negociação.</td></tr>}
          {negocios.map(n => {
            const f = FASES.find(x => x.k === n.fase)
            const pct = n.processo_pct
            const atrasado = n.processo_atrasado
            const statusProc = n.processo_status || '—'
            return (
              <tr key={n.id} onClick={() => onOpen(n)} className="cursor-pointer border-t border-border/40 hover:bg-muted/20">
                <td className="py-2 pl-4 pr-3 font-medium text-foreground">{n.titulo}</td>
                <td className="py-2 pr-3 text-muted-foreground">{n.cliente_nome}</td>
                <td className="py-2 pr-3">
                  <span className="rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: (f?.cor || '#535353') + '18', color: f?.cor || '#535353' }}>{f?.label}</span>
                </td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{n.servico_nome || '—'}</td>
                <td className="py-2 pr-3 text-right font-medium">{fmtBRL((n.valor_estimado || 0) - (n.desconto || 0))}</td>
                <td className="py-2 pr-3">
                  {n.processo_id
                    ? <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> #{n.processo_id}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="py-2 pr-3">
                  {atrasado ? (
                    <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Atrasado</span>
                  ) : (
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      statusProc === 'Concluida' || statusProc === 'concluida' ? 'bg-emerald-500/15 text-emerald-600'
                      : ['Pendente','em_execucao'].includes(statusProc) ? 'bg-amber-500/15 text-amber-600'
                      : 'bg-muted text-muted-foreground'
                    }`}>{statusProc}</span>
                  )}
                </td>
                <td className="max-w-[180px] truncate py-2 pr-3 text-xs text-muted-foreground" title={n.tarefa_atual || n.processo_etapa_atual || ''}>
                  {n.tarefa_atual || n.processo_etapa_atual || '—'}
                </td>
                <td className="py-2 pr-4 text-center">
                  {n.processo_id
                    ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-[#0078d4]" style={{ width: `${Math.min(Number(pct) || 0, 100)}%` }} />
                        </span>
                        <span className="text-xs font-semibold text-foreground">{pct ?? 0}%</span>
                      </span>
                    )
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

function ServicosLista({ servicos, onNovo, onSaved, templates }: any) {
  return (
    <div className="space-y-3">
      <button onClick={onNovo} className="flex items-center gap-1.5 rounded-lg border border-[#0078d4]/30 px-3 py-2 text-xs font-medium text-[#0078d4] hover:bg-[#0078d4]/10">
        <Plus className="h-3.5 w-3.5" /> Cadastrar serviço
      </button>
      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-4 pr-3">Serviço</th>
              <th className="py-2 pr-3">Valor</th>
              <th className="py-2 pr-3">Processo vinculado</th>
              <th className="py-2 pr-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {servicos.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Nenhum serviço. Cadastre o primeiro (valor obrigatório).</td></tr>}
            {servicos.map((s: Servico) => (
              <ServicoRow key={s.id} s={s} templates={templates} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ServicoRow({ s, templates, onSaved }: any) {
  const qc = useQueryClient()
  const [edit, setEdit] = useState(false)
  const [nome, setNome] = useState(s.nome)
  const [valor, setValor] = useState(String(s.valor))
  const [templateId, setTemplateId] = useState(String(s.template_processo_id || ''))
  const [err, setErr] = useState('')

  const salvar = async () => {
    const t = getToken()
    try {
      const r = await fetch(`/api/crm/servicos/${s.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ nome, valor: Number(valor), template_processo_id: templateId ? Number(templateId) : null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'HTTP ' + r.status)
      setEdit(false); qc.invalidateQueries({ queryKey: ['crm-servicos'] }); onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const excluir = async () => {
    if (!confirm(`Excluir o serviço "${s.nome}"?`)) return
    const t = getToken()
    await fetch(`/api/crm/servicos/${s.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
    qc.invalidateQueries({ queryKey: ['crm-servicos'] }); onSaved()
  }

  if (edit) {
    return (
      <tr className="border-t border-border/40 bg-[#0078d4]/5">
        <td className="py-2 pl-4 pr-3">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do serviço"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td className="py-2 pr-3">
          <input value={valor} onChange={e => setValor(e.target.value)} type="number" min="0.01" step="0.01"
            className="w-32 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td className="py-2 pr-3">
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring">
            <option value="">Sem processo</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </select>
        </td>
        <td className="py-2 pr-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {err && <span className="text-[10px] text-rose-600">{err}</span>}
            <button onClick={salvar} className="rounded-lg bg-[#0078d4] px-3 py-1 text-xs font-medium text-white hover:bg-[#0078d4]/85">Salvar</button>
            <button onClick={() => setEdit(false)} className="rounded-lg border border-border px-3 py-1 text-xs">Cancelar</button>
          </div>
        </td>
      </tr>
    )
  }
  return (
    <tr className="border-t border-border/40">
      <td className="py-2 pl-4 pr-3 font-medium text-foreground">{s.nome}</td>
      <td className="py-2 pr-3 font-semibold text-[#0078d4]">{fmtBRL(s.valor)}</td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">{s.template_nome || 'Sem processo vinculado'}</td>
      <td className="py-2 pr-4 text-right">
        <button onClick={() => setEdit(true)} className="p-1 text-muted-foreground hover:text-[#0078d4]"><Pencil className="h-4 w-4" /></button>
        <button onClick={excluir} className="p-1 text-muted-foreground hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
      </td>
    </tr>
  )
}

function ServicoModal({ templates, onClose, onSaved }: any) {
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const salvar = async () => {
    if (!nome.trim()) { setErr('Informe o nome'); return }
    if (!Number(valor) || Number(valor) <= 0) { setErr('Valor obrigatório (maior que zero)'); return }
    setSaving(true); setErr('')
    const t = getToken()
    try {
      const r = await fetch('/api/crm/servicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ nome, valor: Number(valor), template_processo_id: templateId ? Number(templateId) : null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'HTTP ' + r.status)
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao salvar') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Novo serviço</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do serviço *</label>
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Abertura de Empresa"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor (R$) *</label>
            <input value={valor} onChange={e => setValor(e.target.value)} type="number" min="0.01" step="0.01"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Processo vinculado (dispara ao fechar)</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring">
              <option value="">Sem processo</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button onClick={salvar} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85 disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function NovoNegocioModal({ clientes, servicos, onClose, onSaved }: any) {
  const [clienteId, setClienteId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [valor, setValor] = useState('')
  const [titulo, setTitulo] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const aoEscolherServico = (id: string) => {
    setServicoId(id)
    const s = servicos.find((x: Servico) => String(x.id) === id)
    if (s) setValor(String(s.valor))
  }

  const salvar = async () => {
    if (!clienteId) { setErr('Selecione um cliente (cadastre-o antes em Clientes)'); return }
    if (!servicoId) { setErr('Selecione um serviço'); return }
    setSaving(true); setErr('')
    const t = getToken()
    try {
      const r = await fetch('/api/crm/negocios', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ cliente_id: Number(clienteId), crm_servico_id: Number(servicoId), valor_estimado: Number(valor) || 0, titulo: titulo.trim() || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'HTTP ' + r.status)
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Nova negociação</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecione o cliente…</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.name || c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Serviço *</label>
            <select value={servicoId} onChange={e => aoEscolherServico(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecione o serviço…</option>
              {servicos.map((s: Servico) => <option key={s.id} value={s.id}>{s.nome} — {fmtBRL(s.valor)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor estimado (R$) — preenchido do serviço, edite se necessário</label>
            <input value={valor} onChange={e => setValor(e.target.value)} type="number" min="0" step="0.01"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título (opcional)</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Abertura de empresa — Cliente X"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button onClick={salvar} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Abrir negociação
          </button>
        </div>
      </div>
    </div>
  )
}

function NegocioModal({ negocio, onClose, onSaved }: any) {
  const qc = useQueryClient()
  const [fase, setFase] = useState<Fase>(negocio.fase)
  const [desconto, setDesconto] = useState(String(negocio.desconto || 0))
  const [atvTexto, setAtvTexto] = useState('')
  const [fechando, setFechando] = useState(false)
  const out = useQuery({ queryKey: ['crm-negocio', negocio.id], queryFn: () => apiFetch<any>(`/api/crm/negocios/${negocio.id}`), enabled: !!negocio.id, staleTime: 10_000 })
  const d = out.data

  const mudarFase = async (f: Fase) => {
    setFase(f)
    const t = getToken()
    await fetch(`/api/crm/negocios/${negocio.id}/fase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ fase: f }) })
    qc.invalidateQueries({ queryKey: ['crm-negocio', negocio.id] })
    onSaved()
  }
  const addAtiv = async () => {
    if (!atvTexto.trim()) return
    const t = getToken()
    await fetch(`/api/crm/negocios/${negocio.id}/atividades`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ descricao: atvTexto }) })
    setAtvTexto(''); qc.invalidateQueries({ queryKey: ['crm-negocio', negocio.id] })
  }
  const salvarDesconto = async () => {
    const t = getToken()
    await fetch(`/api/crm/negocios/${negocio.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ desconto: Number(desconto) || 0 }) })
    qc.invalidateQueries({ queryKey: ['crm-negocio', negocio.id] }); onSaved()
  }
  const fechar = async () => {
    if (fase !== 'ganho') { await mudarFase('ganho') }
    setFechando(true)
    const t = getToken()
    try {
      const r = await fetch(`/api/crm/negocios/${negocio.id}/fechar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ valor_fechado: (negocio.valor_estimado || 0) - (Number(desconto) || 0) }) })
      const z = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(z.detail || 'HTTP ' + r.status)
      alert(`Negociação fechada! ${z.processo_id ? `Processo #${z.processo_id} disparado automaticamente.` : 'Atenção: serviço sem processo vinculado.'} O cliente foi ativado.`)
      qc.invalidateQueries({ queryKey: ['crm-negocio', negocio.id] }); onSaved()
    } catch (e) { alert('Erro ao fechar: ' + (e instanceof Error ? e.message : '')) }
    setFechando(false)
  }

  const fLabel = FASES.find(x => x.k === fase)?.label
  const fCor = FASES.find(x => x.k === fase)?.cor
  const valorLiquido = (negocio.valor_estimado || 0) - (Number(desconto) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{negocio.titulo}</h3>
            <p className="text-xs text-muted-foreground">{negocio.cliente_nome} · responsável {negocio.responsavel_nome || d?.responsavel_nome || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (!confirm(`Excluir a negociação "${negocio.titulo}"? Isso remove atividades e histórico. O processo ${negocio.processo_id ? `#${negocio.processo_id}` : ''} não será excluído.`)) return
                const t = getToken()
                const r = await fetch(`/api/crm/negocios/${negocio.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
                if (r.ok) { alert('Negociação excluída.'); onClose(); onSaved() }
                else alert('Erro ao excluir negociação')
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600" title="Excluir negociação">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-lg bg-muted/30 p-2">
          <button onClick={() => mudarFase(fase === 'novo' ? 'novo' : 'novo')}
            className={`rounded-md px-2 py-1 text-[10px] ${fase === 'novo' ? 'bg-[#0078d4] text-white' : 'text-muted-foreground'}`}>Novo</button>
          <button onClick={() => mudarFase('qualificado')}
            className={`rounded-md px-2 py-1 text-[10px] ${fase === 'qualificado' ? 'bg-[#0078d4] text-white' : 'text-muted-foreground'}`}>Qualificado</button>
          <button onClick={() => mudarFase('proposta')}
            className={`rounded-md px-2 py-1 text-[10px] ${fase === 'proposta' ? 'bg-[#0078d4] text-white' : 'text-muted-foreground'}`}>Proposta</button>
          <button onClick={() => mudarFase('negociacao')}
            className={`rounded-md px-2 py-1 text-[10px] ${fase === 'negociacao' ? 'bg-[#0078d4] text-white' : 'text-muted-foreground'}`}>Negociação</button>
          <button onClick={fechar}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${fase === 'ganho' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/15 text-emerald-600'}`}>
            {fechando ? 'Fechando…' : 'Ganho ✓'}
          </button>
          <button onClick={() => mudarFase('perdido')}
            className={`rounded-md px-2 py-1 text-[10px] ${fase === 'perdido' ? 'bg-rose-600 text-white' : 'text-muted-foreground'}`}>Perdido</button>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="card-soft rounded-lg bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">Serviço</p>
            <p className="text-sm font-semibold text-foreground">{negocio.servico_nome || '—'}</p>
            <p className="text-[11px] text-muted-foreground">Valor do serviço: <b>{fmtBRL(negocio.servico_valor ?? negocio.valor_estimado)}</b></p>
          </div>
          <div className="card-soft rounded-lg bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">Fase atual</p>
            <p className="text-sm font-semibold" style={{ color: fCor }}>{fLabel} · {negocio.probabilidade || 0}%</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Valor</span>
              <input value={desconto} onChange={e => setDesconto(e.target.value)} type="number" min="0" className="w-24 rounded border border-input bg-background px-2 py-0.5 text-xs" />
              <span>desconto</span>
              <button onClick={salvarDesconto} className="rounded bg-[#0078d4]/10 px-2 py-0.5 text-[10px] text-[#0078d4]">ok</button>
            </div>
            <p className="mt-1 text-xs"><b>Líquido: {fmtBRL(valorLiquido)}</b></p>
          </div>
        </div>

        {negocio.processo_id && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Processo #{negocio.processo_id} gerado — {negocio.processo_titulo || ''} ({negocio.processo_status || 'Pendente'}).
            <a href="/processos" className="ml-auto font-semibold underline">abrir →</a>
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Registrar atividade (ligação, e-mail, nota…)</label>
          <div className="flex gap-2">
            <input value={atvTexto} onChange={e => setAtvTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAtiv()}
              placeholder="Descreva o contato…" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={addAtiv} className="rounded-lg bg-[#0078d4] px-3 text-white hover:bg-[#0078d4]/85"><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
          {(d?.historico || []).length === 0 && <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>}
          {(d?.historico || []).map((h: any, i: number) => (
            <div key={i} className="rounded-lg border border-border/40 px-3 py-1.5 text-xs">
              <span className="font-medium text-foreground">{h.fase_antiga || '—'} → {h.fase_nova}</span>
              <span className="ml-1 text-muted-foreground">· {h.user_nome || ''} · {String(h.criado_em || '').slice(0, 16).replace('T', ' ')}</span>
            </div>
          ))}
          {(d?.atividades || []).map((a: Atividade) => (
            <div key={a.id} className="rounded-lg border border-border/40 px-3 py-1.5 text-xs">
              <p className="text-foreground">{a.descricao}</p>
              <p className="text-[10px] text-muted-foreground">{a.user_nome || ''} · {String(a.criado_em || '').slice(0, 16).replace('T', ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}