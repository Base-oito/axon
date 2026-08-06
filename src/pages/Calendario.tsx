import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

type Obrigacao = {
  id: number
  titulo: string
  client_name: string
  status: string
  prioridade: string
  meta_interna_date: string | null
  vencimento_legal_date: string | null
  departamento_nome: string
  responsavel_nome: string
  valor_total: number | null
  documento_requerido: boolean
  cliente_id: number
  arquivo_path: string | null
}

type Tarefa = {
  id: number
  titulo: string
  client_name?: string
  status: string
  prioridade: string
  vencimento_em?: string | null
  due_date?: string | null
  created_at: string
  user_name?: string
  departamento_nome?: string
}

type CalendarEvent = {
  id: string
  type: 'obrigacao' | 'tarefa'
  date: string
  title: string
  subtitle: string
  status: string
  prioridade: string
  data: Obrigacao | Tarefa
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('nfse_token')
    if (!raw) return null
    try { const p = JSON.parse(raw); if (p.access_token) return p.access_token } catch {}
    if (raw.split('.').length === 3) return raw
    return null
  } catch { return null }
}

function formatDateBR(d: string | null): string {
  if (!d) return '-'
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('pt-BR')
  } catch { return '-' }
}

function getDateKey(d: string | null): string | null {
  if (!d) return null
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch { return null }
}

function getTarefaDate(t: Tarefa): string | null {
  return t.vencimento_em || t.due_date || t.created_at?.split('T')[0] || null
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const DAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

const STATUS_DOT: Record<string, string> = {
  Concluida: '#59A993', Concluída: '#59A993',
  Pendente: '#ED6D40', Atrasada: '#CB3500',
  concluida: '#59A993', pending: '#ED6D40',
  em_andamento: '#F59E0B', blocked: '#CB3500', done: '#59A993',
}

const STATUS_BADGE: Record<string, string> = {
  Concluida: 'bg-success/10 text-success', Concluída: 'bg-success/10 text-success',
  Pendente: 'bg-infrared/10 text-infrared', Atrasada: 'bg-danger/10 text-danger',
  concluida: 'bg-success/10 text-success', pending: 'bg-infrared/10 text-infrared',
  em_andamento: 'bg-amber-500/10 text-amber-500', blocked: 'bg-danger/10 text-danger', done: 'bg-success/10 text-success',
}

const PRIORITY_BADGE: Record<string, string> = {
  Alta: 'bg-danger/10 text-danger',
  Média: 'bg-infrared/10 text-infrared',
  Media: 'bg-infrared/10 text-infrared',
  Baixa: 'bg-pulse-ash/10 text-pulse-ash',
}

export default function Calendario() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [dateMode, setDateMode] = useState<'meta' | 'vencimento'>('meta')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterObrigacoes, setFilterObrigacoes] = useState(true)
  const [filterTarefas, setFilterTarefas] = useState(true)
  const [completing, setCompleting] = useState<{ ev: CalendarEvent; uploading: boolean } | null>(null)
  const [completeFile, setCompleteFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function getUserId(): number | null {
    try {
      const t = getToken()
      if (!t) return null
      const p = JSON.parse(atob(t.split('.')[1]))
      return p.sub ? Number(p.sub) : null
    } catch { return null }
  }

  const handleCompleteTask = async (ev: CalendarEvent) => {
    const t = getToken()
    if (!t) return
    setSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const r = await fetch(`/api/tarefas/${ev.data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ concluida_em: today }),
      })
      if (!r.ok) throw new Error('Erro ao concluir tarefa')
      setCompleting(null)
      refreshData()
    } catch (e: any) {
      alert(e.message || 'Erro ao concluir tarefa')
    } finally { setSubmitting(false) }
  }

  const handleCompleteObrigacao = async () => {
    if (!completing) return
    const t = getToken()
    if (!t) return
    setSubmitting(true)
    try {
      const ob = completing.ev.data as Obrigacao
      const userId = getUserId()
      const body: Record<string, any> = {
        status: 'Concluida',
        concluida_em: new Date().toISOString(),
        concluido_por: userId,
      }
      if (completeFile) {
        const fd = new FormData()
        fd.append('file', completeFile)
        const uploadRes = await fetch(`/api/obrigacoes/${ob.id}/upload`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + t },
          body: fd,
        })
        if (!uploadRes.ok) throw new Error('Erro ao fazer upload do arquivo')
        const uploadData = await uploadRes.json()
        body.arquivo_path = uploadData.path
      }
      const r = await fetch(`/api/obrigacoes/${ob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Erro ao concluir obrigação')
      setCompleting(null)
      setCompleteFile(null)
      refreshData()
    } catch (e: any) {
      alert(e.message || 'Erro ao concluir obrigação')
    } finally { setSubmitting(false) }
  }

  const refreshData = () => {
    const t = getToken()
    if (!t) return
    Promise.all([
      fetch('/api/obrigacoes', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
      fetch('/api/tarefas-completas', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
    ]).then(([o, ta]) => {
      setObrigacoes(Array.isArray(o) ? o : [])
      setTarefas(Array.isArray(ta) ? ta : [])
    }).catch(() => {})
  }

  // role-based filtering can be added here: const role = getUserRole()

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    Promise.all([
      fetch('/api/obrigacoes', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
      fetch('/api/tarefas-completas', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
    ]).then(([o, ta]) => {
      setObrigacoes(Array.isArray(o) ? o : [])
      setTarefas(Array.isArray(ta) ? ta : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [navigate])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const dateField = dateMode === 'meta' ? 'meta_interna_date' : 'vencimento_legal_date'

  const allEvents: CalendarEvent[] = []
  for (const o of obrigacoes) {
    const d = getDateKey((o as any)[dateField] || null)
    if (d) allEvents.push({ id: `ob-${o.id}`, type: 'obrigacao', date: d, title: o.titulo, subtitle: o.client_name, status: o.status, prioridade: o.prioridade, data: o })
  }
  for (const t of tarefas) {
    const d = getDateKey(getTarefaDate(t))
    if (d) allEvents.push({ id: `ta-${t.id}`, type: 'tarefa', date: d, title: t.titulo, subtitle: t.client_name || '', status: t.status, prioridade: t.prioridade, data: t })
  }

  const groupedByDate = new Map<string, CalendarEvent[]>()
  for (const ev of allEvents) {
    if (!groupedByDate.has(ev.date)) groupedByDate.set(ev.date, [])
    groupedByDate.get(ev.date)!.push(ev)
  }

  const monthEvents = allEvents.filter(ev => {
    const [y, m] = ev.date.split('-').map(Number)
    return y === year && (m - 1) === month
  })

  const filteredMonthEvents = monthEvents.filter(ev => {
    if (ev.type === 'obrigacao' && !filterObrigacoes) return false
    if (ev.type === 'tarefa' && !filterTarefas) return false
    return true
  })

  const total = filteredMonthEvents.length
  const concluidas = filteredMonthEvents.filter(ev => {
    const s = (ev.status || '').toLowerCase()
    return s === 'concluida' || s === 'concluída' || s === 'done' || s === 'concluido'
  }).length
  const pendentes = filteredMonthEvents.filter(ev => {
    const s = (ev.status || '').toLowerCase()
    return s === 'pendente' || s === 'pending'
  }).length
  const atrasadas = filteredMonthEvents.filter(ev => {
    const s = (ev.status || '').toLowerCase()
    return s === 'atrasada' || s === 'blocked'
  }).length

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDow = firstDay.getDay()

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const weeks: (string | null)[][] = []
  let day = 1
  for (let w = 0; w < 6; w++) {
    const week: (string | null)[] = []
    for (let d = 0; d < 7; d++) {
      if ((w === 0 && d < startDow) || day > daysInMonth) week.push(null)
      else { week.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); day++ }
    }
    weeks.push(week)
  }
  while (weeks.length > 0 && weeks[weeks.length - 1].every(c => c === null)) weeks.pop()

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

  const selectedEvents = selectedDay ? (groupedByDate.get(selectedDay) || []).filter(ev => {
    if (ev.type === 'obrigacao' && !filterObrigacoes) return false
    if (ev.type === 'tarefa' && !filterTarefas) return false
    return true
  }) : []

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id)

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/calendario" />

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Calendário</h1>
                <p className="text-pulse-ash text-sm">Obrigações, tarefas e eventos</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-urban-smoke mb-6">
              <div className="flex gap-1">
                <button onClick={() => { setDateMode('meta'); setSelectedDay(null); setExpandedId(null) }}
                  className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                    dateMode === 'meta' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'}`}>
                  Meta Interna
                </button>
                <button onClick={() => { setDateMode('vencimento'); setSelectedDay(null); setExpandedId(null) }}
                  className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                    dateMode === 'vencimento' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'}`}>
                  Vencimento Legal
                </button>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filterObrigacoes} onChange={e => setFilterObrigacoes(e.target.checked)}
                    className="accent-electric-teal" />
                  <span className="text-xs text-pulse-ash tracking-wider">Obrigações</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filterTarefas} onChange={e => setFilterTarefas(e.target.checked)}
                    className="accent-electric-teal" />
                  <span className="text-xs text-pulse-ash tracking-wider">Tarefas</span>
                </label>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-pulse-ash text-sm">Carregando calendário...</div>
              </div>
            )}

            {!loading && (
              <>
                <div className="grid grid-cols-4 gap-5 mb-8">
                  <SummaryCard value={total} label="Total do Mês" color="#5C939F" />
                  <SummaryCard value={concluidas} label="Concluídas" color="#59A993" />
                  <SummaryCard value={pendentes} label="Pendentes" color="#ED6D40" />
                  <SummaryCard value={atrasadas} label="Atrasadas" color="#CB3500" />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <button onClick={prevMonth}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-pulse-ash hover:text-off-white hover:bg-urban-smoke transition-all text-xl">‹</button>
                  <h2 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>{MONTHS[month]} {year}</h2>
                  <button onClick={nextMonth}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-pulse-ash hover:text-off-white hover:bg-urban-smoke transition-all text-xl">›</button>
                </div>

                <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-urban-smoke">
                    {DAY_HEADERS.map(dh => (
                      <div key={dh} className="py-3 text-center text-xs tracking-wider text-pulse-ash">{dh}</div>
                    ))}
                  </div>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 border-b border-urban-smoke last:border-b-0">
                      {week.map((dateKey, di) => {
                        const isToday = dateKey === todayKey
                        const isSelected = dateKey === selectedDay
                        const dayEvents = dateKey ? (groupedByDate.get(dateKey) || []).filter(ev => {
                          if (ev.type === 'obrigacao' && !filterObrigacoes) return false
                          if (ev.type === 'tarefa' && !filterTarefas) return false
                          return true
                        }) : []
                        const dayNum = dateKey ? parseInt(dateKey.split('-')[2]) : null
                        return (
                          <div key={di} onClick={() => dateKey && setSelectedDay(selectedDay === dateKey ? null : dateKey)}
                            className={`min-h-[80px] p-2 border-r border-urban-smoke last:border-r-0 cursor-pointer transition-colors hover:bg-urban-smoke/30 ${
                              isSelected ? 'bg-electric-teal/10' : ''
                            } ${isToday ? 'ring-1 ring-electric-teal ring-inset' : ''} ${!dateKey ? 'pointer-events-none' : ''}`}>
                            {dayNum && <div className={`text-xs mb-1.5 ${isToday ? 'text-electric-teal font-bold' : 'text-off-white'}`}>{dayNum}</div>}
                            {dayEvents.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {dayEvents.map(ev => (
                                  <span key={ev.id} className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: STATUS_DOT[ev.status || ''] || (ev.type === 'tarefa' ? '#F97316' : '#535353') }}
                                    title={`${ev.type === 'obrigacao' ? '' : '[Tarefa] '}${ev.title} - ${ev.status || 'Pendente'}`} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-6 mt-4 pb-8">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success" />
                    <span className="text-xs text-pulse-ash tracking-wider">Concluída</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ED6D40' }} />
                    <span className="text-xs text-pulse-ash tracking-wider">Pendente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                    <span className="text-xs text-pulse-ash tracking-wider">Atrasada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F97316' }} />
                    <span className="text-xs text-pulse-ash tracking-wider">Tarefa</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedDay && (
          <aside className="w-96 shrink-0 bg-rich-carbon border-l border-urban-smoke flex flex-col">
            <div className="p-4 border-b border-urban-smoke flex items-center justify-between">
              <div>
                <h3 className="text-sm font-roc" style={{ fontWeight: 500 }}>
                  {(() => { const p = selectedDay.split('-').map(Number); return `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}` })()}
                </h3>
                <p className="text-xs text-pulse-ash">{selectedEvents.length} evento(s)</p>
              </div>
              <button onClick={() => { setSelectedDay(null); setExpandedId(null) }}
                className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedEvents.length === 0 && (
                <div className="text-center py-8 text-pulse-ash text-xs">Nenhum evento neste dia.</div>
              )}
              {selectedEvents.map(ev => (
                <div key={ev.id} onClick={() => toggleExpand(ev.id)}
                  className="bg-core-black border border-urban-smoke rounded-lg p-3 cursor-pointer hover:border-electric-teal/30 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-off-white leading-tight">{ev.title}</span>
                    {ev.type === 'tarefa' && <span className="text-[10px] text-orange-400 uppercase shrink-0">Tarefa</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-pulse-ash">{ev.subtitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs tracking-wider ${PRIORITY_BADGE[ev.prioridade || 'Média'] || PRIORITY_BADGE['Média']}`}>{ev.prioridade || '-'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs tracking-wider ${STATUS_BADGE[ev.status || 'Pendente'] || STATUS_BADGE['Pendente']}`}>{ev.status || 'Pendente'}</span>
                  </div>
                  {expandedId === ev.id && ev.type === 'obrigacao' && (
                    <div className="mt-3 pt-3 border-t border-urban-smoke space-y-1.5">
                      {(ev.data as Obrigacao).departamento_nome && (
                        <div className="flex justify-between text-xs"><span className="text-pulse-ash">Departamento</span><span className="text-off-white">{(ev.data as Obrigacao).departamento_nome}</span></div>
                      )}
                      {(ev.data as Obrigacao).responsavel_nome && (
                        <div className="flex justify-between text-xs"><span className="text-pulse-ash">Responsável</span><span className="text-off-white">{(ev.data as Obrigacao).responsavel_nome}</span></div>
                      )}
                      {(ev.data as Obrigacao).valor_total != null && (
                        <div className="flex justify-between text-xs"><span className="text-pulse-ash">Valor</span><span className="text-off-white">R$ {(ev.data as Obrigacao).valor_total!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      )}
                      <div className="flex justify-between text-xs"><span className="text-pulse-ash">Meta Interna</span><span className="text-off-white">{formatDateBR((ev.data as Obrigacao).meta_interna_date)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-pulse-ash">Venc. Legal</span><span className="text-off-white">{formatDateBR((ev.data as Obrigacao).vencimento_legal_date)}</span></div>
                      {(ev.data as Obrigacao).documento_requerido && (
                        <div className="text-[10px] text-amber-400 mt-1">Documento requerido para conclusão</div>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setCompleting({ ev, uploading: false }); setCompleteFile(null) }}
                        className="w-full mt-2 py-1.5 rounded text-xs tracking-wider bg-[#59A993] text-white hover:bg-[#59A993]/80 transition-colors">
                        Concluir
                      </button>
                    </div>
                  )}
                  {expandedId === ev.id && ev.type === 'tarefa' && (
                    <div className="mt-3 pt-3 border-t border-urban-smoke space-y-1.5">
                      {(ev.data as Tarefa).user_name && (
                        <div className="flex justify-between text-xs"><span className="text-pulse-ash">Responsável</span><span className="text-off-white">{(ev.data as Tarefa).user_name}</span></div>
                      )}
                      {(ev.data as Tarefa).departamento_nome && (
                        <div className="flex justify-between text-xs"><span className="text-pulse-ash">Departamento</span><span className="text-off-white">{(ev.data as Tarefa).departamento_nome}</span></div>
                      )}
                      {getTarefaDate(ev.data as Tarefa) && (
                        <div className="flex justify-between text-xs"><span className="text-pulse-ash">Data</span><span className="text-off-white">{formatDateBR(getTarefaDate(ev.data as Tarefa))}</span></div>
                      )}
                      {(ev.data as any).blocked_by && (ev.data as any).blocked_by.length > 0 && (
                        <div className="text-[10px] text-danger mt-1">Bloqueado por: {(ev.data as any).blocked_by.join(', ')}</div>
                      )}
                      {(ev.data as any).is_completed ? (
                        <div className="w-full mt-2 py-1.5 rounded text-xs text-center text-success tracking-wider">Concluída</div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleCompleteTask(ev) }}
                          className="w-full mt-2 py-1.5 rounded text-xs tracking-wider bg-[#59A993] text-white hover:bg-[#59A993]/80 transition-colors disabled:opacity-40"
                          disabled={(ev.data as any).blocked_by && (ev.data as any).blocked_by.length > 0}>
                          Concluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {completing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80 backdrop-blur-sm"
            onClick={() => { if (!submitting) { setCompleting(null); setCompleteFile(null) } }}>
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-md mx-4 p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm tracking-wider text-off-white font-roc" style={{ fontWeight: 500 }}>
                  Concluir {completing.ev.type === 'obrigacao' ? 'Obrigação' : 'Tarefa'}
                </h3>
                <button onClick={() => { if (!submitting) { setCompleting(null); setCompleteFile(null) } }}
                  className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">×</button>
              </div>

              <div className="text-xs text-off-white mb-1">{completing.ev.title}</div>
              <div className="text-xs text-pulse-ash mb-4">{completing.ev.subtitle}</div>

              {completing.ev.type === 'obrigacao' && (completing.ev.data as Obrigacao).documento_requerido && (
                <div className="mb-4">
                  <label className="block text-xs tracking-wider text-pulse-ash mb-2">
                    Anexar PDF (obrigatório)
                  </label>
                  <input type="file" accept=".pdf,application/pdf"
                    onChange={e => setCompleteFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-pulse-ash file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-electric-teal/20 file:text-electric-teal hover:file:bg-electric-teal/30" />
                  {completeFile && (
                    <div className="text-[10px] text-electric-teal mt-1">{completeFile.name} ({(completeFile.size / 1024).toFixed(1)} KB)</div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {completing.ev.type === 'obrigacao' ? (
                  <button onClick={handleCompleteObrigacao} disabled={submitting || ((completing.ev.data as Obrigacao).documento_requerido && !completeFile)}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs tracking-wider bg-[#59A993] text-white hover:bg-[#59A993]/80 transition-colors disabled:opacity-40">
                    {submitting ? 'Concluindo...' : 'Confirmar Conclusão'}
                  </button>
                ) : (
                  <button onClick={() => handleCompleteTask(completing.ev)} disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs tracking-wider bg-[#59A993] text-white hover:bg-[#59A993]/80 transition-colors disabled:opacity-40">
                    {submitting ? 'Concluindo...' : 'Confirmar Conclusão'}
                  </button>
                )}
                <button onClick={() => { setCompleting(null); setCompleteFile(null) }} disabled={submitting}
                  className="px-4 py-2.5 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white border border-urban-smoke transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
      <div className="text-xs tracking-wider mb-2" style={{ color }}>{label}</div>
      <div className="text-sm tracking-wider" style={{ fontWeight: 500 }}>{value.toLocaleString()}</div>
    </div>
  )
}
