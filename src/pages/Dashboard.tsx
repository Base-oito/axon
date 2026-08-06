import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

type DashboardData = {
  overall: {
    clientes: { total: number; ativos: number; inativos: number }
    obrigacoes: { total: number; pendentes: number; concluidas: number; eficiencia: number }
    tarefas: { total: number; pendentes: number; concluidas: number; eficiencia: number }
    processos: { total: number; em_andamento: number; finalizados: number; cancelados: number }
  }
  departamentos: Array<{
    id: number; nome: string
    obrigacoes: { total: number; concluidas: number }
    tarefas: { total: number; concluidas: number }
    processos: { total: number }
  }>
  usuarios: Array<{
    id: number; nome: string
    obrigacoes: { total: number; concluidas: number }
    tarefas: { total: number; concluidas: number }
    processos: { total: number; concluidos: number }
  }>
  nfse: {
    total: number; hoje: number; tomados: number; prestados: number
    valor_total: number; valor_tomados: number; valor_prestados: number
  }
  nf_e: {
    total: number; hoje: number; entrada: number; saida: number
    valor_total: number; v_icms: number; v_ipi: number; v_pis: number; v_cofins: number
  }
  certificados: { validos: number; vencendo: number; vencidos: number }
  execucoes_recentes: Array<{
    id: number; tipo: string; movement_type: string; client_name: string
    owner_cnpj: string; issued_at: string; created_at: string; total_value: number
  }>
}

type OperacionalData = {
  resumo: {
    total_clientes: number; clientes_ativos: number
    total_nfse: number; total_nfe: number; total_docs: number
    media_docs: number; sem_movimento: number
  }
  departamentos: Array<{ nome: string }>
  clientes: Array<{
    id: number; name: string; cnpj: string; active: boolean
    departamento: string; nfse: number; nfe: number
    total_docs: number; certificado: string
  }>
}

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('performance')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [opData, setOpData] = useState<OperacionalData | null>(null)

  // Document search state
  const [docType, setDocType] = useState('todas')
  const [docMov, setDocMov] = useState('')
  const [docCli, setDocCli] = useState('')
  const [docFrom, setDocFrom] = useState('')
  const [docTo, setDocTo] = useState('')
  const [docQuery, setDocQuery] = useState('')
  const [cliList, setCliList] = useState<Array<{ id: number; name: string }>>([])
  const [docs, setDocs] = useState<Array<any>>([])
  const [docLoading, setDocLoading] = useState(false)
  const [docPage, setDocPage] = useState(0)
  const [docTotal, setDocTotal] = useState(0)
  const DOCS_PER_PAGE = 100

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    Promise.all([
      fetch('/api/dashboard/completo', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/dashboard/operacional', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ]).then(([d, o]) => {
      setData(d)
      setOpData(o)
      setLoading(false)
    }).catch(() => { setLoading(false) })
    fetch('/api/clientes', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setCliList(Array.isArray(d) ? d : [])).catch(() => {})
  }, [navigate])

  const loadDocs = async (page = 0) => {
    const t = getToken()
    if (!t) return
    setDocLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(DOCS_PER_PAGE))
      params.set('offset', String(page * DOCS_PER_PAGE))
      if (docCli) params.set('cliente_id', docCli)
      if (docFrom) params.set('issued_from', docFrom)
      if (docTo) params.set('issued_to', docTo)
      if (docMov) params.set('movement_type', docMov)
      if (docQuery) params.set('search', docQuery)

      const needsNfse = docType === 'nfse' || docType === 'todas'
      const needsNfe = docType === 'mercadorias' || docType === 'todas'

       const [nfseRes, nfeRes] = await Promise.all([
         needsNfse ? fetch(`/api/nfse-documents?${params}`, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => ({ documents: [], total: 0, aggregates: { total_value: 0 } })) : Promise.resolve({ documents: [], total: 0, aggregates: { total_value: 0 } }),
         needsNfe ? fetch(`/api/merchandise-documents?${params}`, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => ({ documents: [], total: 0, aggregates: { total_value: 0, v_icms: 0, v_pis: 0, v_cofins: 0, v_ipi: 0, v_frete: 0, v_prod: 0 } })) : Promise.resolve({ documents: [], total: 0, aggregates: { total_value: 0, v_icms: 0, v_pis: 0, v_cofins: 0, v_ipi: 0, v_frete: 0, v_prod: 0 } }),
       ])

       const nfseList = (nfseRes.documents || []).map((d: any) => ({
         ...d,
         tipo: 'NFS-e',
         movimento: d.movement_type,
         chave: d.access_key || d.identificador || '-',
         numero: d.number || '',
         emitente: d.issuer_name || d.counterparty_name || '-',
       }))
       const nfeList = (nfeRes.documents || [])
         .filter((d: any) => !d.is_event)
         .map((d: any) => ({
           ...d,
           tipo: 'NF-e',
           movimento: d.movement_type,
           chave: d.access_key || '-',
           numero: d.number || '',
           emitente: d.issuer_name || d.counterparty_name || '-',
         }))

       const all = [...nfseList, ...nfeList]
       all.sort((a: any, b: any) => (b.created_at || b.issued_at || '').localeCompare(a.created_at || a.issued_at || ''))
       setDocs(all)
       setDocPage(page)
       setDocTotal((nfseRes.total || 0) + (nfeRes.total || 0))

       const af = nfseRes.aggregates || { total_value: 0 }
       const am = nfeRes.aggregates || { total_value: 0, v_icms: 0, v_pis: 0, v_cofins: 0, v_ipi: 0, v_frete: 0, v_prod: 0 }
       setDocTotals({
         valor: (af.total_value || 0) + (am.total_value || 0),
         icms: am.v_icms || 0,
         pis: am.v_pis || 0,
         cofins: am.v_cofins || 0,
         ipi: am.v_ipi || 0,
         frete: am.v_frete || 0,
         prod: am.v_prod || 0,
       })
    } catch (e) { console.error(e) }
    setDocLoading(false)
  }

   const [docTotals, setDocTotals] = useState({ valor: 0, icms: 0, pis: 0, cofins: 0, ipi: 0, frete: 0, prod: 0 })
  const [excelLoading, setExcelLoading] = useState(false)

  useEffect(() => { if (tab === 'documentos') { setDocPage(0); loadDocs(0) } }, [tab, docType, docMov, docCli, docFrom, docTo])

  const downloadPdfReport = async () => {
    const t = getToken(); if (!t) return
    const body: any = { doc_type: docType === 'todas' ? 'both' : docType === 'nfse' ? 'nfse' : 'merchandise' }
    if (docMov) body.movement = docMov
    if (docCli) body.cliente_id = docCli
    if (docFrom) body.issued_from = docFrom
    if (docTo) body.issued_to = docTo
    try {
      const r = await fetch('/api/relatorios/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'relatorio-fiscal.pdf'; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erro ao gerar relatório') }
  }

  const downloadExcelReport = async () => {
    const t = getToken(); if (!t) return
    setExcelLoading(true)
    const body: any = { doc_type: docType === 'todas' ? 'both' : docType === 'nfse' ? 'nfse' : 'merchandise' }
    if (docMov) body.movement = docMov
    if (docCli) body.cliente_id = docCli
    if (docFrom) body.issued_from = docFrom
    if (docTo) body.issued_to = docTo
    try {
      const r = await fetch('/api/relatorios/excel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'relatorio-fiscal.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erro ao gerar planilha Excel') }
    setExcelLoading(false)
  }

  const downloadXmlZip = async () => {
    const t = getToken(); if (!t) return
    const body: any = { doc_type: docType === 'todas' ? 'both' : docType === 'nfse' ? 'nfse' : 'merchandise' }
    if (docMov) body.movement = docMov
    if (docCli) body.cliente_id = docCli
    if (docFrom) body.issued_from = docFrom
    if (docTo) body.issued_to = docTo
    try {
      const r = await fetch('/api/relatorios/xml-zip', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'xmls.zip'; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erro ao baixar XMLs') }
  }

  const tabs = [
    { key: 'performance', label: 'Performance' },
    { key: 'operacional', label: 'Operacional' },
    { key: 'notas', label: 'Notas Fiscais' },
    { key: 'documentos', label: 'Documentos' },
  ]

  const d = data
  const o = data?.overall
  const ns = data?.nfse
  const ne = data?.nf_e

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/dashboard" />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Dashboard</h1>
              <p className="text-pulse-ash text-sm">Indicadores consolidados do escritório</p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/dashboard/pdf" target="_blank"
                className="text-xs text-electric-teal hover:text-off-white transition-colors tracking-wider border border-electric-teal/30 px-4 py-2 rounded-lg">
                PDF
              </a>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 mb-8 border-b border-urban-smoke">
            {tabs.map(t => (
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

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Carregando dashboard...</div>
            </div>
          )}

          {/* ── TAB: PERFORMANCE ── */}
          {!loading && tab === 'performance' && d && (
            <div className="space-y-6">
              {/* 4 main cards */}
              <div className="grid grid-cols-4 gap-5">
                <StatCard value={o?.clientes?.ativos || 0} label="Clientes Ativos" sub={`${o?.clientes?.total || 0} total`} color="blue" />
                <StatCard value={o?.obrigacoes?.concluidas || 0} label="Obrigações OK" sub={`${o?.obrigacoes?.eficiencia || 0}% eficiência`} color="green" />
                <StatCard value={o?.tarefas?.concluidas || 0} label="Tarefas OK" sub={`${o?.tarefas?.eficiencia || 0}% eficiência`} color="purple" />
                <StatCard value={o?.processos?.total || 0} label="Processos" sub={`${o?.processos?.finalizados || 0} finalizados`} color="amber" />
              </div>

              {/* NFS-e + NF-e */}
              <div className="grid grid-cols-2 gap-5">
                {ns && (
                  <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                    <h3 className="text-xs tracking-wider text-pulse-ash mb-4">NFS-e</h3>
                    <div className="text-3xl mb-1 font-roc" style={{ fontWeight: 500 }}>{ns.total.toLocaleString()}</div>
                    <div className="text-xs text-pulse-ash mb-4">{ns.hoje} hoje</div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="p-4 bg-electric-teal/5 rounded-xl border border-electric-teal/10">
                        <div className="text-xs text-electric-teal tracking-wider mb-1">Tomados</div>
                        <div className="text-xl font-roc" style={{ fontWeight: 500 }}>{ns.tomados.toLocaleString()}</div>
                        <div className="text-xs text-pulse-ash mt-1">R$ {ns.valor_tomados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="p-4 bg-infrared/5 rounded-xl border border-infrared/10">
                        <div className="text-xs text-infrared tracking-wider mb-1">Prestados</div>
                        <div className="text-xl font-roc" style={{ fontWeight: 500 }}>{ns.prestados.toLocaleString()}</div>
                        <div className="text-xs text-pulse-ash mt-1">R$ {ns.valor_prestados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                )}
                {ne && (
                  <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                    <h3 className="text-xs tracking-wider text-pulse-ash mb-4">NF-e Entrada (Compras)</h3>
                    <div className="text-3xl mb-1 font-roc" style={{ fontWeight: 500 }}>{ne.total.toLocaleString()}</div>
                    <div className="text-xs text-pulse-ash mb-4">{ne.hoje} hoje</div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="p-4 bg-electric-teal/5 rounded-xl border border-electric-teal/10">
                        <div className="text-xs text-electric-teal tracking-wider mb-1">Entrada</div>
                        <div className="text-xl font-roc" style={{ fontWeight: 500 }}>{ne.entrada.toLocaleString()}</div>
                        <div className="text-xs text-pulse-ash mt-1">R$ {ne.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-pulse-ash">ICMS</span>
                          <span>R$ {ne.v_icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-pulse-ash">IPI</span>
                          <span>R$ {ne.v_ipi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-pulse-ash">PIS</span>
                          <span>R$ {ne.v_pis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-pulse-ash">COFINS</span>
                          <span>R$ {ne.v_cofins.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Departments + Users */}
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Departamentos</h3>
                  {(d?.departamentos || []).map(dept => {
                    const total = dept.obrigacoes.total + dept.tarefas.total
                    const concluidas = dept.obrigacoes.concluidas + dept.tarefas.concluidas
                    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0
                    return (
                      <div key={dept.id} className="flex items-center justify-between py-1.5 border-b border-urban-smoke/50 last:border-0">
                        <span className="text-xs">{dept.nome}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-urban-smoke rounded-full overflow-hidden">
                            <div className="h-full bg-electric-teal rounded-full transition-all" style={{ width: pct + '%' }} />
                          </div>
                          <span className="text-xs text-pulse-ash w-10 text-right">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Usuários</h3>
                  {(d?.usuarios || []).map(u => {
                    const total = u.obrigacoes.total + u.tarefas.total
                    const concluidas = u.obrigacoes.concluidas + u.tarefas.concluidas
                    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0
                    return (
                      <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-urban-smoke/50 last:border-0">
                        <span className="text-xs">{u.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-pulse-ash">{concluidas}/{total}</span>
                          <div className="w-16 h-1.5 bg-urban-smoke rounded-full overflow-hidden">
                            <div className="h-full bg-success rounded-full transition-all" style={{ width: pct + '%' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent executions */}
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Execuções Recentes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                        <th className="text-left py-2 pr-4">Tipo</th>
                        <th className="text-left py-2 pr-4">Movimento</th>
                        <th className="text-left py-2 pr-4">Cliente</th>
                        <th className="text-left py-2 pr-4">CNPJ</th>
                        <th className="text-right py-2 pr-4">Valor</th>
                        <th className="text-right py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d?.execucoes_recentes || []).map((ex: any) => (
                        <tr key={ex.id} className="border-b border-urban-smoke/30 hover:bg-urban-smoke/30 transition-colors">
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                              ex.tipo === 'NFS-e' ? 'bg-electric-teal/10 text-electric-teal' : 'bg-purple-900/30 text-purple-400'
                            }`}>{ex.tipo}</span>
                          </td>
                          <td className="py-2 pr-4 text-pulse-ash">{ex.movement_type}</td>
                          <td className="py-2 pr-4">{ex.client_name || '-'}</td>
                          <td className="py-2 pr-4 text-pulse-ash font-mono text-xs">{ex.owner_cnpj || '-'}</td>
                          <td className="py-2 pr-4 text-right">R$ {(ex.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 text-right text-pulse-ash">{ex.created_at ? new Date(ex.created_at).toLocaleString('pt-BR') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: OPERACIONAL ── */}
          {!loading && tab === 'operacional' && opData && (
            <div className="space-y-6">
              <div className="grid grid-cols-6 gap-4">
                <StatCard value={opData.resumo.clientes_ativos} label="Clientes Ativos" sub={`${opData.resumo.total_clientes} total`} color="blue" />
                <StatCard value={opData.resumo.total_nfse} label="NFSe (mês)" sub="Notas emitidas" color="purple" />
                <StatCard value={opData.resumo.total_nfe} label="NF-e (mês)" sub="Notas emitidas" color="cyan" />
                <StatCard value={opData.resumo.total_docs} label="Total Docs" sub="Soma total" color="green" />
                <StatCard value={opData.resumo.media_docs} label="Média" sub="por cliente" color="amber" />
                <StatCard value={opData.resumo.sem_movimento} label="Sem Movimento" sub="Clientes" color="rose" />
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Departamentos</h3>
                  <div className="space-y-2">
                    {(opData?.departamentos || []).map((dept: any) => (
                      <div key={dept.nome} className="text-xs text-off-white py-1">{dept.nome}</div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 bg-rich-carbon border border-urban-smoke rounded-xl p-6">
                  <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Clientes</h3>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                          <th className="text-left py-2 pr-3">Cliente</th>
                          <th className="text-center py-2 pr-3">NFSe</th>
                          <th className="text-center py-2 pr-3">NF-e</th>
                          <th className="text-center py-2 pr-3">Total</th>
                          <th className="text-center py-2">Certificado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(opData?.clientes || []).map((c: any) => (
                          <tr key={c.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-electric-teal" />
                                <div>
                                  <div className="text-off-white">{c.name}</div>
                                  <div className="text-pulse-ash text-xs font-mono">{c.cnpj}</div>
                                </div>
                              </div>
                            </td>
                            <td className="text-center py-2 pr-3">{c.nfse}</td>
                            <td className="text-center py-2 pr-3">{c.nfe}</td>
                            <td className="text-center py-2 pr-3 font-roc" style={{ fontWeight: 500 }}>{c.total_docs}</td>
                            <td className="text-center py-2">
                              <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                                c.certificado === 'valido' ? 'bg-success/10 text-success' :
                                c.certificado === 'vencendo' ? 'bg-infrared/10 text-infrared' :
                                c.certificado === 'vencido' ? 'bg-danger/10 text-danger' :
                                'bg-pulse-ash/10 text-pulse-ash'
                              }`}>
                                {c.certificado === 'valido' ? 'Válido' :
                                 c.certificado === 'vencendo' ? 'Vencendo' :
                                 c.certificado === 'vencido' ? 'Vencido' : 'Sem Cert'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: NOTAS FISCAIS ── */}
          {!loading && tab === 'notas' && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-5">
                <StatCard value={ns?.total || 0} label="NFS-e" sub={`${ns?.hoje || 0} hoje`} color="blue" />
                <StatCard value={ne?.total || 0} label="NF-e" sub={`${ne?.hoje || 0} hoje`} color="purple" />
                <StatCard value={(ns?.total || 0) + (ne?.total || 0)} label="Total Documentos" sub="Acumulado" color="green" />
                <StatCard value={d?.certificados?.validos || 0} label="Certificados Válidos" sub={`${d?.certificados?.vencendo || 0} vencendo`} color="amber" />
              </div>

              {/* Action buttons */}
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Automação</h3>
                <p className="text-xs text-pulse-ash mb-4">Disparar download de notas fiscais para todos os clientes ativos com certificado.</p>
                <div className="flex gap-3">
                  <button onClick={async () => {
                    if (!confirm('Executar download para todos os clientes ativos?')) return
                    const t = getToken()
                    if (!t) return
                    try {
                      const r = await fetch('/api/runs/run-nfse', { method: 'POST', headers: { Authorization: 'Bearer ' + t } })
                      const j = await r.json()
                      alert(j.message || 'Download iniciado')
                    } catch { alert('Erro ao iniciar download') }
                  }}
                    className="px-5 py-3 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2">
                    <span>↓</span> Baixar NFs
                  </button>
                  <button onClick={async () => {
                    if (!confirm('Executar scan de XMLs pendentes?')) return
                    const t = getToken()
                    if (!t) return
                    try {
                      const r = await fetch('/api/runs/scan-nfse', { method: 'POST', headers: { Authorization: 'Bearer ' + t } })
                      const j = await r.json()
                      alert(j.message || 'Scan iniciado')
                    } catch { alert('Erro ao iniciar scan') }
                  }}
                    className="px-5 py-3 rounded-lg text-xs tracking-wider bg-urban-smoke text-off-white hover:bg-pulse-ash transition-colors flex items-center gap-2 border border-urban-smoke">
                    <span>◎</span> Scan XMLs
                  </button>
                </div>
              </div>

              {/* Recent documents */}
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                <h3 className="text-xs tracking-wider text-pulse-ash mb-4">Documentos Recentes</h3>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                        <th className="text-left py-2 pr-3">Tipo</th>
                        <th className="text-left py-2 pr-3">Movimento</th>
                        <th className="text-left py-2 pr-3">Cliente</th>
                        <th className="text-left py-2 pr-3">Emitente</th>
                        <th className="text-right py-2 pr-3">Valor</th>
                        <th className="text-right py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d?.execucoes_recentes || []).slice(0, 15).map((ex: any) => (
                        <tr key={ex.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                              ex.tipo === 'NFS-e' ? 'bg-electric-teal/10 text-electric-teal' : 'bg-purple-900/30 text-purple-400'
                            }`}>{ex.tipo}</span>
                          </td>
                          <td className="py-2 pr-3 text-pulse-ash">{ex.movement_type}</td>
                          <td className="py-2 pr-3">{ex.client_name || '-'}</td>
                          <td className="py-2 pr-3 text-pulse-ash">{ex.owner_cnpj || '-'}</td>
                          <td className="py-2 pr-3 text-right">R$ {(ex.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 text-right text-pulse-ash">{ex.issued_at ? new Date(ex.issued_at).toLocaleDateString('pt-BR') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(d?.execucoes_recentes || []).length === 0 && (
                  <div className="text-center py-8 text-pulse-ash text-sm">Nenhum documento recente.</div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: DOCUMENTOS ── */}
          {!loading && tab === 'documentos' && (
            <div className="space-y-5">
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Tipo</label>
                    <select value={docType} onChange={e => {
                      const v = e.target.value
                      setDocType(v)
                      if (v === 'mercadorias' && (docMov === 'tomados' || docMov === 'prestados')) setDocMov('')
                      if (v === 'nfse' && (docMov === 'entrada' || docMov === 'saida')) setDocMov('')
                    }}
                      className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="todas">Todas</option>
                      <option value="nfse">NFS-e</option>
                      <option value="mercadorias">NF-e</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Movimento</label>
                    <select value={docMov} onChange={e => setDocMov(e.target.value)}
                      className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Todos</option>
                      {docType !== 'mercadorias' && (
                        <>
                          <option value="tomados">Tomados</option>
                          <option value="prestados">Prestados</option>
                        </>
                      )}
                      {docType !== 'nfse' && (
                        <>
                          <option value="entrada">Entrada</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cliente</label>
                    <select value={docCli} onChange={e => setDocCli(e.target.value)}
                      className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Todos</option>
                      {(cliList || []).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name || c.razao_social}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">De</label>
                    <input type="date" value={docFrom} onChange={e => setDocFrom(e.target.value)}
                      className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Até</label>
                    <input type="date" value={docTo} onChange={e => setDocTo(e.target.value)}
                      className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Buscar</label>
                    <input type="text" value={docQuery} onChange={e => setDocQuery(e.target.value)} placeholder="Emitente ou chave..."
                      className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal w-44" />
                  </div>
                  <button onClick={() => { setDocPage(0); loadDocs(0) }}
                    className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                    {docLoading ? 'Carregando...' : 'Buscar'}
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={downloadXmlZip} className="px-4 py-2 rounded-lg text-xs tracking-wider bg-urban-smoke text-off-white hover:bg-pulse-ash transition-colors border border-urban-smoke">
                      Baixar XMLs (ZIP)
                    </button>
                    <button onClick={downloadExcelReport} disabled={excelLoading} className="px-4 py-2 rounded-lg text-xs tracking-wider bg-urban-smoke text-off-white hover:bg-pulse-ash transition-colors border border-urban-smoke">
                      {excelLoading ? 'Gerando Excel...' : 'Relatório Excel'}
                    </button>
                    <button onClick={downloadPdfReport} className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                      Relatório PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals Cards */}
              {!docLoading && docs.length > 0 && (
                <div className="grid grid-cols-7 gap-3">
                  <MiniCard label="Valor Total" value={docTotals.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} prefix="R$ " color="#5C939F" sub="Total agregado" />
                  <MiniCard label="ICMS" value={docTotals.icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} prefix="R$ " color="#3B82F6" sub="NF-e" />
                  <MiniCard label="PIS/COFINS" value={(docTotals.pis + docTotals.cofins).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} prefix="R$ " color="#A78BFA" sub="NF-e" />
                  <MiniCard label="IPI" value={docTotals.ipi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} prefix="R$ " color="#F97316" sub="NF-e" />
                  <MiniCard label="Frete" value={docTotals.frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} prefix="R$ " color="#8B5CF6" sub="NF-e" />
                  <MiniCard label="Produtos" value={docTotals.prod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} prefix="R$ " color="#EC4899" sub="NF-e" />
                  <MiniCard label="Documentos" value={docTotal.toString()} color="#10B981" />
                </div>
              )}

              <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                      <th className="text-left py-2 pr-3">Tipo</th>
                      <th className="text-left py-2 pr-3">Mov.</th>
                      <th className="text-left py-2 pr-3">Nº</th>
                      <th className="text-left py-2 pr-3">Cliente</th>
                      <th className="text-left py-2 pr-3">Emitente</th>
                      <th className="text-left py-2 pr-3">Chave/NF</th>
                      <th className="text-right py-2 pr-3">Valor</th>
                      <th className="text-right py-2 pr-1">ICMS</th>
                      <th className="text-right py-2 pr-1">PIS/COF</th>
                      <th className="text-right py-2 pr-3">Data</th>
                      <th className="text-center py-2">XML</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(docs || []).map((doc: any) => {
                      const isNfe = doc.tipo === 'NF-e'
                      const icms = isNfe ? (doc.v_icms || 0) : null
                      const pisCof = isNfe ? (doc.v_pis || 0) + (doc.v_cofins || 0) : null
                      return (
                      <tr key={doc.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                            doc.tipo === 'NFS-e' ? 'bg-electric-teal/10 text-electric-teal' : 'bg-purple-900/30 text-purple-400'
                          }`}>{doc.tipo}</span>
                        </td>
                        <td className="py-2 pr-3 text-pulse-ash">{doc.movimento}</td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-pulse-ash">{doc.numero || '-'}</td>
                        <td className="py-2 pr-3">{doc.client_name || doc.cliente_nome || '-'}</td>
                        <td className="py-2 pr-3 text-pulse-ash truncate max-w-[180px]">{doc.emitente || '-'}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-pulse-ash truncate max-w-[160px]">{doc.chave}</td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">R$ {(doc.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 pr-1 text-right text-xs text-pulse-ash whitespace-nowrap">
                          {icms != null && icms > 0 ? `R$ ${icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : icms != null ? '-' : ''}
                        </td>
                        <td className="py-2 pr-1 text-right text-xs text-pulse-ash whitespace-nowrap">
                          {pisCof != null && pisCof > 0 ? `R$ ${pisCof.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : pisCof != null ? '-' : ''}
                        </td>
                        <td className="py-2 pr-3 text-right text-pulse-ash whitespace-nowrap">{doc.issued_at ? new Date(doc.issued_at.replace(/-03:00|T.*/, '') + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="py-2 text-center">
                          <a
                            href={`/api/${doc.tipo === 'NFS-e' ? 'nfse-documents' : 'merchandise-documents'}/${doc.id}/xml`}
                            className="px-2 py-1 rounded text-xs text-electric-teal hover:text-off-white hover:bg-electric-teal/10 transition-colors tracking-wider"
                            target="_blank" rel="noreferrer"
                          >
                            XML
                          </a>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
                  {docs.length === 0 && !docLoading && (
                    <div className="text-center py-10 text-pulse-ash text-sm">Nenhum documento encontrado.</div>
                  )}
                </div>

                {/* Pagination */}
                {docTotal > DOCS_PER_PAGE && (
                  <div className="flex items-center justify-between mt-4 px-1">
                    <span className="text-xs text-pulse-ash">
                      {docPage * DOCS_PER_PAGE + 1}–{Math.min((docPage + 1) * DOCS_PER_PAGE, docTotal)} de {docTotal}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadDocs(docPage - 1)}
                        disabled={docPage === 0 || docLoading}
                        className="px-3 py-1.5 rounded text-xs border border-urban-smoke text-pulse-ash hover:text-off-white disabled:opacity-30 transition-colors"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: Math.min(5, Math.ceil(docTotal / DOCS_PER_PAGE)) }, (_, i) => {
                        const totalPages = Math.ceil(docTotal / DOCS_PER_PAGE)
                        let pageNum = i
                        if (totalPages > 5) {
                          if (docPage < 2) pageNum = i
                          else if (docPage > totalPages - 3) pageNum = totalPages - 5 + i
                          else pageNum = docPage - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => loadDocs(pageNum)}
                            className={`px-3 py-1.5 rounded text-xs transition-colors ${
                              docPage === pageNum
                                ? 'bg-electric-teal text-white'
                                : 'border border-urban-smoke text-pulse-ash hover:text-off-white'
                            }`}
                          >
                            {pageNum + 1}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => loadDocs(docPage + 1)}
                        disabled={(docPage + 1) * DOCS_PER_PAGE >= docTotal || docLoading}
                        className="px-3 py-1.5 rounded text-xs border border-urban-smoke text-pulse-ash hover:text-off-white disabled:opacity-30 transition-colors"
                      >
                        Próximo
                      </button>
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

function MiniCard({ label, value, prefix = '', color, sub = '' }: { label: string; value: string; prefix?: string; color: string; sub?: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-lg p-3">
      <div className="text-xs tracking-wider mb-0.5" style={{ color }}>{label}</div>
      <div className="text-sm font-roc whitespace-nowrap" style={{ fontWeight: 500 }}>
        {prefix}{value}
      </div>
      {sub && <div className="text-[10px] text-pulse-ash mt-0.5">{sub}</div>}
    </div>
  )
}

function StatCard({ value, label, sub, color }: { value: number | string; label: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: '#5C939F', green: '#59A993', purple: '#A78BFA', amber: '#ED6D40',
    cyan: '#22D3EE', rose: '#FB7185', indigo: '#6366F1'
  }
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
      <div className="text-xs tracking-wider mb-2" style={{ color: colors[color] || colors.blue }}>{label}</div>
      <div className="text-sm tracking-wider mb-1" style={{ fontWeight: 500 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-pulse-ash">{sub}</div>
    </div>
  )
}


