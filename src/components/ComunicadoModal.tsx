import { useState, useEffect, useCallback } from 'react'

type Comunicado = {
  id: number
  titulo: string
  conteudo: string
  imagem_url: string | null
  ativo: boolean
  created_at: string
  created_by: number | null
  criador_nome?: string | null
}

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

function getUserId(): number | null {
  try {
    const t = getToken()
    if (!t) return null
    const p = JSON.parse(atob(t.split('.')[1]))
    return Number(p.sub) || null
  } catch { return null }
}

function formatDateTime(d: string): string {
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function ComunicadoModal() {
  const [queue, setQueue] = useState<Comunicado[]>([])
  const [current, setCurrent] = useState<Comunicado | null>(null)
  const [confirming, setConfirming] = useState(false)

  const loadPending = useCallback(async () => {
    const t = getToken()
    if (!t) return
    const uid = getUserId()
    try {
      const r = await fetch('/api/comunicados/ativos', { headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) return
      const d = await r.json()
      const pending = (Array.isArray(d) ? d : [])
        .filter((c: Comunicado) => !(uid !== null && c.created_by === uid))
      setQueue(pending)
    } catch { /* offline */ }
  }, [])

  useEffect(() => {
    loadPending()
    const interval = setInterval(loadPending, 20000)
    return () => clearInterval(interval)
  }, [loadPending])

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setQueue(q => q.slice(1))
    }
  }, [queue, current])

  useEffect(() => {
    if (!current) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [current])

  const entendido = async () => {
    if (!current) return
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-core-black/90 backdrop-blur-sm"
      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="px-6 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-teal/15 border border-electric-teal/30 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-electric-teal animate-pulse" />
            <span className="text-[10px] tracking-wider text-electric-teal uppercase">Comunicado</span>
          </div>
          <h3 className="text-base font-roc tracking-wider text-off-white">{current.titulo}</h3>
          {current.created_at && (
            <p className="text-[10px] text-pulse-ash mt-1 tracking-wider">
              Publicado em {formatDateTime(current.created_at)}
            </p>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="bg-core-black border border-urban-smoke rounded-lg p-4 text-sm text-off-white whitespace-pre-wrap leading-relaxed">
            {current.conteudo}
          </div>
          {current.imagem_url && (
            <img src={current.imagem_url} alt="" className="mt-3 max-h-64 w-full object-cover rounded-lg border border-urban-smoke" />
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={entendido}
            disabled={confirming}
            className="w-full py-3 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {confirming ? 'Registrando...' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}
