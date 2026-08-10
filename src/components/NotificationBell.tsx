import { useState, useEffect } from 'react'

type Notification = {
  id: number; tipo: string; titulo: string; texto: string
  link: string | null; lida: number; created_at: string
}

const dotColors: Record<string, string> = {
  chat: 'bg-blue-500', dm: 'bg-blue-500',
  obrigacao: 'bg-danger', certificado: 'bg-success',
  atribuicao: 'bg-purple-500', comentario: 'bg-amber-500',
  vencimento: 'bg-danger', tarefa: 'bg-infrared',
  processo: 'bg-purple-500',
}

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchNotifs = () => {
    const t = getToken(); if (!t) return
    fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => {
        setNotifs(d.notificacoes || [])
        setTotal(d.total || 0)
      }).catch(() => {})
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 15000)
    return () => clearInterval(interval)
  }, [])

  const dismissOne = async (id: number) => {
    const t = getToken(); if (!t) return
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } }).catch(() => {})
    setNotifs(prev => prev.filter(n => n.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  const clearAll = async () => {
    const t = getToken(); if (!t) return
    try {
      await fetch('/api/notifications', { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      setNotifs([]); setTotal(0); setOpen(false)
    } catch (e) {
      console.error('Erro ao limpar notificações:', e)
    }
  }

  const openLink = async (link: string) => {
    if (!link.startsWith('/api/')) { window.location.href = link; return }
    const t = getToken(); if (!t) return
    try {
      const r = await fetch(link, { headers: { Authorization: 'Bearer ' + t }, redirect: 'manual' })
      if (r.status === 307 || r.status === 302) {
        const loc = r.headers.get('location')
        if (loc) { window.location.href = loc; return }
      }
      if (r.ok) { window.location.href = link; return }
      alert('Não foi possível abrir o link (' + r.status + ')')
    } catch {
      alert('Não foi possível abrir o link')
    }
  }

  const formatTime = (d: string) => {
    try {
      const dt = new Date(d)
      const diff = Date.now() - dt.getTime()
      if (diff < 60000) return 'Agora'
      if (diff < 3600000) return Math.floor(diff / 60000) + 'min'
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h'
      return dt.toLocaleDateString('pt-BR')
    } catch { return '' }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:bg-urban-smoke/40 transition-all">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-core-black/80" onClick={() => setOpen(false)}>
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-urban-smoke shrink-0">
              <h3 className="text-xs tracking-wider text-pulse-ash">Notificações ({total})</h3>
              <div className="flex items-center gap-2">
                {total > 0 && (
                  <button onClick={clearAll}
                    className="text-[10px] tracking-wider text-pulse-ash hover:text-danger transition-colors">
                    Limpar todas
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-pulse-ash hover:text-danger text-sm">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="text-center py-12 text-xs text-pulse-ash">Nenhuma notificação</div>
              ) : (
                <div className="divide-y divide-urban-smoke/20">
                  {notifs.map(n => (
                    <div key={n.id} className="px-5 py-4 hover:bg-urban-smoke/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${dotColors[n.tipo] || 'bg-pulse-ash'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium text-off-white">{n.titulo}</div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-pulse-ash">{formatTime(n.created_at)}</span>
                              {n.link && (
                                <button onClick={() => { setOpen(false); openLink(n.link) }}
                                  className="text-[10px] tracking-wider text-electric-teal hover:underline">Abrir</button>
                              )}
                              <button onClick={() => dismissOne(n.id)}
                                className="text-pulse-ash hover:text-danger text-xs" title="Descartar">✕</button>
                            </div>
                          </div>
                          <div className="text-xs text-pulse-ash mt-1 leading-relaxed whitespace-pre-wrap">{n.texto}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
