import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}




type Atendimento = {
  id: number
  remote_jid: string
  remote_name: string
  status: string
  created_at: string
}

type Mensagem = {
  id: number
  texto: string
  de_remetente: boolean
  created_at: string
}

type DashboardStats = {
  total_conversas: number
  ativas: number
  encerradas: number
  mensagens: number
}

export default function WhatsApp() {
  const navigate = useNavigate()

  const [connected, setConnected] = useState<boolean | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [selected, setSelected] = useState<Atendimento | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [novaMsg, setNovaMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const api = (path: string, options?: RequestInit) => {
    const t = getToken()
    return fetch(`/api/whatsapp${path}`, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        Authorization: `Bearer ${t}`,
      },
    })
  }

  const loadStatus = async () => {
    try {
      const r = await api('/status')
      const d = await r.json()
      setConnected(d.connected)
    } catch { setConnected(false) }
  }

  const loadQrCode = async () => {
    try {
      const r = await api('/qrcode')
      if (r.ok) {
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        setQrCode(url)
      }
    } catch { setQrCode(null) }
  }

  const loadDashboard = async () => {
    try {
      const r = await api('/dashboard')
      const d = await r.json()
      setDashboard(d)
    } catch {}
  }

  const loadAtendimentos = async () => {
    try {
      const r = await api('/atendimentos')
      const d = await r.json()
      setAtendimentos(Array.isArray(d) ? d : [])
    } catch { setAtendimentos([]) }
  }

  const loadMensagens = async (atendimentoId: number) => {
    setMsgLoading(true)
    try {
      const r = await api(`/atendimentos/${atendimentoId}/mensagens`)
      const d = await r.json()
      setMensagens(Array.isArray(d) ? d : [])
    } catch { setMensagens([]) }
    setMsgLoading(false)
  }

  const handleStart = async () => {
    try {
      await api('/start', { method: 'POST' })
      await new Promise(r => setTimeout(r, 2000))
      loadStatus()
      loadQrCode()
    } catch { alert('Erro ao iniciar sessão') }
  }

  const handleStop = async () => {
    try {
      await api('/stop', { method: 'POST' })
      setConnected(false)
      setQrCode(null)
    } catch { alert('Erro ao parar sessão') }
  }

  const handleLogout = async () => {
    if (!confirm('Desconectar e limpar sessão?')) return
    try {
      await api('/logout', { method: 'POST' })
      setConnected(false)
      setQrCode(null)
      setSelected(null)
      setMensagens([])
    } catch { alert('Erro ao desconectar') }
  }

  const handleEnviar = async () => {
    if (!novaMsg.trim() || !selected) return
    setEnviando(true)
    try {
      await api('/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote_jid: selected.remote_jid, texto: novaMsg.trim(), client_id: selected.id }),
      })
      setNovaMsg('')
      loadMensagens(selected.id)
    } catch { alert('Erro ao enviar mensagem') }
    setEnviando(false)
  }

  const selectAtendimento = (a: Atendimento) => {
    setSelected(a)
    loadMensagens(a.id)
  }

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    setLoading(true)
    Promise.all([loadStatus(), loadDashboard(), loadAtendimentos()]).finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    if (connected === false) loadQrCode()
  }, [connected])

  useEffect(() => {
    if (connected) {
      const interval = setInterval(() => { loadAtendimentos(); loadDashboard() }, 15000)
      return () => clearInterval(interval)
    }
  }, [connected])

  useEffect(() => {
    if (selected && connected) {
      const interval = setInterval(() => loadMensagens(selected.id), 10000)
      return () => clearInterval(interval)
    }
  }, [selected, connected])

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/whatsapp" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>WhatsApp</h1>
              <p className="text-pulse-ash text-sm">Integração e atendimento via WhatsApp</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
              <span className="text-xs tracking-wider text-pulse-ash">
                {connected ? 'Conectado' : connected === false ? 'Desconectado' : 'Verificando...'}
              </span>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Carregando WhatsApp...</div>
            </div>
          )}

          {!loading && (
            <div className="space-y-6">
              {/* Connection + QR Code */}
              {!connected && (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Conexão WhatsApp</h3>
                  <div className="flex items-start gap-8">
                    <div className="shrink-0">
                      {qrCode ? (
                        <div className="bg-white p-4 rounded-xl inline-block">
                          <img src={qrCode} alt="QR Code" className="w-56 h-56" />
                        </div>
                      ) : (
                        <div className="w-56 h-56 bg-urban-smoke/20 rounded-xl flex items-center justify-center border border-urban-smoke">
                          <span className="text-pulse-ash text-xs text-center px-4">QR Code não disponível.<br />Inicie a sessão.</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-sm text-pulse-ash">
                        Para conectar, clique em <strong className="text-off-white">Iniciar Sessão</strong>. Escaneie o QR Code com o WhatsApp do seu celular.
                      </p>
                      <div className="flex items-center gap-3 pt-2">
                        <button onClick={handleStart}
                          className="px-5 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                          Iniciar Sessão
                        </button>
                        <button onClick={loadQrCode}
                          className="px-5 py-2.5 rounded-lg text-xs tracking-wider bg-urban-smoke text-off-white hover:bg-pulse-ash transition-colors border border-urban-smoke">
                          Recarregar QR
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dashboard Stats */}
              {connected && dashboard && (
                <div className="grid grid-cols-4 gap-5">
                  <StatCard value={dashboard.total_conversas} label="Conversas" sub="Total de atendimentos" color="#5C939F" />
                  <StatCard value={dashboard.ativas} label="Ativas" sub="Em andamento" color="#59A993" />
                  <StatCard value={dashboard.encerradas} label="Encerradas" sub="Finalizadas" color="#A78BFA" />
                  <StatCard value={dashboard.mensagens} label="Mensagens" sub="Total enviadas/recebidas" color="#ED6D40" />
                </div>
              )}

              {/* Controls */}
              {connected && (
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-4 flex items-center gap-3">
                  <button onClick={handleStop}
                    className="px-4 py-2 rounded-lg text-xs tracking-wider bg-infrared/10 text-infrared border border-infrared/20 hover:bg-infrared/20 transition-colors">
                    Parar Sessão
                  </button>
                  <button onClick={handleLogout}
                    className="px-4 py-2 rounded-lg text-xs tracking-wider bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors">
                    Desconectar
                  </button>
                  <button onClick={() => { loadStatus(); loadDashboard(); loadAtendimentos() }}
                    className="ml-auto px-4 py-2 rounded-lg text-xs tracking-wider bg-urban-smoke text-pulse-ash hover:text-off-white transition-colors border border-urban-smoke">
                    Atualizar
                  </button>
                </div>
              )}

              {/* Main area: Conversas + Messages */}
              {connected && (
                <div className="flex gap-5" style={{ height: 'calc(100vh - 380px)', minHeight: 400 }}>
                  {/* Conversations list */}
                  <div className="w-80 shrink-0 bg-rich-carbon border border-urban-smoke rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-urban-smoke">
                      <h3 className="text-xs tracking-wider text-pulse-ash">Atendimentos</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {atendimentos.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-pulse-ash text-xs">Nenhum atendimento.</span>
                        </div>
                      )}
                      {atendimentos.map(a => (
                        <button
                          key={a.id}
                          onClick={() => selectAtendimento(a)}
                          className={`w-full text-left p-4 border-b border-urban-smoke/30 hover:bg-urban-smoke/20 transition-colors ${
                            selected?.id === a.id ? 'bg-electric-teal/5 border-l-2 border-l-electric-teal' : ''
                          }`}
                        >
                          <div className="text-sm text-off-white truncate">{a.remote_name || a.remote_jid}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              a.status === 'ativa' || a.status === 'aberta' ? 'bg-success' : 'bg-pulse-ash'
                            }`} />
                            <span className="text-xs text-pulse-ash tracking-wider">{a.status || 'nova'}</span>
                            <span className="text-xs text-pulse-ash ml-auto">
                              {a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR') : ''}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Messages view */}
                  <div className="flex-1 bg-rich-carbon border border-urban-smoke rounded-xl flex flex-col overflow-hidden">
                    {!selected ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-3xl block mb-3 opacity-30">💬</span>
                          <p className="text-pulse-ash text-sm">Selecione um atendimento</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 border-b border-urban-smoke flex items-center gap-3">
                          <div>
                            <div className="text-sm text-off-white">{selected.remote_name || selected.remote_jid}</div>
                            <div className="text-xs text-pulse-ash font-mono">{selected.remote_jid}</div>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {msgLoading && (
                            <div className="flex items-center justify-center py-10">
                              <span className="text-pulse-ash text-xs">Carregando mensagens...</span>
                            </div>
                          )}
                          {!msgLoading && mensagens.length === 0 && (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-pulse-ash text-xs">Nenhuma mensagem.</span>
                            </div>
                          )}
                          {!msgLoading && mensagens.map(m => (
                            <div key={m.id} className={`flex ${m.de_remetente ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                                m.de_remetente
                                  ? 'bg-urban-smoke/50 text-off-white rounded-tl-sm'
                                  : 'bg-electric-teal/20 text-off-white rounded-tr-sm'
                              }`}>
                                <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                                <div className="text-[9px] text-pulse-ash mt-1 text-right">
                                  {m.created_at ? new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 border-t border-urban-smoke flex items-center gap-2">
                          <input
                            type="text"
                            value={novaMsg}
                            onChange={e => setNovaMsg(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleEnviar() }}
                            placeholder="Digite sua mensagem..."
                            className="flex-1 bg-core-black border border-urban-smoke rounded-lg px-4 py-2.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                          />
                          <button
                            onClick={handleEnviar}
                            disabled={enviando || !novaMsg.trim()}
                            className="px-5 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {enviando ? '...' : 'Enviar'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ value, label, sub, color }: { value: number | string; label: string; sub: string; color: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
      <div className="text-xs tracking-wider mb-2" style={{ color }}>{label}</div>
      <div className="text-sm tracking-wider mb-1" style={{ fontWeight: 500 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-pulse-ash">{sub}</div>
    </div>
  )
}
