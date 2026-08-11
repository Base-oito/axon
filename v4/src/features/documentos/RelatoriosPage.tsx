import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { FileSpreadsheet, FileText as FileTextIcon, FileArchive, Loader2, Download, Clock } from 'lucide-react'

interface Relatorio {
  id: number
  tipo: 'pdf' | 'excel' | 'xmlzip'
  status: 'pending' | 'running' | 'done' | 'error'
  progresso: number
  filename?: string | null
  error?: string | null
  created_at: string
  finished_at?: string | null
}

const tipoLabel: Record<string, string> = { pdf: 'PDF', excel: 'Excel', xmlzip: 'XML (ZIP)' }

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Na fila', cls: 'bg-amber-50 text-amber-700' },
  running: { label: 'Gerando…', cls: 'bg-blue-50 text-blue-700' },
  done: { label: 'Pronto', cls: 'bg-emerald-50 text-emerald-700' },
  error: { label: 'Falhou', cls: 'bg-red-50 text-red-700' },
}

function fmtDate(d?: string | null) {
  if (!d) return '-'
  const dt = new Date(d)
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtCnpj(v?: string) {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export default function RelatoriosPage() {
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState<'pdf' | 'excel' | 'xmlzip'>('excel')
  const [docType, setDocType] = useState<'todas' | 'nfse' | 'mercadorias'>('todas')
  const [cliente, setCliente] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showEvents, setShowEvents] = useState(false)
  const [msg, setMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const raw = await apiFetch<Array<{ id: number; name?: string; nome?: string; cnpj?: string }>>('/api/clientes')
      return (raw || []).map(c => ({ id: c.id, nome: c.nome || c.name || `Cliente ${c.id}`, cnpj: c.cnpj }))
    },
    staleTime: 10 * 60_000,
  })

  const { data: relatorios, isFetching } = useQuery({
    queryKey: ['relatorios'],
    queryFn: () => apiFetch<{ relatorios: Relatorio[] }>('/api/relatorios'),
    refetchInterval: (query) => {
      const list = query.state.data?.relatorios || []
      return list.some(r => r.status === 'pending' || r.status === 'running') ? 8_000 : 30_000
    },
  })

  const list = relatorios?.relatorios || []

  const enqueue = async () => {
    setMsg(''); setErrorMsg('')
    const t = getToken()
    if (!t) return
    const body: Record<string, unknown> = {
      tipo,
      doc_type: docType === 'todas' ? 'both' : docType,
    }
    if (cliente) body.cliente_id = cliente
    if (from) body.issued_from = from
    if (to) body.issued_to = to
    if (showEvents) body.show_events = true
    try {
      const r = await fetch('/api/relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`)
      setMsg(`Relatório ${tipoLabel[tipo]} em segundo plano — você pode continuar navegando. Quando estiver pronto, receberá uma notificação com o download.`)
      queryClient.invalidateQueries({ queryKey: ['relatorios'] })
    } catch (e: unknown) {
      setErrorMsg('Erro ao gerar relatório: ' + (e instanceof Error ? e.message : 'tente novamente'))
    }
  }

  const download = async (id: number) => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/relatorios/${id}/download`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.url) { window.location.href = d.url; return }
      alert('Erro ao baixar relatório: ' + (r.ok ? (d?.detail || 'erro desconhecido') : 'HTTP ' + r.status))
    } catch {
      alert('Erro ao baixar relatório')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerados em segundo plano — continue usando o sistema à vontade; a notificação chega com o download.
        </p>
      </div>

      {/* Formulário */}
      <div className="card-soft rounded-lg bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Formato</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="xmlzip">XML (ZIP)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de documento</label>
            <select value={docType} onChange={e => setDocType(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="todas">Todas</option>
              <option value="nfse">NFS-e</option>
              <option value="mercadorias">NF-e</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa</label>
            <select value={cliente} onChange={e => setCliente(e.target.value)}
              className="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Todas</option>
              {(clientes || []).map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.nome}{c.cnpj ? ` — ${fmtCnpj(c.cnpj)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showEvents} onChange={e => setShowEvents(e.target.checked)}
              className="h-4 w-4 accent-[#0078d4]" />
            Incluir eventos
          </label>
          <button onClick={enqueue}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
            Gerar relatório
          </button>
        </div>

        {msg && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-[#0078d4]/30 bg-[#0078d4]/10 px-4 py-3 text-xs text-[#0078d4]">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-muted-foreground transition-colors hover:text-foreground">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 transition-colors hover:text-red-700">✕</button>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Meus relatórios</h2>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {list.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum relatório gerado ainda.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {list.map(r => {
              const sc = statusConfig[r.status]
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.tipo === 'excel' && <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                    {r.tipo === 'pdf' && <FileTextIcon className="h-4 w-4 text-red-600" />}
                    {r.tipo === 'xmlzip' && <FileArchive className="h-4 w-4 text-amber-600" />}
                    <span className="text-sm font-medium text-foreground">#{r.id} — {tipoLabel[r.tipo]}</span>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${sc.cls}`}>
                    {sc.label}
                  </span>
                  {r.status === 'error' && (
                    <span className="max-w-[300px] truncate text-xs text-red-600" title={r.error || ''}>{r.error}</span>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {fmtDate(r.created_at)}
                    </span>
                    {r.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                    {r.status === 'done' && (
                      <button onClick={() => download(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700">
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </button>
                    )}
                    {r.status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
