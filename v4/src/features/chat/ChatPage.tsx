import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Send, MessageSquare } from 'lucide-react'

interface Canal {
  id: number
  nome: string
  fixo?: boolean
}

interface Mensagem {
  id: number
  mensagem?: string
  conteudo?: string
  texto?: string
  sender_name?: string
  created_at?: string
}

function getText(m: Mensagem) {
  return m.mensagem || m.conteudo || m.texto || ''
}

function fmtTime(d?: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPage() {
  const qc = useQueryClient()
  const [canalId, setCanalId] = useState<number | null>(null)
  const [texto, setTexto] = useState('')

  const { data: canais } = useQuery({
    queryKey: ['chat-canais'],
    queryFn: () => apiFetch<Canal[]>('/api/chat/canais'),
    staleTime: 60_000,
  })

  const { data: mensagens, refetch } = useQuery({
    queryKey: ['chat-msgs', canalId],
    queryFn: () => apiFetch<Mensagem[]>(`/api/chat/mensagens?canal_id=${canalId || ''}`),
    enabled: !!canalId,
    refetchInterval: 15_000,
  })

  // Polling rápido quando um canal está aberto
  useEffect(() => {
    if (!canalId) return
    const t = setInterval(() => refetch(), 5000)
    return () => clearInterval(t)
  }, [canalId, refetch])

  const enviar = useMutation({
    mutationFn: async (msg: string) => {
      const t = getToken()
      const r = await fetch('/api/chat/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ canal_id: canalId, conteudo: msg }),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['chat-msgs', canalId] })
    },
  })

  const canalAtivo = (canais || []).find(c => c.id === canalId)

  return (
    <div className="flex h-full min-h-[calc(100vh-7rem)] gap-4">
      {/* Lista de canais */}
      <div className="card-soft w-64 shrink-0 overflow-hidden rounded-lg bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Canais</h2>
        </div>
        <div className="p-2">
          {(canais || []).map(c => (
            <button
              key={c.id}
              onClick={() => setCanalId(c.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                canalId === c.id
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">{c.nome}</span>
            </button>
          ))}
          {(canais || []).length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum canal.</p>
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="card-soft flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{canalAtivo?.nome || 'Selecione um canal'}</h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {(mensagens || []).map(m => (
            <div key={m.id} className="max-w-[70%]">
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-xs font-medium text-[#0078d4]">{m.sender_name || '—'}</p>
                <p className="mt-0.5 text-sm text-foreground">{getText(m)}</p>
              </div>
              <p className="mt-0.5 pl-1 text-[10px] text-muted-foreground">{fmtTime(m.created_at)}</p>
            </div>
          ))}
          {canalId && (mensagens || []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem neste canal.</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && texto.trim() && canalId) enviar.mutate(texto.trim()) }}
            placeholder={canalId ? 'Escreva uma mensagem…' : 'Selecione um canal primeiro'}
            disabled={!canalId}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => { if (texto.trim() && canalId) enviar.mutate(texto.trim()) }}
            disabled={!canalId || !texto.trim() || enviar.isPending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
