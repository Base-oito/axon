import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

type CanonicalAcc = { id: number; codigo: string; nome_padrao: string; grupo: string; tipo: string }
type PlanoConta = { id: number; codigo: string; descricao: string; confianca: number; origem: string; canonica_id: number | null; canonica_nome: string | null; canonica_grupo: string | null }
type Cliente = { id: number; name: string; cnpj?: string }
type Importacao = { id: number; cliente_nome: string; arquivo_nome: string; total_lancamentos: number; classificados_auto: number; pendentes: number; status: string; created_at: string }
type Lancamento = { id: number; data: string | null; descricao: string; valor: number; tipo_lancamento: string; conta_sugerida_id: number | null; conta_sugerida_nome: string | null; conta_confirmada_id: number | null; confianca: number; status: string }

export default function ImportacaoContabil() {
  const [tab, setTab] = useState('plano')

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/importacao-contabil" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Importação Contábil</h1>
              <p className="text-pulse-ash text-sm">Plano de contas, importação financeira e classificação automática</p>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke flex-wrap">
            {[
              { key: 'plano', label: 'Plano de Contas' },
              { key: 'financeiro', label: 'Financeiro' },
              { key: 'historico', label: 'Histórico' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  tab === t.key ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'plano' && <PlanoContasTab />}
          {tab === 'financeiro' && <FinanceiroTab />}
          {tab === 'historico' && <HistoricoTab />}
        </div>
      </main>
    </div>
  )
}

/* ── PLANO DE CONTAS ── */
function PlanoContasTab() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null)
  const [plano, setPlano] = useState<PlanoConta[]>([])
  const [canonicas, setCanonicas] = useState<CanonicalAcc[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('todos')
  const [matchResult, setMatchResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setClientes).catch(() => {})
    fetch('/api/contabil/contas-canonicas', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setCanonicas).catch(() => {})
  }, [])

  const loadPlano = async (clienteId: number) => {
    const t = getToken(); if (!t) return; setLoading(true)
    const status = filter === 'pendente' ? 'pendente' : filter === 'classificado' ? 'classificado' : ''
    const qs = status ? `?status=${status}` : ''
    fetch(`/api/contabil/planos-contas/${clienteId}${qs}`, { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setPlano).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedCliente) loadPlano(selectedCliente)
  }, [selectedCliente, filter])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selectedCliente) return
    setUploading(true)
    const t = getToken(); if (!t) return
    const fd = new FormData(); fd.append('file', file); fd.append('cliente_id', String(selectedCliente))
    try {
      const r = await fetch('/api/contabil/planos-contas/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      const d = await r.json(); setMatchResult(d); loadPlano(selectedCliente)
    } catch {}
    setUploading(false)
  }

  const handleMatch = async (planoId: number, canonicalId: number) => {
    const t = getToken(); if (!t) return
    await fetch(`/api/contabil/planos-contas/${planoId}/match`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ conta_canonica_id: canonicalId }),
    })
    if (selectedCliente) loadPlano(selectedCliente)
  }

  const grupoColor = (g: string) => {
    const m: Record<string, string> = { receita: 'text-success', despesa: 'text-danger', custo: 'text-infrared', ativo: 'text-electric-teal', passivo: 'text-yellow-400', patrimonio: 'text-purple-400' }
    return m[g] || 'text-pulse-ash'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <select value={selectedCliente || ''} onChange={e => setSelectedCliente(e.target.value ? parseInt(e.target.value) : null)}
          className="bg-rich-carbon border border-urban-smoke rounded-lg px-3 py-2 text-sm text-off-white min-w-[220px]">
          <option value="">Selecionar cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedCliente && (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
              {uploading ? 'Enviando...' : 'Upload CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" />
            <div className="flex gap-0.5 bg-urban-smoke/30 rounded-lg p-0.5">
              {['todos', 'classificado', 'pendente'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs tracking-wider transition-colors capitalize ${
                    filter === f ? 'bg-electric-teal text-white' : 'text-pulse-ash hover:text-off-white'
                  }`}>{f}</button>
              ))}</div>
          </>
        )}
      </div>

      {matchResult && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 text-xs text-success">
          {matchResult.total} contas importadas — {matchResult.classificados_auto} automáticas, {matchResult.pendentes} pendentes
        </div>
      )}

      {loading && <div className="text-center py-10 text-pulse-ash text-sm">Carregando...</div>}

      {!loading && selectedCliente && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon">
                  <th className="text-left py-2.5 px-4">Código</th>
                  <th className="text-left py-2.5 px-4">Descrição</th>
                  <th className="text-left py-2.5 px-4">Conta Canônica</th>
                  <th className="text-center py-2.5 px-4">Confiança</th>
                  <th className="text-center py-2.5 px-4 w-48">Ajustar</th>
                </tr>
              </thead>
              <tbody>
                {plano.map(p => (
                  <tr key={p.id} className="border-b border-urban-smoke/10 hover:bg-urban-smoke/20 transition-colors">
                    <td className="py-2 px-4 font-mono text-pulse-ash">{p.codigo || '-'}</td>
                    <td className="py-2 px-4">{p.descricao}</td>
                    <td className="py-2 px-4">
                      {p.canonica_nome ? (
                        <span className={`${grupoColor(p.canonica_grupo || '')}`}>{p.canonica_nome}</span>
                      ) : (
                        <span className="text-pulse-ash italic">—</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.confianca >= 60 ? 'bg-success/10 text-success' : 'bg-infrared/10 text-infrared'}`}>
                        {p.confianca}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <select value={p.canonica_id || ''}
                        onChange={e => { if (e.target.value) handleMatch(p.id, parseInt(e.target.value)) }}
                        className="bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white w-full">
                        <option value="">Selecionar...</option>
                        {canonicas.map(c => (
                          <option key={c.id} value={c.id}>{c.nome_padrao}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plano.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhuma conta. Faça upload do CSV.</div>}
          </div>
        </div>
      )}
      {!selectedCliente && <div className="text-center py-20 text-pulse-ash text-sm">Selecione um cliente para começar.</div>}
    </div>
  )
}

/* ── FINANCEIRO ── */
function FinanceiroTab() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null)
  const [importacaoId, setImportacaoId] = useState<number | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [canonicas, setCanonicas] = useState<CanonicalAcc[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [filter, setFilter] = useState('todos')
  const [ctpDebito, setCtpDebito] = useState('1')
  const [ctpCredito, setCtpCredito] = useState('1')
  const [codFilial, setCodFilial] = useState('')
  const [codHistorico, setCodHistorico] = useState('0')
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setClientes).catch(() => {})
    fetch('/api/contabil/contas-canonicas', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setCanonicas).catch(() => {})
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selectedCliente) return
    setUploading(true)
    const t = getToken(); if (!t) return
    const fd = new FormData(); fd.append('file', file); fd.append('cliente_id', String(selectedCliente))
    try {
      const r = await fetch('/api/contabil/financeiro/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      const d = await r.json(); setResult(d); setImportacaoId(d.importacao_id)
      loadLancamentos(d.importacao_id)
    } catch {}
    setUploading(false)
  }

  const loadLancamentos = async (importId: number) => {
    const t = getToken(); if (!t) return; setLoading(true)
    const status = filter === 'pendente' ? 'pendente' : filter === 'classificado' ? 'classificado' : ''
    const qs = status ? `?status=${status}` : ''
    fetch(`/api/contabil/financeiro/${importId}/lancamentos${qs}`, { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setLancamentos).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (importacaoId) loadLancamentos(importacaoId)
  }, [filter])

  const handleClassify = async (lancId: number, canonicalId: number) => {
    const t = getToken(); if (!t) return
    await fetch(`/api/contabil/financeiro/lancamentos/${lancId}/classificar`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ conta_canonica_id: canonicalId }),
    })
    if (importacaoId) loadLancamentos(importacaoId)
  }

  const formatMoney = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <select value={selectedCliente || ''} onChange={e => setSelectedCliente(e.target.value ? parseInt(e.target.value) : null)}
          className="bg-rich-carbon border border-urban-smoke rounded-lg px-3 py-2 text-sm text-off-white min-w-[220px]">
          <option value="">Selecionar cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedCliente && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
            {uploading ? 'Processando...' : 'Upload Planilha'}
          </button>
        )}
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" />
      </div>

      {result && (
        <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 text-xs text-success">
          {result.total} lançamentos — {result.auto} automáticos, {result.pendentes} pendentes
        </div>
      )}

      {importacaoId && (
        <div className="flex gap-0.5 bg-urban-smoke/30 rounded-lg p-0.5">
          {['todos', 'classificado', 'confirmado', 'pendente'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs tracking-wider transition-colors capitalize ${
                filter === f ? 'bg-electric-teal text-white' : 'text-pulse-ash hover:text-off-white'
              }`}>{f}</button>
          ))}
        </div>
      )}

      {importacaoId && lancamentos.filter(l => l.status !== 'pendente').length > 0 && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-4 space-y-3">
          <h4 className="text-xs tracking-wider text-electric-teal">Exportar para Domínio (Vários para Vários)</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-pulse-ash w-20 shrink-0">Cta Débito:</span>
              <input value={ctpDebito} onChange={e => setCtpDebito(e.target.value)}
                placeholder="1" className="bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white w-16" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-pulse-ash w-20 shrink-0">Cta Crédito:</span>
              <input value={ctpCredito} onChange={e => setCtpCredito(e.target.value)}
                placeholder="1" className="bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white w-16" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-pulse-ash">Filial:</span>
              <input value={codFilial} onChange={e => setCodFilial(e.target.value)}
                placeholder="0" className="bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white w-16" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-pulse-ash">Cód.Hist:</span>
              <input value={codHistorico} onChange={e => setCodHistorico(e.target.value)}
                placeholder="0" className="bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white w-16" />
            </div>
            <button onClick={async () => {
              const t = getToken(); if (!t) return; setExporting(true)
              try {
                const r = await fetch(`/api/contabil/financeiro/${importacaoId}/exportar`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
                  body: JSON.stringify({ contrapartida_debito: ctpDebito, contrapartida_credito: ctpCredito, cod_filial: codFilial, cod_historico: codHistorico }),
                })
                const d = await r.json()
                if (d.conteudo) {
                  const blob = new Blob([d.conteudo], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = d.arquivo; a.click()
                  URL.revokeObjectURL(url)
                }
              } catch { alert('Erro ao exportar') }
              setExporting(false)
            }} disabled={exporting}
              className="ml-auto px-4 py-2 rounded-lg text-xs tracking-wider bg-success text-white hover:bg-success/80 transition-colors disabled:opacity-30">
              {exporting ? 'Exportando...' : 'Exportar TXT'}
            </button>
          </div>
          <p className="text-[10px] text-pulse-ash">Despesas/Custos usam conta de débito, Receitas usam conta de crédito. O sistema inverte automaticamente.</p>
        </div>
      )}

      {loading && <div className="text-center py-10 text-pulse-ash text-sm">Carregando...</div>}

      {!loading && importacaoId && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon">
                  <th className="text-left py-2.5 px-3">Data</th>
                  <th className="text-left py-2.5 px-3">Descrição</th>
                  <th className="text-right py-2.5 px-3">Valor</th>
                  <th className="text-center py-2.5 px-3">Tipo</th>
                  <th className="text-left py-2.5 px-3">Conta Sugerida</th>
                  <th className="text-center py-2.5 px-3">Confiança</th>
                  <th className="text-center py-2.5 px-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map(l => (
                  <tr key={l.id} className="border-b border-urban-smoke/10 hover:bg-urban-smoke/20 transition-colors">
                    <td className="py-2 px-3 font-mono text-pulse-ash">{l.data ? new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[250px]" title={l.descricao}>{l.descricao}</td>
                    <td className="py-2 px-3 text-right font-mono">R$ {formatMoney(l.valor)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${l.tipo_lancamento === 'debito' ? 'bg-infrared/10 text-infrared' : 'bg-success/10 text-success'}`}>
                        {l.tipo_lancamento}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {l.conta_sugerida_nome ? (
                        <span className="text-success">{l.conta_sugerida_nome}</span>
                      ) : (
                        <span className="text-pulse-ash italic">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${l.confianca >= 60 ? 'bg-success/10 text-success' : 'bg-infrared/10 text-infrared'}`}>
                        {l.confianca}%
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <select value={l.conta_sugerida_id || ''}
                        onChange={e => { if (e.target.value) handleClassify(l.id, parseInt(e.target.value)) }}
                        className="bg-core-black border border-urban-smoke rounded px-2 py-1 text-xs text-off-white w-full">
                        <option value="">Classificar...</option>
                        {canonicas.map(c => (
                          <option key={c.id} value={c.id}>{c.nome_padrao}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lancamentos.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhum lançamento.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── HISTÓRICO ── */
function HistoricoTab() {
  const [imports, setImports] = useState<Importacao[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    const t = getToken(); if (!t) return; setLoading(true)
    fetch('/api/contabil/financeiro', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setImports).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="text-center py-10 text-pulse-ash text-sm">Carregando...</div>

  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon">
              <th className="text-left py-2.5 px-4">Data</th>
              <th className="text-left py-2.5 px-4">Cliente</th>
              <th className="text-left py-2.5 px-4">Arquivo</th>
              <th className="text-center py-2.5 px-4">Total</th>
              <th className="text-center py-2.5 px-4">Auto</th>
              <th className="text-center py-2.5 px-4">Pendentes</th>
              <th className="text-center py-2.5 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {imports.map(imp => (
              <tr key={imp.id} className="border-b border-urban-smoke/10 hover:bg-urban-smoke/20 transition-colors">
                <td className="py-2 px-4 text-pulse-ash">{imp.created_at ? new Date(imp.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td className="py-2 px-4">{imp.cliente_nome}</td>
                <td className="py-2 px-4 font-mono text-pulse-ash">{imp.arquivo_nome}</td>
                <td className="py-2 px-4 text-center">{imp.total_lancamentos}</td>
                <td className="py-2 px-4 text-center text-success">{imp.classificados_auto}</td>
                <td className="py-2 px-4 text-center text-infrared">{imp.pendentes}</td>
                <td className="py-2 px-4 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    imp.status === 'concluido' ? 'bg-success/10 text-success' :
                    imp.status === 'processando' ? 'bg-electric-teal/10 text-electric-teal' :
                    'bg-pulse-ash/10 text-pulse-ash'
                  }`}>{imp.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {imports.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhuma importação realizada.</div>}
      </div>
    </div>
  )
}
