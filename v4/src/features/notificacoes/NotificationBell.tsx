import { useState, useEffect, useRef } from 'react'
import { Bell, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Notification = {
  id: number
  tipo: string
  titulo: string
  texto: string
  link: string | null
  lida: number
  created_at: string
}

const dotColors: Record<string, string> = {
  relatorio: 'bg-primary',
  chat: 'bg-sky-500',
  dm: 'bg-sky-500',
  obrigacao: 'bg-red-500',
  vencimento: 'bg-red-500',
  certificado: 'bg-emerald-500',
  atribuicao: 'bg-violet-500',
  processo: 'bg-violet-500',
  comentario: 'bg-amber-500',
  tarefa: 'bg-orange-500',
}

function formatTime(d: string) {
  try {
    const dt = new Date(d)
    const diff = Date.now() - dt.getTime()
    if (diff < 60_000) return 'agora'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
    return dt.toLocaleDateString('pt-BR')
  } catch {
    return ''
  }
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const tick = () => {
      if (!active) return
      apiFetch<{ notificacoes: Notification[]; total: number }>('/api/notifications')
        .then(d => {
          setNotifs(d.notificacoes || [])
          setTotal(d.total || 0)
        })
        .catch(() => {})
    }
    tick()
    const interval = setInterval(tick, 15_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const dismissOne = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token}` } })
    } catch {
      /* ignora falha de rede */
    }
    setNotifs(prev => prev.filter(n => n.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  const clearAll = async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE', headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token}` } })
      setNotifs([])
      setTotal(0)
      setOpen(false)
    } catch {
      /* ignora falha de rede */
    }
  }

  const openLink = async (link: string) => {
    if (!link.startsWith('/api/')) {
      window.location.href = link
      return
    }
    try {
      const token = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
      const r = await fetch(link, { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.url) {
        window.location.href = d.url
        return
      }
      alert('Não foi possível abrir o link: ' + (r.ok ? (d?.detail || 'erro desconhecido') : 'HTTP ' + r.status))
    } catch {
      alert('Não foi possível abrir o link')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="h-[18px] w-[18px]" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="absolute right-0 top-11 z-50 flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">Notificações</div>
              <div className="flex items-center gap-3">
                {total > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Limpar todas
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {notifs.map(n => (
                    <li key={n.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColors[n.tipo] || 'bg-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{n.titulo}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(n.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.texto}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {n.link && (
                          <button
                            onClick={() => {
                              setOpen(false)
                              openLink(n.link as string)
                            }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            Abrir
                          </button>
                        )}
                        <button
                          onClick={() => dismissOne(n.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                          title="Descartar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}