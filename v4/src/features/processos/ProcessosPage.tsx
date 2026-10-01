import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, openAuthedFile } from '@/lib/api'
import type { AprovacaoPendente, Processo, RecurrenciaMap, Template, Vinculo } from './types'
import { listProcessos, listRecorrencias, listTemplates, createProcesso, deleteProcesso, encerrarRecorrencia, gerarRecorrentes, iniciarRecorrencia, updateProcesso, updateSituacao, listVinculos, uploadProcessoAnexo, listAprovacoesPendentes, aprovarEtapa, reprovarEtapa, solicitarAprovacao } from './api'
import { useClientesOperacionais, useDepartamentos } from './hooks/useShared'
import {
  KANBAN_COLUMNS, PRIORIDADE_MAP, STATUS_FILTERS, STATUS_MAP,
  STEP_TYPE_COLORS, countCompleted, fmtDateBR, getCurrentStep, getDependencyNames,
  getDisplayName, getKanbanStatus, getMe, hasIncompleteSubtasks, hasUnmetDependencies,
  safeEtapas, pedirAnexo,
} from './helpers'
import TemplateModal from './components/TemplateModal'
import InstanceModal from './components/InstanceModal'
import ProcessoDetail from './components/ProcessoDetail'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'
import {
  DndContext, PointerSensor, TouchSensor, closestCorners, useDroppable, useDraggable,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { FileCheck2, FileWarning } from 'lucide-react'

type SubTab = 'modelos' | 'instancias' | 'kanban' | 'aprovacoes' | 'recorrencias' | 'vinculados'

/** Indicador de documento na tabela de instâncias: verde (anexado), âmbar (pendente). */
function renderDocIndicador(p: Processo) {
  const etapas = safeEtapas(p.etapas)
  const exigem = etapas.filter(e => e.exige_documento)
  if (exigem.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  const pendentes = exigem.filter(e => e.isCompleted && !e.anexo)
  const atuais = exigem.filter(e => !e.isCompleted)
  const algumAnexo = exigem.some(e => e.anexo)
  if (pendentes.length > 0) {
    return <span title="Etapa concluída sem documento anexado" className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-600"><FileWarning className="h-3 w-3" /> falta anexo</span>
  }
  if (atuais.length > 0) {
    return <span title="A etapa atual exige documento ao concluir" className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"><FileWarning className="h-3 w-3" /> exige doc</span>
  }
  return <span title="Documento anexado" className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600"><FileCheck2 className="h-3 w-3" /> {algumAnexo ? 'anexado' : 'ok'}</span>
}

function StatusPill({ status }: { status: string }) {
  const c = STATUS_MAP[status]?.color || '#535353'
  return (
    <span
      className="whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: c + '18', color: c, border: '1px solid ' + c + '35' }}
    >
      {STATUS_MAP[status]?.label || status}
    </span>
  )
}

const REC_LABEL: Record<string, string> = {
  diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal',
  trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}
const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
function fmtRecorrencia(t: { recorrencia_padrao?: string; recorrencia_dia_mes?: number | null; recorrencia_dia_semana?: number | null }) {
  const f = (t.recorrencia_padrao || 'mensal').toLowerCase()
  const label = REC_LABEL[f] || f
  if (f === 'semanal') {
    const d = t.recorrencia_dia_semana ?? 0
    return `${label} · ${DIAS_SEMANA[d] ?? 'Segunda'}`
  }
  if (f === 'diaria') return label
  return `${label} · dia ${t.recorrencia_dia_mes ?? 1}`
}

export default function ProcessosPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [subTab, setSubTab] = useState<SubTab>('modelos')
  const [statusFilter, setStatusFilter] = useState('')
  const [meusProcessos, setMeusProcessos] = useState(false)

  // Filtros avançados (instâncias) — para admin/líder/super
  const [busca, setBusca] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')

  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Ao abrir o detalhe de qualquer instância, rola até o painel (que fica no topo)
  useEffect(() => {
    if (selectedProcesso && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedProcesso])
  const [editingSituacao, setEditingSituacao] = useState<{ id: number; situacao: string } | null>(null)
  const me = getMe()
  const isAdmin = me.role === 'administrador' || me.role === 'super_admin'
  const isGestor = isAdmin || me.role === 'lider'
  const temFiltroInst = busca.trim() !== '' || filtroResponsavel !== '' || filtroCliente !== '' ||
    filtroDepartamento !== '' || filtroPrioridade !== ''
  const limparFiltrosInst = () => {
    setBusca(''); setFiltroResponsavel(''); setFiltroCliente(''); setFiltroDepartamento(''); setFiltroPrioridade('')
  }

  // Kanban flow (lote)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [flowTemplateId, setFlowTemplateId] = useState('')
  const [flowClients, setFlowClients] = useState<number[]>([])

  // Recorrência
  const [recurrenciaOpen, setRecurrenciaOpen] = useState<number | null>(null)
  const [recurrenciaClientes, setRecurrenciaClientes] = useState<number[]>([])

  const { data: templates = [] } = useQuery({ queryKey: ['processo-templates'], queryFn: listTemplates })
  const { data: processos = [] } = useQuery({ queryKey: ['processos', meusProcessos], queryFn: () => listProcessos(meusProcessos || undefined) })
  const { data: recorrencias = {} as RecurrenciaMap } = useQuery({ queryKey: ['processo-recorrencias'], queryFn: listRecorrencias })
  const { data: vinculos = { vinculos: [] as Vinculo[] } } = useQuery({ queryKey: ['processo-vinculos'], queryFn: listVinculos })
  const { data: departamentos = [] } = useDepartamentos()
  const { data: clientes = [] } = useClientesOperacionais()
  const { data: usuarios = [] } = useQuery({
    queryKey: ['processos-usuarios'],
    queryFn: () => apiFetch<any[]>('/api/usuarios?limit=500'),
    staleTime: 5 * 60_000,
  })
  const usersMap = Object.fromEntries(usuarios.map((u: any) => [String(u.id), u]))
  const deptMap = Object.fromEntries(departamentos.map((d: any) => [String(d.id), d]))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['processos'] })
    qc.invalidateQueries({ queryKey: ['processo-templates'] })
    qc.invalidateQueries({ queryKey: ['processo-recorrencias'] })
    qc.invalidateQueries({ queryKey: ['processo-vinculos'] })
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

    // Exige documento/relatório? Se marcado no modelo, precisa anexar antes de fechar.
    if (current.exige_documento && !current.anexo) {
      const file = await pedirAnexo()
      if (!file) return
      try {
        const anexo = await uploadProcessoAnexo(processo.id, file)
        current.anexo = anexo
      } catch (e) {
        alert('Falha ao anexar o documento: ' + (e instanceof Error ? e.message : 'erro'))
        return
      }
    }
    // Checklist de documentos exigidos
    const docs = current.documentos_exigidos || []
    if (docs.length > 0) {
      const itens = Object.fromEntries((current.checklist || []).map(i => [String(i.id), i]))
      if (docs.some(d => !(itens[String(d.id)]?.anexo))) {
        alert('Anexe todos os documentos exigidos antes de concluir.')
        return
      }
    }
    // Etapa que exige aprovação: envia para aprovação (não conclui direto)
    if (current.exige_aprovacao) {
      try {
        await solicitarAprovacao(processo.id, current.id)
        invalidate()
        alert('Etapa enviada para aprovação.')
      } catch (e) {
        alert('Falha ao enviar para aprovação: ' + (e instanceof Error ? e.message : 'erro'))
      }
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

    try {
      await mutUpdate.mutateAsync({ id: processo.id, payload: { etapas, status: newStatus, etapa_atual: newEtapaAtual } })
      // Atualiza em tempo real o painel expandido
      setSelectedProcesso(prev => (prev && prev.id === processo.id ? { ...prev, etapas, status: newStatus, etapa_atual: newEtapaAtual } : prev))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir etapa')
      return
    }
    if (current.notificar_todos) {
      alert('Notificações enviadas para todos os usuários.')
    }
  }

  const toggleSubtask = async (processo: Processo, stepId: string, subtaskId: string) => {
    const etapas = safeEtapas(processo.etapas).map(e => ({ ...e }))
    const step = etapas.find(e => e.id === stepId)
    if (!step || !step.subtasks) return
    step.subtasks = step.subtasks.map(st => (st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st))
    try {
      await mutUpdate.mutateAsync({ id: processo.id, payload: { etapas } })
      // Atualiza em tempo real o painel expandido
      setSelectedProcesso(prev => (prev && prev.id === processo.id ? { ...prev, etapas } : prev))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar subtarefa')
    }
  }

  const anexarEtapa = async (stepId: string) => {
    const file = await pedirAnexo()
    if (!file) return
    const etapas = safeEtapas(selectedProcesso?.etapas || []).map(e => ({ ...e }))
    const step = etapas.find(e => e.id === stepId)
    if (!step) return
    try {
      const anexo = await uploadProcessoAnexo(selectedProcesso!.id, file)
      step.anexo = anexo
      await mutUpdate.mutateAsync({ id: selectedProcesso!.id, payload: { etapas } })
      setSelectedProcesso(prev => (prev ? { ...prev, etapas } : prev))
    } catch (e) {
      alert('Falha ao anexar o documento: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  const filteredProcessos = processos.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false
    if (busca.trim()) {
      const b = busca.trim().toLowerCase()
      const hay = [p.titulo || '', p.cliente_nome || '', p.etapa_atual || ''].join(' ').toLowerCase()
      if (!hay.includes(b)) return false
    }
    if (filtroResponsavel && String((p as any).user_id ?? '') !== filtroResponsavel) return false
    if (filtroCliente && String((p as any).cliente_id ?? '') !== filtroCliente) return false
    if (filtroDepartamento && String((p as any).template_departamento_id ?? '') !== filtroDepartamento) return false
    if (filtroPrioridade && (p.prioridade || '') !== filtroPrioridade) return false
    return true
  })
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
        {subTab === 'modelos' && isAdmin && (
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
        {(['modelos', 'instancias', 'kanban', 'aprovacoes', 'recorrencias', 'vinculados'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setSubTab(tab); setSelectedProcesso(null); setEditingSituacao(null) }}
            className={`-mb-px border-b-2 px-5 py-3 text-xs tracking-wider transition-all duration-200 ${
              subTab === tab ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'modelos' ? 'Modelos' : tab === 'instancias' ? 'Instâncias' : tab === 'kanban' ? 'Kanban' : tab === 'aprovacoes' ? 'Aprovações' : tab === 'recorrencias' ? 'Recorrências' : 'Vinculados'}
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
                      <tr key={tmpl.id} className={`border-t border-border/40 transition-colors ${isAdmin ? 'cursor-pointer hover:bg-muted/30' : ''}`} onClick={() => { if (isAdmin) { setEditingTemplate(tmpl); setShowTemplateModal(true) } }}>
                        <td className="px-4 py-3">{tmpl.titulo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tmpl.categoria || '-'}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{safeEtapas(tmpl.etapas).length}</td>
                        <td className="px-4 py-3 text-center">
                          {tmpl.recorrente ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4]">
                              <span>+</span> {fmtRecorrencia(tmpl)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
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
                          )}
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
          {selectedProcesso && (
            <div ref={detailRef}>
              <ProcessoDetail
              processo={selectedProcesso}
              me={me}
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
              onAnexarEtapa={(stepId) => anexarEtapa(stepId)}
              onToggleSubtask={(stepId, subId) => toggleSubtask(selectedProcesso, stepId, subId)}
              onDelete={() => {
                if (confirm('Excluir processo ' + selectedProcesso.titulo + ' de cliente ' + (selectedProcesso.cliente_nome || '?') + '?')) {
                  mutDelete.mutate(selectedProcesso.id, { onSuccess: () => setSelectedProcesso(null) })
                }
              }}
              onOpenKanban={() => navigate(`/processos/${selectedProcesso.id}`)}
              onClose={() => setSelectedProcesso(null)}
              mostrarAoCliente={!!selectedProcesso.mostrar_ao_cliente}
              onToggleMostrarCliente={() => mutUpdate.mutate({
                id: selectedProcesso.id,
                payload: { mostrar_ao_cliente: !selectedProcesso.mostrar_ao_cliente },
              }, { onSuccess: () => {
                setSelectedProcesso(prev => (prev && prev.id === selectedProcesso.id ? { ...prev, mostrar_ao_cliente: !prev.mostrar_ao_cliente } : prev))
                qc.invalidateQueries({ queryKey: ['processos'] })
              } })}
              />
            </div>
          )}
          {isGestor && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome do processo, cliente..."
                className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todos responsáveis</option>
                {usuarios.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username || u.id}</option>
                ))}
              </select>
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                className="h-9 max-w-[220px] rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todos clientes</option>
                {clientes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
                ))}
              </select>
              <select value={filtroDepartamento} onChange={e => setFiltroDepartamento(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todos departamentos</option>
                {departamentos.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
              <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Todas prioridades</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Media">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
              {temFiltroInst && (
                <button onClick={limparFiltrosInst}
                  className="h-9 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Limpar filtros
                </button>
              )}
            </div>
          )}
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
            <span className="mx-2 h-4 w-px bg-border" />
            <button
              onClick={() => setMeusProcessos(x => !x)}
              title="Mostrar apenas processos em que você participa (responsável, etapa ou criador)"
              className={`rounded px-3 py-1.5 text-xs tracking-wider transition-colors ${
                meusProcessos
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-600'
                  : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {meusProcessos ? '✓ Meus processos' : 'Meus processos'}
            </button>
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
                      <th className="py-2 pr-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doc</th>
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
                        <td className="px-4 py-3 text-center">{renderDocIndicador(p)}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{fmtDateBR(p.data_inicio)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtDateBR(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== KANBAN ===== */}
      {subTab === 'kanban' && (
        <KanbanBoard processos={processos} usersMap={usersMap} deptMap={deptMap} onDrop={payload => mutUpdate.mutate(payload)} onOpen={p => navigate(`/processos/${p.id}`)} />
      )}

      {/* ===== APROVAÇÕES ===== */}
      {subTab === 'aprovacoes' && (
        <AprovacoesCentral onOpen={p => navigate(`/processos/${p.id}`)} />
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
                      <td className="px-4 py-3 text-muted-foreground">{fmtRecorrencia(entry.template)}</td>
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

      {/* ===== VINCULADOS ===== */}
      {subTab === 'vinculados' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {vinculos.vinculos.length} vínculo(s) ativo(s) em execução — gatilhos que já dispararam ou estão configurados para disparar outro processo.
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              Somente em andamento
            </span>
          </div>

          {vinculos.vinculos.length === 0 ? (
            <div className="card-soft rounded-lg bg-card p-16 text-center">
              <div className="mb-2 text-sm text-muted-foreground">Nenhum processo vinculado em execução.</div>
              <div className="text-xs text-muted-foreground">
                Configure um gatilho em um modelo (aba Modelos → etapa "+ Gatilho" → "Dispara o modelo") para criar vínculos automáticos.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {vinculos.vinculos.map((v: Vinculo, idx) => (
                <div key={idx} className="card-soft rounded-lg bg-card p-4">
                  {/* Processo pai */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className="min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:border-[#0078d4]/30"
                      onClick={() => { setSubTab('instancias'); setSelectedProcesso(v.pai) }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Processo origem</p>
                      <p className="truncate text-sm font-medium text-foreground">{v.pai.titulo}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="truncate text-xs text-muted-foreground">{v.pai.cliente_nome || '-'}</span>
                        <StatusPill status={v.pai.status} />
                      </div>
                      {v.gatilho?.title && (
                        <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                          ▽ etapa "{v.gatilho.title}"
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-center px-1 text-[#0078d4]">
                      <span className="text-lg leading-none">→</span>
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">dispara</span>
                    </div>

                    {/* Processos filhos disparados */}
                    <div className="min-w-0 flex-1 space-y-2">
                      {v.filho && v.filho.length > 0 ? (
                        v.filho.map(f => (
                          <div
                            key={f.id}
                            onClick={() => { setSubTab('instancias'); setSelectedProcesso(f) }}
                            className="cursor-pointer rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:border-[#0078d4]/30"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Processo disparado</p>
                            <p className="truncate text-sm font-medium text-foreground">{f.titulo}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="truncate text-xs text-muted-foreground">{f.cliente_nome || '-'}</span>
                              <StatusPill status={f.status} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Modelo configurado no gatilho</p>
                          <p className="truncate text-sm font-medium text-foreground">
                            {templates.find(t => t.id === Number(v.dispara_template_id))?.titulo || 'Modelo #' + v.dispara_template_id}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Ainda não disparado / sem instância ativa.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KanbanCard({ p, colKey, usersMap, deptMap, onOpen }: {
  p: Processo
  colKey: string
  usersMap: Record<string, any>
  deptMap: Record<string, any>
  onOpen: (p: Processo) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(p.id) })
  const etapas = safeEtapas(p.etapas)
  const completed = countCompleted(etapas)
  const total = etapas.length
  const { step: current, index: currentIdx } = getCurrentStep(etapas)
  const borderColor = STATUS_MAP[colKey]?.color || '#535353'
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  // Vencimento: dueDate da etapa atual, senão prazo do processo
  const venc = current?.dueDate || ''
  const isVencido = !current?.isCompleted && venc && new Date(venc + 'T00:00:00') < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  const responsavel = (p.user_id && usersMap[String(p.user_id)])
    ? (usersMap[String(p.user_id)].display_name || usersMap[String(p.user_id)].username || '')
    : ((p as any).responsavel_nome || '')
  const deptoId = current?.departamento_id ?? (p as any).template_departamento_id
  const departamento = deptoId && deptMap[String(deptoId)] ? deptMap[String(deptoId)].nome : ''
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      draggable={false}
      className="cursor-grab rounded-lg border border-border bg-background p-3 transition-colors hover:border-[#0078d4]/30 active:cursor-grabbing"
      style={{ borderLeftWidth: '3px', borderLeftColor: borderColor, opacity: isDragging ? 0.4 : 1, transform: CSS.Translate.toString(transform), touchAction: 'none' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{p.cliente_nome || '-'}</span>
        <span className="ml-2 shrink-0 text-[9px] text-muted-foreground">{p.status}</span>
      </div>
      <div className="mb-2 cursor-pointer text-xs font-medium hover:text-[#0078d4]" onClick={e => { e.stopPropagation(); onOpen(p) }}>
        {p.titulo}
      </div>
      <div className="mb-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: pct + '%', backgroundColor: pct === 100 ? '#10B981' : '#5C939F' }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{completed}/{total} etapas</span>
          {currentIdx >= 0 && <span>Etapa {currentIdx + 1}/{total}</span>}
        </div>
      </div>
      {responsavel && (
        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          <span className="truncate">{responsavel}</span>
        </div>
      )}
      {departamento && (
        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 12h18" />
          </svg>
          <span className="truncate">{departamento}</span>
        </div>
      )}
      {venc && (
        <div className={`mb-1.5 text-xs ${isVencido ? 'text-rose-500' : 'text-muted-foreground'}`}>
          Vence: {fmtDateBR(venc)}
        </div>
      )}
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
      {current?.aprovacao_status === 'pendente' && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
          Aguardando aprovação
        </div>
      )}
      {current?.exige_documento && (
        <div className="mt-1.5 flex items-center gap-1">
          {current.anexo ? (
            <a
              href={current.anexo.url}
              target="_blank" rel="noreferrer"
              onClick={ev => { ev.stopPropagation(); ev.preventDefault(); void openAuthedFile(current.anexo!.url) }}
              className="inline-flex cursor-pointer items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 hover:bg-emerald-500/25"
            >
              <FileCheck2 className="h-3 w-3" /> {current.anexo.nome.slice(0, 22)}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
              <FileWarning className="h-3 w-3" /> exige anexo
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function KanbanColumn({ col, processos, usersMap, deptMap, onOpen }: {
  col: (typeof KANBAN_COLUMNS)[number]
  processos: Processo[]
  usersMap: Record<string, any>
  deptMap: Record<string, any>
  onOpen: (p: Processo) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, data: { col: col.key } })
  return (
    <div
      ref={setNodeRef}
      className="flex w-60 shrink-0 flex-col rounded-xl border border-border bg-card transition-colors"
      style={{ borderColor: isOver ? (STATUS_MAP[col.key]?.color || '#0078d4') + '60' : undefined }}
    >
      <div className="border-b border-border/60 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs tracking-wider text-muted-foreground">{col.label}</span>
          <span className="text-xs text-muted-foreground">{processos.length}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ minHeight: '300px' }}>
        {processos.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
            <span className="text-xs text-muted-foreground">Sem processos</span>
          </div>
        ) : (
          processos.map(p => <KanbanCard key={p.id} p={p} colKey={col.key} usersMap={usersMap} deptMap={deptMap} onOpen={onOpen} />)
        )}
      </div>
    </div>
  )
}

function KanbanBoard({ processos, usersMap, deptMap, onDrop, onOpen }: {
  processos: Processo[]
  usersMap: Record<string, any>
  deptMap: Record<string, any>
  onDrop: (payload: { id: number; payload: Record<string, unknown> }) => void
  onOpen: (p: Processo) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const id = Number(e.active.id)
    const colKey = String(e.over.id)
    const col = KANBAN_COLUMNS.find(c => c.key === colKey)
    if (!col) return
    const p = processos.find(x => x.id === id)
    if (!p) return
    if (getKanbanStatus(p) === colKey) return
    if (col.status === 'Aguardando_Decisao') return
    onDrop({ id, payload: { status: col.status } })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="space-y-5">
        <div className="text-xs text-muted-foreground">{processos.length} processo(s)</div>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4" style={{ minHeight: '60vh' }}>
            {KANBAN_COLUMNS.map(col => {
              const colProcesses = processos.filter(p => getKanbanStatus(p) === col.key)
              return (
                <KanbanColumn key={col.key} col={col} processos={colProcesses} usersMap={usersMap} deptMap={deptMap} onOpen={onOpen} />
              )
            })}
          </div>
        </div>
      </div>
    </DndContext>
  )
}

function AprovacoesCentral({ onOpen }: { onOpen: (p: Processo) => void }) {
  const qc = useQueryClient()
  const { data: pendentes = [], refetch, isLoading } = useQuery({
    queryKey: ['aprovacoes-pendentes'],
    queryFn: listAprovacoesPendentes,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
  const [motivo, setMotivo] = useState<Record<number, string>>({})

  const decidir = async (item: AprovacaoPendente, aprovar: boolean) => {
    try {
      if (aprovar) {
        await aprovarEtapa(item.processo_id, item.etapa_id)
      } else {
        const c = (motivo[item.processo_id] || '').trim()
        if (c.length < 3) { alert('Informe o motivo da reprovação'); return }
        await reprovarEtapa(item.processo_id, item.etapa_id, c)
        setMotivo(prev => ({ ...prev, [item.processo_id]: '' }))
      }
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['processos'] })
      refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao processar aprovação')
    }
  }

  const emAbertoDocs = (item: AprovacaoPendente) => {
    const itens = Object.fromEntries((item.checklist || []).map(i => [String(i.id), i]))
    return (item.documentos_exigidos || []).filter(d => !(itens[String(d.id)]?.anexo)).length
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">{pendentes.length} aprovação(ões) pendente(s)</div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando aprovações…</div>
      ) : pendentes.length === 0 ? (
        <div className="card-soft rounded-lg bg-card p-12 text-center text-sm text-muted-foreground">Nenhuma aprovação pendente. 🎉</div>
      ) : (
        <div className="space-y-3">
          {pendentes.map(item => (
            <div key={item.processo_id + item.etapa_id} className="card-soft rounded-lg bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.processo_titulo}</p>
                  <p className="text-xs text-muted-foreground">{item.cliente_nome}</p>
                  <p className="mt-1.5 text-xs text-foreground">
                    Etapa: <span className="font-medium text-amber-600">{item.etapa_titulo}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Solicitado por {item.solicitado_por || '—'} · {item.solicitado_em ? new Date(item.solicitado_em).toLocaleDateString('pt-BR') : ''}
                    {item.aprovador_nome ? ` · Aprovador: ${item.aprovador_nome}` : ''}
                  </p>
                  {item.documentos_exigidos.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Documentos: {item.checklist.filter(i => i.anexo).length}/{item.documentos_exigidos.length} anexados
                      {emAbertoDocs(item) > 0 && <span className="ml-1 text-amber-600">({emAbertoDocs(item)} pendente(s))</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => onOpen({ id: item.processo_id } as Processo)} className="rounded border border-border px-3 py-1.5 text-xs text-[#0078d4] hover:bg-muted">
                    Abrir processo
                  </button>
                  <button onClick={() => decidir(item, true)} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                    Aprovar
                  </button>
                  <button onClick={() => decidir(item, false)} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">
                    Reprovar
                  </button>
                </div>
              </div>
              <textarea
                value={motivo[item.processo_id] || ''}
                onChange={e => setMotivo(prev => ({ ...prev, [item.processo_id]: e.target.value }))}
                placeholder="Motivo da reprovação (obrigatório ao reprovar)"
                rows={2}
                className="mt-3 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
