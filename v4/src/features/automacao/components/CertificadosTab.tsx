import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { listClientesCert, uploadCertificado } from '../api'

type SortKey = 'name' | 'cnpj' | 'expires' | 'status'
type SortDir = 'asc' | 'desc'

function certStatus(expires?: string | null): { label: string; cls: string } | null {
  if (!expires) return null
  const exp = new Date(expires)
  if (isNaN(exp.getTime())) return null
  const dias = Math.floor((exp.getTime() - Date.now()) / 86400000)
  if (dias > 30) return { label: 'Válido', cls: 'bg-emerald-50 text-emerald-700' }
  if (dias > 0) return { label: 'Vencendo', cls: 'bg-amber-50 text-amber-700' }
  return { label: 'Vencido', cls: 'bg-red-50 text-red-700' }
}

const STATUS_ORDER: Record<string, number> = { Vencido: 0, Vencendo: 1, Válido: 2 }

function fmtDate(d?: string | null) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

export default function CertificadosTab() {
  const qc = useQueryClient()
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [clientId, setClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: clientes = [] } = useQuery({ queryKey: ['clientes-cert'], queryFn: listClientesCert, staleTime: 10 * 60_000 })

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...clientes]
    arr.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'name') {
        va = (a.name || a.nome || '').toLowerCase()
        vb = (b.name || b.nome || '').toLowerCase()
      } else if (sortKey === 'cnpj') {
        va = a.cnpj || ''
        vb = b.cnpj || ''
      } else if (sortKey === 'expires') {
        va = a.certificate_expires_at ? new Date(a.certificate_expires_at).getTime() : -1
        vb = b.certificate_expires_at ? new Date(b.certificate_expires_at).getTime() : -1
      } else {
        va = STATUS_ORDER[certStatus(a.certificate_expires_at)?.label || ''] ?? 99
        vb = STATUS_ORDER[certStatus(b.certificate_expires_at)?.label || ''] ?? 99
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [clientes, sortKey, sortDir])

  const comCert = clientes.filter(c => c.certificate_expires_at).length

  const handleUpload = async () => {
    if (!file || !password || !clientId) return
    setSaving(true)
    setError('')
    try {
      await uploadCertificado(file, password, Number(clientId))
      setShowUpload(false)
      setFile(null)
      setPassword('')
      setClientId('')
      qc.invalidateQueries({ queryKey: ['clientes-cert'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no upload')
    }
    setSaving(false)
  }

  const HeadBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${
        sortKey === k ? 'text-[#0078d4]' : 'text-muted-foreground'
      }`}
    >
      {children} {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{clientes.length}</span> clientes ·{' '}
          <span className="font-semibold text-foreground">{comCert}</span> com certificado
        </div>
        <button
          onClick={() => { setShowUpload(true); setError('') }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
        >
          <Upload className="h-4 w-4" />
          + Upload Certificado
        </button>
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border/60 bg-card shadow-sm">
              <tr>
                <HeadBtn k="name">Cliente</HeadBtn>
                <HeadBtn k="cnpj">CNPJ</HeadBtn>
                <HeadBtn k="expires">Vencimento</HeadBtn>
                <HeadBtn k="status">Status</HeadBtn>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const st = certStatus(c.certificate_expires_at)
                return (
                  <tr key={c.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.name || c.nome || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.cnpj || '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(c.certificate_expires_at)}</td>
                    <td className="px-4 py-2.5">
                      {st ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => { setShowUpload(true); setClientId(String(c.id)); setError('') }}
                        className="rounded border border-[#0078d4]/30 px-3 py-1 text-xs tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
                      >
                        Upload .pfx
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Upload */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[480px] max-w-full rounded-xl border border-border bg-card shadow-lg">
            <div className="border-b border-border/60 px-6 py-4">
              <h3 className="text-sm font-semibold text-foreground">Upload de Certificado Digital</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Arquivo .pfx/.p12 + senha do certificado (A1).</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente *</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                  <option value="">Selecione o cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Certificado (.pfx / .p12) *</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pfx,.p12"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/70"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha do Certificado *</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="Senha do .pfx"
                />
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
              <button onClick={() => setShowUpload(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={saving || !file || !password || !clientId}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Enviando...' : 'Fazer Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
