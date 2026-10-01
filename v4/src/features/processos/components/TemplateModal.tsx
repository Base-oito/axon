import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Departamento } from '../hooks/useShared'
import type { Etapa, Template } from '../types'
import { saveTemplate, deleteTemplate, listTemplates } from '../api'
import {
  CATEGORIAS, RECORRENCIA_OPTIONS, STEP_TYPE_COLORS,
  genStepId, genSubtaskId, normalizeOptions, safeEtapas, calculaDuracaoProcesso,
} from '../helpers'

function MiniBadge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="whitespace-nowrap rounded px-2 py-0.5 text-xs"
      style={{ backgroundColor: color + '18', color, border: '1px solid ' + color + '35' }}
    >
      {text}
    </span>
  )
}

const inputCls =
  'w-full rounded-lg border border-urban-smoke bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0078d4]'

const REC_LABEL: Record<string, string> = {
  diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal',
  trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}
const DIAS_SEMANA = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

interface Props {
  template: Template | null
  departamentos: Departamento[]
  onClose: () => void
  onSaved: () => void
}

export default function TemplateModal({ template, departamentos, onClose, onSaved }: Props) {
  const [titulo, setTitulo] = useState(template?.titulo || '')
  const [categoria, setCategoria] = useState(template?.categoria || '')
  const [depto, setDepto] = useState(template?.departamento_id != null ? String(template.departamento_id) : '')
  const [recorrente, setRecorrente] = useState(!!template?.recorrente)
  const [recorrencia, setRecorrencia] = useState(template?.recorrencia_padrao || 'mensal')
  const [diaMes, setDiaMes] = useState(template?.recorrencia_dia_mes ?? 1)
  const [diaSemana, setDiaSemana] = useState(template?.recorrencia_dia_semana ?? 0)
  const [etapas, setEtapas] = useState<Etapa[]>(() =>
    template
      ? safeEtapas(template.etapas).map((e, i) => ({
          ...e,
          type: (['Tarefa', 'Obrigação', 'Decisão', 'Gatilho'].includes(e.type) ? e.type : 'Tarefa') as Etapa['type'],
          order: e.order ?? i,
          options: normalizeOptions(e.options),
          dependsOn: e.dependsOn || [],
          subtasks: e.subtasks || [],
          dias: e.dias || undefined,
          notificar_todos: e.notificar_todos || false,
          exige_documento: e.exige_documento || false,
          exige_aprovacao: e.exige_aprovacao || false,
          aprovador_id: e.aprovador_id ?? '',
          documentos_exigidos: e.documentos_exigidos || [],
        }))
      : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { data: usuarios = [] } = useQuery({
    queryKey: ['processo-usuarios'],
    queryFn: () => apiFetch<any[]>('/api/usuarios?limit=500'),
    staleTime: 5 * 60_000,
  })

  const addStep = (type: Etapa['type'] = 'Tarefa') => {
    setEtapas(prev => [
      ...prev,
      {
        id: genStepId(),
        title: '',
        type,
        assignee: '',
        user_id: '',
        order: prev.length,
        options: type === 'Decisão' || type === 'Gatilho' ? [] : undefined,
        dependsOn: [],
        subtasks: [],
        dias: undefined,
        notificar_todos: false,
        exige_documento: false,
        exige_aprovacao: false,
        aprovador_id: '',
        documentos_exigidos: [],
      },
    ])
  }

  const removeStep = (index: number) => {
    setEtapas(prev => {
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

  const moveStep = (index: number, dir: -1 | 1) => {
    setEtapas(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((s, i) => ({ ...s, order: i }))
    })
  }

  const updateStepField = (index: number, field: string, value: unknown) => {
    setEtapas(prev => prev.map((s, i) => (i !== index ? s : { ...s, [field]: value })))
  }

  const { data: modelos = [] } = useQuery({ queryKey: ['processo-templates'], queryFn: listTemplates })

  const toggleDependsOn = (stepIndex: number, depStepId: string) => {
    setEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      const current = s.dependsOn || []
      return {
        ...s,
        dependsOn: current.includes(depStepId) ? current.filter(id => id !== depStepId) : [...current, depStepId],
      }
    }))
  }

  const addSubtask = (stepIndex: number) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, subtasks: [...(s.subtasks || []), { id: genSubtaskId(), title: '', isCompleted: false }] })))
  }

  const removeSubtask = (stepIndex: number, subtaskId: string) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, subtasks: (s.subtasks || []).filter(st => st.id !== subtaskId) })))
  }

  const updateSubtaskField = (stepIndex: number, subtaskId: string, value: string) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, subtasks: (s.subtasks || []).map(st => (st.id === subtaskId ? { ...st, title: value } : st)) })))
  }

  const addDocExigido = (stepIndex: number) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, documentos_exigidos: [...(s.documentos_exigidos || []), { id: genSubtaskId(), nome: '' }] })))
  }

  const removeDocExigido = (stepIndex: number, docId: string) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, documentos_exigidos: (s.documentos_exigidos || []).filter(d => d.id !== docId) })))
  }

  const updateDocExigido = (stepIndex: number, docId: string, nome: string) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, documentos_exigidos: (s.documentos_exigidos || []).map(d => (d.id === docId ? { ...d, nome } : d)) })))
  }

  const addBranchOption = (stepIndex: number) => {
    setEtapas(prev => prev.map((s, i) => (i !== stepIndex ? s : { ...s, options: [...(s.options || []), { label: '', nextStepId: '' }] })))
  }

  const removeBranchOption = (stepIndex: number, optionIndex: number) => {
    setEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      const next = (s.options || []).filter((_, oi) => oi !== optionIndex)
      return { ...s, options: next.length > 0 ? next : undefined }
    }))
  }

  const updateBranchOption = (stepIndex: number, optionIndex: number, field: 'label' | 'nextStepId', value: string) => {
    setEtapas(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      return { ...s, options: (s.options || []).map((o, oi) => (oi === optionIndex ? { ...o, [field]: value } : o)) }
    }))
  }

  const handleSave = async () => {
    if (!titulo.trim()) {
      setError('Título é obrigatório')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveTemplate(template?.id ?? null, {
        titulo: titulo.trim(),
        categoria,
        departamento_id: depto ? Number(depto) : null,
        recorrente,
        recorrencia_padrao: recorrencia,
        recorrencia_dia_mes: recorrencia !== 'semanal' && recorrencia !== 'diaria' ? Math.max(1, Math.min(31, Number(diaMes) || 1)) : null,
        recorrencia_dia_semana: recorrencia === 'semanal' ? Number(diaSemana) : null,
        etapas: etapas.map((e, i) => ({ ...e, order: i })),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar template')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!template || !confirm('Excluir este modelo de processo?')) return
    setSaving(true)
    try {
      await deleteTemplate(template.id)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir template')
    }
    setSaving(false)
  }

  const btnAdd: Record<string, { cls: string; label: string }> = {
    Tarefa: { cls: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10', label: '+ Tarefa' },
    'Obrigação': { cls: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10', label: '+ Obrigacao' },
    'Decisão': { cls: 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10', label: '+ Decisao' },
    'Gatilho': { cls: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10', label: '+ Gatilho' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card">
        <div className="shrink-0 border-b border-border/60 p-6">
          <h3 className="text-sm font-semibold tracking-wider text-foreground">
            {template ? 'Editar Modelo' : 'Novo Modelo de Processo'}
          </h3>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 space-y-5 overflow-y-auto border-r border-border/60 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Titulo</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome do processo" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {CATEGORIAS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Departamento</label>
              <select value={depto} onChange={e => setDepto(e.target.value)} className={inputCls}>
                <option value="">Nenhum</option>
                {departamentos.map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            {etapas.length > 0 && (
              <div className="rounded-lg border border-[#0078d4]/25 bg-[#0078d4]/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0078d4]">Duração estimada</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {calculaDuracaoProcesso(etapas)} dia{calculaDuracaoProcesso(etapas) !== 1 ? 's' : ''}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Soma dos dias no caminho crítico (etapas paralelas contam uma vez)
                </p>
              </div>
            )}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Recorrente</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRecorrente(!recorrente)}
                  className={`relative h-5 w-10 rounded-full transition-colors ${recorrente ? 'bg-[#0078d4]' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${recorrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-muted-foreground">{recorrente ? 'Ativo' : 'Inativo'}</span>
              </div>
              {recorrente && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Frequência</label>
                    <select value={recorrencia} onChange={e => setRecorrencia(e.target.value)} className={inputCls}>
                      {RECORRENCIA_OPTIONS.map(o => (
                        <option key={o} value={o}>{REC_LABEL[o] || o}</option>
                      ))}
                    </select>
                  </div>
                  {recorrencia === 'semanal' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Dia da semana</label>
                      <select value={String(diaSemana)} onChange={e => setDiaSemana(Number(e.target.value))} className={inputCls}>
                        {DIAS_SEMANA.map((label, i) => (
                          <option key={i} value={i}>{label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-muted-foreground">Ex.: toda segunda-feira</p>
                    </div>
                  )}
                  {recorrencia !== 'semanal' && recorrencia !== 'diaria' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Dia do mês</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={diaMes}
                        onChange={e => setDiaMes(Number(e.target.value) || 1)}
                        className={inputCls}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">Ex.: todo dia 01</p>
                    </div>
                  )}
                  {recorrencia === 'diaria' && (
                    <p className="text-[10px] text-muted-foreground">Todos os dias</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-xs font-medium tracking-wider text-muted-foreground">Fluxo de Etapas</h4>
              <div className="flex items-center gap-2">
                {(Object.keys(btnAdd) as Etapa['type'][]).map(t => (
                  <button
                    key={t}
                    onClick={() => addStep(t)}
                    className={`rounded px-3 py-1 text-xs tracking-wider transition-colors border ${btnAdd[t].cls}`}
                  >
                    {btnAdd[t].label}
                  </button>
                ))}
              </div>
            </div>

            {etapas.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
                <span className="mb-2 text-sm text-muted-foreground">Nenhuma etapa definida</span>
                <span className="text-xs text-muted-foreground">Adicione etapas para compor o fluxo do processo.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {etapas.map((etapa, idx) => (
                  <div key={etapa.id || idx} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                        <button
                          onClick={() => moveStep(idx, -1)}
                          disabled={idx === 0}
                          className="text-xs leading-none text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ^
                        </button>
                        <span className="w-5 text-center font-mono text-xs text-muted-foreground">{idx + 1}</span>
                        <button
                          onClick={() => moveStep(idx, 1)}
                          disabled={idx >= etapas.length - 1}
                          className="text-xs leading-none text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          v
                        </button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <MiniBadge text={etapa.type} color={STEP_TYPE_COLORS[etapa.type] || '#535353'} />
                          <input
                            type="text"
                            value={etapa.title}
                            onChange={e => updateStepField(idx, 'title', e.target.value)}
                            placeholder="Titulo da etapa"
                            className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#0078d4] focus:outline-none"
                          />
                          <button onClick={() => removeStep(idx)} className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10" title="Remover etapa">
                            x
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground">Dias para vencer:</label>
                            <input
                              type="number"
                              min="0"
                              value={etapa.dias ?? ''}
                              onChange={e => updateStepField(idx, 'dias', e.target.value ? Number(e.target.value) : undefined)}
                              placeholder="0"
                              className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground">Departamento:</label>
                            <select
                              value={etapa.departamento_id != null ? String(etapa.departamento_id) : ''}
                              onChange={e => updateStepField(idx, 'departamento_id', e.target.value ? Number(e.target.value) : null)}
                              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                            >
                              <option value="">(do modelo)</option>
                              {departamentos.map(d => (
                                <option key={d.id} value={d.id}>{d.nome}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground">Responsável:</label>
                            <select
                              value={etapa.user_id != null && etapa.user_id !== '' ? String(etapa.user_id) : ''}
                              onChange={e => updateStepField(idx, 'user_id', e.target.value ? Number(e.target.value) : '')}
                              className="max-w-[180px] rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                            >
                              <option value="">Automático (responsável da empresa no depto)</option>
                              {usuarios.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.display_name || u.username || `#${u.id}`}</option>
                              ))}
                            </select>
                          </div>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={etapa.notificar_todos || false}
                              onChange={e => updateStepField(idx, 'notificar_todos', e.target.checked)}
                              className="h-3 w-3 rounded accent-[#0078d4]"
                            />
                            Notificar todos ao concluir
                          </label>
                        </div>
                        <div className="mt-3 rounded-lg border border-[#0078d4]/20 bg-[#0078d4]/5 p-2.5">
                          <label className="flex cursor-pointer items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={etapa.exige_documento || false}
                              onChange={e => updateStepField(idx, 'exige_documento', e.target.checked)}
                              className="mt-0.5 h-3 w-3 rounded accent-[#0078d4]"
                            />
                            <span>
                              <span className="font-medium text-foreground">Exige Documento/Relatório atualizado</span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                Ao concluir esta etapa, o usuário deverá anexar um documento/relatório para fechar.
                              </span>
                            </span>
                          </label>
                        </div>

                        {/* Checklist de documentos exigidos */}
                        <div className="mt-3 rounded-lg border border-border bg-background p-2.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <label className="text-xs font-medium text-foreground">Documentos exigidos (checklist)</label>
                            <button
                              onClick={() => addDocExigido(idx)}
                              className="rounded border border-[#0078d4]/30 px-2 py-0.5 text-xs text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
                            >
                              + Documento
                            </button>
                          </div>
                          <p className="mb-2 text-[11px] text-muted-foreground">Cada documento da lista deverá ser anexado antes de concluir a etapa.</p>
                          {(etapa.documentos_exigidos || []).map(doc => (
                            <div key={doc.id} className="mb-1.5 flex items-center gap-2">
                              <input
                                type="text"
                                value={doc.nome}
                                onChange={e => updateDocExigido(idx, doc.id, e.target.value)}
                                placeholder="Nome do documento (ex.: Contrato Social)"
                                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                              />
                              <button onClick={() => removeDocExigido(idx, doc.id)} className="shrink-0 text-xs text-red-400 hover:text-red-500">x</button>
                            </div>
                          ))}
                        </div>

                        {/* Aprovação */}
                        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                          <label className="flex cursor-pointer items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={etapa.exige_aprovacao || false}
                              onChange={e => updateStepField(idx, 'exige_aprovacao', e.target.checked)}
                              className="mt-0.5 h-3 w-3 rounded accent-emerald-600"
                            />
                            <span>
                              <span className="font-medium text-foreground">Exige Aprovação</span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                Ao concluir, a etapa vai para "Aguardando aprovação" e só fecha após o aceite do aprovador.
                              </span>
                            </span>
                          </label>
                          {etapa.exige_aprovacao && (
                            <div className="mt-2 flex items-center gap-2">
                              <label className="text-xs text-muted-foreground">Aprovador:</label>
                              <select
                                value={etapa.aprovador_id != null && etapa.aprovador_id !== '' ? String(etapa.aprovador_id) : ''}
                                onChange={e => updateStepField(idx, 'aprovador_id', e.target.value ? Number(e.target.value) : '')}
                                className="max-w-[220px] rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                              >
                                <option value="">Responsável do processo (padrão)</option>
                                {usuarios.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.display_name || u.username || `#${u.id}`}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 border-t border-border/60 pt-3">
                          <label className="mb-2 block text-xs font-medium text-foreground">Dependências</label>
                          {idx === 0 ? (
                            <span className="text-xs italic text-muted-foreground">Primeira etapa — não possui dependências.</span>
                          ) : (
                            <div>
                              <div className="mb-2 text-[11px] text-muted-foreground">
                                Etapas anteriores que devem estar concluídas antes desta:
                              </div>
                              <div className="space-y-1">
                                {etapas.filter((_, i) => i < idx).map(dep => {
                                  const originalIdx = etapas.indexOf(dep)
                                  const isSelected = (etapa.dependsOn || []).includes(dep.id)
                                  return (
                                    <label
                                      key={dep.id}
                                      onClick={() => toggleDependsOn(idx, dep.id)}
                                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                                        isSelected
                                          ? 'border border-[#0078d4]/30 bg-[#0078d4]/15'
                                          : 'border border-border bg-background hover:border-[#0078d4]/30'
                                      }`}
                                    >
                                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-[#0078d4]" />
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] ${isSelected ? 'bg-[#0078d4]/20 text-[#0078d4]' : 'bg-border text-muted-foreground'}`}>
                                          #{originalIdx + 1}
                                        </span>
                                        <span className="truncate text-xs text-foreground">{dep.title || '(sem titulo)'}</span>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Subtarefas</label>
                            <button
                              onClick={() => addSubtask(idx)}
                              className="rounded border border-[#0078d4]/30 px-2 py-0.5 text-xs text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
                            >
                              + Adicionar
                            </button>
                          </div>
                          {(etapa.subtasks || []).length > 0 && (
                            <div className="mb-2 space-y-1.5">
                              {(etapa.subtasks || []).map(st => (
                                <div key={st.id} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={st.title}
                                    onChange={e => updateSubtaskField(idx, st.id, e.target.value)}
                                    placeholder="Subtarefa..."
                                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                                  />
                                  <button onClick={() => removeSubtask(idx, st.id)} className="shrink-0 text-xs text-red-400 hover:text-red-500">
                                    x
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {(etapa.type === 'Decisão' || etapa.type === 'Gatilho') && (
                          <div className="space-y-2 border-l-2 border-orange-500/20 pl-2">
                            {etapa.type === 'Gatilho' && (
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap text-xs text-muted-foreground">Dispara o modelo:</span>
                                <select
                                  value={etapa.dispara_template_id != null ? String(etapa.dispara_template_id) : ''}
                                  onChange={e => updateStepField(idx, 'dispara_template_id', e.target.value ? Number(e.target.value) : null)}
                                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                >
                                  <option value="">Nenhum (apenas ramificação)</option>
                                  {modelos.filter(m => !template || m.id !== template.id).map(m => (
                                    <option key={m.id} value={m.id}>{m.titulo}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {etapa.type === 'Gatilho' ? 'Opcoes de Disparo' : 'Opcoes de Decisao'}
                              </span>
                              <button
                                onClick={() => addBranchOption(idx)}
                                className="rounded border border-[#0078d4]/30 px-2 py-0.5 text-xs text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
                              >
                                + Opcao
                              </button>
                            </div>
                            {(etapa.options || []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">Nenhuma opcao de ramificacao. Adicione ao menos uma.</span>
                            ) : (
                              <div className="space-y-2">
                                {(etapa.options || []).map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={opt.label}
                                      onChange={e => updateBranchOption(idx, oi, 'label', e.target.value)}
                                      placeholder="Rotulo (ex: Sim, Nao)"
                                      className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                                    />
                                    <span className="text-xs text-muted-foreground">→</span>
                                    <select
                                      value={opt.nextStepId}
                                      onChange={e => updateBranchOption(idx, oi, 'nextStepId', e.target.value)}
                                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                    >
                                      <option value="">Proxima sequencial</option>
                                      {etapas.filter((_, i) => i !== idx).map(s => (
                                        <option key={s.id} value={s.id}>
                                          #{etapas.indexOf(s) + 1} {s.title || '(sem titulo)'}
                                        </option>
                                      ))}
                                    </select>
                                    <button onClick={() => removeBranchOption(idx, oi)} className="shrink-0 text-xs text-red-400 hover:text-red-500">
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

        <div className="flex shrink-0 items-center justify-between border-t border-border/60 p-4">
          <div className="text-xs text-rose-600">{error}</div>
          <div className="flex items-center gap-3">
            {template && (
              <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-400/30 px-4 py-2 text-xs tracking-wider text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                Excluir
              </button>
            )}
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !titulo.trim()}
              className="rounded-lg bg-[#0078d4] px-5 py-2 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Salvando...' : template ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
