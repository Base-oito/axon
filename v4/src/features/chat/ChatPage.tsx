import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Send, MessageSquare, Search } from 'lucide-react'

interface Canal {
  id: number
  nome: string
  fixo?: boolean
}

interface Usuario {
  id: number
  display_name?: string
  username?: string
  role?: string
}

interface Mensagem {
  id: number
  mensagem?: string
  conteudo?: string
  texto?: string
  sender_name?: string
  created_at?: string
  user_id?: number
}

interface UnreadMap {
  [key: string]: { count: number; sender?: string; message?: string }
}

function getText(m: Mensagem) {
  return m.mensagem || m.conteudo || m.texto || ''
}

function fmtTime(d?: string) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtListTime(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  const hoje = new Date()
  const sameDay = dt.toDateString() === hoje.toDateString()
  if (sameDay) return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function ChatPage() {
  const qc = useQueryClient()
  const [activeType, setActiveType] = useState<'channel' | 'dm' | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const [dmSearch, setDmSearch] = useState('')
  const [myId, setMyId] = useState<number | null>(null)

  const token = getToken()
  useEffect(() => {
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setMyId(Number(payload.sub))
    } catch { /* ignore */ }
  }, [token])

  // Canais
  const { data: canais } = useQuery({
    queryKey: ['chat-canais'],
    queryFn: () => apiFetch<Canal[]>('/api/chat/canais'),
    staleTime: 60_000,
    refetchInterval: 30_000,
  })

  // Usuários (DMs)
  const { data: usuarios } = useQuery({
    queryKey: ['chat-usuarios'],
    queryFn: () => apiFetch<Usuario[]>('/api/usuarios?limit=500'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Não lidas
  const { data: unread } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: () => apiFetch<UnreadMap>('/api/chat/unread'),
    refetchInterval: 30_000,
  })

  // Últimas mensagens por conversa
  const { data: lastTimes } = useQuery({
    queryKey: ['chat-last-times'],
    queryFn: () => apiFetch<Record<string, string>>('/api/chat/last-times'),
    refetchInterval: 60_000,
  })

  // Mensagens da conversa ativa
  const { data: mensagens } = useQuery({
    queryKey: ['chat-msgs', activeType, activeId],
    queryFn: () => {
      const url = activeType === 'channel' ? `/api/chat/mensagens/${activeId}` : `/api/chat/dm/${activeId}`
      return apiFetch<Mensagem[]>(url)
    },
    enabled: !!activeType && !!activeId,
    refetchInterval: 15_000,
  })

  const enviar = useMutation({
    mutationFn: async (msg: string) => {
      const t = getToken()
      const url = activeType === 'channel' ? '/api/chat/mensagens' : `/api/chat/dm/${activeId}`
      const body = activeType === 'channel'
        ? { canal_id: activeId, conteudo: msg }
        : { conteudo: msg }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['chat-msgs', activeType, activeId] })
      qc.invalidateQueries({ queryKey: ['chat-last-times'] })
      qc.invalidateQueries({ queryKey: ['chat-unread'] })
    },
  })

  const selectChannel = (c: Canal) => {
    setActiveType('channel')
    setActiveId(c.id)
  }

  const selectDM = (u: Usuario) => {
    setActiveType('dm')
    setActiveId(u.id)
  }

  // DMs ordenados: não-lidas primeiro, depois última mensagem, depois alfabético
  const sortedDMs = (usuarios || [])
    .filter(u => u.id !== myId)
    .filter(u => !dmSearch || (u.display_name || u.username || '').toLowerCase().includes(dmSearch.toLowerCase()))
    .sort((a, b) => {
      const unreadA = unread?.[`dm-${a.id}`]
      const unreadB = unread?.[`dm-${b.id}`]
      if (unreadA?.count && !unreadB?.count) return -1
      if (unreadB?.count && !unreadA?.count) return 1
      const timeA = lastTimes?.[`dm-${a.id}`] || ''
      const timeB = lastTimes?.[`dm-${b.id}`] || ''
      if (timeA && timeB) return timeB.localeCompare(timeA)
      if (timeA) return -1
      if (timeB) return 1
      return (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '')
    })

  const getUnread = (type: 'channel' | 'dm', id: number) =>
    unread?.[type === 'channel' ? `channel-${id}` : `dm-${id}`]?.count || 0

  const canalAtivo = activeType === 'channel' ? (canais || []).find(c => c.id === activeId) : null
  const dmAtivo = activeType === 'dm' ? (usuarios || []).find(u => u.id === activeId) : null
  const titulo = activeType === 'channel' ? canalAtivo?.nome : dmAtivo ? (dmAtivo.display_name || dmAtivo.username) : 'Selecione uma conversa'

  return (
    <div className="flex h-full min-h-[calc(100vh-7rem)] gap-4">
      {/* Lista de contatos: canais + DMs */}
      <div className="card-soft flex w-72 shrink-0 flex-col overflow-hidden rounded-lg bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
        </div>

        {/* Canais */}
        <div className="border-b border-border/40 px-3 py-2">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Canais</p>
          <div className="space-y-0.5">
            {(canais || []).map(c => {
              const un = getUnread('channel', c.id)
              const active = activeType === 'channel' && activeId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{c.nome}</span>
                  {un > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {un}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* DMs */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mensagens diretas</p>
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={dmSearch}
              onChange={e => setDmSearch(e.target.value)}
              placeholder="Buscar contato…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-0.5">
            {sortedDMs.map(u => {
              const un = getUnread('dm', u.id)
              const active = activeType === 'dm' && activeId === u.id
              return (
                <button
                  key={u.id}
                  onClick={() => selectDM(u)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0078d4]/10 text-xs font-bold text-[#0078d4]">
                    {(u.display_name || u.username || '?')[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-left">{u.display_name || u.username}</span>
                    <span className="block text-left text-[10px] text-muted-foreground/70">
                      {fmtListTime(lastTimes?.[`dm-${u.id}`])}
                    </span>
                  </span>
                  {un > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {un}
                    </span>
                  )}
                </button>
              )
            })}
            {sortedDMs.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum contato encontrado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Conversa */}
      <div className="card-soft flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          {activeType === 'dm' && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0078d4]/10 text-sm font-bold text-[#0078d4]">
              {(titulo || '?')[0]?.toUpperCase()}
            </span>
          )}
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {(mensagens || []).map(m => {
            const isMine = m.user_id === myId
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${isMine ? 'text-right' : ''}`}>
                  <div className={`rounded-lg px-3 py-2 ${isMine ? 'bg-primary text-primary-foreground' : 'bg-muted/60'}`}>
                    {!isMine && <p className="text-xs font-medium text-[#0078d4]">{m.sender_name || '—'}</p>}
                    <p className={`mt-0.5 text-sm ${isMine ? 'text-primary-foreground' : 'text-foreground'}`}>{getText(m)}</p>
                  </div>
                  <p className="mt-0.5 pl-1 text-[10px] text-muted-foreground">{fmtTime(m.created_at)}</p>
                </div>
              </div>
            )
          })}
          {activeType && (mensagens || []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 p-3">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && texto.trim() && activeType) enviar.mutate(texto.trim()) }}
            placeholder={activeType ? 'Escreva uma mensagem…' : 'Selecione uma conversa'}
            disabled={!activeType}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => { if (texto.trim() && activeType) enviar.mutate(texto.trim()) }}
            disabled={!activeType || !texto.trim() || enviar.isPending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
