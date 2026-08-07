import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Send, MessageSquare, Search, MoreVertical, Reply, Forward, ClipboardList, Trash2, X, Plus, Mic, Paperclip, Square, Trash, Info, Copy, Users } from 'lucide-react'

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

function safeAnexos(item: any): any[] {
  if (!item) return []
  if (Array.isArray(item)) return item
  if (typeof item === 'string') {
    try { return JSON.parse(item) || [] } catch { return [] }
  }
  return []
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
  const [showDetail, setShowDetail] = useState(false)
  const [userDetail, setUserDetail] = useState<any>(null)
  const [userEmpresas, setUserEmpresas] = useState<Array<{ id: number; name: string; cnpj?: string }>>([])
  const [participantes, setParticipantes] = useState<Array<{ user_id: number; display_name: string; username: string; last_active?: string }>>([])
  const [participantSearch, setParticipantSearch] = useState('')
  const [showCreateCanal, setShowCreateCanal] = useState(false)
  const [novoCanal, setNovoCanal] = useState('')
  const [canalMembros, setCanalMembros] = useState<number[]>([])
  const [attachments, setAttachments] = useState<Array<{ file: File; preview: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recTime, setRecTime] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recChunksRef = useRef<Blob[]>([])
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    queryFn: async () => {
      const url = activeType === 'channel' ? `/api/chat/mensagens/${activeId}` : `/api/chat/dm/${activeId}`
      const msgs = await apiFetch<Mensagem[]>(url)
      // Ordem cronológica: mais antigas em cima, mais recentes embaixo
      return [...(msgs || [])].sort((a, b) =>
        String(a.created_at || '').localeCompare(String(b.created_at || '')))
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

  // ── Upload de arquivo (anexo) ────────────────────────
  const uploadFile = async (file: File): Promise<{ nome: string; path: string }> => {
    const t = getToken()
    const formData = new FormData()
    formData.append('file', file)
    const r = await fetch('/api/chat/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t },
      body: formData,
    })
    if (!r.ok) throw new Error('Falha no upload')
    return r.json()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.size > 2 * 1024 * 1024) { alert('Arquivo máximo 2MB'); continue }
      setAttachments(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
    }
    e.target.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Gravação de áudio ────────────────────────────────
  const supportsMediaRecorder = typeof MediaRecorder !== 'undefined'

  const startRecording = async () => {
    if (!supportsMediaRecorder) { alert('Gravação de áudio não suportada neste navegador'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(recChunksRef.current, { type: 'audio/webm' })
        if (blob.size > 0) {
          const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
          setAttachments(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecTime(0)
      recTimerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
    } catch {
      alert('Não foi possível acessar o microfone')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    if (recTimerRef.current) clearInterval(recTimerRef.current)
  }

  // ── Criar canal (admin+) ─────────────────────────────
  const criarCanal = useMutation({
    mutationFn: async () => {
      const t = getToken()
      const r = await fetch('/api/chat/canais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ nome: novoCanal.trim(), tipo: 'texto', membros: canalMembros }),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => {
      setShowCreateCanal(false)
      setNovoCanal('')
      setCanalMembros([])
      qc.invalidateQueries({ queryKey: ['chat-canais'] })
    },
    onError: () => alert('Erro ao criar canal'),
  })

  const excluirCanal = useMutation({
    mutationFn: async (id: number) => {
      const t = getToken()
      const r = await fetch(`/api/chat/canais/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => {
      if (activeType === 'channel') { setActiveType(null); setActiveId(null) }
      qc.invalidateQueries({ queryKey: ['chat-canais'] })
    },
    onError: () => alert('Erro ao excluir canal'),
  })

  const enviar = useMutation({
    mutationFn: async (msg: string) => {
      const t = getToken()
      const currentAttachments = attachments
      let anexos: any[] | null = null
      if (currentAttachments.length > 0) {
        setUploading(true)
        anexos = []
        for (const att of currentAttachments) {
          const result = await uploadFile(att.file)
          anexos.push(result)
        }
        setUploading(false)
      }
      const body: any = { conteudo: msg }
      if (anexos) body.anexos = anexos
      if (activeType === 'channel') body.canal_id = activeId
      const url = activeType === 'channel' ? '/api/chat/mensagens' : `/api/chat/dm/${activeId}`
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => {
      setTexto('')
      setReplyTo(null)
      setAttachments([])
      invalidade()
    },
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

  // ── Ao ABRIR uma conversa: posiciona na última mensagem (embaixo).
  //    Sem rolagem automática nas atualizações seguintes (polling). ──
  const justOpened = useRef(false)
  useEffect(() => {
    if (!activeType || !activeId) return
    justOpened.current = true
    const t = setTimeout(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
      justOpened.current = false
    }, 60)
    return () => clearTimeout(t)
  }, [activeType, activeId])

  // ── Autosize do textarea ─────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [texto])

  const selectChannel = (c: Canal) => { setActiveType('channel'); setActiveId(c.id); setReplyTo(null); setShowDetail(false) }
  const selectDM = (u: Usuario) => { setActiveType('dm'); setActiveId(u.id); setReplyTo(null); setShowDetail(false) }

  // ── Painel lateral: detalhes do contato + empresas ──
  const loadDmUserDetail = async (userId: number) => {
    const t = getToken()
    if (!t) return
    try {
      const [userRes, empresasRes] = await Promise.all([
        fetch(`/api/usuarios/${userId}`, { headers: { Authorization: 'Bearer ' + t } }),
        fetch(`/api/usuarios/${userId}/empresas`, { headers: { Authorization: 'Bearer ' + t } }),
      ])
      if (userRes.ok) setUserDetail(await userRes.json())
      if (empresasRes.ok) setUserEmpresas(await empresasRes.json())
    } catch { /* ignore */ }
  }

  const toggleDetail = () => {
    setShowDetail(prev => {
      if (!prev && activeType === 'dm' && activeId) loadDmUserDetail(activeId)
      if (!prev && activeType === 'channel' && activeId) loadParticipants(activeId)
      return !prev
    })
  }

  // ── Participantes do canal ──
  const loadParticipants = async (canalId: number) => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/chat/canais/${canalId}/participantes`, { headers: { Authorization: 'Bearer ' + t } })
      if (r.ok) setParticipantes(await r.json())
    } catch { /* ignore */ }
  }

  const addParticipant = async (userId: number) => {
    const t = getToken()
    if (!t || !activeId) return
    try {
      const r = await fetch(`/api/chat/canais/${activeId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ user_id: userId }),
      })
      if (r.ok) {
        await loadParticipants(activeId)
        qc.invalidateQueries({ queryKey: ['chat-canais'] })
      }
    } catch { /* ignore */ }
  }

  const removeParticipant = async (userId: number) => {
    const t = getToken()
    if (!t || !activeId) return
    if (!confirm('Remover este participante do canal?')) return
    try {
      const r = await fetch(`/api/chat/canais/${activeId}/participantes/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (r.ok) {
        await loadParticipants(activeId)
        qc.invalidateQueries({ queryKey: ['chat-canais'] })
      }
    } catch { /* ignore */ }
  }

  const isOnline = (lastActive?: string) => {
    if (!lastActive) return false
    return Date.now() - new Date(lastActive).getTime() < 5 * 60_000
  }

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
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
          {IS_ADMIN.includes(me.role) && (
            <button onClick={() => setShowCreateCanal(true)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Novo canal">
              <Plus className="h-4 w-4" />
            </button>
          )}
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
          <h2 className="flex-1 truncate text-sm font-semibold text-foreground">{titulo}</h2>
          {activeType === 'channel' && (
            <button onClick={toggleDetail}
              title="Membros do canal"
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors ${showDetail ? 'bg-[#0078d4]/10 text-[#0078d4]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Users className="h-4 w-4" />
              {participantes.length > 0 ? participantes.length : 'Membros'}
            </button>
          )}
          {activeType === 'dm' && (
            <button onClick={toggleDetail}
              title="Informações do contato"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showDetail ? 'bg-[#0078d4]/10 text-[#0078d4]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Info className="h-4 w-4" />
              <span className="sr-only">info</span>
            </button>
          )}
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
                    {/* Anexos */}
                    {safeAnexos(m.anexos).length > 0 && (
                      <div className="mt-2 space-y-2">
                        {safeAnexos(m.anexos).map((att: any, ai: number) => {
                          const path = `/api/chat/uploads/${att.path}`
                          const isImage = (att.nome || '').match(/\.(png|jpg|jpeg|gif|webp)$/i) || (att.path || '').match(/\.(png|jpg|jpeg|gif|webp)$/i)
                          const isAudio = (att.nome || '').match(/\.(mp3|wav|ogg|webm|aac|m4a)$/i) || (att.path || '').match(/\.(mp3|wav|ogg|webm|aac|m4a)$/i)
                          return (
                            <div key={ai}>
                              {isImage ? (
                                <img src={path} alt="" className="max-w-[220px] cursor-pointer rounded-lg transition-opacity hover:opacity-80"
                                  onClick={() => window.open(path, '_blank')} />
                              ) : isAudio ? (
                                <audio controls src={path} className="h-8 max-w-full rounded" preload="metadata" />
                              ) : (
                                <a href={path} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-[#0078d4] hover:underline">
                                  📎 {att.nome || 'Arquivo'}
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
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

        {/* Preview de anexos */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border/60 bg-muted/30 p-3">
            {attachments.map((att, i) => {
              const isImg = att.file.type.startsWith('image/')
              const isAudio = att.file.type.startsWith('audio/')
              return (
                <div key={i} className="relative">
                  {isImg ? (
                    <img src={att.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ) : isAudio ? (
                    <audio controls src={att.preview} className="h-10 w-48 rounded" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-card text-2xl">📎</span>
                  )}
                  <button onClick={() => removeAttachment(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-border/60 p-3">
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} disabled={!activeType || uploading}
            title="Anexar arquivo (máx. 2MB)"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
            <Paperclip className="h-4 w-4" />
          </button>
          {!recording ? (
            <button onClick={startRecording} disabled={!activeType}
              title="Gravar áudio"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
              <Mic className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={stopRecording}
              title={`Parar gravação (${recTime}s)`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-xs font-medium text-white shadow-md transition-colors hover:bg-rose-600">
              <Square className="h-3.5 w-3.5" /> {recTime}s
            </button>
          )}
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

      {/* ── Painel lateral de membros (canal) ── */}
      {showDetail && activeType === 'channel' && (
        <div className="card-soft flex w-72 shrink-0 flex-col overflow-hidden rounded-lg bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Membros do canal</h3>
            <p className="text-xs text-muted-foreground">{participantes.length} participantes</p>
          </div>

          {IS_ADMIN.includes(me.role) && (
            <div className="border-b border-border/40 p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={participantSearch}
                  onChange={e => setParticipantSearch(e.target.value)}
                  placeholder="Adicionar usuário…"
                  className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                {(usuarios || [])
                  .filter(u => u.id !== me.id)
                  .filter(u => !participantes.find(p => p.user_id === u.id))
                  .filter(u => !participantSearch || (u.display_name || u.username || '').toLowerCase().includes(participantSearch.toLowerCase()))
                  .slice(0, 10)
                  .map(u => (
                    <button key={u.id} onClick={() => addParticipant(u.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Plus className="h-3.5 w-3.5 text-[#0078d4]" />
                      {u.display_name || u.username}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {participantes.map(p => {
              const online = p.last_active ? Date.now() - new Date(p.last_active).getTime() < 5 * 60_000 : false
              return (
                <div key={p.user_id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0078d4]/10 text-xs font-bold text-[#0078d4]">
                    {(p.display_name || p.username || '?')[0]?.toUpperCase()}
                    <span className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card ${online ? 'bg-emerald-500' : 'bg-muted'}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.display_name || p.username}</span>
                  {IS_ADMIN.includes(me.role) && p.user_id !== me.id && (
                    <button onClick={() => removeParticipant(p.user_id)}
                      title="Remover do canal"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
            {participantes.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhum participante.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Painel lateral de contato (DM) ── */}
      {showDetail && activeType === 'dm' && userDetail && (
        <div className="card-soft w-72 shrink-0 overflow-y-auto rounded-lg bg-card">
          <div className="border-b border-border/60 p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0078d4]/10 text-2xl font-bold text-[#0078d4]">
              {(userDetail.display_name || userDetail.username || '?')[0]?.toUpperCase()}
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">{userDetail.display_name || userDetail.username}</h3>
            <p className={`mt-1 text-xs ${isOnline(userDetail.last_active) ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {isOnline(userDetail.last_active) ? '● Online' : '○ Offline'}
            </p>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">E-mail</p>
                <div className="group flex items-center gap-1.5">
                  <p className="truncate text-sm text-foreground" title={userDetail.username}>{userDetail.username}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(userDetail.username); alert('E-mail copiado!') }}
                    title="Copiar e-mail"
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {userDetail.role_title && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cargo</p>
                  <p className="text-sm text-foreground">{userDetail.role_title}</p>
                </div>
              )}
              {userDetail.departamento_nome && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Departamento</p>
                  <p className="text-sm text-foreground">{userDetail.departamento_nome}</p>
                </div>
              )}
              {userDetail.ramal && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ramal</p>
                  <p className="text-sm text-foreground">{userDetail.ramal}</p>
                </div>
              )}
            </div>

            {userEmpresas.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Empresas responsável
                </p>
                <div className="space-y-1.5">
                  {userEmpresas.map(emp => (
                    <div key={emp.id} className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <p className="truncate text-xs font-medium text-foreground">{emp.name}</p>
                      {emp.cnpj && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{emp.cnpj}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userEmpresas.length === 0 && !userDetail.role_title && !userDetail.departamento_nome && !userDetail.ramal && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhuma informação adicional disponível.
              </p>
            )}
          </div>
        </div>
      )}

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
              {IS_ADMIN.includes(me.role) && activeType === 'channel' && (
                <button onClick={() => { if (confirm('Excluir este canal? As mensagens serão removidas.')) excluirCanal.mutate(activeId!); setMenuMsg(null) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                  <Trash className="h-4 w-4" /> Excluir canal (admin)
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

      {/* ── Modal de novo canal (admin+) ── */}
      {showCreateCanal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreateCanal(false)}>
          <div className="glass-strong w-full max-w-sm rounded-xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Novo canal</h3>
            <input
              value={novoCanal}
              onChange={e => setNovoCanal(e.target.value)}
              placeholder="Nome do canal…"
              autoFocus
              className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Membros</p>
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                {(usuarios || []).filter(u => u.id !== me.id).map(u => {
                  const nome = u.display_name || u.username || '?'
                  const checked = canalMembros.includes(u.id)
                  return (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
                      <input type="checkbox" checked={checked}
                        onChange={() => setCanalMembros(prev => checked ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                        className="h-4 w-4 accent-[#0078d4]" />
                      {nome}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowCreateCanal(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => { if (novoCanal.trim()) criarCanal.mutate() }} disabled={!novoCanal.trim() || criarCanal.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90 disabled:opacity-40">
                Criar canal
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
