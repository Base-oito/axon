import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clientFetch } from './PortalLogin'
import { Bell, CheckCheck } from 'lucide-react'

type Notif = { id: number; titulo: string; texto?: string; link?: string; lida: number; created_at?: string }

export default function NotificacoesBell() {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const q = useQuery({ queryKey: ['cli-not'], queryFn: () => clientFetch<Notif[]>('/api/client-portal/notificacoes'), staleTime: 10_000, refetchInterval: 30_000 })
  const naolidas = q.data?.filter(n => !n.lida).length || 0
  const naolidasQ = useQuery({
    queryKey: ['cli-not-count'],
    queryFn: () => clientFetch<{ naolidas: number }>('/api/client-portal/notificacoes/naolidas'),
    staleTime: 10_000, refetchInterval: 30_000,
  })

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  const marcar = async (n: Notif) => {
    await clientFetch(`/api/client-portal/notificacoes/${n.id}/lida`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    qc.invalidateQueries({ queryKey: ['cli-not'] }); qc.invalidateQueries({ queryKey: ['cli-not-count'] })
  }
  const totalNaoLidas = naolidasQ.data?.naolidas ?? naolidas

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAberto(x => !x)}
        className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Bell className="h-4 w-4" />
        {totalNaoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {totalNaoLidas}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            {naolidas > 0 && (
              <button
                onClick={async () => {
                  await Promise.all((q.data || []).filter(n => !n.lida).map(n => clientFetch(`/api/client-portal/notificacoes/${n.id}/lida`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })))
                  qc.invalidateQueries({ queryKey: ['cli-not'] }); qc.invalidateQueries({ queryKey: ['cli-not-count'] })
                }}
                className="flex items-center gap-1 text-[11px] text-[#0078d4] hover:underline">
                <CheckCheck className="h-3 w-3" /> Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {q.data?.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sem notificações.</p>
            ) : (
              q.data?.map(n => (
                <button key={n.id} onClick={() => marcar(n)}
                  className={`block w-full border-b border-border/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/30 ${n.lida ? 'opacity-70' : 'bg-[#0078d4]/5'}`}>
                  <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    {!n.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0078d4]" />}
                    {n.titulo}
                  </p>
                  {n.texto && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{n.texto}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground/60">{fmtDT(n.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtDT(d?: string) {
  if (!d) return ''
  return String(d).slice(0, 16).replace('T', ' ')
}