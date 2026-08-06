import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

type Reuniao = {
  id: number
  titulo: string
  descricao: string
  data: string
  hora_inicio: string
  hora_fim: string
  cliente_id: number | null
  cliente_nome: string | null
  sala: string
  created_by: number | null
  criado_por_nome: string | null
  participantes: { id: number; display_name: string }[]
}

type Usuario = {
  id: number
  display_name: string
  departamento_id: number | null
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

function formatTime(t: string): string {
  return t.slice(0, 5)
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 7).padStart(2, '0'))
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function getWeekDays(date: Date): Date[] {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  const week: Date[] = []
  for (let i = 0; i < 7; i++) {
    const wd = new Date(d)
    wd.setDate(diff + i)
    wd.setHours(0, 0, 0, 0)
    week.push(wd)
  }
  return week
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function Reunioes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    return d
  })
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '08:00',
    hora_fim: '09:00',
    cliente_id: '',
    sala: '',
    participantes: [] as number[],
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientes, setClientes] = useState<{ id: number; name: string }[]>([])
  const [userRole, setUserRole] = useState('')
  const [userDeptId, setUserDeptId] = useState<number | null>(null)

  const canEdit = userRole === 'administrador' || userRole === 'lider' || userRole === 'super_admin' || userDeptId === 17

  const weekDays = getWeekDays(currentWeekStart)
  const weekStartISO = formatISO(weekDays[0])
  const weekEndISO = formatISO(weekDays[6])

  const weekReunioes = reunioes.filter(r => {
    return r.data >= weekStartISO && r.data <= weekEndISO
  })

  const getReunioesForDay = (dateISO: string) => {
    return weekReunioes.filter(r => r.data === dateISO).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  }

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/reunioes?data_inicio=${weekStartISO}&data_fim=${weekEndISO}`, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
      fetch('/api/reunioes/usuarios', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
      fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
      fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => ({})),
    ]).then(([r, u, c, me]) => {
      setReunioes(Array.isArray(r) ? r : [])
      setUsuarios(Array.isArray(u) ? u : [])
      setClientes(Array.isArray(c) ? c : [])
      setUserRole((me as any).role || '')
      setUserDeptId((me as any).departamento_id || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [navigate, weekStartISO, weekEndISO])

  const prevWeek = () => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() - 7)
    setCurrentWeekStart(d)
  }
  const nextWeek = () => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() + 7)
    setCurrentWeekStart(d)
  }
  const goToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    setCurrentWeekStart(d)
  }

  const openNewModal = (date?: string, hora?: string) => {
    setEditingId(null)
    setForm({
      titulo: '',
      descricao: '',
      data: date || formatISO(new Date()),
      hora_inicio: hora || '08:00',
      hora_fim: hora ? (() => { const [h, m] = hora.split(':').map(Number); return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}` })() : '09:00',
      cliente_id: '',
      sala: '',
      participantes: [],
    })
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (r: Reuniao) => {
    setEditingId(r.id)
    setForm({
      titulo: r.titulo,
      descricao: r.descricao,
      data: r.data,
      hora_inicio: r.hora_inicio.slice(0, 5),
      hora_fim: r.hora_fim.slice(0, 5),
      cliente_id: r.cliente_id ? String(r.cliente_id) : '',
      sala: r.sala,
      participantes: r.participantes.map(p => p.id),
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditingId(null); setFormError('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.titulo.trim()) { setFormError('Título obrigatório'); return }
    if (!form.data) { setFormError('Data obrigatória'); return }
    if (form.hora_inicio >= form.hora_fim) { setFormError('Horário fim deve ser depois do início'); return }
    setSubmitting(true)
    const t = getToken()
    if (!t) return
    try {
      const body: Record<string, any> = {
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        sala: form.sala,
        participantes: form.participantes,
      }
      const url = editingId ? `/api/reunioes/${editingId}` : '/api/reunioes'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        const err = await res.json().catch(() => ({ detail: 'Conflito de horário na sala' }))
        throw new Error((err as any).detail || 'Conflito de horário')
      }
      if (!res.ok) throw new Error('Erro ao salvar reunião')
      closeModal()
      refreshData()
    } catch (e: any) {
      setFormError(e.message || 'Erro ao salvar reunião')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta reunião?')) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/reunioes/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      refreshData()
    } catch { alert('Erro ao excluir reunião') }
  }

  const refreshData = () => {
    const t = getToken()
    if (!t) return
    fetch(`/api/reunioes?data_inicio=${weekStartISO}&data_fim=${weekEndISO}`, { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setReunioes(Array.isArray(d) ? d : [])).catch(() => {})
  }

  const todayISO = formatISO(new Date())
  const HOUR_HEIGHT = 60

  const isToday = (dateISO: string) => dateISO === todayISO

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/reunioes" />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Reuniões</h1>
              <p className="text-pulse-ash text-sm">Agenda da sala de reunião</p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button onClick={() => openNewModal()}
                  className="px-3 py-1.5 rounded text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                  + Nova
                </button>
              )}
              <button onClick={goToday}
                className="px-3 py-1.5 rounded text-xs tracking-wider bg-electric-teal/20 text-electric-teal hover:bg-electric-teal/30 transition-colors">
                Hoje
              </button>
              <button onClick={prevWeek}
                className="w-8 h-8 flex items-center justify-center rounded text-pulse-ash hover:text-off-white hover:bg-urban-smoke transition-all">‹</button>
              <span className="text-sm font-roc px-2" style={{ fontWeight: 500 }}>
                {formatDateBR(weekDays[0])} — {formatDateBR(weekDays[6])}
              </span>
              <button onClick={nextWeek}
                className="w-8 h-8 flex items-center justify-center rounded text-pulse-ash hover:text-off-white hover:bg-urban-smoke transition-all">›</button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Carregando reuniões...</div>
            </div>
          )}

          {!loading && (
            <div className="flex-1 overflow-y-auto bg-rich-carbon border border-urban-smoke rounded-xl">
              {/* Header row */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-urban-smoke sticky top-0 bg-rich-carbon z-10">
                <div className="py-2 text-center text-[10px] text-pulse-ash tracking-wider">Hora</div>
                {weekDays.map((d, i) => {
                  const dateISO = formatISO(d)
                  return (
                    <div key={i}
                      className={`py-2 text-center text-[11px] tracking-wider border-l border-urban-smoke ${
                        isToday(dateISO) ? 'text-electric-teal font-bold' : 'text-pulse-ash'
                      }`}>
                      <div>{DAYS[(d.getDay())]}</div>
                      <div>{String(d.getDate()).padStart(2, '0')}</div>
                    </div>
                  )
                })}
              </div>

              {/* Time grid */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                <div className="col-start-1">
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_HEIGHT }}
                      className="border-b border-urban-smoke/20 flex items-start justify-center pt-0.5">
                      <span className="text-[10px] text-pulse-ash">{h}:00</span>
                    </div>
                  ))}
                </div>
                {weekDays.map((d, di) => {
                  const dateISO = formatISO(d)
                  const dayEvents = getReunioesForDay(dateISO)
                  return (
                    <div key={di} className="relative border-l border-urban-smoke">
                      {/* Hour lines */}
                      {HOURS.map(h => (
                        <div key={h} style={{ height: HOUR_HEIGHT }}
                          className={`border-b border-urban-smoke/20 ${canEdit ? 'cursor-pointer hover:bg-electric-teal/5' : ''} transition-colors`}
                          onClick={canEdit ? () => openNewModal(dateISO, `${h}:00`) : undefined} />
                      ))}
                      {/* Meeting blocks */}
                      {dayEvents.map(r => {
                        const startMin = parseTimeToMinutes(r.hora_inicio)
                        const endMin = parseTimeToMinutes(r.hora_fim)
                        const top = ((startMin - 7 * 60) / (60)) * HOUR_HEIGHT
                        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 2, 20)
                        return (
                          <div key={r.id}
                            onClick={canEdit ? () => openEditModal(r) : undefined}
                            className={`absolute left-0.5 right-0.5 bg-electric-teal/20 border border-electric-teal/40 rounded px-1.5 py-0.5 ${canEdit ? 'cursor-pointer hover:bg-electric-teal/30' : ''} transition-colors overflow-hidden z-20`}
                            style={{ top, height, minHeight: 20 }}>
                            <div className="text-[10px] font-medium text-electric-teal leading-tight truncate">{r.titulo}</div>
                            <div className="text-[8px] text-pulse-ash">{formatTime(r.hora_inicio)}-{formatTime(r.hora_fim)}</div>
                            {r.sala && <div className="text-[8px] text-pulse-ash truncate">{r.sala}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-core-black/80 backdrop-blur-sm"
          onClick={closeModal}>
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm tracking-wider text-off-white font-roc" style={{ fontWeight: 500 }}>
                  {editingId ? 'Editar Reunião' : 'Nova Reunião'}
                </h3>
                <button onClick={closeModal} className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">×</button>
              </div>

              {formError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-xs text-danger mb-4">{formError}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Título *</label>
                  <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Descrição</label>
                  <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Data *</label>
                    <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Início *</label>
                    <input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} required
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Fim *</label>
                    <input type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} required
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cliente</label>
                  <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                    <option value="">Sem cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Sala</label>
                  <input type="text" value={form.sala} onChange={e => setForm(f => ({ ...f, sala: e.target.value }))}
                    placeholder="Ex: Sala 1, Auditório..."
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-2">Participantes</label>
                  <div className="max-h-40 overflow-y-auto border border-urban-smoke rounded-lg p-3 space-y-1.5 bg-core-black">
                    {usuarios.length === 0 && (
                      <div className="text-xs text-pulse-ash py-2 text-center">Nenhum usuário disponível</div>
                    )}
                    {usuarios.map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:text-off-white transition-colors">
                        <input type="checkbox" checked={form.participantes.includes(u.id)}
                          onChange={() => setForm(f => ({
                            ...f,
                            participantes: f.participantes.includes(u.id)
                              ? f.participantes.filter(id => id !== u.id)
                              : [...f.participantes, u.id],
                          }))}
                          className="accent-electric-teal rounded" />
                        <span className="text-xs text-pulse-ash">{u.display_name}</span>
                      </label>
                    ))}
                  </div>
                  {form.participantes.length > 0 && (
                    <div className="text-[10px] text-pulse-ash mt-1">{form.participantes.length} participante(s)</div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50">
                    {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Reunião'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={() => { if (editingId) handleDelete(editingId); closeModal() }}
                      className="px-4 py-2.5 rounded-lg text-xs tracking-wider text-danger hover:text-danger/70 border border-danger/30 transition-colors">
                      Excluir
                    </button>
                  )}
                  <button type="button" onClick={closeModal}
                    className="px-4 py-2.5 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white border border-urban-smoke transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
