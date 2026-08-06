import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

export default function QuartelGeneral() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [workers, setWorkers] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [replyText, setReplyText] = useState('')
  const [replyId, setReplyId] = useState<number | null>(null)
  const [solving, setSolving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState<any>(null)

  const loadAll = async () => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    try {
      const [s, tn, w, l, tk, st] = await Promise.all([
        fetch('/api/quartel/status', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => null),
        fetch('/api/quartel/tenants', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
        fetch('/api/quartel/workers', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => null),
        fetch('/api/quartel/logs?lines=100', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => ({ lines: [] })),
        fetch('/api/admin/suporte', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
        fetch('/api/quartel/stats', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => null),
      ])
      setStatus(s)
      setTenants(Array.isArray(tn) ? tn : [])
      setWorkers(w)
      setLogs(l?.lines || [])
      setTickets(Array.isArray(tk) ? tk : [])
      setStats(st)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const dot = (ok: boolean) => (
    <span className={`w-2 h-2 rounded-full inline-block ${ok ? 'bg-success' : 'bg-danger'}`} />
  )

  const pctColor = (pct: number) => pct > 80 ? 'text-danger' : pct > 60 ? 'text-infrared' : 'text-success'

  if (loading) return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/quartel" />
      <main className="flex-1 flex items-center justify-center"><div className="text-pulse-ash text-sm">Carregando...</div></main>
    </div>
  )

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/quartel" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Quartel General</h1>
              <p className="text-pulse-ash text-sm">Monitoramento do sistema — acesso restrito</p>
            </div>
            <button onClick={loadAll} className="px-3 py-1.5 rounded text-xs tracking-wider bg-urban-smoke/30 text-pulse-ash hover:text-off-white transition-colors">
              Atualizar
            </button>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke">
            {['dashboard', 'overview', 'tenants', 'workers', 'tickets', 'logs'].map(k => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-5 py-3 text-xs tracking-widest transition-all border-b-2 -mb-px ${
                  tab === k ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}>{k === 'overview' ? 'Visão Geral' : k === 'dashboard' ? 'Dashboard' : k === 'tenants' ? 'Tenants' : k === 'workers' ? 'Workers' : k === 'tickets' ? 'Tickets' : 'Logs'}</button>
            ))}
          </div>

          {tab === 'dashboard' && stats && status && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-5">
                {/* CPU Bar */}
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <div className="text-xs tracking-wider text-pulse-ash mb-3">CPU</div>
                  <div className="flex items-end gap-1 mb-2">
                    <div className="flex-1 bg-urban-smoke rounded-full h-6 overflow-hidden">
                      <div className="h-full bg-electric-teal rounded-full transition-all" style={{ width: `${Math.min(status.system.cpu_pct, 100)}%` }} />
                    </div>
                    <span className={`text-sm font-roc ${Number(status.system.cpu_pct) > 80 ? 'text-danger' : 'text-success'}`} style={{ fontWeight: 500 }}>{status.system.cpu_pct}%</span>
                  </div>
                  <div className="text-[10px] text-pulse-ash">{status.system.cpu_cores} cores</div>
                </div>
                {/* RAM Bar */}
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <div className="text-xs tracking-wider text-pulse-ash mb-3">RAM</div>
                  <div className="flex items-end gap-1 mb-2">
                    <div className="flex-1 bg-urban-smoke rounded-full h-6 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min(status.system.mem_pct, 100)}%` }} />
                    </div>
                    <span className={`text-sm font-roc ${Number(status.system.mem_pct) > 80 ? 'text-danger' : 'text-success'}`} style={{ fontWeight: 500 }}>{status.system.mem_pct}%</span>
                  </div>
                  <div className="text-[10px] text-pulse-ash">{status.system.mem_used}/{status.system.mem_total}</div>
                </div>
                {/* Disk Bar */}
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <div className="text-xs tracking-wider text-pulse-ash mb-3">Disco</div>
                  <div className="flex items-end gap-1 mb-2">
                    <div className="flex-1 bg-urban-smoke rounded-full h-6 overflow-hidden">
                      <div className="h-full bg-infrared rounded-full transition-all" style={{ width: `${Math.min(status.system.disk_pct, 100)}%` }} />
                    </div>
                    <span className={`text-sm font-roc ${Number(status.system.disk_pct) > 80 ? 'text-danger' : 'text-success'}`} style={{ fontWeight: 500 }}>{status.system.disk_pct}%</span>
                  </div>
                  <div className="text-[10px] text-pulse-ash">{status.system.disk_free} livre</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Donut - Agentes */}
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <div className="text-xs tracking-wider text-pulse-ash mb-4">Agentes</div>
                  <div className="flex items-center gap-6 justify-center">
                    <div className="relative w-24 h-24">
                      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1B1B1B" strokeWidth="3" />
                        {(() => {
                          const online = status.counts.agentes_online || 0
                          const total = status.counts.agentes || 1
                          const pct = (online / total) * 100
                          const dash = (pct / 100) * 100
                          return <circle cx="18" cy="18" r="15.9" fill="none" stroke="#59A993" strokeWidth="3" strokeDasharray={`${dash} ${100 - dash}`} strokeLinecap="round" />
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-roc" style={{ fontWeight: 500 }}>{status.counts.agentes_online}/{status.counts.agentes}</div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-success" /> Online: {status.counts.agentes_online}</div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pulse-ash" /> Offline: {(status.counts.agentes || 0) - (status.counts.agentes_online || 0)}</div>
                    </div>
                  </div>
                </div>

                {/* Documentos */}
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <div className="text-xs tracking-wider text-pulse-ash mb-4">Documentos Fiscais</div>
                  <div className="space-y-3">
                    {[
                      { label: 'NFS-e', value: stats.docs?.nfse || 0, color: '#F97316' },
                      { label: 'NF-e', value: stats.docs?.nfe || 0, color: '#8B5CF6' },
                      { label: 'Total', value: (stats.docs?.nfse || 0) + (stats.docs?.nfe || 0), color: '#59A993' },
                    ].map(d => (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-xs text-pulse-ash w-16">{d.label}</span>
                        <div className="flex-1 bg-urban-smoke rounded-full h-4 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((d.value / Math.max((stats.docs?.nfse || 0) + (stats.docs?.nfe || 0), 1)) * 100, 100)}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="text-xs text-off-white w-16 text-right">{d.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                <div className="text-xs tracking-wider text-pulse-ash mb-4">Últimos Eventos</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(stats.events || []).map((ev: any, i: number) => {
                    const colors: Record<string, string> = { login: 'bg-blue-500', heartbeat: 'bg-success', ticket: 'bg-infrared' }
                    const labels: Record<string, string> = { login: 'Login', heartbeat: 'Agente', ticket: 'Ticket' }
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-urban-smoke/10 last:border-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${colors[ev.tipo] || 'bg-pulse-ash'}`} />
                        <span className="text-pulse-ash w-16 shrink-0">{labels[ev.tipo] || ev.tipo}</span>
                        <span className="text-off-white truncate flex-1">{ev.detalhe}</span>
                        <span className="text-[10px] text-pulse-ash shrink-0">{new Date(ev.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* DB Tables */}
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                <div className="text-xs tracking-wider text-pulse-ash mb-4">Tamanho das Tabelas do Banco</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(stats.tables || []).map((t: any) => {
                    const maxBytes = stats.tables?.[0]?.bytes || 1
                    return (
                      <div key={t.tablename} className="flex items-center gap-2 text-xs">
                        <span className="text-pulse-ash w-40 truncate">{t.tablename}</span>
                        <div className="flex-1 bg-urban-smoke rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-electric-teal/50 rounded-full transition-all" style={{ width: `${(t.bytes / maxBytes) * 100}%` }} />
                        </div>
                        <span className="text-off-white w-14 text-right font-mono text-[10px]">{t.size}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'overview' && status && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'CPU', value: `${status.system.cpu_pct}%`, sub: `${status.system.cpu_cores} cores`, color: status.system.cpu_pct > 80 ? '#CB3500' : '#59A993' },
                  { label: 'RAM', value: `${status.system.mem_pct}%`, sub: `${status.system.mem_used}/${status.system.mem_total}`, color: status.system.mem_pct > 80 ? '#CB3500' : '#59A993' },
                  { label: 'Disco', value: `${status.system.disk_pct}%`, sub: `${status.system.disk_free} livre`, color: status.system.disk_pct > 80 ? '#CB3500' : '#59A993' },
                  { label: 'Banco', value: status.system.db_size, sub: 'PostgreSQL', color: '#5C939F' },
                ].map(c => (
                  <div key={c.label} className="bg-rich-carbon border border-urban-smoke rounded-xl p-4">
                    <div className="text-xs tracking-wider mb-1" style={{ color: c.color }}>{c.label}</div>
                    <div className="text-xl font-roc" style={{ fontWeight: 500 }}>{c.value}</div>
                    <div className="text-xs text-pulse-ash">{c.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Serviços</h3>
                  <div className="space-y-2.5">
                    {Object.entries(status.services).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-pulse-ash capitalize">{k}</span>
                        <span className="flex items-center gap-2">
                          {v ? 'Online' : 'Offline'}
                          {dot(!!v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Contadores</h3>
                  <div className="space-y-2.5">
                    {Object.entries(status.counts).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-pulse-ash capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="text-off-white font-roc" style={{ fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'tenants' && (
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon">
                      <th className="text-left py-2.5 px-4">ID</th>
                      <th className="text-left py-2.5 px-4">Nome</th>
                      <th className="text-left py-2.5 px-4">Slug</th>
                      <th className="text-center py-2.5 px-4">Ativo</th>
                      <th className="text-center py-2.5 px-4">Usuários</th>
                      <th className="text-center py-2.5 px-4">Clientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id} className="border-b border-urban-smoke/10 hover:bg-urban-smoke/20">
                        <td className="py-2 px-4 font-mono text-pulse-ash">{t.id}</td>
                        <td className="py-2 px-4">{t.nome}</td>
                        <td className="py-2 px-4 font-mono text-pulse-ash">{t.slug}</td>
                        <td className="py-2 px-4 text-center">{dot(t.ativo)}</td>
                        <td className="py-2 px-4 text-center">{t.user_count}</td>
                        <td className="py-2 px-4 text-center">{t.client_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'workers' && workers && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 text-center">
                  <div className="text-3xl font-roc mb-1" style={{ fontWeight: 500 }}>{workers.workers}</div>
                  <div className="text-xs text-pulse-ash tracking-wider">Workers</div>
                </div>
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 text-center">
                  <div className="text-3xl font-roc mb-1" style={{ fontWeight: 500 }}>{workers.threads}</div>
                  <div className="text-xs text-pulse-ash tracking-wider">Threads/Worker</div>
                </div>
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 text-center">
                  <div className="text-3xl font-roc mb-1" style={{ fontWeight: 500 }}>{workers.workers * workers.threads}</div>
                  <div className="text-xs text-pulse-ash tracking-wider">Total Threads</div>
                </div>
              </div>
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Endpoints</h3>
                <div className="space-y-2">
                  {Object.entries(workers).filter(([k]) => k !== 'workers' && k !== 'threads').map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs py-2 border-b border-urban-smoke/20 last:border-0">
                      <span className="text-pulse-ash">{k.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className={`flex items-center gap-2 ${v ? 'text-success' : 'text-danger'}`}>
                        {v ? 'Online' : 'Offline'} {dot(!!v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'tickets' && (
            <div className="space-y-4">
              {tickets.map(tk => (
                <div key={tk.id} className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-sm text-off-white">{tk.titulo}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${tk.status === 'Aberto' ? 'bg-infrared/10 text-infrared' : tk.status === 'Em Andamento' ? 'bg-blue-500/10 text-blue-400' : tk.status === 'Fechado' ? 'bg-pulse-ash/10 text-pulse-ash' : 'bg-success/10 text-success'}`}>{tk.status}</span>
                      </div>
                      <p className="text-xs text-pulse-ash mt-1">{tk.descricao}</p>
                    </div>
                    <span className="text-[10px] text-pulse-ash shrink-0">{new Date(tk.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-pulse-ash mb-3">
                    <span>@{tk.username || tk.user_name}</span>
                    {tk.tenant_nome && <span>· {tk.tenant_nome}</span>}
                  </div>
                  {tk.resposta_admin && (
                    <div className="bg-core-black border border-success/20 rounded-lg p-3 mb-3">
                      <div className="text-[10px] tracking-wider text-success mb-1">Resposta</div>
                      <p className="text-xs text-off-white">{tk.resposta_admin}</p>
                    </div>
                  )}
                  {replyId === tk.id ? (
                    <div className="flex gap-2">
                      <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                        className="flex-1 bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white resize-none" rows={2} placeholder="Escreva a resposta..." />
                      <div className="flex flex-col gap-1">
                        <button onClick={async () => {
                          const t = getToken(); if (!t) return; setSolving(true)
                          await fetch(`/api/admin/suporte/${tk.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ status: 'Fechado', resposta_admin: replyText }) }).catch(() => {})
                          try { navigator.serviceWorker.ready.then(reg => reg.active?.postMessage({ type: 'notify', title: 'Ticket respondido', body: replyText.substring(0, 100), tag: `ticket-${tk.id}`, icon: '/logo.png', url: '/suporte' })) } catch {}
                          setReplyId(null); setReplyText(''); setSolving(false); loadAll()
                        }} disabled={solving || !replyText.trim()} className="px-3 py-1 rounded text-[10px] bg-success text-white hover:bg-success/80 disabled:opacity-30">
                          {solving ? '...' : 'Concluir'}
                        </button>
                        <button onClick={() => setReplyId(null)} className="px-3 py-1 rounded text-[10px] bg-urban-smoke/30 text-pulse-ash">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {tk.status !== 'Fechado' && (
                        <button onClick={() => { setReplyId(tk.id); setReplyText(tk.resposta_admin || '') }}
                          className="px-3 py-1 rounded text-[10px] tracking-wider bg-electric-teal/20 text-electric-teal hover:bg-electric-teal/30 transition-colors">
                          Responder
                        </button>
                      )}
                      {tk.status === 'Aberto' && (
                        <button onClick={async () => {
                          const t = getToken(); if (!t) return
                          await fetch(`/api/admin/suporte/${tk.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ status: 'Em Andamento' }) })
                          loadAll()
                        }} className="px-3 py-1 rounded text-[10px] tracking-wider bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                          Iniciar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {tickets.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhum ticket pendente.</div>}
            </div>
          )}

          {tab === 'logs' && (
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 max-h-[calc(100vh-260px)] overflow-y-auto">
              <pre className="text-xs font-mono text-pulse-ash whitespace-pre-wrap leading-relaxed">
                {logs.map((l, i) => (
                  <div key={i} className="py-0.5 border-b border-urban-smoke/10 last:border-0">
                    {l.includes('Erro') || l.includes('ERROR') || l.includes('Traceback') || l.includes('falhou') ?
                      <span className="text-danger">{l}</span> :
                      l.includes('WARNING') || l.includes('Rate limited') ?
                      <span className="text-infrared">{l}</span> :
                      <span>{l}</span>
                    }
                  </div>
                ))}
                {logs.length === 0 && <div className="text-center py-4 text-pulse-ash">Nenhum log disponível</div>}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
