import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Processo, RecurrenciaMap, Template } from './types'
import { listProcessos, listRecorrencias, listTemplates, createProcesso, deleteProcesso, encerrarRecorrencia, gerarRecorrentes, iniciarRecorrencia, updateProcesso, updateSituacao } from './api'
import { useClientes, useDepartamentos } from './hooks/useShared'
import {
  KANBAN_COLUMNS, PRIORIDADE_MAP, STATUS_FILTERS, STATUS_MAP,
  STEP_TYPE_COLORS, countCompleted, fmtDateBR, getCurrentStep, getDependencyNames,
  getDisplayName, getKanbanStatus, hasIncompleteSubtasks, hasUnmetDependencies, safeEtapas,
} from './helpers'
import TemplateModal from './components/TemplateModal'
import InstanceModal from './components/InstanceModal'
import KanbanPorProcesso from './components/KanbanPorProcesso'
import ProcessoDetail from './components/ProcessoDetail'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

type SubTab = 'modelos' | 'instancias' | 'kanban' | 'recorrencias'

export default function ProcessosPage() {
  const qc = useQueryClient()
  const [subTab, setSubTab] = useState<SubTab>('modelos')
  const [statusFilter, setStatusFilter] = useState('')

  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)
  const [kanbanProcesso, setKanbanProcesso] = useState<Processo | null>(null)
  const [editingSituacao, setEditingSituacao] = useState<{ id: number; situacao: string } | null>(null)

  // Kanban flow (lote)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [flowTemplateId, setFlowTemplateId] = useState('')
  const [flowClients, setFlowClients] = useState<number[]>([])

  // Recorrência
  const [recurrenciaOpen, setRecurrenciaOpen] = useState<number | null>(null)
  const [recurrenciaClientes, setRecurrenciaClientes] = useState<number[]>([])

  const { data: templates = [] } = useQuery({ queryKey: ['processo-templates'], queryFn: listTemplates })
  const { data: processos = [] } = useQuery({ queryKey: ['processos'], queryFn: listProcessos })
  const { data: recorrencias = {} as RecurrenciaMap } = useQuery({ queryKey: ['processo-recorrencias'], queryFn: listRecorrencias })
  const { data: departamentos = [] } = useDepartamentos()
  const { data: clientes = [] } = useClientes()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['processos'] })
    qc.invalidateQueries({ queryKey: ['processo-templates'] })
    qc.invalidateQueries({ queryKey: ['processo-recorrencias'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const mutUpdate = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => updateProcesso(id, payload),
    onSuccess: invalidate,
  })

  const mutDelete = useMutation({ mutationFn: (id: number) => deleteProcesso(id), onSuccess: invalidate })
  const mutSituacao = useMutation({ mutationFn: ({ id, situacao }: { id: number; situacao: string }) => updateSituacao(id, situacao), onSuccess: invalidate })

  const mutIniciarRec = useMutation({
    mutationFn: ({ id, clientes: c }: { id: number; clientes: number[] }) => iniciarRecorrencia(id, c),
    onSuccess: () => { setRecurrenciaOpen(null); invalidate() },
  })
  const mutEncerrarRec = useMutation({ mutationFn: (id: number) => encerrarRecorrencia(id), onSuccess: invalidate })
  const mutGerarRec = useMutation({ mutationFn: () => gerarRecorrentes(), onSuccess: invalidate })

  const createFlows = async () => {
    const tmpl = templates.find(t => String(t.id) === flowTemplateId)
    if (!tmpl || flowClients.length === 0) return
    const etapas = safeEtapas(tmpl.etapas).map((e, i) => ({
      ...e,
      type: (['Tarefa', 'Obrigação', 'Decisão', 'Gatilho'].includes(e.type) ? e.type : 'Tarefa') as typeof e.type,
      order: e.order ?? i,
      isCompleted: false,
      selectedOptionId: undefined,
      subtasks: (e.subtasks || []).map(st => ({ ...st, isCompleted: false })),
      dueDate: undefined,
    }))
    const firstStep = etapas[0]?.title || ''
    for (const cid of flowClients) {
      const cli = clientes.find(c => c.id === cid)
      await createProcesso({
        template_id: Number(flowTemplateId),
        titulo: tmpl.titulo + ' - ' + (cli?.name || cli?.nome || 'Cliente'),
        cliente_nome: cli?.name || cli?.nome || '',
        cliente_id: cid,
        prioridade: 'Média',
        data_inicio: new Date().toISOString().slice(0, 10),
        visibilidade: 'público',
        etapas,
        etapa_atual: firstStep,
        status: 'Pendente',
      })
    }
    setShowFlowModal(false)
    invalidate()
  }

  const completeStep = async (processo: Processo, optionLabel?: string) => {
    const etapas = safeEtapas(processo.etapas).map(e => ({ ...e }))
    const { index, step: current } = getCurrentStep(etapas)
    if (!current || index < 0) return

    if (hasUnmetDependencies(current, etapas)) {
      alert('Bloqueado! Esta etapa depende de: ' + getDependencyNames(current, etapas))
      return
    }
    if (hasIncompleteSubtasks(current)) {
      alert('Conclua todas as subtarefas primeiro!')
      return
    }

    current.isCompleted = true
    current.completedBy = getDisplayName()
    current.completedAt = new Date().toISOString()

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

    await mutUpdate.mutateAsync({ id: processo.id, payload: { etapas, status: newStatus, etapa_atual: newEtapaAtual } })
    if (current.notificar_todos) {
      alert('Notificações enviadas para todos os usuários.')
    }
  }

  const toggleSubtask = async (processo: Processo, stepId: string, subtaskId: string) => {
    const etapas = safeEtapas(processo.etapas).map(e => ({ ...e }))
    const step = etapas.find(e => e.id === stepId)
    if (!step || !step.subtasks) return
    step.subtasks = step.subtasks.map(st => (st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st))
    await mutUpdate.mutateAsync({ id: processo.id, payload: { etapas } })
  }

  const filteredProcessos = statusFilter ? processos.filter(p => p.status === statusFilter) : processos
  const sTemplates = useSortable('titulo')
  const sProcessos = useSortable('titulo')
  const sRec = useSortable('titulo')
  const sortedTemplates = sortItems(templates, sTemplates.sortKey, sTemplates.sortDir, t => {
    if (sTemplates.sortKey === 'categoria') return t.categoria || ''
    if (sTemplates.sortKey === 'etapas') return safeEtapas(t.etapas).length
    if (sTemplates.sortKey === 'recorrente') return t.recorrente ? 1 : 0
    return t.titulo || ''
  })
  const sortedProcessos = sortItems(filteredProcessos, sProcessos.sortKey, sProcessos.sortDir, p => {
    if (sProcessos.sortKey === 'cliente') return p.cliente_nome || ''
    if (sProcessos.sortKey === 'status') return p.status || ''
    if (sProcessos.sortKey === 'prioridade') return p.prioridade || ''
    if (sProcessos.sortKey === 'data_inicio') return p.data_inicio || ''
    if (sProcessos.sortKey === 'created') return p.created_at || ''
    return p.titulo || ''
  })
  const recurrenciaEntries = templates.filter(t => t.recorrente).map(tmpl => {
    const rc = recorrencias[String(tmpl.id)]
    return {
      template: tmpl,
      ativo: !!rc?.ativo,
      clientes: rc?.clientes || [],
      ultima_geracao: rc?.ultima_geracao || '',
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Processos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Modelos, instancias, fluxos de trabalho e recorrencias</p>
        </div>
        {subTab === 'modelos' && (
          <button
            onClick={() => { setEditingTemplate(null); setShowTemplateModal(true) }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
          >
            + Novo Modelo
          </button>
        )}
        {subTab === 'instancias' && (
          <button
            onClick={() => setShowInstanceModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
          >
            + Nova Instancia
          </button>
        )}
        {subTab === 'kanban' && (
          <button
            onClick={() => { setFlowTemplateId(''); setFlowClients([]); setShowFlowModal(true) }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
          >
            + Iniciar Novo Fluxo
          </button>
        )}
        {subTab === 'recorrencias' && (
          <button
            onClick={() => {
              if (confirm('Gerar instâncias para todas as recorrências pendentes?')) mutGerarRec.mutate()
            }}
            disabled={mutGerarRec.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {mutGerarRec.isPending ? 'Gerando...' : 'Gerar Recorrentes'}
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {(['modelos', 'instancias', 'kanban', 'recorrencias'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setSubTab(tab); setSelectedProcesso(null); setEditingSituacao(null) }}
            className={`-mb-px border-b-2 px-5 py-3 text-xs tracking-wider transition-all duration-200 ${
              subTab === tab ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'modelos' ? 'Modelos' : tab === 'instancias' ? 'Instâncias' : tab === 'kanban' ? 'Kanban' : 'Recorrências'}
          </button>
        ))}
      </div>

      {/* ===== MODELOS ===== */}
      {subTab === 'modelos' && (
        <div className="space-y-5">
          <div className="text-xs text-muted-foreground">{templates.length} modelo(s) cadastrado(s)</div>
          <div className="card-soft overflow-hidden rounded-lg bg-card">
            {templates.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Nenhum modelo de processo cadastrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/30">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <SortableTh k="titulo" sortKey={sTemplates.sortKey} sortDir={sTemplates.sortDir} onToggle={sTemplates.toggle}>Titulo</SortableTh>
                      <SortableTh k="categoria" sortKey={sTemplates.sortKey} sortDir={sTemplates.sortDir} onToggle={sTemplates.toggle}>Categoria</SortableTh>
                      <SortableTh k="etapas" sortKey={sTemplates.sortKey} sortDir={sTemplates.sortDir} onToggle={sTemplates.toggle} align="center">Etapas</SortableTh>
                      <SortableTh k="recorrente" sortKey={sTemplates.sortKey} sortDir={sTemplates.sortDir} onToggle={sTemplates.toggle} align="center">Recorrente</SortableTh>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTemplates.map(tmpl => (
                      <tr key={tmpl.id} className="cursor-pointer border-t border-border/40 transition-colors hover:bg-muted/30" onClick={() => { setEditingTemplate(tmpl); setShowTemplateModal(true) }}>
                        <td className="px-4 py-3">{tmpl.titulo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tmpl.categoria || '-'}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{safeEtapas(tmpl.etapas).length}</td>
                        <td className="px-4 py-3 text-center">
                          {tmpl.recorrente ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4]">
                              <span>+</span> {tmpl.recorrencia_padrao || 'mensal'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              const body = {
                                titulo: tmpl.titulo + ' (Cópia)',
                                categoria: tmpl.categoria || '',
                                departamento_id: tmpl.departamento_id,
                                recorrente: !!tmpl.recorrente,
                                recorrencia_padrao: tmpl.recorrencia_padrao || 'mensal',
                                etapas: safeEtapas(tmpl.etapas),
                              }
                              fetch('/api/processo-templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token || '') },
                                body: JSON.stringify(body),
                              }).then(() => invalidate())
                            }}
                            className="rounded border border-amber-400/30 px-3 py-1 text-xs tracking-wider text-amber-500 transition-colors hover:bg-amber-400/10"
                          >
                            Duplicar
                          </button>
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

      {/* ===== INSTANCIAS ===== */}
      {subTab === 'instancias' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`rounded px-3 py-1.5 text-xs tracking-wider transition-colors ${
                  statusFilter === s.key
                    ? 'border border-[#0078d4]/30 bg-[#0078d4]/20 text-[#0078d4]'
                    : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="card-soft overflow-hidden rounded-lg bg-card">
            {filteredProcessos.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Nenhum processo encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/30">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <SortableTh k="titulo" sortKey={sProcessos.sortKey} sortDir={sProcessos.sortDir} onToggle={sProcessos.toggle}>Titulo</SortableTh>
                      <SortableTh k="cliente" sortKey={sProcessos.sortKey} sortDir={sProcessos.sortDir} onToggle={sProcessos.toggle}>Cliente</SortableTh>
                      <SortableTh k="status" sortKey={sProcessos.sortKey} sortDir={sProcessos.sortDir} onToggle={sProcessos.toggle} align="center">Status</SortableTh>
                      <SortableTh k="prioridade" sortKey={sProcessos.sortKey} sortDir={sProcessos.sortDir} onToggle={sProcessos.toggle} align="center">Prioridade</SortableTh>
                      <SortableTh k="data_inicio" sortKey={sProcessos.sortKey} sortDir={sProcessos.sortDir} onToggle={sProcessos.toggle} align="center">Data Inicio</SortableTh>
                      <SortableTh k="created" sortKey={sProcessos.sortKey} sortDir={sProcessos.sortDir} onToggle={sProcessos.toggle} align="right">Criado</SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProcessos.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProcesso(selectedProcesso?.id === p.id ? null : p)}
                        className={`cursor-pointer border-t border-border/40 transition-colors hover:bg-muted/30 ${selectedProcesso?.id === p.id ? 'bg-[#0078d4]/10' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium">{p.titulo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.cliente_nome || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="rounded px-2 py-0.5 text-xs"
                            style={{ backgroundColor: (STATUS_MAP[p.status]?.color || '#535353') + '18', color: STATUS_MAP[p.status]?.color || '#535353', border: '1px solid ' + (STATUS_MAP[p.status]?.color || '#535353') + '35' }}
                          >
                            {STATUS_MAP[p.status]?.label || p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-medium" style={{ color: PRIORIDADE_MAP[p.prioridade] || '#535353' }}>
                          {p.prioridade}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{fmtDateBR(p.data_inicio)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtDateBR(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedProcesso && (
            <ProcessoDetail
              processo={selectedProcesso}
              saving={mutUpdate.isPending}
              editingSituacao={editingSituacao}
              onSetSituacao={setEditingSituacao}
              onSaveSituacao={() => {
                if (!editingSituacao) return
                mutSituacao.mutate({ id: editingSituacao.id, situacao: editingSituacao.situacao }, {
                  onSuccess: () => {
                    setSelectedProcesso(prev => (prev && prev.id === editingSituacao.id ? { ...prev, situacao: editingSituacao.situacao } : prev))
                    setEditingSituacao(null)
                  },
                })
              }}
              onChangeStatus={(status) => mutUpdate.mutate({ id: selectedProcesso.id, payload: { status } })}
              onCompleteStep={(optLabel) => completeStep(selectedProcesso, optLabel)}
              onToggleSubtask={(stepId, subId) => toggleSubtask(selectedProcesso, stepId, subId)}
              onDelete={() => {
                if (confirm('Excluir processo ' + selectedProcesso.titulo + ' de cliente ' + (selectedProcesso.cliente_nome || '?') + '?')) {
                  mutDelete.mutate(selectedProcesso.id, { onSuccess: () => setSelectedProcesso(null) })
                }
              }}
              onOpenKanban={() => setKanbanProcesso(selectedProcesso)}
            />
          )}
        </div>
      )}

      {/* ===== KANBAN ===== */}
      {subTab === 'kanban' && (
        <div className="space-y-5">
          <div className="text-xs text-muted-foreground">{processos.length} processo(s)</div>
          <div className="grid grid-cols-5 gap-4" style={{ minHeight: '60vh' }}>
            {KANBAN_COLUMNS.map(col => {
              const colProcesses = processos.filter(p => getKanbanStatus(p) === col.key)
              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded-xl border border-border bg-card"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const id = Number(e.dataTransfer.getData('text/plain'))
                    if (!id) return
                    if (col.status === 'aguardando_decisao') return
                    mutUpdate.mutate({ id, payload: { status: col.status } })
                  }}
                >
                  <div className="border-b border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs tracking-wider text-muted-foreground">{col.label}</span>
                      <span className="text-xs text-muted-foreground">{colProcesses.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {colProcesses.length === 0 ? (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
                        <span className="text-xs text-muted-foreground">Sem processos</span>
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
                            draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', String(p.id))}
                            className="cursor-grab rounded-lg border border-border bg-background p-3 transition-colors hover:border-[#0078d4]/30 active:cursor-grabbing"
                            style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="truncate text-xs text-muted-foreground">{p.cliente_nome || '-'}</span>
                              <select
                                value={p.status}
                                onChange={e => { e.stopPropagation(); mutUpdate.mutate({ id: p.id, payload: { status: e.target.value } }) }}
                                onClick={e => e.stopPropagation()}
                                className="cursor-pointer rounded border border-border bg-transparent px-1 py-0.5 text-xs text-muted-foreground focus:outline-none"
                              >
                                {Object.keys(STATUS_MAP).map(s => (
                                  <option key={s} value={s}>{STATUS_MAP[s].label}</option>
                                ))}
                              </select>
                            </div>
                            <div
                              className="mb-2 cursor-pointer text-xs font-medium hover:text-[#0078d4]"
                              onClick={() => { setSubTab('instancias'); setSelectedProcesso(p) }}
                            >
                              {p.titulo}
                            </div>
                            <div className="mb-1.5">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: pct + '%', backgroundColor: pct === 100 ? '#10B981' : '#5C939F' }}
                                />
                              </div>
                            </div>
                            {current && (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="rounded px-2 py-0.5 text-xs"
                                  style={{ backgroundColor: (STEP_TYPE_COLORS[current.type] || '#535353') + '18', color: STEP_TYPE_COLORS[current.type] || '#535353' }}
                                >
                                  {current.type}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">{current.title}</span>
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

      {/* ===== RECORRENCIAS ===== */}
      {subTab === 'recorrencias' && (
        <div className="space-y-5">
          <div className="text-xs text-muted-foreground">{recurrenciaEntries.filter(e => e.ativo).length} recorrencia(s) ativa(s)</div>
          {recurrenciaEntries.length === 0 ? (
            <div className="card-soft rounded-lg bg-card p-16 text-center">
              <div className="mb-2 text-sm text-muted-foreground">Nenhum template com recorrencia configurada.</div>
              <div className="text-xs text-muted-foreground">Marque um modelo como "Recorrente" na aba Modelos para ativar recorrencias.</div>
            </div>
          ) : (
            <div className="card-soft overflow-hidden rounded-lg bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <SortableTh k="titulo" sortKey={sRec.sortKey} sortDir={sRec.sortDir} onToggle={sRec.toggle}>Template</SortableTh>
                    <SortableTh k="frequencia" sortKey={sRec.sortKey} sortDir={sRec.sortDir} onToggle={sRec.toggle}>Frequencia</SortableTh>
                    <SortableTh k="ativo" sortKey={sRec.sortKey} sortDir={sRec.sortDir} onToggle={sRec.toggle} align="center">Status</SortableTh>
                    <SortableTh k="clientes" sortKey={sRec.sortKey} sortDir={sRec.sortDir} onToggle={sRec.toggle} align="center">Clientes</SortableTh>
                    <SortableTh k="ultima" sortKey={sRec.sortKey} sortDir={sRec.sortDir} onToggle={sRec.toggle} align="center">Ultima Geracao</SortableTh>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortItems(recurrenciaEntries, sRec.sortKey, sRec.sortDir, e => {
                    if (sRec.sortKey === 'frequencia') return e.template.recorrencia_padrao || ''
                    if (sRec.sortKey === 'ativo') return e.ativo ? 1 : 0
                    if (sRec.sortKey === 'clientes') return e.clientes.length
                    if (sRec.sortKey === 'ultima') return e.ultima_geracao || ''
                    return e.template.titulo || ''
                  }).map(entry => (
                    <tr key={entry.template.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">{entry.template.titulo}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{entry.template.recorrencia_padrao || 'mensal'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs tracking-wider"
                          style={{
                            backgroundColor: entry.ativo ? '#10B98118' : '#53535318',
                            color: entry.ativo ? '#10B981' : '#535353',
                            border: '1px solid ' + (entry.ativo ? '#10B98135' : '#53535335'),
                          }}
                        >
                          {entry.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{entry.clientes.length}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {entry.ultima_geracao ? fmtDateBR(entry.ultima_geracao) : 'Nunca'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.ativo ? (
                          <button
                            onClick={() => {
                              if (confirm('Encerrar recorrência deste template?')) mutEncerrarRec.mutate(entry.template.id)
                            }}
                            className="rounded border border-red-400/30 px-3 py-1 text-xs tracking-wider text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            Encerrar
                          </button>
                        ) : (
                          <button
                            onClick={() => { setRecurrenciaOpen(entry.template.id); setRecurrenciaClientes(entry.clientes) }}
                            className="rounded border border-[#0078d4]/30 px-3 py-1 text-xs tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
                          >
                            Iniciar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          departamentos={departamentos}
          onClose={() => setShowTemplateModal(false)}
          onSaved={invalidate}
        />
      )}
      {showInstanceModal && (
        <InstanceModal templates={templates} clientes={clientes} onClose={() => setShowInstanceModal(false)} onSaved={invalidate} />
      )}
      {showFlowModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowFlowModal(false)} />
          <div className="relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border/60 p-6">
              <h3 className="text-sm font-semibold tracking-wider text-foreground">Iniciar Novo Fluxo</h3>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Modelo (template)</label>
                <select
                  value={flowTemplateId}
                  onChange={e => setFlowTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-[#0078d4] focus:outline-none"
                >
                  <option value="">Selecione um modelo...</option>
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.titulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Clientes ({flowClients.length} selecionado(s))
                </label>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                  {clientes.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">Nenhum cliente disponivel.</div>
                  ) : (
                    clientes.map(c => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={flowClients.includes(c.id)}
                          onChange={() => setFlowClients(prev => (prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]))}
                          className="rounded accent-[#0078d4]"
                        />
                        <span className="text-foreground">{c.name || c.nome || 'Cliente #' + c.id}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/60 p-4">
              <button onClick={() => setShowFlowModal(false)} className="rounded-lg px-4 py-2 text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={createFlows}
                disabled={!flowTemplateId || flowClients.length === 0}
                className="rounded-lg bg-[#0078d4] px-5 py-2 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Criar {flowClients.length} Fluxo(s)
              </button>
            </div>
          </div>
        </div>
      )}
      {recurrenciaOpen !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRecurrenciaOpen(null)} />
          <div className="relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border/60 p-6">
              <h3 className="text-sm font-semibold tracking-wider text-foreground">Iniciar Recorrencia</h3>
            </div>
            <div className="space-y-4 p-6">
              <div className="text-xs text-muted-foreground">
                Template: <span className="text-foreground">{templates.find(t => t.id === recurrenciaOpen)?.titulo}</span>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Selecione os clientes ({recurrenciaClientes.length})
                </label>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                  {clientes.map(c => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={recurrenciaClientes.includes(c.id)}
                        onChange={() => setRecurrenciaClientes(prev => (prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]))}
                        className="rounded accent-[#0078d4]"
                      />
                      <span className="text-foreground">{c.name || c.nome || 'Cliente #' + c.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/60 p-4">
              <button onClick={() => setRecurrenciaOpen(null)} className="rounded-lg px-4 py-2 text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={() => mutIniciarRec.mutate({ id: recurrenciaOpen, clientes: recurrenciaClientes })}
                disabled={mutIniciarRec.isPending || recurrenciaClientes.length === 0}
                className="rounded-lg bg-[#0078d4] px-5 py-2 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutIniciarRec.isPending ? 'Iniciando...' : 'Iniciar Recorrencia'}
              </button>
            </div>
          </div>
        </div>
      )}
      {kanbanProcesso && (
        <KanbanPorProcesso processo={kanbanProcesso} onClose={() => { setKanbanProcesso(null); invalidate() }} />
      )}
    </div>
  )
}
