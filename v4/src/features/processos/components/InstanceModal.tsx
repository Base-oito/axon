import { useState } from 'react'
import type { ClienteOpt } from '../hooks/useShared'
import type { Etapa, Template } from '../types'
import { createProcesso } from '../api'
import { PRIORIDADES, PRIORIDADE_MAP, STEP_TYPE_COLORS, VISIBILIDADE_OPTIONS, addDays, normalizeOptions, safeEtapas } from '../helpers'

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#0078d4] focus:outline-none'

interface Props {
  templates: Template[]
  clientes: ClienteOpt[]
  onClose: () => void
  onSaved: () => void
}

export default function InstanceModal({ templates, clientes, onClose, onSaved }: Props) {
  const [templateId, setTemplateId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [cliente, setCliente] = useState('')
  const [prioridade, setPrioridade] = useState('Média')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [visibilidade, setVisibilidade] = useState('público')
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleTemplateSelect = (id: string) => {
    setTemplateId(id)
    const tmpl = templates.find(t => String(t.id) === id)
    if (tmpl) {
      setTitulo(tmpl.titulo || '')
      setEtapas(safeEtapas(tmpl.etapas).map((e, i) => ({
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
      setTitulo('')
      setEtapas([])
    }
  }

  const handleSave = async () => {
    if (!titulo.trim() || !cliente) return
    setSaving(true)
    setError('')
    const cli = clientes.find(c => String(c.id) === cliente)
    try {
      const etapasWithDue = etapas.map(e => ({
        ...e,
        dueDate: e.dias && dataInicio ? addDays(dataInicio, e.dias) : undefined,
      }))
      const firstStep = etapasWithDue[0]?.title || ''
      const body: Record<string, unknown> = {
        titulo: titulo.trim(),
        cliente_nome: cli ? cli.name || cli.nome || '' : '',
        cliente_id: Number(cliente),
        prioridade,
        data_inicio: dataInicio,
        visibilidade,
        etapas: etapasWithDue,
        etapa_atual: firstStep,
        status: 'Pendente',
      }
      if (templateId) body.template_id = Number(templateId)
      await createProcesso(body)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar instância')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 p-6">
          <h3 className="text-sm font-semibold tracking-wider text-foreground">Nova Instancia de Processo</h3>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Modelo (template)</label>
            <select value={templateId} onChange={e => handleTemplateSelect(e.target.value)} className={inputCls}>
              <option value="">Selecione um modelo...</option>
              {templates.map(tmpl => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.titulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Titulo</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome da instancia" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cliente</label>
            <select value={cliente} onChange={e => setCliente(e.target.value)} className={inputCls}>
              <option value="">Selecione um cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.nome || 'Cliente #' + c.id}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Prioridade</label>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className={inputCls}>
                {PRIORIDADES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Data de Inicio</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Visibilidade</label>
            <select value={visibilidade} onChange={e => setVisibilidade(e.target.value)} className={inputCls}>
              {VISIBILIDADE_OPTIONS.map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
          {etapas.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Etapas ({etapas.length})</label>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {etapas.map((etapa, i) => (
                  <div key={etapa.id || i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                    <span className="w-5 font-mono text-muted-foreground">{i + 1}</span>
                    <span
                      className="rounded px-2 py-0.5 text-xs"
                      style={{ backgroundColor: (STEP_TYPE_COLORS[etapa.type] || '#535353') + '18', color: STEP_TYPE_COLORS[etapa.type] || '#535353' }}
                    >
                      {etapa.type}
                    </span>
                    <span className="flex-1 text-foreground">{etapa.title}</span>
                    <span className="text-xs" style={{ color: PRIORIDADE_MAP[prioridade] || '#F59E0B' }}>
                      {etapa.dias ? `${etapa.dias}d` : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !titulo.trim() || !cliente}
            className="rounded-lg bg-[#0078d4] px-5 py-2 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Criando...' : 'Criar Instancia'}
          </button>
        </div>
      </div>
    </div>
  )
}
