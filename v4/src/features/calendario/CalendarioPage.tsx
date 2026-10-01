import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Loader2, Calendar as CalendarIcon, Video } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, addMonths, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Obrigacao, Reuniao, TarefaCal } from './api'
import { concluirObrigacao, concluirTarefa, concluirTarefaProjeto, excluirReuniao, listAllReunioes, listObrigacoes, listTarefasCal, listUsuariosReuniao, salvarReuniao } from './api'
import { useClientes } from '@/features/processos/hooks/useShared'
import { getProcesso, updateProcesso, uploadProcessoAnexo } from '@/features/processos/api'
import { getDependencyNames, getDisplayName, hasIncompleteSubtasks, hasUnmetDependencies, pedirAnexo, safeEtapas } from '@/features/processos/helpers'

type EventType = 'obrigacao' | 'tarefa' | 'reuniao'

interface CalEvent {
  id: string
  type: EventType
  date: string
  title: string
  subtitle: string
  status: string
  prioridade: string
  data: Obrigacao | TarefaCal | Reuniao
}

const STATUS_COLOR: Record<string, string> = {
  Concluida: '#10B981', Concluída: '#10B981', done: '#10B981', concluida: '#10B981',
  Pendente: '#ED6D40', pending: '#ED6D40',
  Atrasada: '#CB3500', atrasada: '#CB3500', blocked: '#CB3500',
  em_andamento: '#F59E0B',
}

const PRIO_BADGE: Record<string, string> = {
  Alta: 'bg-red-50 text-red-700',
  Média: 'bg-amber-50 text-amber-700',
  Media: 'bg-amber-50 text-amber-700',
  Baixa: 'bg-muted text-muted-foreground',
}

const STATUS_BADGE: Record<string, string> = {
  Concluida: 'bg-emerald-50 text-emerald-700', Concluída: 'bg-emerald-50 text-emerald-700', done: 'bg-emerald-50 text-emerald-700',
  Pendente: 'bg-amber-50 text-amber-700', pending: 'bg-amber-50 text-amber-700',
  Atrasada: 'bg-red-50 text-red-700', atrasada: 'bg-red-50 text-red-700', blocked: 'bg-red-50 text-red-700',
  em_andamento: 'bg-blue-50 text-blue-700',
}

function getDateKey(d: string | null | undefined): string | null {
  if (!d) return null
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return null
    return format(dt, 'yyyy-MM-dd')
  } catch {
    return null
  }
}

function getTarefaDate(t: TarefaCal): string | null {
  return t.vencimento_em || t.vencimento || t.due_date || t.created_at?.split('T')[0] || null
}

function getObrigacaoDate(o: Obrigacao, mode: 'meta' | 'vencimento'): string | null {
  return getDateKey(mode === 'meta' ? o.meta_interna_date : o.vencimento_legal_date)
}

export default function CalendarioPage() {
  const qc = useQueryClient()
  const [dateMode, setDateMode] = useState<'meta' | 'vencimento'>('meta')
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [justificando, setJustificando] = useState<TarefaCal | null>(null)
  const [fObrigacoes, setFObrigacoes] = useState(true)
  const [fTarefas, setFTarefas] = useState(true)
  const [fReunioes, setFReunioes] = useState(true)
  const [completing, setCompleting] = useState<{ ev: CalEvent; file: File | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showReuniaoModal, setShowReuniaoModal] = useState(false)
  const [editReuniao, setEditReuniao] = useState<Reuniao | null>(null)

  const { data: obrigacoes = [] } = useQuery({ queryKey: ['obrigacoes'], queryFn: listObrigacoes, staleTime: 30_000 })
  const { data: tarefas = [] } = useQuery({ queryKey: ['tarefas-completas'], queryFn: listTarefasCal, staleTime: 30_000 })
  const { data: reunioes = [] } = useQuery({ queryKey: ['reunioes'], queryFn: listAllReunioes, staleTime: 30_000 })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['obrigacoes'] })
    qc.invalidateQueries({ queryKey: ['tarefas-completas'] })
    qc.invalidateQueries({ queryKey: ['reunioes'] })
  }

  const allEvents: CalEvent[] = useMemo(() => {
    const evs: CalEvent[] = []
    for (const o of obrigacoes) {
      const d = getObrigacaoDate(o, dateMode)
      if (d) evs.push({ id: `ob-${o.id}`, type: 'obrigacao', date: d, title: o.titulo, subtitle: o.client_name, status: o.status, prioridade: o.prioridade, data: o })
    }
    for (const t of tarefas) {
      const d = getTarefaDate(t)
      if (d) evs.push({ id: `ta-${t.id}`, type: 'tarefa', date: d, title: t.titulo, subtitle: t.client_name || '', status: t.is_completed ? 'Concluida' : (t.status || 'Pendente'), prioridade: t.prioridade, data: t })
    }
    for (const r of reunioes) {
      const d = getDateKey(r.data)
      if (d) evs.push({ id: `re-${r.id}`, type: 'reuniao', date: d, title: r.titulo, subtitle: `${r.online ? 'Online' : (r.interna ? 'Interna' : (r.sala || 'Sala'))} · ${String(r.hora_inicio).slice(0, 5)}-${String(r.hora_fim).slice(0, 5)}`, status: '', prioridade: '', data: r })
    }
    return evs
  }, [obrigacoes, tarefas, reunioes, dateMode])

  const visible = (ev: CalEvent) => {
    if (ev.type === 'obrigacao' && !fObrigacoes) return false
    if (ev.type === 'tarefa' && !fTarefas) return false
    if (ev.type === 'reuniao' && !fReunioes) return false
    return true
  }

  const groupedByDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const ev of allEvents) {
      if (!m.has(ev.date)) m.set(ev.date, [])
      m.get(ev.date)!.push(ev)
    }
    return m
  }, [allEvents])

  // Grade mensal
  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    const days: Date[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d))
    return days
  }, [month])

  const monthEvents = allEvents.filter(ev => isSameMonth(parseISO(ev.date), month) && visible(ev))
  const total = monthEvents.length
  const concluidas = monthEvents.filter(ev => ['concluida', 'concluída', 'done'].includes((ev.status || '').toLowerCase())).length
  const pendentes = monthEvents.filter(ev => ['pendente', 'pending'].includes((ev.status || '').toLowerCase())).length
  const atrasadas = monthEvents.filter(ev => ['atrasada', 'blocked'].includes((ev.status || '').toLowerCase())).length

  const selectedEvents = (selectedDay ? groupedByDate.get(selectedDay) || [] : []).filter(visible)

  const handleCompleteObrigacao = async () => {
    if (!completing) return
    setSubmitting(true)
    try {
      await concluirObrigacao((completing.ev.data as Obrigacao).id, completing.file)
      setCompleting(null)
      setSelectedEvent(null)
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir obrigação')
    }
    setSubmitting(false)
  }

  /** Conclui uma etapa de processo respeitando dependências, subtarefas e documento exigido. */
  const completeProcessStep = async (pid: number, stepId: string) => {
    try {
      const processo = await getProcesso(pid)
      const etapas = safeEtapas(processo.etapas).map(e => ({ ...e }))
      const step = etapas.find(e => e.id === stepId)
      if (!step) { alert('Etapa não encontrada no processo.'); return }
      if (step.isCompleted) { invalidate(); setSelectedEvent(null); return }
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
      await updateProcesso(pid, {
        etapas,
        status: allDone ? 'Concluida' : 'em_execucao',
        etapa_atual: allDone ? step.title : (etapas.find(e => !e.isCompleted)?.title || step.title),
      })
      invalidate()
      setSelectedEvent(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir etapa do processo')
    }
  }

  /** Conclui uma tarefa de PROJETO (regra: vencida exige justificativa de atraso ≥ 50 caracteres). */
  const completeProjectTask = async (projeto_tarefa_id: number, justificativa?: string) => {
    try {
      await concluirTarefaProjeto(projeto_tarefa_id, justificativa)
      invalidate()
      setSelectedEvent(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir tarefa do projeto')
    }
  }

  const handleCompleteTarefa = async (ev: CalEvent) => {
    const t = ev.data as TarefaCal
    if (ev.type !== 'tarefa') return
    // Tarefa de PROCESSO: conclui a etapa via módulo de processos (valida dependências/documento)
    if (t.origem === 'processo' && t.processo_id && t.step_id) {
      await completeProcessStep(t.processo_id, t.step_id)
      return
    }
    // Tarefa de PROJETO: vencida exige justificativa (modal replicado do módulo de projetos)
    if (t.origem === 'projeto' && t.projeto_tarefa_id) {
      const venc = getTarefaDate(t)
      const hoje = new Date().toISOString().slice(0, 10)
      if (venc && venc.slice(0, 10) < hoje) {
        setJustificando(t)
        return
      }
      await completeProjectTask(t.projeto_tarefa_id)
      return
    }
    // Tarefa clássica (numérica)
    if (!/^\d+$/.test(String(t.id))) {
      alert('Essa tarefa pertence a um processo/projeto. Conclua-a no módulo correspondente.')
      return
    }
    setSubmitting(true)
    try {
      await concluirTarefa(Number(t.id))
      setCompleting(null)
      setSelectedEvent(null)
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir tarefa')
    }
    setSubmitting(false)
  }

  const handleDeleteReuniao = async (id: number) => {
    if (!confirm('Excluir esta reunião?')) return
    try {
      await excluirReuniao(id)
      setSelectedEvent(null)
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir reunião')
    }
  }

  // Fecha o painel lateral com Esc
  useEffect(() => {
    if (!selectedEvent && !justificando) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedEvent(null); setJustificando(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedEvent, justificando])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendário</h1>
          <p className="mt-1 text-sm text-muted-foreground">Obrigações, tarefas e reuniões</p>
        </div>
        <button
          onClick={() => { setEditReuniao(null); setShowReuniaoModal(true) }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
        >
          <Video className="h-4 w-4" />
          Nova Reunião
        </button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total do Mês', value: total, cls: 'text-[#5C939F]' },
          { label: 'Concluídas', value: concluidas, cls: 'text-emerald-600' },
          { label: 'Pendentes', value: pendentes, cls: 'text-amber-600' },
          { label: 'Atrasadas', value: atrasadas, cls: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="card-soft rounded-lg bg-card p-4">
            <div className={`text-xs font-medium ${c.cls}`}>{c.label}</div>
            <div className="mt-1 text-xl font-bold text-foreground">{c.value.toLocaleString('pt-BR')}</div>
          </div>
        ))}
      </div>

      {/* Barra de modos e filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex gap-1">
          {(['meta', 'vencimento'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setDateMode(m); setSelectedDay(null); setSelectedEvent(null) }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                dateMode === m ? 'bg-[#0078d4]/15 text-[#0078d4]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'meta' ? 'Meta Interna' : 'Vencimento Legal'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {[
            { label: 'Obrigações', checked: fObrigacoes, set: setFObrigacoes },
            { label: 'Tarefas', checked: fTarefas, set: setFTarefas },
            { label: 'Reuniões', checked: fReunioes, set: setFReunioes },
          ].map(f => (
            <label key={f.label} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={f.checked} onChange={e => f.set(e.target.checked)} className="h-4 w-4 accent-[#0078d4]" />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Calendário (50%) + Painel de eventos */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Grade mensal ── */}
        <div className="card-soft rounded-lg bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold capitalize text-foreground">{format(month, 'MMMM yyyy', { locale: ptBR })}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth(addMonths(month, -1))} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setMonth(new Date())} className="rounded-md px-2 py-1 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
                Hoje
              </button>
              <button onClick={() => setMonth(addMonths(month, 1))} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border/60 pb-2 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((d, i) => {
              const key = format(d, 'yyyy-MM-dd')
              const dayEvents = (groupedByDate.get(key) || []).filter(visible)
              const inMonth = isSameMonth(d, month)
              const today = isToday(d)
              const selected = selectedDay === key
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(selected ? null : key)}
                  className={`min-h-[72px] cursor-pointer border-b border-r border-border/30 p-1.5 transition-colors last:border-r-0 hover:bg-muted/40 ${
                    selected ? 'bg-[#0078d4]/10' : ''
                  } ${today ? 'ring-1 ring-inset ring-[#0078d4]' : ''} ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <div className={`text-right text-xs ${today ? 'font-bold text-[#0078d4]' : 'text-muted-foreground'}`}>{format(d, 'd')}</div>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id} className="flex items-center gap-1 overflow-hidden">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{
                            backgroundColor: ev.type === 'reuniao' ? '#8B5CF6' : (STATUS_COLOR[ev.status || ''] || '#535353'),
                          }} />
                          <span className="truncate text-[9px] text-muted-foreground">{ev.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3">
            <Legend color="#10B981" label="Concluída" />
            <Legend color="#ED6D40" label="Pendente" />
            <Legend color="#CB3500" label="Atrasada" />
            <Legend color="#8B5CF6" label="Reunião" />
          </div>
        </div>

        {/* ── Painel lateral: eventos do dia ── */}
        <div className="card-soft flex flex-col rounded-lg bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {selectedDay ? format(parseISO(selectedDay), "EEEE, dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
              </h3>
              <p className="text-xs text-muted-foreground">{selectedEvents.length} evento(s)</p>
            </div>
            {selectedDay && (
              <button onClick={() => { setSelectedDay(null); setSelectedEvent(null) }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[520px] flex-1 space-y-2 overflow-y-auto p-3">
            {!selectedDay && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                Clique em um dia para ver obrigações, tarefas e reuniões.
              </div>
            )}
            {selectedDay && selectedEvents.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Nenhum evento neste dia.</div>
            )}
            {selectedEvents.map(ev => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className="cursor-pointer rounded-lg border border-border bg-background p-3 transition-colors hover:border-[#0078d4]/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium leading-tight text-foreground">{ev.title}</span>
                  <TypeBadge type={ev.type} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{ev.subtitle}</div>
                {(ev.type === 'obrigacao' || ev.type === 'tarefa') && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${PRIO_BADGE[ev.prioridade || 'Média'] || PRIO_BADGE['Média']}`}>{ev.prioridade || '-'}</span>
                    {ev.status && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[ev.status] || STATUS_BADGE['Pendente']}`}>{ev.status}</span>
                    )}
                  </div>
                )}
                <div className="mt-1.5 text-[10px] text-muted-foreground">{eventMeta(ev)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel lateral (drawer): detalhes do evento ── */}
      {selectedEvent && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200" onClick={() => setSelectedEvent(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <TypeBadge type={selectedEvent.type} />
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {selectedEvent.type === 'obrigacao' ? 'Obrigação' : selectedEvent.type === 'tarefa' ? 'Tarefa' : 'Reunião'}
                  </span>
                </div>
                <h3 className="truncate text-sm font-semibold text-foreground">{selectedEvent.title}</h3>
                <p className="text-xs text-muted-foreground">{selectedEvent.subtitle}</p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {(selectedEvent.type === 'obrigacao' || selectedEvent.type === 'tarefa') && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-2 py-0.5 text-[10px] ${PRIO_BADGE[selectedEvent.prioridade || 'Média'] || PRIO_BADGE['Média']}`}>
                    {selectedEvent.prioridade || '-'}
                  </span>
                  {selectedEvent.status && (
                    <span className={`rounded px-2 py-0.5 text-[10px] ${STATUS_BADGE[selectedEvent.status] || STATUS_BADGE['Pendente']}`}>
                      {selectedEvent.status}
                    </span>
                  )}
                </div>
              )}

              {selectedEvent.type === 'obrigacao' && <ObrigacaoDetalhes ob={selectedEvent.data as Obrigacao} />}
              {selectedEvent.type === 'tarefa' && <TarefaDetalhes t={selectedEvent.data as TarefaCal} />}
              {selectedEvent.type === 'reuniao' && <ReuniaoDetalhes r={selectedEvent.data as Reuniao} />}

              {/* Ações */}
              {selectedEvent.type === 'obrigacao' && (
                (selectedEvent.status === 'Concluida' || selectedEvent.status === 'Concluída') ? (
                  <div className="w-full rounded-md bg-emerald-50 py-2 text-center text-xs font-medium text-emerald-600">Concluída ✓</div>
                ) : (
                  <button
                    onClick={() => setCompleting({ ev: selectedEvent, file: null })}
                    className="w-full rounded-md bg-emerald-600 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    Concluir Obrigação
                  </button>
                )
              )}

              {selectedEvent.type === 'tarefa' && (
                (selectedEvent.data as TarefaCal).is_completed ? (
                  <div className="w-full rounded-md bg-emerald-50 py-2 text-center text-xs font-medium text-emerald-600">Concluída ✓</div>
                ) : (
                  <button
                    onClick={() => handleCompleteTarefa(selectedEvent)}
                    disabled={submitting || !!((selectedEvent.data as TarefaCal).blocked_by && (selectedEvent.data as TarefaCal).blocked_by!.length)}
                    className="w-full rounded-md bg-emerald-600 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {submitting ? 'Concluindo...' : 'Concluir Tarefa'}
                  </button>
                )
              )}

              {selectedEvent.type === 'reuniao' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditReuniao(selectedEvent.data as Reuniao); setShowReuniaoModal(true) }}
                    className="flex-1 rounded-md border border-[#0078d4]/30 bg-[#0078d4]/10 py-2 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteReuniao((selectedEvent.data as Reuniao).id)}
                    className="flex-1 rounded-md border border-red-400/30 bg-red-50 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Modal justificativa de atraso (tarefa de projeto vencida) */}
      {justificando && (
        <JustificativaModal
          onClose={() => setJustificando(null)}
          onConfirm={async just => {
            const tid = justificando.projeto_tarefa_id
            setJustificando(null)
            if (!tid) return
            await completeProjectTask(tid, just)
          }}
        />
      )}

      {/* Modal concluir obrigação */}
      {completing && (
        <ConcluirModal
          ev={completing.ev}
          file={completing.file}
          submitting={submitting}
          onFile={f => setCompleting({ ...completing, file: f })}
          onConfirm={() => (completing.ev.type === 'obrigacao' ? handleCompleteObrigacao() : handleCompleteTarefa(completing.ev))}
          onCancel={() => { if (!submitting) setCompleting(null) }}
        />
      )}

      {/* Modal reunião */}
      {showReuniaoModal && (
        <ReuniaoModal
          reuniao={editReuniao}
          onClose={() => { setShowReuniaoModal(false); setEditReuniao(null) }}
          onSaved={() => { setShowReuniaoModal(false); setEditReuniao(null); setSelectedEvent(null); invalidate() }}
        />
      )}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function TypeBadge({ type }: { type: EventType }) {
  if (type === 'tarefa') return <span className="shrink-0 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-orange-600">Tarefa</span>
  if (type === 'reuniao') return <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-600">Reunião</span>
  return <span className="shrink-0 rounded bg-[#0078d4]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#0078d4]">Obrigação</span>
}

function eventMeta(ev: CalEvent): string {
  if (ev.type === 'obrigacao') {
    const o = ev.data as Obrigacao
    const partes = [o.responsavel_nome, o.departamento_nome].filter(Boolean)
    return partes.length ? partes.join(' · ') : 'Sem responsável'
  }
  if (ev.type === 'tarefa') {
    const t = ev.data as TarefaCal
    const origem = t.origem === 'processo' ? 'Processo' : t.origem === 'projeto' ? 'Projeto' : 'Pessoal'
    const partes = [origem, t.user_name, fmtBR(getTarefaDate(t))].filter(Boolean)
    return partes.join(' · ')
  }
  const r = ev.data as Reuniao
  return `${String(r.hora_inicio).slice(0, 5)}—${String(r.hora_fim).slice(0, 5)}${r.sala ? ` · ${r.sala}` : ''}`
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}

function DetailBlock({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-3">{children}</div>
}

function fmtBR(d: string | null | undefined) {
  if (!d) return '-'
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('pt-BR')
  } catch {
    return '-'
  }
}

function ObrigacaoDetalhes({ ob }: { ob: Obrigacao }) {
  return (
    <>
      <DetailBlock>
        <DetailRow label="Cliente" value={ob.client_name || '-'} />
        {ob.departamento_nome && <DetailRow label="Departamento" value={ob.departamento_nome} />}
        <DetailRow label="Responsável" value={ob.responsavel_nome || '-'} />
        <DetailRow label="Valor" value={ob.valor_total != null ? `R$ ${ob.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'} />
        <DetailRow label="Meta Interna" value={fmtBR(ob.meta_interna_date)} />
        <DetailRow label="Venc. Legal" value={fmtBR(ob.vencimento_legal_date)} />
        {ob.concluida_em && <DetailRow label="Concluída em" value={fmtBR(ob.concluida_em)} />}
      </DetailBlock>
      {ob.documento_requerido && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
          Documento requerido para conclusão — anexe um PDF antes de concluir.
        </div>
      )}
    </>
  )
}

function TarefaDetalhes({ t }: { t: TarefaCal }) {
  const origem = t.origem === 'processo' ? 'Processo' : t.origem === 'projeto' ? 'Projeto' : 'Pessoal'
  const data = getTarefaDate(t)
  const key = getDateKey(data)
  const hoje = new Date().toISOString().slice(0, 10)
  const atrasada = !!key && !t.is_completed && key < hoje
  return (
    <>
      <DetailBlock>
        <DetailRow label="Origem" value={origem} />
        <DetailRow label="Cliente" value={t.client_name || '-'} />
        {t.user_name && <DetailRow label="Responsável" value={t.user_name} />}
        {t.departamento_nome && <DetailRow label="Departamento" value={t.departamento_nome} />}
        <DetailRow label="Vencimento" value={<span className={atrasada ? 'font-medium text-rose-600' : ''}>{fmtBR(data)}</span>} />
        <DetailRow label="Criada em" value={fmtBR(t.created_at)} />
      </DetailBlock>
      {t.descricao && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Descrição</div>
          <p className="text-xs leading-relaxed text-foreground">{t.descricao}</p>
        </div>
      )}
      {t.blocked_by && t.blocked_by.length > 0 && (
        <div className="rounded-lg border border-rose-500/10 bg-rose-50 p-2">
          <div className="mb-0.5 text-[10px] font-medium text-rose-700">Bloqueado por</div>
          <div className="text-xs text-foreground">{t.blocked_by.join(', ')}</div>
        </div>
      )}
      {t.origem === 'processo' && t.subtasks && t.subtasks.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subtarefas</div>
          <ul className="space-y-1">
            {t.subtasks.map(st => (
              <li key={st.id} className={`flex items-center gap-1.5 text-xs ${st.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {st.title || 'Subtarefa'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function ReuniaoDetalhes({ r }: { r: Reuniao }) {
  return (
    <DetailBlock>
      {r.descricao && <DetailRow label="Descrição" value={r.descricao} />}
      {r.cliente_nome && <DetailRow label="Cliente" value={r.cliente_nome} />}
      <DetailRow label="Formato" value={r.online ? 'Reunião online' : (r.interna ? 'Interna' : 'Presencial')} />
      <DetailRow label="Local" value={r.online ? '—' : (r.sala || '-')} />
      <DetailRow label="Horário" value={`${String(r.hora_inicio).slice(0, 5)} — ${String(r.hora_fim).slice(0, 5)}`} />
      {r.criado_por_nome && <DetailRow label="Criada por" value={r.criado_por_nome} />}
      {r.participantes && r.participantes.length > 0 && (
        <DetailRow label="Participantes" value={r.participantes.map(p => p.display_name).join(', ')} />
      )}
    </DetailBlock>
  )
}

function JustificativaModal({ onClose, onConfirm }: {
  onClose: () => void
  onConfirm: (just: string) => Promise<void>
}) {
  const [just, setJust] = useState('')
  const [saving, setSaving] = useState(false)
  const ok = just.trim().length >= 50
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Justificar atraso</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs text-muted-foreground">
            Esta tarefa está <b className="text-rose-600">VENCIDA</b>. Para concluí-la é necessário
            informar a justificativa do atraso (mínimo de <b>50 caracteres</b>).
          </p>
          <textarea
            value={just}
            onChange={e => setJust(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Descreva o motivo do atraso…"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <p className={`text-[11px] ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
            {just.trim().length}/50 caracteres {ok ? '· ok' : '· obrigatório'}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm(just); setSaving(false) }} disabled={!ok || saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">
            {saving ? 'Salvando…' : 'Concluir com justificativa'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConcluirModal({ ev, file, submitting, onFile, onConfirm, onCancel }: {
  ev: CalEvent
  file: File | null
  submitting: boolean
  onFile: (f: File | null) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const ob = ev.type === 'obrigacao' ? (ev.data as Obrigacao) : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Concluir {ev.type === 'obrigacao' ? 'Obrigação' : 'Tarefa'}</h3>
          <button onClick={onCancel} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs font-medium text-foreground">{ev.title}</div>
        <div className="mb-4 text-xs text-muted-foreground">{ev.subtitle}</div>
        {ob?.documento_requerido && (
          <div className="mb-4">
            <label className="mb-2 block text-xs text-muted-foreground">Anexar PDF (obrigatório)</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={e => onFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-[#0078d4]/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#0078d4] hover:file:bg-[#0078d4]/20"
            />
            {file && <div className="mt-1 text-[10px] text-[#0078d4]">{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onConfirm}
            disabled={submitting || (!!ob?.documento_requerido && !file)}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            {submitting ? 'Concluindo...' : 'Confirmar Conclusão'}
          </button>
          <button onClick={onCancel} disabled={submitting} className="rounded-lg border border-border px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal Reunião ── */

interface ReuniaoForm {
  titulo: string
  descricao: string
  data: string
  hora_inicio: string
  hora_fim: string
  cliente_id: string
  sala: string
  interna: boolean
  online: boolean
  participantes: number[]
}

function ReuniaoModal({ reuniao, onClose, onSaved }: { reuniao: Reuniao | null; onClose: () => void; onSaved: () => void }) {
  const { data: clientes = [] } = useClientes()
  const { data: usuarios = [] } = useQuery({ queryKey: ['reuniao-usuarios'], queryFn: listUsuariosReuniao, staleTime: 2 * 60_000 })
  const [form, setForm] = useState<ReuniaoForm>({
    titulo: reuniao?.titulo || '',
    descricao: reuniao?.descricao || '',
    data: reuniao?.data || format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: reuniao ? String(reuniao.hora_inicio).slice(0, 5) : '08:00',
    hora_fim: reuniao ? String(reuniao.hora_fim).slice(0, 5) : '09:00',
    cliente_id: reuniao?.cliente_id ? String(reuniao.cliente_id) : '',
    sala: reuniao?.sala || '',
    interna: !!reuniao?.interna,
    online: !!reuniao?.online,
    participantes: reuniao?.participantes.map(p => p.id) || [],
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [recorrenciaOn, setRecorrenciaOn] = useState(false)
  const [recFrequencia, setRecFrequencia] = useState('semanal')
  const [recDiaSemana, setRecDiaSemana] = useState('0')
  const [recDiaMes, setRecDiaMes] = useState('1')
  const [recOrdinal, setRecOrdinal] = useState('1')
  const [recVezes, setRecVezes] = useState('4')

  const handleSubmit = async () => {
    setError('')
    if (!form.titulo.trim()) { setError('Título obrigatório'); return }
    if (!form.data) { setError('Data obrigatória'); return }
    if (form.hora_inicio >= form.hora_fim) { setError('Horário fim deve ser depois do início'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        sala: form.sala,
        interna: form.interna,
        online: form.online,
        participantes: form.participantes,
      }
      if (recorrenciaOn && !reuniao) {
        const r: Record<string, unknown> = { frequencia: recFrequencia, intervalo: 1, vezes: Number(recVezes) || 0 }
        if (recFrequencia === 'semanal') r.dia_semana = Number(recDiaSemana)
        if (recFrequencia === 'mensal_dia') r.dia_mes = Number(recDiaMes)
        if (recFrequencia === 'mensal_ordinal') {
          r.ordinal = Number(recOrdinal)
          r.dia_semana = Number(recDiaSemana)
        }
        payload.recorrencia = r
      }
      await salvarReuniao(payload, reuniao?.id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar reunião')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{reuniao ? 'Editar Reunião' : 'Nova Reunião'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data *</label>
              <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Início *</label>
              <input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Fim *</label>
              <input type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
              <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} className={inputCls}>
                <option value="">Sem cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Onde acontece</label>
              <select
                value={form.sala}
                onChange={e => setForm(f => ({ ...f, sala: e.target.value }))}
                disabled={form.online}
                className={inputCls + (form.online ? ' opacity-50' : '')}
              >
                <option value="">Sem local</option>
                <option value="Sala de Reunião">Sala de Reunião</option>
                <option value="Empresa Cliente">Empresa Cliente</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40">
              <input
                type="checkbox"
                checked={form.online}
                onChange={e => setForm(f => ({ ...f, online: e.target.checked, sala: e.target.checked ? '' : f.sala }))}
                className="h-4 w-4 rounded accent-[#0078d4]"
              />
              <span>
                <span className="block text-xs font-medium text-foreground">Reunião online</span>
                <span className="block text-[10px] text-muted-foreground">
                  Não disputa a sala — pode haver várias no mesmo horário com participantes diferentes
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40">
              <input
                type="checkbox"
                checked={form.interna}
                onChange={e => setForm(f => ({ ...f, interna: e.target.checked }))}
                className="h-4 w-4 rounded accent-[#0078d4]"
              />
              <span>
                <span className="block text-xs font-medium text-foreground">Reunião interna</span>
                <span className="block text-[10px] text-muted-foreground">
                  Sem cliente externo — não disputa a sala de reunião
                </span>
              </span>
            </label>
          </div>
          {!reuniao && (
            <div className="rounded-lg border border-border/60 p-3">
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={recorrenciaOn}
                  onChange={e => setRecorrenciaOn(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0078d4]"
                />
                Repetir esta reunião
              </label>
              {recorrenciaOn && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Repetir</label>
                      <select value={recFrequencia} onChange={e => setRecFrequencia(e.target.value)} className={inputCls}>
                        <option value="semanal">Toda semana</option>
                        <option value="mensal_dia">Todo dia {recDiaMes} do mês</option>
                        <option value="mensal_ordinal">Dia específico do mês</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Quantas vezes</label>
                      <input type="number" min="1" max="60" value={recVezes} onChange={e => setRecVezes(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {recFrequencia === 'semanal' && (
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Dia da semana</label>
                      <select value={recDiaSemana} onChange={e => setRecDiaSemana(e.target.value)} className={inputCls}>
                        <option value="0">Segunda-feira</option>
                        <option value="1">Terça-feira</option>
                        <option value="2">Quarta-feira</option>
                        <option value="3">Quinta-feira</option>
                        <option value="4">Sexta-feira</option>
                        <option value="5">Sábado</option>
                        <option value="6">Domingo</option>
                      </select>
                    </div>
                  )}
                  {recFrequencia === 'mensal_dia' && (
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Dia do mês</label>
                      <input type="number" min="1" max="28" value={recDiaMes} onChange={e => setRecDiaMes(e.target.value)} className={inputCls} />
                    </div>
                  )}
                  {recFrequencia === 'mensal_ordinal' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Posição</label>
                        <select value={recOrdinal} onChange={e => setRecOrdinal(e.target.value)} className={inputCls}>
                          <option value="1">Primeira</option>
                          <option value="2">Segunda</option>
                          <option value="3">Terceira</option>
                          <option value="4">Quarta</option>
                          <option value="-1">Última</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Dia da semana</label>
                        <select value={recDiaSemana} onChange={e => setRecDiaSemana(e.target.value)} className={inputCls}>
                          <option value="0">Segunda-feira</option>
                          <option value="1">Terça-feira</option>
                          <option value="2">Quarta-feira</option>
                          <option value="3">Quinta-feira</option>
                          <option value="4">Sexta-feira</option>
                          <option value="5">Sábado</option>
                          <option value="6">Domingo</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Participantes</label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background p-3">
              {usuarios.length === 0 && <div className="py-2 text-center text-xs text-muted-foreground">Nenhum usuário disponível</div>}
              {usuarios.map(u => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 text-xs text-foreground transition-colors hover:text-[#0078d4]">
                  <input
                    type="checkbox"
                    checked={form.participantes.includes(u.id)}
                    onChange={() => setForm(f => ({
                      ...f,
                      participantes: f.participantes.includes(u.id) ? f.participantes.filter(id => id !== u.id) : [...f.participantes, u.id],
                    }))}
                    className="h-4 w-4 rounded accent-[#0078d4]"
                  />
                  {u.display_name}
                </label>
              ))}
            </div>
            {form.participantes.length > 0 && (
              <div className="mt-1 text-[10px] text-muted-foreground">{form.participantes.length} participante(s) — serão notificados</div>
            )}
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          {reuniao && (
            <button
              onClick={() => {
                const msg = (reuniao as Reuniao)?.serie_id
                  ? 'Esta reunião faz parte de uma série recorrente. Excluir todas as ocorrências?\n\nOK = todas · Cancelar = só esta'
                  : 'Excluir esta reunião?'
                if (!confirm(msg)) return
                const toda = !!(reuniao as Reuniao)?.serie_id
                excluirReuniao(reuniao.id, toda).then(onSaved)
              }}
              className="mr-auto rounded-lg border border-red-400/30 px-4 py-2 text-xs text-red-600 transition-colors hover:bg-red-50"
            >
              Excluir
            </button>
          )}
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Salvando...' : reuniao ? 'Salvar' : 'Criar Reunião'}
          </button>
        </div>
      </div>
    </div>
  )
}
