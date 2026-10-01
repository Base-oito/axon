import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { BarChart3, Lock, CheckCircle2 } from 'lucide-react'

export interface Enquete {
  id: number
  canal_id: number
  criado_por: number
  criado_por_nome: string | null
  pergunta: string
  opcoes: string[]
  encerrada: boolean
  encerrada_por_nome: string | null
  prazo: string | null
  created_at: string
  votos: Array<{ opcao_idx: number; user_id: number; display_name: string }>
  meu_voto: number | null
  total_votos: number
}

function fmtPrazo(p?: string | null) {
  if (!p) return null
  const dt = new Date(p)
  if (isNaN(dt.getTime())) return null
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function EnqueteCard({ enqueteId, isMine, onEncerrada }: {
  enqueteId: number
  isMine: boolean
  onEncerrada: () => void
}) {
  const [voting, setVoting] = useState<number | null>(null)
  const [err, setErr] = useState('')

  const { data: enq, refetch } = useQuery({
    queryKey: ['enquete', enqueteId],
    queryFn: () => apiFetch<Enquete>(`/api/chat/enquetes/${enqueteId}`),
    refetchInterval: 30_000,
  })

  const votar = async (idx: number) => {
    const t = getToken()
    if (!t || enq?.encerrada) return
    setVoting(idx)
    setErr('')
    try {
      const r = await fetch(`/api/chat/enquetes/${enqueteId}/votar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ opcao_idx: idx }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || 'Erro ao votar')
      }
      refetch()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao votar')
    }
    setVoting(null)
  }

  const encerrar = async () => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/chat/enquetes/${enqueteId}/encerrar`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || 'Erro ao encerrar')
      }
      refetch()
      onEncerrada()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao encerrar')
    }
  }

  if (!enq) {
    return (
      <div className="mt-1.5 w-[320px] max-w-full rounded-xl border border-border bg-card p-3">
        <div className="animate-pulse text-xs text-muted-foreground">Carregando enquete…</div>
      </div>
    )
  }

  const total = enq.total_votos || 0
  const prazo = fmtPrazo(enq.prazo)
  const mostraResultado = enq.encerrada

  return (
    <div className="mt-1.5 w-[320px] max-w-full rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 shrink-0 text-[#0078d4]" />
        <p className="flex-1 text-sm font-semibold text-foreground">{enq.pergunta}</p>
        {enq.encerrada && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </div>

      <div className="space-y-1.5">
        {enq.opcoes.map((op, idx) => {
          const votos = enq.votos.filter(v => v.opcao_idx === idx)
          const pct = total > 0 ? Math.round((votos.length / total) * 100) : 0
          const vencedora = enq.encerrada && votos.length === Math.max(...enq.opcoes.map((_, i) => enq.votos.filter(v => v.opcao_idx === i).length))
          return (
            <button
              key={idx}
              onClick={() => votar(idx)}
              disabled={enq.encerrada || voting !== null}
              className={`relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors ${
                enq.meu_voto === idx
                  ? 'border-[#0078d4] bg-[#0078d4]/5'
                  : 'border-border bg-muted/30 hover:bg-muted'
              } ${enq.encerrada ? 'cursor-default' : 'cursor-pointer'} ${enq.encerrada && vencedora && votos.length > 0 ? 'ring-1 ring-emerald-500' : ''}`}
              title={enq.encerrada ? undefined : `Votar em "${op}"`}
            >
              {mostraResultado && (
                <span
                  className="absolute inset-y-0 left-0 bg-[#0078d4]/10 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                  {op}
                  {enq.encerrada && vencedora && votos.length > 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  )}
                </span>
                {mostraResultado && (
                  <span className="shrink-0 text-xs font-semibold text-foreground">{pct}%</span>
                )}
              </span>
              {mostraResultado && votos.length > 0 && (
                <span className="relative mt-1 block truncate text-[10px] text-muted-foreground">
                  {votos.map(v => v.display_name).join(', ')}
                </span>
              )}
              {voting === idx && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-xs text-foreground">
                  Votando…
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {enq.encerrada
            ? `${total} voto${total !== 1 ? 's' : ''} · Encerrada`
            : `${total} voto${total !== 1 ? 's' : ''}${prazo ? ` · Encerra ${prazo}` : ''}`}
          {enq.encerrada && enq.encerrada_por_nome ? ` por ${enq.encerrada_por_nome}` : ''}
        </span>
        {!enq.encerrada && (isMine || ['administrador', 'super_admin', 'lider'].includes(getRole())) && (
          <button
            onClick={encerrar}
            className="text-[10px] font-medium text-muted-foreground transition-colors hover:text-rose-600"
          >
            Encerrar
          </button>
        )}
      </div>
      {err && <div className="mt-1 text-[10px] text-rose-600">{err}</div>}
    </div>
  )
}

function getRole(): string {
  try {
    const t = getToken()
    if (t) return JSON.parse(atob(t.split('.')[1])).role || ''
  } catch { /* ignore */ }
  return ''
}
