import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}




function getUserRole(): string {
  try {
    const t = getToken()
    if (!t) return ''
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.role || ''
  } catch { return '' }
}

type Ticket = {
  id: number
  titulo: string
  descricao: string
  status: string
  resposta_admin: string | null
  user_name?: string
  username?: string
  tenant_nome?: string
  created_at: string
  updated_at: string
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    'Aberto': { bg: 'bg-infrared/10', text: 'text-infrared', label: 'Aberto' },
    'Em Andamento': { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Em Andamento' },
    'Respondido': { bg: 'bg-success/10', text: 'text-success', label: 'Respondido' },
    'Fechado': { bg: 'bg-pulse-ash/10', text: 'text-pulse-ash', label: 'Fechado' },
  }
  const s = map[status] || map['Aberto']
  return (
    <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleString('pt-BR') } catch { return d }
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '...' : text
}

export default function Suporte() {
  const navigate = useNavigate()
  const role = getUserRole()
  const isAdmin = role === 'super_admin'

  const [tab, setTab] = useState<'meus' | 'admin'>('meus')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [replyTicket, setReplyTicket] = useState<Ticket | null>(null)

  const loadTickets = async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const res = await fetch('/api/suporte', { headers: { Authorization: 'Bearer ' + t } })
      const data = await res.json()
      setTickets(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  const loadAdminTickets = async () => {
    const t = getToken()
    if (!t) return
    setAdminLoading(true)
    try {
      const res = await fetch('/api/admin/suporte', { headers: { Authorization: 'Bearer ' + t } })
      const data = await res.json()
      setAdminTickets(Array.isArray(data) ? data : [])
    } catch {}
    setAdminLoading(false)
  }

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    loadTickets()
    if (isAdmin) loadAdminTickets()
  }, [navigate])

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/suporte" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Suporte</h1>
              <p className="text-pulse-ash text-sm">Central de atendimento e tickets</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <a href="/admin" target="_blank" rel="noreferrer"
                  className="px-4 py-2 rounded-lg text-xs tracking-wider bg-purple-900/30 text-purple-400 border border-purple-400/30 hover:bg-purple-900/50 transition-colors">
                  Quartel General
                </a>
              )}
              <button
                onClick={() => setShowNewModal(true)}
                className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2"
              >
                <span>+</span> Novo Ticket
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-1 mb-6 border-b border-urban-smoke">
              <button
                onClick={() => setTab('meus')}
                className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  tab === 'meus' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}
              >
                Meus Tickets
              </button>
              <button
                onClick={() => { setTab('admin'); if (adminTickets.length === 0 && !adminLoading) loadAdminTickets() }}
                className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  tab === 'admin' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}
              >
                Administração
              </button>
            </div>
          )}

          {tab === 'meus' && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-pulse-ash text-sm">Carregando tickets...</div>
                </div>
              )}

              {!loading && tickets.length === 0 && (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-12 text-center">
                  <div className="text-xs tracking-wider text-pulse-ash mb-2">Nenhum Ticket</div>
                  <p className="text-sm text-pulse-ash mb-4">Você ainda não abriu nenhum chamado.</p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors inline-flex items-center gap-2"
                  >
                    <span>+</span> Abrir Chamado
                  </button>
                </div>
              )}

              {!loading && tickets.length > 0 && (
                <div className="space-y-4">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 hover:border-pulse-ash/30 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-roc" style={{ fontWeight: 500 }}>{ticket.titulo}</h3>
                          <p className="text-pulse-ash text-xs mt-1">{truncate(ticket.descricao, 200)}</p>
                        </div>
                        <div className="ml-4 shrink-0">{statusBadge(ticket.status)}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-pulse-ash">
                        <span>Aberto em {formatDate(ticket.created_at)}</span>
                        {ticket.updated_at !== ticket.created_at && (
                          <span>Atualizado em {formatDate(ticket.updated_at)}</span>
                        )}
                      </div>
                      {ticket.resposta_admin && (
                        <div className="mt-4 pt-4 border-t border-urban-smoke">
                          <div className="text-xs tracking-wider text-success mb-2">Resposta do Administrador</div>
                          <p className="text-xs text-off-white bg-core-black border border-urban-smoke rounded-lg p-3">{ticket.resposta_admin}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'admin' && isAdmin && (
            <>
              {adminLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-pulse-ash text-sm">Carregando tickets...</div>
                </div>
              )}

              {!adminLoading && adminTickets.length === 0 && (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-12 text-center">
                  <div className="text-xs tracking-wider text-pulse-ash mb-2">Nenhum Ticket</div>
                  <p className="text-sm text-pulse-ash">Nenhum ticket aberto no sistema.</p>
                </div>
              )}

              {!adminLoading && adminTickets.length > 0 && (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon z-10">
                          <th className="text-left py-3 px-4">Título</th>
                          <th className="text-left py-3 px-4">Usuário</th>
                          <th className="text-left py-3 px-4">Tenant</th>
                          <th className="text-center py-3 px-4">Status</th>
                          <th className="text-center py-3 px-4">Data</th>
                          <th className="text-center py-3 px-4 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminTickets.map(ticket => (
                          <tr key={ticket.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium">{ticket.titulo}</div>
                              <div className="text-pulse-ash text-xs mt-0.5">{truncate(ticket.descricao, 80)}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div>{ticket.user_name || ticket.username || '-'}</div>
                              {ticket.username && ticket.username !== ticket.user_name && (
                                <div className="text-pulse-ash text-xs font-mono">{ticket.username}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-pulse-ash">{ticket.tenant_nome || '-'}</td>
                            <td className="py-3 px-4 text-center">{statusBadge(ticket.status)}</td>
                            <td className="py-3 px-4 text-center text-pulse-ash">{formatDate(ticket.created_at)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => { setReplyTicket(ticket); setShowReplyModal(true) }}
                                className="px-3 py-1 rounded text-xs tracking-wider bg-electric-teal/10 text-electric-teal hover:bg-electric-teal/20 transition-colors"
                              >
                                Responder
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showNewModal && (
        <NewTicketModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); loadTickets() }}
        />
      )}

      {showReplyModal && replyTicket && (
        <ReplyTicketModal
          ticket={replyTicket}
          onClose={() => { setShowReplyModal(false); setReplyTicket(null) }}
          onSaved={() => {
            setShowReplyModal(false)
            setReplyTicket(null)
            loadTickets()
            if (isAdmin) loadAdminTickets()
          }}
        />
      )}
    </div>
  )
}

function NewTicketModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ titulo: '', descricao: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.titulo.trim()) { alert('Título é obrigatório'); return }
    if (!form.descricao.trim()) { alert('Descrição é obrigatória'); return }
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const res = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSaved()
    } catch { alert('Erro ao abrir ticket') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[520px] max-w-full mx-4">
        <h3 className="text-sm tracking-wider mb-6">Novo Ticket</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Título *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Resumo do problema"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Descrição *</label>
            <textarea
              value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Descreva seu problema ou dúvida em detalhes"
              rows={6}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
          >
            {saving ? 'Enviando...' : 'Abrir Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReplyTicketModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: Ticket
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    status: ticket.status,
    resposta_admin: ticket.resposta_admin || '',
  })
  const [saving, setSaving] = useState(false)

  const STATUS_OPTIONS = ['Aberto', 'Em Andamento', 'Respondido', 'Fechado']

  const handleSave = async () => {
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/suporte/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSaved()
    } catch { alert('Erro ao responder ticket') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[560px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm tracking-wider mb-6">Responder Ticket #{ticket.id}</h3>

        <div className="space-y-4 mb-6 pb-6 border-b border-urban-smoke">
          <div>
            <div className="text-xs tracking-wider text-pulse-ash mb-1">Solicitante</div>
            <div className="text-xs text-off-white">{ticket.user_name || ticket.username || '-'}</div>
            {ticket.tenant_nome && (
              <div className="text-xs text-pulse-ash mt-0.5">Tenant: {ticket.tenant_nome}</div>
            )}
          </div>
          <div>
            <div className="text-xs tracking-wider text-pulse-ash mb-1">Título</div>
            <div className="text-xs text-off-white">{ticket.titulo}</div>
          </div>
          <div>
            <div className="text-xs tracking-wider text-pulse-ash mb-1">Descrição</div>
            <div className="text-xs text-off-white bg-core-black border border-urban-smoke rounded-lg p-3">{ticket.descricao}</div>
          </div>
          <div>
            <div className="text-xs tracking-wider text-pulse-ash mb-1">Data</div>
            <div className="text-xs text-pulse-ash">{formatDate(ticket.created_at)}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Resposta</label>
            <textarea
              value={form.resposta_admin}
              onChange={e => setForm(p => ({ ...p, resposta_admin: e.target.value }))}
              placeholder="Escreva a resposta para o usuário..."
              rows={5}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
          >
            {saving ? 'Salvando...' : 'Atualizar Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}
