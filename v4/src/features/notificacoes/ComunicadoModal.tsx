import { useCallback, useEffect, useState } from 'react'
import { getToken } from '@/lib/api'
import { Megaphone } from 'lucide-react'

interface Comunicado {
  id: number
  titulo: string
  conteudo: string
  imagem_url: string | null
  ativo: boolean
  created_at: string
  created_by: number | null
}

function fmtDateTime(d?: string) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' +
      dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function ComunicadoModal() {
  const [queue, setQueue] = useState<Comunicado[]>([])
  const [current, setCurrent] = useState<Comunicado | null>(null)
  const [ciente, setCiente] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const loadPending = useCallback(async () => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/comunicados/ativos', { headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) return
      const d = await r.json()
      const meId = (() => {
        try {
          const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
          return tok ? Number(JSON.parse(atob(tok.split('.')[1])).sub) : 0
        } catch {
          return 0
        }
      })()
      const pending = (Array.isArray(d) ? d : []).filter((c: Comunicado) => c.created_by !== meId)
      setQueue(pending)
    } catch {
      /* offline */
    }
  }, [])

  useEffect(() => {
    loadPending()
    const interval = setInterval(loadPending, 20_000)
    return () => clearInterval(interval)
  }, [loadPending])

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setQueue(q => q.slice(1))
      setCiente(false)
    }
  }, [queue, current])

  useEffect(() => {
    if (!current) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [current])

  const confirmar = async () => {
    if (!current || !ciente) return
    setConfirming(true)
    const t = getToken()
    try {
      if (t) {
        await fetch(`/api/comunicados/${current.id}/visualizar`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + t },
        })
      }
      setCurrent(null)
    } finally {
      setConfirming(false)
    }
  }

  if (!current) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        <div className="px-6 pt-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0078d4]/30 bg-[#0078d4]/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0078d4]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0078d4]">Comunicado</span>
          </div>
          <h3 className="text-base font-semibold text-foreground">{current.titulo}</h3>
          {current.created_at && (
            <p className="mt-1 text-[10px] text-muted-foreground">Publicado em {fmtDateTime(current.created_at)}</p>
          )}
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-5">
          <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground">
            {current.conteudo}
          </div>
          {current.imagem_url && (
            <img src={current.imagem_url} alt="" className="mt-3 max-h-64 w-full rounded-lg border border-border object-cover" />
          )}
        </div>

        <div className="space-y-3 px-6 pb-6">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              checked={ciente}
              onChange={e => setCiente(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-[#0078d4]"
            />
            <span className="text-xs font-medium text-foreground">Tenho plena ciência do comunicado</span>
          </label>
          <button
            onClick={confirmar}
            disabled={!ciente || confirming}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] py-3 text-xs font-semibold text-white transition-colors hover:bg-[#0078d4]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Megaphone className="h-4 w-4" />
            {confirming ? 'Registrando...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
