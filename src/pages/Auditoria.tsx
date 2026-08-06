import { useState, useEffect, useCallback } from 'react'
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

type AuditItem = {
  id: number
  acao: string
  entidade: string
  entidade_id: number | null
  detalhes: string | null
  usuario_nome: string
  user_id: number | null
  created_at: string
}

type AuditResponse = {
  items: AuditItem[]
  total: number
  usuarios: { id: number; nome: string }[]
}

type AuditStats = {
  top_acoes: { acao: string; total: number }[]
  op_por_dia: { data: string; total: number }[]
  top_usuarios: { usuario_nome: string; total: number }[]
  total_registros: number
  sessoes: {
    total: number
    hoje: number
    usuarios_online: number
    horas_online: { usuario_nome: string; horas: number }[]
  }
  heatmap: number[]
}

const ACAO_COLORS: Record<string, string> = {
  criar: '#59A993',
  editar: '#3B82F6',
  remover: '#CB3500',
  excluir: '#CB3500',
  concluir: '#ED6D40',
  login: '#A78BFA',
  logout: '#A78BFA',
}

function acaoColor(acao: string): string {
  const key = acao.toLowerCase()
  return ACAO_COLORS[key] || '#535353'
}

export default function Auditoria() {
  const navigate = useNavigate()
  const userRole = getUserRole()
  const isAdmin = userRole === 'administrador' || userRole === 'super_admin'

  const [tab, setTab] = useState('registros')

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/auditoria" />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Auditoria</h1>
              <p className="text-pulse-ash text-sm">Registro de ações e estatísticas do sistema</p>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke">
            {[
              { key: 'registros', label: 'Registros' },
              { key: 'estatisticas', label: 'Estatísticas' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  tab === t.key
                    ? 'text-electric-teal border-electric-teal'
                    : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!isAdmin ? (
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-12 text-center">
              <div className="text-xs tracking-wider text-pulse-ash mb-2">Acesso Restrito</div>
              <p className="text-sm text-pulse-ash">Apenas administradores podem acessar a auditoria.</p>
            </div>
          ) : (
            <>
              {tab === 'registros' && <RegistrosTab />}
              {tab === 'estatisticas' && <EstatisticasTab />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function RegistrosTab() {
  const [data, setData] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acoes, setAcoes] = useState<string[]>([])
  const [entidades, setEntidades] = useState<string[]>([])

  const [filtroUserId, setFiltroUserId] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroEntidade, setFiltroEntidade] = useState('')
  const [filtroSearch, setFiltroSearch] = useState('')
  const [filtroFrom, setFiltroFrom] = useState('')
  const [filtroTo, setFiltroTo] = useState('')
  const [filtroLimit, setFiltroLimit] = useState('100')

  const [offset, setOffset] = useState(0)

  const fetchDados = useCallback(async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroUserId) params.set('user_id', filtroUserId)
      if (filtroAcao) params.set('acao', filtroAcao)
      if (filtroEntidade) params.set('entidade', filtroEntidade)
      if (filtroSearch) params.set('search', filtroSearch)
      if (filtroFrom) params.set('from_date', filtroFrom)
      if (filtroTo) params.set('to_date', filtroTo)
      params.set('limit', filtroLimit)
      params.set('offset', String(offset))

      const res = await fetch(`/api/audit?${params}`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [filtroUserId, filtroAcao, filtroEntidade, filtroSearch, filtroFrom, filtroTo, filtroLimit, offset])

  const fetchOptions = useCallback(async () => {
    const t = getToken()
    if (!t) return
    try {
      const [aRes, eRes] = await Promise.all([
        fetch('/api/audit/acoes', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('/api/audit/entidades', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ])
      setAcoes(aRes.acoes || [])
      setEntidades(eRes.entidades || [])
    } catch {}
  }, [])

  useEffect(() => { fetchOptions() }, [fetchOptions])

  useEffect(() => {
    const t = getToken()
    if (!t) return
    fetchDados()
  }, [fetchDados])

  const aplicarFiltros = () => {
    setOffset(0)
  }

  useEffect(() => { fetchDados() }, [offset])

  const total = data?.total || 0
  const limit = parseInt(filtroLimit) || 100
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-5">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Usuário</label>
            <select value={filtroUserId} onChange={e => setFiltroUserId(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Todos</option>
              {(data?.usuarios || []).map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Ação</label>
            <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Todas</option>
              {acoes.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Entidade</label>
            <select value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Todas</option>
              {entidades.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Buscar</label>
            <input type="text" value={filtroSearch} onChange={e => setFiltroSearch(e.target.value)}
              placeholder="Buscar nos detalhes..."
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal w-44" />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">De</label>
            <input type="date" value={filtroFrom} onChange={e => setFiltroFrom(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Até</label>
            <input type="date" value={filtroTo} onChange={e => setFiltroTo(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Limite</label>
            <select value={filtroLimit} onChange={e => { setFiltroLimit(e.target.value); setOffset(0) }}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
          <button onClick={aplicarFiltros}
            className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
            Filtrar
          </button>
        </div>
      </div>

      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-pulse-ash text-sm">Carregando registros...</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon z-10">
                    <th className="text-left py-3 px-4">Data/Hora</th>
                    <th className="text-left py-3 px-4">Usuário</th>
                    <th className="text-left py-3 px-4">Ação</th>
                    <th className="text-left py-3 px-4">Entidade</th>
                    <th className="text-left py-3 px-4">Detalhes</th>
                    <th className="text-center py-3 px-4">Entidade ID</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items || []).map(item => (
                    <tr key={item.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                      <td className="py-3 px-4 text-pulse-ash whitespace-nowrap font-mono text-xs">
                        {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{item.usuario_nome || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="px-2 py-0.5 rounded text-xs tracking-wider text-white"
                          style={{ backgroundColor: acaoColor(item.acao) }}
                        >
                          {item.acao}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-pulse-ash">{item.entidade || '-'}</td>
                      <td className="py-3 px-4 text-pulse-ash max-w-xs truncate" title={item.detalhes || ''}>
                        {item.detalhes ? (item.detalhes.length > 80 ? item.detalhes.slice(0, 80) + '...' : item.detalhes) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-pulse-ash font-mono text-xs">
                        {item.entidade_id ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(data?.items || []).length === 0 && (
              <div className="text-center py-10 text-pulse-ash text-sm">Nenhum registro encontrado.</div>
            )}

            <div className="flex items-center justify-between px-4 py-3 border-t border-urban-smoke">
              <div className="text-xs text-pulse-ash">
                {total > 0 ? (
                  <>
                    Exibindo {offset + 1}–{Math.min(offset + limit, total)} de {total.toLocaleString()} registros
                  </>
                ) : (
                  'Nenhum registro'
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 rounded text-xs tracking-wider border border-urban-smoke text-pulse-ash hover:text-off-white hover:border-pulse-ash transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs text-pulse-ash px-2">
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1.5 rounded text-xs tracking-wider border border-urban-smoke text-pulse-ash hover:text-off-white hover:border-pulse-ash transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Próximo
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EstatisticasTab() {
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchStats = useCallback(async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)

      const res = await fetch(`/api/audit/stats?${params}`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      const json = await res.json()
      setStats(json)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { fetchStats() }, [fetchStats])

  const maxAcoes = stats?.top_acoes?.length ? Math.max(...stats.top_acoes.map(a => a.total), 1) : 1
  const maxDiaOp = stats?.op_por_dia?.length ? Math.max(...stats.op_por_dia.map(d => d.total), 1) : 1

  return (
    <div className="space-y-5">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">De</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Até</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
          </div>
          <button onClick={fetchStats}
            className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
            {loading ? '...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-pulse-ash text-sm">Carregando estatísticas...</div>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-4 gap-5">
            <StatCard
              value={stats.total_registros.toLocaleString()}
              label="Total de Registros"
              sub="Ações registradas"
              color="#5C939F"
            />
            <StatCard
              value={stats.sessoes.usuarios_online.toString()}
              label="Usuários Online"
              sub={`${stats.sessoes.hoje} sessões hoje`}
              color="#59A993"
            />
            <StatCard
              value={stats.sessoes.hoje.toString()}
              label="Sessões Hoje"
              sub={`${stats.sessoes.total} total`}
              color="#A78BFA"
            />
            <StatCard
              value={stats.sessoes.total.toString()}
              label="Total de Sessões"
              sub="Histórico completo"
              color="#ED6D40"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Top Ações</h3>
              <div className="space-y-3">
                {stats.top_acoes.map((a, i) => (
                  <div key={a.acao || i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">{a.acao}</span>
                      <span className="text-xs text-pulse-ash font-mono">{a.total}</span>
                    </div>
                    <div className="w-full h-2 bg-urban-smoke rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round((a.total / maxAcoes) * 100)}%`,
                          backgroundColor: acaoColor(a.acao),
                        }}
                      />
                    </div>
                  </div>
                ))}
                {stats.top_acoes.length === 0 && (
                  <div className="text-xs text-pulse-ash py-4 text-center">Sem dados</div>
                )}
              </div>
            </div>

            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Top Usuários</h3>
              <div className="space-y-3">
                {stats.top_usuarios.map((u, i) => (
                  <div key={u.usuario_nome || i} className="flex items-center justify-between py-1.5 border-b border-urban-smoke/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-pulse-ash font-mono w-5">{i + 1}</span>
                      <span className="text-xs">{u.usuario_nome}</span>
                    </div>
                    <span className="text-xs text-pulse-ash font-mono">{u.total}</span>
                  </div>
                ))}
                {stats.top_usuarios.length === 0 && (
                  <div className="text-xs text-pulse-ash py-4 text-center">Sem dados</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Operações por Dia</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.op_por_dia.map((d, i) => (
                  <div key={d.data || i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-pulse-ash">
                        {d.data ? new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                      <span className="text-xs text-pulse-ash font-mono">{d.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-urban-smoke rounded-full overflow-hidden">
                      <div
                        className="h-full bg-electric-teal rounded-full"
                        style={{ width: `${Math.round((d.total / maxDiaOp) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {stats.op_por_dia.length === 0 && (
                  <div className="text-xs text-pulse-ash py-4 text-center">Sem dados</div>
                )}
              </div>
            </div>

            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Horas Online por Usuário</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(stats.sessoes.horas_online || []).map((h, i) => (
                  <div key={h.usuario_nome || i} className="flex items-center justify-between py-1.5 border-b border-urban-smoke/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-pulse-ash font-mono w-5">{i + 1}</span>
                      <span className="text-xs">{h.usuario_nome}</span>
                    </div>
                    <span className="text-xs text-pulse-ash font-mono">
                      {h.horas != null ? `${Math.round(h.horas * 10) / 10}h` : '-'}
                    </span>
                  </div>
                ))}
                {(stats.sessoes.horas_online || []).length === 0 && (
                  <div className="text-xs text-pulse-ash py-4 text-center">Sem dados</div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-12 text-center">
          <p className="text-sm text-pulse-ash">Erro ao carregar estatísticas.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
      <div className="text-xs tracking-wider mb-2" style={{ color }}>{label}</div>
      <div className="text-sm tracking-wider mb-1" style={{ fontWeight: 500 }}>{value}</div>
      <div className="text-xs text-pulse-ash">{sub}</div>
    </div>
  )
}
