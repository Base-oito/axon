import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}
export default function Inteligencia() {
  const [tab, setTab] = useState('certificados')

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/inteligencia" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Inteligência</h1>
              <p className="text-pulse-ash text-sm">Dashboard departamental e certificados</p>
            </div>
          </div>
          <div className="flex gap-1 mb-6 border-b border-urban-smoke">
            <button onClick={() => setTab('certificados')}
              className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${tab === 'certificados' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'}`}>Certificados</button>
            <button onClick={() => setTab('operacional')}
              className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${tab === 'operacional' ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'}`}>Operacional</button>
          </div>
          {tab === 'certificados' && <CertificadosTab />}
          {tab === 'operacional' && <OperacionalTab />}
        </div>
      </main>
    </div>
  )
}

/* ── CERTIFICADOS TAB ── */
function CertificadosTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    if (!t) return
    fetch('/api/inteligencia/certificados', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => { setData(d || { cards: {}, vencidos: [], a_vencer: [] }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cards = data?.cards || {}
  const vencidos: any[] = data?.vencidos || []
  const aVencer: any[] = data?.a_vencer || []

  const certStatus = (c: any) => {
    if (!c.certificate_expires_at) return null
    try {
      const exp = new Date(c.certificate_expires_at)
      const dias = (exp.getTime() - Date.now()) / 86400000
      if (dias > 30) return { label: 'Válido', color: 'bg-success/10 text-success', dias: Math.floor(dias) }
      if (dias > 0) return { label: 'Vencendo', color: 'bg-infrared/10 text-infrared', dias: Math.floor(dias) }
      return { label: 'Vencido', color: 'bg-danger/10 text-danger', dias: Math.floor(Math.abs(dias)) }
    } catch { return null }
  }

  const maxQtd = (arr: { qtd: number }[]) => Math.max(...arr.map(r => r.qtd), 1)

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-pulse-ash text-sm">Carregando certificados...</div></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <Card value={cards.total || 0} label="Total" sub="Certificados" color="#5C939F" />
        <Card value={cards.em_dia || 0} label="Em Dia" sub="Válidos" color="#59A993" />
        <Card value={cards.a_vencer_30d || 0} label="Vencendo" sub="Próximos 30 dias" color="#ED6D40" />
        <Card value={cards.vencidos || 0} label="Vencidos" sub="Expirados" color="#CB3500" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Vencidos ── */}
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
          <h3 className="text-xs tracking-wider text-danger mb-4">Vencidos ({vencidos.length})</h3>
          <div className="space-y-2 mb-4">
            {vencidos.slice(0, 6).map(c => {
              const s = certStatus(c)
              return (
                <div key={c.id} className="flex items-center justify-between bg-core-black/50 rounded-lg px-3 py-2 border border-urban-smoke/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-pulse-ash font-mono">{c.cnpj || '-'}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[10px] text-danger">{s?.dias ? `${s.dias}d atrasado` : '—'}</div>
                    <div className="text-[10px] text-pulse-ash">{c.certificate_expires_at ? new Date(c.certificate_expires_at).toLocaleDateString('pt-BR') : '-'}</div>
                  </div>
                </div>
              )
            })}
            {vencidos.length === 0 && <div className="text-xs text-pulse-ash text-center py-4">Nenhum certificado vencido.</div>}
          </div>
          <CertTable rows={vencidos} certStatus={certStatus} />
        </div>

        {/* ── A Vencer (≤30 dias) ── */}
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
          <h3 className="text-xs tracking-wider text-infrared mb-4">A Vencer ≤30 dias ({aVencer.length})</h3>
          <div className="space-y-2 mb-4">
            {aVencer.slice(0, 6).map(c => {
              const s = certStatus(c)
              return (
                <div key={c.id} className="flex items-center justify-between bg-core-black/50 rounded-lg px-3 py-2 border border-urban-smoke/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-pulse-ash font-mono">{c.cnpj || '-'}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[10px] text-infrared">{s?.dias ? `${s.dias}d` : '—'}</div>
                    <div className="text-[10px] text-pulse-ash">{c.certificate_expires_at ? new Date(c.certificate_expires_at).toLocaleDateString('pt-BR') : '-'}</div>
                  </div>
                </div>
              )
            })}
            {aVencer.length === 0 && <div className="text-xs text-pulse-ash text-center py-4">Nenhum certificado a vencer.</div>}
          </div>
          <CertTable rows={aVencer} certStatus={certStatus} />
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
          <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Cronograma de Vencimento</h3>
          <div className="space-y-1.5">
            {(data?.cronograma_vencimento || []).map((r: any) => {
              const pct = (r.qtd / maxQtd(data?.cronograma_vencimento || [])) * 100
              return (
                <div key={r.mes} className="flex items-center gap-3 text-xs">
                  <span className="text-pulse-ash w-16 shrink-0">{r.mes}</span>
                  <div className="flex-1 bg-urban-smoke rounded-full h-4 overflow-hidden flex">
                    <div className="h-full bg-electric-teal rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-off-white font-roc w-6 text-right shrink-0" style={{ fontWeight: 500 }}>{r.qtd}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
          <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Renovações por Mês</h3>
          <div className="space-y-1.5">
            {(data?.renovacoes_mes || []).map((r: any) => {
              const pct = (r.qtd / maxQtd(data?.renovacoes_mes || [])) * 100
              return (
                <div key={r.mes} className="flex items-center gap-3 text-xs">
                  <span className="text-pulse-ash w-16 shrink-0">{r.mes}</span>
                  <div className="flex-1 bg-urban-smoke rounded-full h-4 overflow-hidden flex">
                    <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-off-white font-roc w-6 text-right shrink-0" style={{ fontWeight: 500 }}>{r.qtd}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CertTable({ rows, certStatus }: { rows: any[]; certStatus: (c: any) => any }) {
  return (
    <div className="overflow-x-auto max-h-48 overflow-y-auto border-t border-urban-smoke/50 pt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-pulse-ash tracking-wider">
            <th className="text-left py-1.5 pr-2">Cliente</th>
            <th className="text-left py-1.5 pr-2">CNPJ</th>
            <th className="text-left py-1.5 pr-2">Validade</th>
            <th className="text-center py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c: any) => {
            const s = certStatus(c)
            return (
              <tr key={c.id} className="border-b border-urban-smoke/10 hover:bg-urban-smoke/20 transition-colors">
                <td className="py-1.5 pr-2 truncate max-w-[140px]">{c.name || '-'}</td>
                <td className="py-1.5 pr-2 text-pulse-ash font-mono">{c.cnpj || '-'}</td>
                <td className="py-1.5 pr-2 text-pulse-ash">{c.certificate_expires_at ? new Date(c.certificate_expires_at).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="py-1.5 text-center">{s && <span className={`px-1.5 py-0.5 rounded text-[10px] tracking-wider ${s.color}`}>{s.label}</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── OPERACIONAL TAB ── */
function OperacionalTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deptos, setDeptos] = useState<any[]>([])
  const [deptId, setDeptId] = useState('')
  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')

  const load = () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    const params = new URLSearchParams()
    if (deptId) params.set('departamento_id', deptId)
    if (dataIni) params.set('data_inicio_obrigacoes', dataIni)
    if (dataFim) params.set('data_fim_obrigacoes', dataFim)
    fetch(`/api/inteligencia/dashboard?${params}`, { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => {
    const t = getToken()
    if (!t) return
    fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setDeptos).catch(() => {})
    load()
  }, [])

  const c = data?.cards || {}

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)}
            className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
            <option value="">Todos</option>
            {deptos.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs tracking-wider text-pulse-ash mb-1">Data Início</label>
          <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
            className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
        </div>
        <div>
          <label className="block text-xs tracking-wider text-pulse-ash mb-1">Data Fim</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
        </div>
        <button onClick={load}
          className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
          {loading ? '...' : 'Filtrar'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="text-pulse-ash text-sm">Carregando...</div></div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-6 gap-4">
            <Card value={c.total_obrigacoes || 0} label="Obrigações" sub="Total no período" color="#5C939F" />
            <Card value={c.obrigacoes_realizadas || 0} label="Realizadas" sub="Concluídas" color="#59A993" />
            <Card value={`${c.eficiencia_obrigacoes || 0}%`} label="Eficiência" sub="Obrigações" color="#A78BFA" />
            <Card value={c.total_tarefas || 0} label="Tarefas" sub="Total no período" color="#ED6D40" />
            <Card value={c.tarefas_realizadas || 0} label="Realizadas" sub="Concluídas" color="#59A993" />
            <Card value={`${c.eficiencia_tarefas || 0}%`} label="Eficiência" sub="Tarefas" color="#A78BFA" />
          </div>

          {/* Colaboradores */}
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
            <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Desempenho por Colaborador</h3>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                    <th className="text-left py-2 pr-3">Colaborador</th>
                    <th className="text-center py-2 pr-3">Empresas</th>
                    <th className="text-center py-2 pr-3">Obrig.</th>
                    <th className="text-center py-2 pr-3">Entregues</th>
                    <th className="text-center py-2 pr-3">Efic. Obrig.</th>
                    <th className="text-center py-2 pr-3">Tarefas</th>
                    <th className="text-center py-2 pr-3">Realizadas</th>
                    <th className="text-center py-2 pr-3">Efic. Taref.</th>
                    <th className="text-center py-2 pr-3">Atraso</th>
                    <th className="text-center py-2">Méd. Tarefa (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.colaboradores || []).map((col: any) => (
                    <tr key={col.user_id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                      <td className="py-2 pr-3 font-medium">{col.nome}</td>
                      <td className="py-2 pr-3 text-center">{col.total_empresas}</td>
                      <td className="py-2 pr-3 text-center">{col.total_obrigacoes}</td>
                      <td className="py-2 pr-3 text-center">{col.obrigacoes_entregues}</td>
                      <td className="py-2 pr-3 text-center">
                        <span className={col.eficiencia_obrigacoes >= 80 ? 'text-success' : col.eficiencia_obrigacoes >= 50 ? 'text-infrared' : 'text-danger'}>{col.eficiencia_obrigacoes}%</span>
                      </td>
                      <td className="py-2 pr-3 text-center">{col.total_tarefas}</td>
                      <td className="py-2 pr-3 text-center">{col.tarefas_realizadas}</td>
                      <td className="py-2 pr-3 text-center">
                        <span className={col.eficiencia_tarefas >= 80 ? 'text-success' : col.eficiencia_tarefas >= 50 ? 'text-infrared' : 'text-danger'}>{col.eficiencia_tarefas}%</span>
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <span className={col.obrigacoes_atraso + col.tarefas_atraso > 0 ? 'text-danger' : 'text-success'}>
                          {col.obrigacoes_atraso + col.tarefas_atraso}
                        </span>
                      </td>
                      <td className="py-2 text-center text-pulse-ash">{col.tempo_medio_tarefa_horas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(data?.colaboradores || []).length === 0 && <div className="text-center py-8 text-pulse-ash text-sm">Nenhum colaborador encontrado.</div>}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Obrigações Mensais */}
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Obrigações Mensais</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(data?.obrigacoes_mensais || []).map((r: any) => (
                  <div key={r.mes} className="flex items-center gap-3 text-xs">
                    <span className="text-pulse-ash w-16 shrink-0">{r.mes}</span>
                    <div className="flex-1 bg-urban-smoke rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-electric-teal rounded-full" style={{ width: `${r.total > 0 ? (r.entregues / r.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-pulse-ash w-12 text-right shrink-0">{r.entregues}/{r.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 Empresas Obrigações Atraso */}
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Top 10 — Obrigações em Atraso</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(data?.top_10_empresas_obrigacoes_atraso || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1">{r.nome}</span>
                    <span className="text-danger font-roc ml-2" style={{ fontWeight: 500 }}>{r.quantidade}</span>
                  </div>
                ))}
              </div>
              {(data?.top_10_empresas_obrigacoes_atraso || []).length === 0 && <div className="text-center py-4 text-pulse-ash text-xs">Nenhuma obrigação em atraso.</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Top 10 Tarefas Atraso */}
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Top 10 — Tarefas em Atraso</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(data?.top_10_empresas_tarefas_atraso || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1">{r.nome}</span>
                    <span className="text-danger font-roc ml-2" style={{ fontWeight: 500 }}>{r.quantidade}</span>
                  </div>
                ))}
              </div>
              {(data?.top_10_empresas_tarefas_atraso || []).length === 0 && <div className="text-center py-4 text-pulse-ash text-xs">Nenhuma tarefa em atraso.</div>}
            </div>

            {/* Top 5 Eficiência Geral */}
            <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
              <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Top 5 — Eficiência Geral</h3>
              <div className="space-y-2">
                {(data?.top_5_eficiencia_geral || []).map((r: any, i: number) => {
                  const media = (r.eficiencia_obrigacoes + r.eficiencia_tarefas) / 2
                  return (
                    <div key={r.user_id} className="flex items-center gap-3 text-xs">
                      <span className="text-pulse-ash w-5 shrink-0 text-right">{i + 1}.</span>
                      <span className="flex-1">{r.nome}</span>
                      <div className="w-20 h-1.5 bg-urban-smoke rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full" style={{ width: media + '%' }} />
                      </div>
                      <span className="text-success font-roc w-8 text-right" style={{ fontWeight: 500 }}>{Math.round(media)}%</span>
                    </div>
                  )
                })}
              </div>
              {(data?.top_5_eficiencia_geral || []).length === 0 && <div className="text-center py-4 text-pulse-ash text-xs">Sem dados.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ value, label, sub, color }: { value: number | string; label: string; sub: string; color: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
      <div className="text-xs tracking-wider mb-1" style={{ color }}>{label}</div>
      <div className="text-sm tracking-wider mb-0.5" style={{ fontWeight: 500 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-pulse-ash">{sub}</div>
    </div>
  )
}
