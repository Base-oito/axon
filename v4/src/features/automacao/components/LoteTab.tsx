import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import type { LoteResult } from '../types'
import { processarLote } from '../api'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

export default function LoteTab() {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<LoteResult[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    e.target.value = ''
  }

  const process = async () => {
    if (files.length === 0) {
      alert('Selecione arquivos PDF')
      return
    }
    setProcessing(true)
    setError('')
    setResults([])
    try {
      const d = await processarLote(files)
      setResults(d.resultados || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar lote')
    }
    setProcessing(false)
  }

  const s = useSortable('filename')
  const sorted = sortItems(results, s.sortKey, s.sortDir, r => {
    if (s.sortKey === 'size') return r.size || 0
    if (s.sortKey === 'modelo') return r.modelo_nome || ''
    if (s.sortKey === 'matched') return r.matched ? 1 : 0
    return r.filename || ''
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Upload em Lote de PDFs</h3>
        <span className="text-xs text-muted-foreground">{files.length} arquivo(s)</span>
      </div>

      <div className="card-soft rounded-lg border-2 border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileUp className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mb-6 text-sm text-muted-foreground">Arraste PDFs ou clique para selecionar</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border bg-card px-5 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Selecionar PDFs
          </button>
          <button
            onClick={process}
            disabled={files.length === 0 || processing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
          >
            {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {processing ? 'Processando...' : 'Processar Lote'}
          </button>
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf" onChange={handleFiles} className="hidden" />
        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {files.map((f, i) => (
              <span key={i} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                {f.name}
                <button
                  className="ml-1.5 text-red-400 hover:text-red-500"
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="text-xs text-rose-600">{error}</div>}

      {results.length > 0 && (
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <SortableTh k="filename" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Arquivo</SortableTh>
                  <SortableTh k="size" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Tamanho</SortableTh>
                  <SortableTh k="modelo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Modelo</SortableTh>
                  <SortableTh k="matched" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Match</SortableTh>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={i} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.filename}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{(r.size || 0) / 1024 > 1 ? ((r.size || 0) / 1024).toFixed(1) + ' KB' : (r.size || 0) + ' B'}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{r.modelo_nome || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.error ? (
                        <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700" title={r.error}>Erro</span>
                      ) : r.matched ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Match</span>
                      ) : (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Sem match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
