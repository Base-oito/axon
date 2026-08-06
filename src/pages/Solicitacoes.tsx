import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

type Solicitacao = {
  id: number
  titulo: string
  descricao: string
  status: string
  cliente_nome: string
  tenant_nome: string
  mensagens: number
  created_at: string
  updated_at: string
}

type Mensagem = {
  id: number
  de_client: boolean
  mensagem: string
  autor_nome: string
  created_at: string
  anexo_path: string | null
}

type SolicitacaoDetalhe = {
  solicitacao: Solicitacao
  mensagens: Mensagem[]
}

const STATUS_LIST = ['Aberta', 'Em Andamento', 'Respondida', 'Fechada'] as const

const STATUS_COLORS: Record<string, string> = {
  Aberta: '#F59E0B',
  'Em Andamento': '#3B82F6',
  Respondida: '#8B5CF6',
  Fechada: '#10B981',
}

const STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'Aberta', label: 'Aberta' },
  { key: 'Em Andamento', label: 'Em Andamento' },
  { key: 'Respondida', label: 'Respondida' },
  { key: 'Fechada', label: 'Fechada' },
]

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

function formatDateTime(d: string): string {
  const dt = new Date(d)
  return dt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#535353'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs tracking-wider whitespace-nowrap"
      style={{ backgroundColor: color + '18', color, border: `1px solid ${color}35` }}
    >
      {status}
    </span>
  )
}

export default function Solicitacoes() {
  const navigate = useNavigate()
  const [role] = useState(getUserRole)

  const [loading, setLoading] = useState(true)
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SolicitacaoDetalhe | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    if (role !== 'super_admin') { navigate('/dashboard'); return }
    loadSolicitacoes(t)
  }, [navigate, role])

  const loadSolicitacoes = async (tok?: string) => {
    const t = tok || getToken()
    if (!t) return
    try {
      const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
      const r = await fetch(`/api/admin/solicitacoes${params}`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      setSolicitacoes(await r.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (!loading) loadSolicitacoes()
  }, [statusFilter])

  const loadDetail = async (id: number) => {
    const t = getToken()
    if (!t) return
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/admin/solicitacoes/${id}/detalhe`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      setDetail(await r.json())
    } catch {}
    setDetailLoading(false)
  }

  const openDetail = (id: number) => {
    setSelectedId(id)
    setReplyText('')
    loadDetail(id)
  }

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedId) return
    const t = getToken()
    if (!t) return
    setSending(true)
    try {
      await fetch(`/api/admin/solicitacoes/${selectedId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ mensagem: replyText.trim() }),
      })
      setReplyText('')
      loadDetail(selectedId)
      loadSolicitacoes()
    } catch {}
    setSending(false)
  }

  const handleChangeStatus = async (status: string) => {
    if (!selectedId) return
    const t = getToken()
    if (!t) return
    setChangingStatus(true)
    try {
      await fetch(`/api/admin/solicitacoes/${selectedId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ status }),
      })
      loadDetail(selectedId)
      loadSolicitacoes()
    } catch {}
    setChangingStatus(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendReply()
    }
  }

  if (role !== 'super_admin') {
    return (
      <div className="h-screen bg-core-black text-off-white flex items-center justify-center">
        <div className="text-pulse-ash text-sm">Acesso restrito.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-screen bg-core-black text-off-white flex items-center justify-center">
        <div className="text-pulse-ash text-sm">Carregando solicitações...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/solicitacoes" />

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Solicitações</h1>
              <p className="text-pulse-ash text-sm">Gerencie as solicitações dos clientes</p>
            </div>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 mb-4">
            {STATUS_FILTERS.map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded text-xs tracking-wider transition-colors ${
                  statusFilter === s.key
                    ? 'bg-electric-teal/20 text-electric-teal border border-electric-teal/30'
                    : 'text-pulse-ash border border-transparent hover:text-off-white hover:bg-urban-smoke/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon z-10">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Título</th>
                    <th className="text-left py-3 px-4">Cliente</th>
                    <th className="text-left py-3 px-4">Tenant</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-center py-3 px-4">Mensagens</th>
                    <th className="text-right py-3 px-4">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoes.map(s => (
                    <tr key={s.id}
                      onClick={() => openDetail(s.id)}
                      className={`border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors cursor-pointer ${
                        selectedId === s.id ? 'bg-electric-teal/5' : ''
                      }`}>
                      <td className="py-3 px-4 font-mono text-xs text-pulse-ash">#{s.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium truncate max-w-[200px]">{s.titulo}</div>
                      </td>
                      <td className="py-3 px-4 text-pulse-ash">{s.cliente_nome || '-'}</td>
                      <td className="py-3 px-4 text-pulse-ash">{s.tenant_nome || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-3 px-4 text-center text-pulse-ash">{s.mensagens}</td>
                      <td className="py-3 px-4 text-right text-pulse-ash">{formatDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {solicitacoes.length === 0 && (
                <div className="text-center py-10 text-pulse-ash text-sm">
                  {statusFilter ? 'Nenhuma solicitação encontrada para este status.' : 'Nenhuma solicitação registrada.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Detail Sheet ── */}
      {selectedId !== null && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-core-black/60" onClick={closeDetail} />
          <div className="relative w-[600px] max-w-full h-full bg-rich-carbon border-l border-urban-smoke flex flex-col animate-[slideLeft_0.2s_ease-out]">
            {/* Header */}
            <div className="p-5 border-b border-urban-smoke flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm tracking-wider truncate">
                  {detail?.solicitacao.titulo || 'Solicitação'}
                </h3>
                {detail && (
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={detail.solicitacao.status} />
                    <span className="text-xs text-pulse-ash">#{detail.solicitacao.id}</span>
                  </div>
                )}
              </div>
              <button onClick={closeDetail} className="text-pulse-ash hover:text-off-white transition-colors ml-4 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-pulse-ash text-sm">Carregando detalhes...</div>
                </div>
              ) : detail ? (
                <>
                  {/* Info section */}
                  <div className="p-5 border-b border-urban-smoke shrink-0 space-y-3">
                    <div>
                      <div className="text-xs tracking-wider text-pulse-ash mb-1">Descrição</div>
                      <div className="text-sm text-off-white whitespace-pre-wrap">{detail.solicitacao.descricao || '—'}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs tracking-wider text-pulse-ash mb-0.5">Cliente</div>
                        <div className="text-sm text-off-white">{detail.solicitacao.cliente_nome || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs tracking-wider text-pulse-ash mb-0.5">Tenant</div>
                        <div className="text-sm text-off-white">{detail.solicitacao.tenant_nome || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs tracking-wider text-pulse-ash mb-0.5">Aberto em</div>
                        <div className="text-sm text-off-white">{formatDateTime(detail.solicitacao.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-xs tracking-wider text-pulse-ash mb-0.5">Atualizado em</div>
                        <div className="text-sm text-off-white">{formatDateTime(detail.solicitacao.updated_at)}</div>
                      </div>
                    </div>

                    {/* Status change */}
                    <div className="pt-2 border-t border-urban-smoke">
                      <div className="text-xs tracking-wider text-pulse-ash mb-2">Alterar Status</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {STATUS_LIST.map(st => (
                          <button
                            key={st}
                            onClick={() => handleChangeStatus(st)}
                            disabled={changingStatus || detail.solicitacao.status === st}
                            className={`px-3 py-1 rounded text-xs tracking-wider transition-colors ${
                              detail.solicitacao.status === st
                                ? 'opacity-40 cursor-default'
                                : 'border hover:bg-electric-teal/10'
                            }`}
                            style={detail.solicitacao.status !== st ? {
                              borderColor: (STATUS_COLORS[st] || '#535353') + '60',
                              color: STATUS_COLORS[st] || '#535353',
                            } : {
                              borderColor: (STATUS_COLORS[st] || '#535353') + '30',
                              color: STATUS_COLORS[st] || '#535353',
                            }}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="text-xs tracking-wider text-pulse-ash mb-3">
                      Mensagens ({detail.mensagens.length})
                    </div>
                    {detail.mensagens.map(msg => (
                      <div key={msg.id} className={`flex ${msg.de_client ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          msg.de_client
                            ? 'bg-urban-smoke text-off-white rounded-tl-sm'
                            : 'bg-electric-teal/20 text-off-white rounded-tr-sm'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs tracking-wider text-electric-teal">{msg.autor_nome}</span>
                            <span className={`text-xs ${
                              msg.de_client ? 'text-pulse-ash' : 'text-electric-teal/60'
                            }`}>
                              {msg.de_client ? '(Cliente)' : '(Admin)'}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">{msg.mensagem}</div>
                          {msg.anexo_path && (
                            <a
                              href={`/api/chat/uploads/${msg.anexo_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-electric-teal hover:underline"
                            >
                              <span>📎</span> Anexo
                            </a>
                          )}
                          <div className="text-xs text-pulse-ash mt-1.5">{formatDateTime(msg.created_at)}</div>
                        </div>
                      </div>
                    ))}
                    {detail.mensagens.length === 0 && (
                      <div className="text-center py-10 text-pulse-ash text-sm">
                        Nenhuma mensagem nesta solicitação.
                      </div>
                    )}
                  </div>

                  {/* Reply area */}
                  <div className="p-4 border-t border-urban-smoke shrink-0">
                    <div className="flex items-end gap-3">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite sua resposta..."
                        rows={2}
                        className="flex-1 bg-core-black border border-urban-smoke rounded-xl px-4 py-3 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none max-h-32"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || sending}
                        className="bg-electric-teal text-white px-4 py-3 rounded-xl hover:bg-electric-teal/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                      >
                        {sending ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
                            <path d="m21.854 2.147-10.94 10.939" />
                          </svg>
                        )}
                        <span className="text-xs tracking-wider hidden sm:inline">
                          {sending ? 'Enviando...' : 'Enviar'}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-pulse-ash text-sm">Erro ao carregar solicitação.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
