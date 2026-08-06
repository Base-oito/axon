import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

export default function MonitorClientes() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [calcLoading, setCalcLoading] = useState(false)

  const load = async (forceCalc = false) => {
    const t = getToken(); if (!t) return
    if (forceCalc) setCalcLoading(true); else setLoading(true)
    try {
      const r = await fetch('/api/clientes/monitor', { headers: { Authorization: 'Bearer ' + t } })
      setData(await r.json())
    } catch {}
    setLoading(false); setCalcLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/monitor-clientes" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-roc" style={{ fontWeight: 500 }}>Monitor de Clientes</h1>
              <p className="text-pulse-ash text-sm">Atividade fiscal — clientes que pararam ou retornaram</p>
            </div>
            <button onClick={() => load(true)} disabled={calcLoading}
              className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
              {calcLoading ? 'Calculando...' : 'Recalcular Agora'}
            </button>
          </div>

          {loading && <div className="text-center py-20 text-pulse-ash text-sm">Carregando...</div>}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                <Card value={data.cards.ativos} label="Ativos" sub="Com movimento ≤60d" color="#59A993" />
                <Card value={data.cards.retornaram} label="Retornaram" sub="Voltaram a emitir" color="#F97316" />
                <Card value={data.cards.pararam} label="Pararam" sub="Sem emissão >60d" color="#CB3500" />
                <Card value={data.cards.sem_movimento} label="Sem Movimento" sub="Nunca emitiram" color="#64748B" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <h3 className="text-xs tracking-wider text-infrared mb-4">Pararam de emitir ({data.pararam.length})</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data.pararam.map((c: any) => (
                      <div key={c.cliente_id} className="flex items-center justify-between bg-core-black/50 rounded-lg px-3 py-2 border border-urban-smoke/30">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate">{c.nome}</div>
                          <div className="text-[10px] text-pulse-ash font-mono">{c.cnpj || '-'}</div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-[10px] text-pulse-ash">Última: {c.ultima_nfse ? new Date(c.ultima_nfse).toLocaleDateString('pt-BR') : '-'}</span>
                        </div>
                      </div>
                    ))}
                    {data.pararam.length === 0 && <div className="text-xs text-pulse-ash text-center py-4">Nenhum cliente parou de emitir.</div>}
                  </div>
                </div>

                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                  <h3 className="text-xs tracking-wider text-electric-teal mb-4">Retornaram a emitir ({data.retornaram.length})</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data.retornaram.map((c: any) => (
                      <div key={c.cliente_id} className="flex items-center justify-between bg-core-black/50 rounded-lg px-3 py-2 border border-urban-smoke/30">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate">{c.nome}</div>
                          <div className="text-[10px] text-pulse-ash font-mono">{c.cnpj || '-'}</div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-[10px] text-success">{c.total_60d} notas</span>
                        </div>
                      </div>
                    ))}
                    {data.retornaram.length === 0 && <div className="text-xs text-pulse-ash text-center py-4">Nenhum cliente retornou.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Card({ value, label, sub, color }: { value: number | string; label: string; sub: string; color: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
      <div className="text-xs tracking-wider mb-1" style={{ color }}>{label}</div>
      <div className="text-2xl font-roc mb-0.5" style={{ fontWeight: 500 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-pulse-ash">{sub}</div>
    </div>
  )
}
