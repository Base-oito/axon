import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { AlertTriangle } from 'lucide-react'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

interface Evento {
  id: number
  access_key: string
  status?: string
  movement_type?: string
  issued_at?: string
  number?: string
  issuer_name?: string
  total_value?: number
}

function fmtDate(d?: string) {
  if (!d) return '-'
  return new Date(String(d).replace(/-03:00|T.*/, '') + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function EventosPage() {
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  const { data, isLoading } = useQuery({
    queryKey: ['eventos', page],
    queryFn: () =>
      apiFetch<{ documents: Evento[]; total: number }>(
        `/api/merchandise-documents?limit=${PER_PAGE}&offset=${page * PER_PAGE}&show_events=true&status=evento_`,
      ),
    staleTime: 30_000,
  })

  // Filtra apenas os que são eventos de fato
  const eventos = (data?.documents || [])

  const s = useSortable('issued_at')
  const sorted = sortItems(eventos, s.sortKey, s.sortDir, e => {
    if (s.sortKey === 'status') return e.status || ''
    if (s.sortKey === 'access_key') return e.access_key || ''
    if (s.sortKey === 'movement') return e.movement_type || ''
    return e.issued_at || ''
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Eventos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cancelamentos, correções e substituições das notas fiscais
        </p>
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SortableTh k="status" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Evento</SortableTh>
                <SortableTh k="access_key" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Chave</SortableTh>
                <SortableTh k="issued_at" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Data</SortableTh>
                <SortableTh k="movement" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Movimento</SortableTh>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">XML</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr key={e.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {e.status || 'evento'}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">{e.access_key}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmtDate(e.issued_at)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.movement_type || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/api/merchandise-documents/${e.id}/xml`} target="_blank" rel="noreferrer"
                      className="rounded px-2 py-1 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
                      XML
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && eventos.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum evento encontrado — os eventos 2102xx (confirmação de operação) são descartados por padrão.
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">{data?.total || 0} eventos</p>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40">
              Anterior
            </button>
            <span className="px-2 py-1.5 text-xs text-muted-foreground">Página {page + 1}</span>
            <button disabled={eventos.length < PER_PAGE} onClick={() => setPage(p => p + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40">
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
