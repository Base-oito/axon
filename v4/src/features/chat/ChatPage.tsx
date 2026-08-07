import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Send, MessageSquare, Search, MoreVertical, Reply, Forward, ClipboardList, Trash2, X } from 'lucide-react'

interface Canal { id: number; nome: string; fixo?: boolean }
interface Usuario { id: number; display_name?: string; username?: string; role?: string }

interface Reacao { user_id: number; reacao: string; user_name: string }

interface Mensagem {
  id: number
  conteudo?: string
  mensagem?: string
  texto?: string
  sender_name?: string
  de_user_name?: string
  de_user_id?: number
  created_at?: string
  reacoes?: Reacao[]
  anexos?: any[]
}

interface UnreadMap { [key: string]: { count: number } }

function getText(m: Mensagem) { return m.conteudo || m.mensagem || m.texto || '' }
function getUserId(): { id: number; role: string } {
  try {
    const t = getToken()
    if (t) {
      const p = JSON.parse(atob(t.split('.')[1]))
      return { id: parseInt(p.sub) || 0, role: p.role || '' }
    }
  } catch { /* ignore */ }
  return { id: 0, role: '' }
}

const IS_ADMIN = ['administrador', 'lider', 'super_admin']

function fmtDateTime(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  const hoje = new Date()
  const sameDay = dt.toDateString() === hoje.toDateString()
  const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

function groupReactions(reacoes: Reacao[] = []): Array<{ reacao: string; count: number }> {
  const map = new Map<string, number>()
  for (const r of reacoes) map.set(r.reacao, (map.get(r.reacao) || 0) + 1)
  return Array.from(map.entries()).map(([reacao, count]) => ({ reacao, count }))
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export default function ChatPage() {
  const qc = useQueryClient()
  const me = getUserId()
  const [activeType, setActiveType] = useState<'channel' | 'dm' | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const [dmSearch, setDmSearch] = useState('')
  const [menuMsg, setMenuMsg] = useState<Mensagem | null>(null)
  const [replyTo, setReplyTo] = useState<Mensagem | null>(null)
  const [forwardMsg, setForwardMsg] = useState<Mensagem | null>(null)
  const [forwardDest, setForwardDest] = useState('')
  const [forwardDestType, setForwardDestType] = useState<'channel' | 'dm'>('channel')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskText, setTaskText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Queries ──────────────────────────────────────────
  const { data: canais } = useQuery({
    queryKey: ['chat-canais'],
    queryFn: () => apiFetch<Canal[]>('/api/chat/canais'),
    staleTime: 60_000, refetchInterval: 30_000,
  })
  const { data: usuarios } = useQuery({
    queryKey: ['chat-usuarios'],
    queryFn: () => apiFetch<Usuario[]>('/api/usuarios?limit=500'),
    staleTime: 60_000, refetchInterval: 60_000,
  })
  const { data: unread } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: () => apiFetch<UnreadMap>('/api/chat/unread'),
    refetchInterval: 30_000,
  })
  const { data: lastTimes } = useQuery({
    queryKey: ['chat-last-times'],
    queryFn: () => apiFetch<Record<string, string>>('/api/chat/last-times'),
    refetchInterval: 60_000,
  })
  const { data: mensagens } = useQuery({
    queryKey: ['chat-msgs', activeType, activeId],
    queryFn: () => {
      const url = activeType === 'channel' ? `/api/chat/mensagens/${activeId}` : `/api/chat/dm/${activeId}`
      return apiFetch<Mensagem[]>(url)
    },
    enabled: !!activeType && !!activeId,
    refetchInterval: 10_000,
  })

  // ── Ações ────────────────────────────────────────────
  const invalidade = () => {
    qc.invalidateQueries({ queryKey: ['chat-msgs', activeType, activeId] })
    qc.invalidateQueries({ queryKey: ['chat-last-times'] })
    qc.invalidateQueries({ queryKey: ['chat-unread'] })
  }

  const enviar = useMutation({
    mutationFn: async (msg: string) => {
      const t = getToken()
      const body: any = { conteudo: msg }
      if (activeType === 'channel') body.canal_id = activeId
      const url = activeType === 'channel' ? '/api/chat/mensagens' : `/api/chat/dm/${activeId}`
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => { setTexto(''); setReplyTo(null); invalidade() },
  })

  const reagir = useMutation({
    mutationFn: async ({ id, reacao }: { id: number; reacao: string }) => {
      const t = getToken()
      const r = await fetch(`/api/chat/mensagens/${id}/reagir`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ reacao }) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: invalidade,
  })

  const apagar = useMutation({
    mutationFn: async (id: number) => {
      const t = getToken()
      const r = await fetch(`/api/chat/mensagens/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: invalidade,
  })

  const criarTarefa = useMutation({
    mutationFn: async (text: string) => {
      const t = getToken()
      const r = await fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ titulo: text.slice(0, 120), descricao: text }) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => { setShowTaskModal(false); setTaskText(''); alert('Tarefa criada!') },
  })

  const encaminhar = useMutation({
    mutationFn: async ({ text, destType, dest }: { text: string; destType: string; dest: string }) => {
      const t = getToken()
      const body: any = { conteudo: text }
      if (destType === 'channel') body.canal_id = parseInt(dest)
      const url = destType === 'channel' ? '/api/chat/mensagens' : `/api/chat/dm/${dest}`
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => { setForwardMsg(null); setForwardDest(''); alert('Mensagem encaminhada!') },
  })

  // ── Scroll para baixo ────────────────────────────────
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [mensagens, activeId])

  // ── Autosize do textarea ─────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [texto])

  const selectChannel = (c: Canal) => { setActiveType('channel'); setActiveId(c.id); setReplyTo(null) }
  const selectDM = (u: Usuario) => { setActiveType('dm'); setActiveId(u.id); setReplyTo(null) }

  const sortedDMs = (usuarios || [])
    .filter(u => u.id !== me.id)
    .filter(u => !dmSearch || (u.display_name || u.username || '').toLowerCase().includes(dmSearch.toLowerCase()))
    .sort((a, b) => {
      const ua = unread?.[`dm-${a.id}`]; const ub = unread?.[`dm-${b.id}`]
      if (ua?.count && !ub?.count) return -1
      if (ub?.count && !ua?.count) return 1
      const ta = lastTimes?.[`dm-${a.id}`] || ''; const tb = lastTimes?.[`dm-${b.id}`] || ''
      if (ta && tb) return tb.localeCompare(ta)
      if (ta) return -1
      if (tb) return 1
      return (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '')
    })

  const getUnread = (type: 'channel' | 'dm', id: number) => unread?.[type === 'channel' ? `channel-${id}` : `dm-${id}`]?.count || 0
  const canalAtivo = activeType === 'channel' ? (canais || []).find(c => c.id === activeId) : null
  const dmAtivo = activeType === 'dm' ? (usuarios || []).find(u => u.id === activeId) : null
  const titulo = canalAtivo?.nome || (dmAtivo ? (dmAtivo.display_name || dmAtivo.username) : 'Selecione uma conversa')

  const avatar = (nome: string) => (
    <span className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#0078d4]/10 text-xs font-bold text-[#0078d4]">
      {(nome || '?')[0]?.toUpperCase()}
    </span>
  )

  return (
    <div className="flex h-full min-h-[calc(100vh-7rem)] gap-4">
      {/* ── Lista de contatos ── */}
      <div className="card-soft flex w-72 shrink-0 flex-col overflow-hidden rounded-lg bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
        </div>
        <div className="border-b border-border/40 px-3 py-2">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Canais</p>
          <div className="space-y-0.5">
            {(canais || []).map(c => {
              const un = getUnread('channel', c.id)
              const active = activeType === 'channel' && activeId === c.id
              return (
                <button key={c.id} onClick={() => selectChannel(c)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{c.nome}</span>
                  {un > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{un}</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mensagens diretas</p>
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={dmSearch} onChange={e => setDmSearch(e.target.value)} placeholder="Buscar contato…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-0.5">
            {sortedDMs.map(u => {
              const un = getUnread('dm', u.id)
              const active = activeType === 'dm' && activeId === u.id
              const nome = u.display_name || u.username || '?'
              return (
                <button key={u.id} onClick={() => selectDM(u)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  {avatar(nome)}
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{nome}</span>
                    <span className="block text-[10px] text-muted-foreground/70">{lastTimes?.[`dm-${u.id}`] ? new Date(lastTimes[`dm-${u.id}`]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
                  </span>
                  {un > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{un}</span>}
                </button>
              )
            })}
            {sortedDMs.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum contato encontrado.</p>}
          </div>
        </div>
      </div>

      {/* ── Conversa ── */}
      <div className="card-soft flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          {activeType === 'dm' && dmAtivo && avatar(dmAtivo.display_name || dmAtivo.username || '?')}
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        </div>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {(mensagens || []).map(m => {
            const isMine = m.de_user_id === me.id
            const nome = m.de_user_name || m.sender_name || '—'
            const reacs = groupReactions(m.reacoes)
            const msgText = getText(m)
            return (
              <div key={m.id} className={`group relative flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                {!isMine && avatar(nome)}
                <div className={`flex max-w-[70%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Nome + data/hora (alinha com o avatar no topo) */}
                  <div className={`mb-0.5 flex items-baseline gap-2 ${isMine ? 'justify-end' : ''}`}>
                    <span className="text-xs font-semibold text-[#0078d4]">{isMine ? 'Você' : nome}</span>
                    <span className="text-[10px] text-muted-foreground/70">{fmtDateTime(m.created_at)}</span>
                  </div>
                  {/* Bolha encaixada abaixo do nome, formando coluna contínua */}
                  <div className={`relative rounded-2xl px-3.5 py-2 text-left ${isMine ? 'rounded-br-md bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'rounded-bl-md bg-muted/60'}`}>
                    {replyTo && replyTo.id === m.id && (
                      <p className={`mb-1 border-l-2 pl-2 text-xs ${isMine ? 'border-white/40 text-white/80' : 'border-[#0078d4]/40 text-muted-foreground'}`}>
                        Respondendo…
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{msgText}</p>
                  </div>
                  {/* Reações */}
                  {reacs.length > 0 && (
                    <div className={`mt-1 flex gap-1 ${isMine ? 'justify-end' : ''}`}>
                      {reacs.map((r, i) => (
                        <span key={i} className="rounded-full border border-border bg-card px-1.5 py-0.5 text-xs shadow-sm">
                          {r.reacao} {r.count > 1 ? r.count : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Menu de ações (hover) */}
                <div className={`flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${isMine ? '' : ''}`}>
                  <button onClick={() => setMenuMsg(menuMsg?.id === m.id ? null : m)}
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
          {activeType && (mensagens || []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
          )}
        </div>

        {/* Barra de resposta */}
        {replyTo && (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2">
            <p className="truncate text-xs text-muted-foreground">
              Respondendo a <span className="font-medium text-foreground">{replyTo.de_user_name || 'mensagem'}</span>: {getText(replyTo).slice(0, 60)}
            </p>
            <button onClick={() => setReplyTo(null)} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-border/60 p-3">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (texto.trim() && activeType) enviar.mutate(texto.trim()) } }}
            placeholder={activeType ? 'Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)' : 'Selecione uma conversa'}
            disabled={!activeType}
            rows={1}
            className="max-h-40 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={() => { if (texto.trim() && activeType) enviar.mutate(texto.trim()) }}
            disabled={!activeType || !texto.trim() || enviar.isPending}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Modal de ações da mensagem ── */}
      {menuMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setMenuMsg(null)}>
          <div className="glass-strong w-full max-w-xs rounded-xl p-2" onClick={e => e.stopPropagation()}>
            <p className="px-3 py-2 text-xs font-semibold text-foreground">Ações da mensagem</p>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-xs text-muted-foreground">Reagir:</span>
                <div className="flex gap-1">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { reagir.mutate({ id: menuMsg.id, reacao: e }); setMenuMsg(null) }}
                      className="rounded-full p-1 text-lg transition-transform hover:scale-125">{e}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => { setReplyTo(menuMsg); setMenuMsg(null) }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted">
                <Reply className="h-4 w-4 text-muted-foreground" /> Responder
              </button>
              <button onClick={() => { setForwardMsg(menuMsg); setMenuMsg(null) }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted">
                <Forward className="h-4 w-4 text-muted-foreground" /> Encaminhar
              </button>
              <button onClick={() => { setTaskText(getText(menuMsg)); setShowTaskModal(true); setMenuMsg(null) }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted">
                <ClipboardList className="h-4 w-4 text-muted-foreground" /> Transformar em tarefa
              </button>
              {IS_ADMIN.includes(me.role) && (
                <button onClick={() => { if (confirm('Apagar mensagem?')) apagar.mutate(menuMsg.id); setMenuMsg(null) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" /> Apagar (admin)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de encaminhar ── */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setForwardMsg(null)}>
          <div className="glass-strong w-full max-w-sm rounded-xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Encaminhar mensagem</h3>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setForwardDestType('channel')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${forwardDestType === 'channel' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>Canal</button>
              <button onClick={() => setForwardDestType('dm')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${forwardDestType === 'dm' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>Direto</button>
            </div>
            <select value={forwardDest} onChange={e => setForwardDest(e.target.value)} className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecione…</option>
              {forwardDestType === 'channel'
                ? (canais || []).map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)
                : (usuarios || []).filter(u => u.id !== me.id).map(u => <option key={u.id} value={String(u.id)}>{u.display_name || u.username}</option>)}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setForwardMsg(null)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => { if (forwardDest) encaminhar.mutate({ text: getText(forwardMsg), destType: forwardDestType, dest: forwardDest }) }}
                disabled={!forwardDest} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90 disabled:opacity-40">
                Encaminhar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de tarefa ── */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowTaskModal(false)}>
          <div className="glass-strong w-full max-w-sm rounded-xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Transformar em tarefa</h3>
            <textarea value={taskText} onChange={e => setTaskText(e.target.value)} rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowTaskModal(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => { if (taskText.trim()) criarTarefa.mutate(taskText.trim()) }} disabled={!taskText.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90 disabled:opacity-40">
                Criar tarefa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
