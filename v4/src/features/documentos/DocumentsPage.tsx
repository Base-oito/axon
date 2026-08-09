import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { FileSpreadsheet, FileText as FileTextIcon, FileArchive } from 'lucide-react'

interface Doc {
  id: number
  tipo: 'NF-e' | 'NFS-e'
  movement_type: string
  status: string
  is_event?: boolean
  number?: string
  series?: string
  access_key: string
  total_value: number
  issued_at?: string
  issuer_name?: string
  issuer_cnpj?: string
  client_name?: string
  v_icms?: number
  v_pis?: number
  v_cofins?: number
  v_ipi?: number
  created_at?: string
}

type SortKey = 'issued_at' | 'total_value' | 'number' | 'issuer_name' | 'status'

function useDocumentos(params: URLSearchParams) {
  return useQuery({
    queryKey: ['documentos', params.toString()],
    queryFn: () => apiFetch<{ documents: Doc[]; total: number }>(`/api/merchandise-documents?${params}`),
    staleTime: 30_000,
  })
}

function useNfse(params: URLSearchParams) {
  return useQuery({
    queryKey: ['nfse-docs', params.toString()],
    queryFn: () => apiFetch<{ documents: Doc[]; total: number }>(`/api/nfse-documents?${params}`),
    staleTime: 30_000,
  })
}

function fmtDate(d?: string) {
  if (!d) return '-'
  return new Date(d.replace(/-03:00|T.*/, '') + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtMoney(v?: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export default function DocumentsPage() {
  const [tipo, setTipo] = useState<'todas' | 'nfse' | 'mercadorias'>('todas')
  const [cliente, setCliente] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [showEvents, setShowEvents] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('issued_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const raw = await apiFetch<Array<{ id: number; name?: string; nome?: string }>>('/api/clientes')
      return (raw || []).map(c => ({ id: c.id, nome: c.nome || c.name || `Cliente ${c.id}` }))
    },
    staleTime: 10 * 60_000,
  })

  const params = new URLSearchParams({ limit: String(PER_PAGE), offset: String(page * PER_PAGE) })
  if (cliente) params.set('cliente_id', cliente)
  if (from) params.set('issued_from', from)
  if (to) params.set('issued_to', to)
  if (q) params.set('search', q)
  if (showEvents && tipo !== 'nfse') params.set('show_events', 'true')

  const needsNfe = tipo === 'mercadorias' || tipo === 'todas'
  const needsNfse = tipo === 'nfse' || tipo === 'todas'
  const { data: nfe } = useDocumentos(needsNfe ? params : new URLSearchParams({ limit: '0' }))
  const { data: nfse } = useNfse(needsNfse ? params : new URLSearchParams({ limit: '0' }))

  const nfeDocs = (nfe?.documents || []).map(d => ({ ...d, tipo: 'NF-e' as const }))
  const nfseDocs = (nfse?.documents || []).map(d => ({ ...d, tipo: 'NFS-e' as const }))
  const all = [...nfseDocs, ...nfeDocs].sort((a, b) =>
    String(b.issued_at || b.created_at || '').localeCompare(String(a.issued_at || a.created_at || '')))

  const sorted = [...all].sort((a, b) => {
    const va = a[sortKey] ?? ''
    const vb = b[sortKey] ?? ''
    if (sortKey === 'total_value') return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    const c = String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? c : -c
  })

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  const total = (needsNfe ? nfe?.total || 0 : 0) + (needsNfse ? nfse?.total || 0 : 0)

  const buildReportBody = () => {
    const body: any = { doc_type: tipo === 'todas' ? 'both' : tipo }
    if (cliente) body.cliente_id = cliente
    if (from) body.issued_from = from
    if (to) body.issued_to = to
    if (showEvents) body.show_events = true
    return body
  }

  const [excelLoading, setExcelLoading] = useState(false)
  const [reportMsg, setReportMsg] = useState('')

  const enqueueReport = async (tipo: string) => {
    const t = getToken()
    if (!t) return
    const body = { tipo, ...buildReportBody() }
    try {
      const r = await fetch('/api/relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`)
      setReportMsg(`Relatório ${tipo === 'pdf' ? 'PDF' : tipo === 'excel' ? 'Excel' : 'XML'} em segundo plano — você pode continuar navegando. A notificação chega com o download.`)
    } catch (e: unknown) {
      alert('Erro ao gerar relatório: ' + (e instanceof Error ? e.message : ''))
    }
  }

  const HeadBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${
        sortKey === k ? 'text-[#0078d4]' : 'text-muted-foreground'
      }`}
    >
      {children} {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Notas fiscais capturadas automaticamente</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => enqueueReport('pdf')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
          >
            <FileTextIcon className="h-4 w-4" />
            Relatório PDF
          </button>
          <button
            onClick={() => { setExcelLoading(true); enqueueReport('excel').finally(() => setExcelLoading(false)) }}
            disabled={excelLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {excelLoading ? 'Gerando Excel…' : 'Relatório Excel'}
          </button>
          <button
            onClick={() => enqueueReport('xmlzip')}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileArchive className="h-4 w-4 text-amber-600" />
            Baixar XMLs (ZIP)
          </button>
          <a href="/documentos/relatorios"
            className="inline-flex items-center gap-2 rounded-lg border border-[#0078d4]/40 bg-[#0078d4]/10 px-3.5 py-2 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/20">
            Acompanhar relatórios
          </a>
        </div>
      </div>

      {reportMsg && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[#0078d4]/30 bg-[#0078d4]/10 px-4 py-3 text-xs text-[#0078d4]">
          <span>{reportMsg}</span>
          <button onClick={() => setReportMsg('')} className="text-muted-foreground transition-colors hover:text-foreground">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="card-soft flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="todas">Todas</option>
            <option value="nfse">NFS-e</option>
            <option value="mercadorias">NF-e</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa</label>
          <select value={cliente} onChange={e => { setCliente(e.target.value); setPage(0) }}
            className="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todas</option>
            {(clientes || []).map(c => (
              <option key={c.id} value={String(c.id)}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0) }} placeholder="Emitente ou chave…"
            className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showEvents} onChange={e => { setShowEvents(e.target.checked); setPage(0) }}
            className="h-4 w-4 accent-[#0078d4]" />
          Incluir eventos
        </label>
      </div>

      {/* Tabela */}
      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="py-2 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                <HeadBtn k="status">Status</HeadBtn>
                <HeadBtn k="number">Nº</HeadBtn>
                <HeadBtn k="issued_at">Data</HeadBtn>
                <HeadBtn k="issuer_name">Emitente</HeadBtn>
                <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chave</th>
                <HeadBtn k="total_value">Valor</HeadBtn>
                <th className="py-2 pr-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">XML</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => (
                <tr key={`${d.tipo}-${d.id}`} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                  <td className="py-2 pl-4 pr-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      d.tipo === 'NFS-e' ? 'bg-cyan-50 text-cyan-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {d.tipo}
                    </span>
                    {d.is_event && (
                      <span className="ml-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">EVENTO</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{d.status || '-'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{d.number || '-'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(d.issued_at)}</td>
                  <td className="max-w-[220px] truncate py-2 pr-3 text-xs">{d.issuer_name || '-'}</td>
                  <td className="max-w-[160px] truncate py-2 pr-3 font-mono text-xs text-muted-foreground">{d.access_key}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-right text-xs font-medium">{fmtMoney(d.total_value)}</td>
                  <td className="py-2 pr-4 text-center">
                    <a href={`/api/${d.tipo === 'NFS-e' ? 'nfse-documents' : 'merchandise-documents'}/${d.id}/xml`}
                      target="_blank" rel="noreferrer"
                      className="rounded px-2 py-1 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
                      XML
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</div>
        )}
        {/* Paginação */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">{total.toLocaleString('pt-BR')} documentos</p>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40">
              Anterior
            </button>
            <span className="px-2 py-1.5 text-xs text-muted-foreground">Página {page + 1}</span>
            <button disabled={sorted.length < PER_PAGE} onClick={() => setPage(p => p + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40">
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
