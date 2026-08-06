import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { lazy, Suspense } from 'react'
const VoiceRoom = lazy(() => import('../components/VoiceRoom'))

function isOnline(lastActive: string | null): boolean {
  if (!lastActive) return false
  const FIVE_MIN = 5 * 60 * 1000
  return Date.now() - new Date(lastActive).getTime() < FIVE_MIN
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('nfse_token')
    if (!raw) return null
    try { const p = JSON.parse(raw); if (p.access_token) return p.access_token } catch {}
    if (raw.split('.').length === 3) return raw
    return null
  } catch { return null }
}

function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return fetch(input, init).then(r => {
    if (r.status === 401) {
      localStorage.removeItem('nfse_token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    return r
  })
}




function getMyId(): number {
  try { const t = getToken(); if (!t) return 0; return parseInt(JSON.parse(atob(t.split('.')[1])).sub) } catch { return 0 }
}
function getUserInfo(): { role: string; id: number } {
  try { const t = getToken(); if (t) { const p = JSON.parse(atob(t.split('.')[1])); return { role: p.role || '', id: parseInt(p.sub) || 0 } } } catch {}
  return { role: '', id: 0 }
}

type Canal = {
  id: number; nome: string; tipo: string; fixo: boolean; membros: number
  created_at: string
}
type Usuario = {
  id: number; username: string; display_name: string
  role: string; last_active: string | null; role_title?: string
  departamento_nome?: string; ramal?: string
}
type EmpresaVinculada = { id: number; name: string; cnpj: string }
type Mensagem = {
  id: number; canal_id?: number; de_user_id: number; de_user_name: string
  para_user_id?: number; conteudo: string; anexos: any[] | null
  resposta_para_id?: number | null; created_at: string
  reacoes: Array<{ user_id: number; reacao: string; user_name: string }>
  visualizacoes_count?: number
}
type Participante = { user_id: number; display_name: string; username: string; last_active: string | null }
type LinkPreview = {
  title: string; description: string; site_name: string; image: string
}
type Visualizacao = { user_id: number; display_name: string; viewed_at: string }

const REACOES_COMUNS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉']

function formatTime(d: string) {
  const dt = new Date(d)
  const now = new Date()
  const diff = now.getTime() - dt.getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function groupByDate(messages: Mensagem[]) {
  const groups: { date: string; msgs: Mensagem[] }[] = []
  let current: { date: string; msgs: Mensagem[] } | null = null
  for (const m of messages) {
    const d = new Date(m.created_at).toLocaleDateString('pt-BR')
    if (!current || current.date !== d) {
      current = { date: d, msgs: [] }
      groups.push(current)
    }
    current.msgs.push(m)
  }
  return groups
}

function groupReactions(reacoes: Array<{ user_id: number; reacao: string; user_name: string }>) {
  const map = new Map<string, { emoji: string; count: number; hasMine: boolean }>()
  const myId = getMyId()
  for (const r of reacoes) {
    const existing = map.get(r.reacao)
    if (existing) {
      existing.count++
      if (r.user_id === myId) existing.hasMine = true
    } else {
      map.set(r.reacao, { emoji: r.reacao, count: 1, hasMine: r.user_id === myId })
    }
  }
  return Array.from(map.values())
}

const MAX_FILE_SIZE = 2 * 1024 * 1024

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i)
  return match ? match[0] : null
}

function safeAnexos(item: any): any[] {
  if (!item) return []
  if (Array.isArray(item)) return item
  if (typeof item === 'string') return JSON.parse(item) || []
  return []
}

export default function Chat() {
  const navigate = useNavigate()
  const userInfo = getUserInfo()
  const userName = (() => {
    try { const t = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token; return JSON.parse(atob(t.split('.')[1])).display_name || 'Usuário' } catch { return 'Usuário' }
  })()

  const [loading, setLoading] = useState(true)
  const [canais, setCanais] = useState<Canal[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [unread, setUnread] = useState<Record<string, { count: number; message: string; sender: string; last_time: string | null }>>({})
  const [lastTimes, setLastTimes] = useState<Record<string, string>>({})
  const [dmSearch, setDmSearch] = useState('')

  const [activeType, setActiveType] = useState<'channel' | 'dm' | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [activeName, setActiveName] = useState('')

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [mensagemText, setMensagemText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: number; name: string; text: string } | null>(null)
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)

  const [showDetail, setShowDetail] = useState(false)
  const [voiceRoom, setVoiceRoom] = useState(false)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [dmUserDetail, setDmUserDetail] = useState<Usuario | null>(null)
  const [dmUserEmpresas, setDmUserEmpresas] = useState<EmpresaVinculada[]>([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCanalName, setNewCanalName] = useState('')
  const [newCanalTipo, setNewCanalTipo] = useState<'texto' | 'voz'>('texto')
  const [newCanalMembros, setNewCanalMembros] = useState<number[]>([])
  const [creatingCanal, setCreatingCanal] = useState(false)

  const [linkPreviews, setLinkPreviews] = useState<Record<number, { preview: LinkPreview; url: string }>>({})
  const processedPreviewsRef = useRef(new Set<number>())

  const [readReceiptsMsgId, setReadReceiptsMsgId] = useState<number | null>(null)
  const [readReceipts, setReadReceipts] = useState<Visualizacao[]>([])
  const [readReceiptsLoading, setReadReceiptsLoading] = useState(false)
  const readReceiptsPopupRef = useRef<HTMLDivElement>(null)
  const [readReceiptsPopupStyle, setReadReceiptsPopupStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingIntervalRef = useRef<number | null>(null)
  const activeTypeRef = useRef(activeType)
  const loadSeqRef = useRef(0)
  const activeIdRef = useRef(activeId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadMessagesRef = useRef<any>(null)

  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [participantSearchTerm, setParticipantSearchTerm] = useState('')

  const [confirmDeleteChannelId, setConfirmDeleteChannelId] = useState<number | null>(null)
  const [emojiPicker, setEmojiPicker] = useState<number | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPri, setTaskPri] = useState('Média')
  const [taskCliente, setTaskCliente] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [clientes, setClientes] = useState<{ id: number; name: string }[]>([])
  const [forwardModal, setForwardModal] = useState(false)
  const [forwardText, setForwardText] = useState('')
  const [forwardDest, setForwardDest] = useState('')
  const [forwardDestType, setForwardDestType] = useState<'channel' | 'dm'>('channel')
  const [inputEmojiOpen, setInputEmojiOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const msgEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const shouldScrollRef = useRef(false)

  const supportsMediaRecorder = typeof MediaRecorder !== 'undefined'
  const isSecureContext = typeof window !== 'undefined' && (window.isSecureContext || location.protocol === 'https:')
  const isAdmin = ['administrador', 'lider', 'super_admin'].includes(userInfo.role)

  const activeChannel = activeType === 'channel' ? canais.find(c => c.id === activeId) : null
  const isFixedChannel = activeType === 'channel' && activeChannel?.fixo === true
  const canPostInChannel = !isFixedChannel || isAdmin

  useEffect(() => { activeTypeRef.current = activeType }, [activeType])
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    Promise.all([
      authFetch('/api/chat/canais', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
      authFetch('/api/usuarios?limit=500', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
    ]).then(([c, u]) => {
      setCanais(Array.isArray(c) ? c : [])
      setUsuarios(Array.isArray(u) ? u : [])
    }).catch(() => {}).finally(() => setLoading(false))
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setClientes).catch(() => {})
    loadUnread()
    loadLastTimes()
    const loadUsers = () => {
      const tok = getToken()
      if (!tok) return
      fetch('/api/usuarios?limit=500', { headers: { Authorization: 'Bearer ' + tok } })
        .then(r => r.json()).then(u => { if (Array.isArray(u)) setUsuarios(u) }).catch(() => {})
      loadLastTimes()
    }
    const unreadInterval = setInterval(loadUnread, 30000)
    const usersInterval = setInterval(loadUsers, 60000)
    const pingInterval = setInterval(() => {
      const tok = getToken()
      if (tok) fetch('/api/chat/ping', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }).catch(() => {})
    }, 60000)
    return () => { clearInterval(unreadInterval); clearInterval(usersInterval); clearInterval(pingInterval) }
  }, [navigate])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (readReceiptsPopupRef.current && !readReceiptsPopupRef.current.contains(e.target as Node)) {
        setReadReceiptsMsgId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadUnread = async () => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/chat/unread', { headers: { Authorization: 'Bearer ' + t } })
      setUnread(await r.json())
    } catch {}
  }

  const loadLastTimes = async () => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch('/api/chat/last-times', { headers: { Authorization: 'Bearer ' + t } })
      setLastTimes(await r.json())
    } catch {}
  }

  const loadMessages = useCallback(async (search?: string) => {
    const type = activeTypeRef.current
    const id = activeIdRef.current
    if (!type || !id) return
    const t = getToken()
    if (!t) return
    const seq = ++loadSeqRef.current
    setMsgLoading(true)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const url = type === 'channel'
        ? `/api/chat/mensagens/${id}${params}`
        : `/api/chat/dm/${id}${params}`
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } })
      const data = await r.json()
      if (seq !== loadSeqRef.current || id !== activeIdRef.current || type !== activeTypeRef.current) return
      if (Array.isArray(data)) setMensagens(data)
      if (!search) {
        const readUrl = type === 'channel' ? `/api/chat/canais/${id}/read` : `/api/chat/dm/${id}/read`
        fetch(readUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {})
      }
    } catch {}
    if (seq === loadSeqRef.current) setMsgLoading(false)
  }, [])

  useEffect(() => { loadMessagesRef.current = loadMessages }, [loadMessages])

  useEffect(() => {
    if (activeType && activeId) {
      setMensagens([])
      loadMessages()
      loadUnread()
    }
  }, [activeType, activeId, loadMessages])

  useEffect(() => {
    if (!activeType || !activeId) return
    let lastUnreadTotal = 0
    const interval = setInterval(async () => {
      const t = getToken()
      if (!t) return
      try {
        const r = await fetch('/api/chat/unread', { headers: { Authorization: 'Bearer ' + t } })
        const data = await r.json()
        setUnread(data)
        // Calculate total unread across all conversations
        const total = Object.values(data as Record<string, any>).reduce((sum: number, v: any) => sum + (v?.count || 0), 0)
        if (lastUnreadTotal > 0 && total > lastUnreadTotal && Notification.permission === 'granted') {
          // Find which conversation has new messages
          for (const [key, val] of Object.entries(data as Record<string, any>)) {
            if (val?.count > 0 && val?.sender && val?.message) {
              try { new Notification(val.sender, { body: val.message.substring(0, 120), icon: '/logo.png', tag: key, requireInteraction: true }) } catch {}
              break
            }
          }
        }
        lastUnreadTotal = total
      } catch {}
      // Also poll messages for the active conversation
      const url = type === 'channel' ? `/api/chat/mensagens/${id}` : `/api/chat/dm/${id}`
      fetch(url, { headers: { Authorization: 'Bearer ' + t } })
        .then(r => r.json()).then(data => {
          if (Array.isArray(data) && id === activeIdRef.current && type === activeTypeRef.current) {
            setMensagens(data)
          }
        }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [activeType, activeId])

  const scrollToBottom = (smooth = true) => {
    msgEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const handleScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom(true)
  }, [mensagens])

  useEffect(() => {
    const t = getToken()
    if (!t || mensagens.length === 0) return
    const newPreviews: Record<number, { preview: LinkPreview; url: string }> = {}
    const promises: Promise<void>[] = []

    for (const msg of mensagens) {
      if (processedPreviewsRef.current.has(msg.id)) continue
      processedPreviewsRef.current.add(msg.id)

      const url = extractUrl(msg.conteudo)
      if (!url) continue

      promises.push(
        fetch(`/api/chat/link-preview?url=${encodeURIComponent(url)}`, {
          headers: { Authorization: 'Bearer ' + t }
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.title) {
              newPreviews[msg.id] = { preview: data, url }
            }
          })
          .catch(() => {})
      )
    }

    if (promises.length > 0) {
      Promise.all(promises).then(() => {
        if (Object.keys(newPreviews).length > 0) {
          setLinkPreviews(prev => ({ ...prev, ...newPreviews }))
        }
      })
    }
  }, [mensagens])

  const selectChannel = (c: Canal) => {
    setActiveType('channel')
    setActiveId(c.id)
    setMensagens([])
    setActiveName(c.nome)
    setShowSearch(false)
    setSearchQuery('')
    setSearchInput('')
    setReplyTo(null)
    setAttachments([])
    setDmUserDetail(null)
    setDmUserEmpresas([])
    setReadReceiptsMsgId(null)
    if (showDetail) loadParticipants(c.id)
  }

  const selectDM = (u: Usuario) => {
    setActiveType('dm')
    setActiveId(u.id)
    setMensagens([])
    setActiveName(u.display_name || u.username)
    setShowSearch(false)
    setSearchQuery('')
    setSearchInput('')
    setReplyTo(null)
    setAttachments([])
    setShowDetail(false)
    setDmUserDetail(null)
    setDmUserEmpresas([])
    setReadReceiptsMsgId(null)
  }

  const loadParticipants = async (canalId: number) => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/chat/canais/${canalId}/participantes`, { headers: { Authorization: 'Bearer ' + t } })
      setParticipantes(await r.json())
    } catch {}
  }

  const loadDmUserDetail = async (userId: number) => {
    const t = getToken()
    if (!t) return
    try {
      const [userRes, empresasRes] = await Promise.all([
        fetch(`/api/usuarios/${userId}`, { headers: { Authorization: 'Bearer ' + t } }),
        fetch(`/api/usuarios/${userId}/empresas`, { headers: { Authorization: 'Bearer ' + t } }),
      ])
      if (userRes.ok) setDmUserDetail(await userRes.json())
      if (empresasRes.ok) setDmUserEmpresas(await empresasRes.json())
    } catch {}
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    if (searchInput) {
      loadMessages(searchInput)
    } else {
      loadMessages()
    }
  }

  const sendMessageWithAttachment = async (anexos: any[]) => {
    const t = getToken()
    const type = activeTypeRef.current
    const id = activeIdRef.current
    if (!t || !type || !id) return

    const body: Record<string, any> = { conteudo: '', anexos }
    if (replyTo) body.resposta_para_id = replyTo.id

    try {
      if (type === 'channel') {
        body.canal_id = id
        await fetch('/api/chat/mensagens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      } else {
        await fetch(`/api/chat/dm/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      }
    } catch {}
    setReplyTo(null)
    setMensagens(prev => [...prev, {
      id: Date.now(), de_user_id: userInfo.id, de_user_name: userName,
      conteudo: '', anexos, created_at: new Date().toISOString(), reacoes: [],
      ...(type === 'channel' ? { canal_id: id as number } : { para_user_id: id as number }),
    } as Mensagem])
  }

  const sendMessage = async () => {
    const t = getToken()
    const type = activeTypeRef.current
    const id = activeIdRef.current
    if (!t || !type || !id) return
    if (!mensagemText.trim() && attachments.length === 0) return

    const currentText = mensagemText.trim()
    const currentAttachments = [...attachments]
    const currentReply = replyTo

    // Clear input immediately for responsive feel
    setMensagemText('')
    setAttachments([])
    setReplyTo(null)

    let anexos: any[] | null = null
    if (currentAttachments.length > 0) {
      setUploading(true)
      anexos = []
      for (const att of currentAttachments) {
        const formData = new FormData()
        formData.append('file', att.file)
        try {
          const r = await fetch('/api/chat/upload', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + t },
            body: formData,
          })
          if (!r.ok) throw new Error('Falha no upload')
          const result = await r.json()
          anexos.push(result)
        } catch {
          // Restore on error
          setMensagemText(currentText)
          setAttachments(currentAttachments)
          setReplyTo(currentReply)
          setUploading(false)
          return
        }
      }
      setUploading(false)
    }

    const body: Record<string, any> = { conteudo: currentText }
    if (anexos) body.anexos = anexos
    if (currentReply) body.resposta_para_id = currentReply.id

    try {
      let r: Response
      if (type === 'channel') {
        body.canal_id = id
        r = await fetch('/api/chat/mensagens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      } else {
        r = await fetch(`/api/chat/dm/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert((err as any).detail || 'Erro ao enviar mensagem')
        setMensagemText(currentText)
        setAttachments(currentAttachments)
        setReplyTo(currentReply)
        return
      }
      // Optimistic: add sent message to list immediately
      const optimisticMsg: Mensagem = {
        id: Date.now(),
        de_user_id: myId,
        de_user_name: (() => {
          try { const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token; return JSON.parse(atob(tok.split('.')[1])).display_name || 'Usuário' } catch { return 'Usuário' }
        })(),
        conteudo: currentText,
        anexos: anexos,
        resposta_para_id: currentReply?.id || null,
        created_at: new Date().toISOString(),
        reacoes: [],
      }
      if (type === 'channel') optimisticMsg.canal_id = id
      else optimisticMsg.para_user_id = id
      
      setMensagens(prev => {
        const updated = [...prev, optimisticMsg]
        console.log('[Chat] Optimistic insert:', { msgId: optimisticMsg.id, count: updated.length, activeId, activeType })
        return updated
      })
      // Polling will refresh in background — don't overwrite optimistic msg
    } catch {
      setMensagemText(currentText)
      setAttachments(currentAttachments)
      setReplyTo(currentReply)
      return
    }
  }

  const toggleReaction = async (msgId: number, reacao: string) => {
    if (isFixedChannel) return
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/chat/mensagens/${msgId}/reagir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ reacao }),
      })
      if (!r.ok) return
      await loadMessages()
    } catch {}
  }

  const deleteMessage = async (msgId: number) => {
    const t = getToken()
    if (!t) return
    if (!confirm('Apagar mensagem?')) return
    try {
      await fetch(`/api/chat/mensagens/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      loadMessages()
    } catch {}
  }

  const handleFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) { alert('Arquivo máximo 2MB'); continue }
      const preview = URL.createObjectURL(file)
      setAttachments(prev => [...prev, { file, preview }])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    handleFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false)
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      handleFiles(imageFiles)
    }
  }

  const createChannel = async () => {
    if (!newCanalName.trim()) return
    const t = getToken()
    if (!t) return
    setCreatingCanal(true)
    try {
      const r = await fetch('/api/chat/canais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ nome: newCanalName.trim(), tipo: newCanalTipo, membros: newCanalMembros }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert((err as any).detail || 'Erro ao criar canal')
        return
      }
      const canal = await r.json()
      setCanais(prev => [...prev, canal])
      setShowCreateModal(false)
      setNewCanalName('')
      setNewCanalMembros([])
      selectChannel(canal)
    } catch { alert('Erro ao criar canal') }
    setCreatingCanal(false)
  }

  const toggleMembro = (id: number) => {
    setNewCanalMembros(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const deleteChannel = async (canalId: number) => {
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/chat/canais/${canalId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (r.ok) {
        setCanais(prev => prev.filter(c => c.id !== canalId))
        if (activeType === 'channel' && activeId === canalId) {
          setActiveType(null)
          setActiveId(null)
          setActiveName('')
          setMensagens([])
          setShowDetail(false)
        }
        setConfirmDeleteChannelId(null)
      }
    } catch {}
  }

  const startRecording = async () => {
    if (!supportsMediaRecorder) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())

        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
        const t = getToken()
        if (!t) return

        const formData = new FormData()
        formData.append('file', file)
        try {
          const r = await fetch('/api/chat/upload', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + t },
            body: formData,
          })
          const result = await r.json()
          await sendMessageWithAttachment([result])
    } catch (e) {
      const err = e as any
      if (err?.name === 'NotAllowedError' || err?.name === 'NotReadableError') {
        alert('Permissão de microfone negada. Verifique as configurações do navegador.')
      } else if (err?.name === 'SecurityError' || !isSecureContext) {
        alert('Gravação de áudio requer HTTPS (SSL). Ative o SSL no servidor.')
      } else {
        alert('Erro ao acessar microfone: ' + (err?.message || ''))
      }
    }
      }

      recorder.start()
      setRecordingTime(0)
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      setIsRecording(true)
    } catch {}
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recordingIntervalRef.current !== null) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
    setIsRecording(false)
    setRecordingTime(0)
  }

  const fetchReadReceipts = async (msgId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (readReceiptsMsgId === msgId) {
      setReadReceiptsMsgId(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setReadReceiptsPopupStyle({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 220) })
    setReadReceiptsMsgId(msgId)
    setReadReceiptsLoading(true)
    const t = getToken()
    if (!t) { setReadReceiptsLoading(false); return }
    try {
      const r = await fetch(`/api/chat/mensagens/${msgId}/visualizacoes`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      if (r.ok) {
        setReadReceipts(await r.json())
      } else {
        setReadReceipts([])
      }
    } catch {
      setReadReceipts([])
    }
    setReadReceiptsLoading(false)
  }

  const openTaskModal = (_msgId: number, text: string) => {
    setTaskTitle(text.slice(0, 200))
    setTaskDesc('')
    setTaskPri('Média')
    setTaskCliente('')
    setTaskDue('')
    setShowTaskModal(true)
  }

  const confirmTask = async () => {
    if (!taskTitle.trim()) return
    const t = getToken()
    if (!t) return
    try {
      const body: any = { titulo: taskTitle.trim(), prioridade: taskPri }
      if (taskDesc) body.descricao = taskDesc
      if (taskCliente) body.cliente_id = parseInt(taskCliente)
      if (taskDue) body.due_date = taskDue
      const r = await fetch('/api/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (r.ok) { setShowTaskModal(false); alert('Tarefa criada!') }
      else { const e = await r.json().catch(() => ({})); alert((e as any).detail || 'Erro') }
    } catch { alert('Erro ao criar tarefa') }
  }

  const openForward = (text: string) => {
    setForwardText(text)
    setForwardDest('')
    setForwardDestType('channel')
    setForwardModal(true)
  }

  const confirmForward = async () => {
    if (!forwardDest) { alert('Selecione um destino'); return }
    const t = getToken()
    if (!t) return
    try {
      const body: any = { conteudo: forwardText }
      if (forwardDestType === 'channel') {
        body.canal_id = parseInt(forwardDest)
        await fetch('/api/chat/mensagens', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      } else {
        await fetch(`/api/chat/dm/${forwardDest}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      }
      setForwardModal(false)
      alert('Mensagem encaminhada!')
    } catch { alert('Erro ao encaminhar') }
  }

  const addParticipant = async (userId: number) => {
    const t = getToken()
    if (!t || !activeId) return
    try {
      await fetch(`/api/chat/canais/${activeId}/participantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ user_id: userId }),
      })
      loadParticipants(activeId)
    } catch {}
  }

  const removeParticipant = async (userId: number) => {
    const t = getToken()
    if (!t || !activeId) return
    if (!confirm('Remover este participante?')) return
    try {
      await fetch(`/api/chat/canais/${activeId}/participantes/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      loadParticipants(activeId)
    } catch {}
  }

  const activeUnread = activeType && activeId
    ? unread[activeType === 'channel' ? `channel-${activeId}` : `dm-${activeId}`]
    : null

  const myId = userInfo.id

  // Sort DMs: unread first, then by last message time, then alphabetically
  const sortedDMs = usuarios
    .filter(u => u.id !== myId)
    .filter(u => !dmSearch || (u.display_name || u.username).toLowerCase().includes(dmSearch.toLowerCase()))
    .sort((a, b) => {
      const unreadA = unread[`dm-${a.id}`]
      const unreadB = unread[`dm-${b.id}`]
      // Unread first
      if (unreadA && unreadA.count > 0 && (!unreadB || unreadB.count === 0)) return -1
      if (unreadB && unreadB.count > 0 && (!unreadA || unreadA.count === 0)) return 1
      // Then by last message time
      const timeA = lastTimes[`dm-${a.id}`] || ''
      const timeB = lastTimes[`dm-${b.id}`] || ''
      if (timeA && timeB) return timeB.localeCompare(timeA)
      if (timeA) return -1
      if (timeB) return 1
      // Then alphabetically
      return (a.display_name || a.username).localeCompare(b.display_name || b.username)
    })

  const filteredUsersForAdd = usuarios.filter(u => {
    if (u.id === myId) return false
    if (participantes.find(p => p.user_id === u.id)) return false
    if (participantSearchTerm && !(u.display_name || u.username).toLowerCase().includes(participantSearchTerm.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="h-screen bg-core-black text-off-white flex items-center justify-center">
        <div className="text-pulse-ash text-sm">Carregando chat...</div>
      </div>
    )
  }

  const grouped = groupByDate(mensagens)

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/chat" />

      <div className="w-72 shrink-0 border-r border-urban-smoke flex flex-col bg-core-black">
        <div className="p-4 border-b border-urban-smoke flex items-center justify-between">
          <h3 className="text-xs tracking-wider text-pulse-ash">Canais</h3>
          <button onClick={() => setShowCreateModal(true)}
            className="text-xs text-electric-teal hover:text-off-white transition-colors tracking-wider px-2 py-1 rounded border border-electric-teal/30">
            + Novo
            </button>
          </div>
        <div className="flex-1 overflow-y-auto">
          <div className="py-2">
            <div className="text-xs tracking-wider text-pulse-ash px-4 py-1">Canais</div>
            {canais.map(c => {
              const u = unread[`channel-${c.id}`]
              return (
                <div key={c.id} className="group relative">
                  <button
                    onClick={() => selectChannel(c)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-all duration-200 ${
                      activeType === 'channel' && activeId === c.id
                        ? 'bg-electric-teal/10 text-electric-teal border-l-2 border-electric-teal'
                        : 'text-pulse-ash hover:text-off-white hover:bg-urban-smoke border-l-2 border-transparent'
                    }`}
                  >
                    <span className="text-sm shrink-0">{c.tipo === 'voz' ? '🎙' : c.fixo ? '📢' : '#'}</span>
                    <span className="truncate flex-1 text-left">{c.nome}</span>
                    {u && u.count > 0 && (
                      <span className="bg-electric-teal text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {u.count > 99 ? '99+' : u.count}
                      </span>
                    )}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteChannelId(c.id) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-xs text-pulse-ash hover:text-danger transition-all p-1"
                      title="Excluir canal"
                    >
                      🗑
                    </button>
                  )}
                </div>
              )
            })}
            {canais.length === 0 && (
              <div className="text-xs text-pulse-ash px-4 py-2 italic">Nenhum canal</div>
            )}
          </div>

          <div className="py-2 border-t border-urban-smoke/50">
            <div className="text-xs tracking-wider text-pulse-ash px-4 py-1">Mensagens Diretas</div>
            <div className="px-3 pb-2">
              <input
                type="text"
                value={dmSearch}
                onChange={e => setDmSearch(e.target.value)}
                placeholder="Buscar contato..."
                className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-1.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
              />
            </div>
            {sortedDMs.map(u => {
              const dmUnread = unread[`dm-${u.id}`]
              return (
                <button
                  key={u.id}
                  onClick={() => selectDM(u)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-all duration-200 ${
                    activeType === 'dm' && activeId === u.id
                      ? 'bg-electric-teal/10 text-electric-teal border-l-2 border-electric-teal'
                      : 'text-pulse-ash hover:text-off-white hover:bg-urban-smoke border-l-2 border-transparent'
                  }`}
                >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline(u.last_active) ? 'bg-success' : 'bg-pulse-ash'}`} />
                  <span className="truncate flex-1 text-left">{u.display_name || u.username}</span>
                  {dmUnread && dmUnread.count > 0 && (
                    <span className="bg-electric-teal text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {dmUnread.count > 99 ? '99+' : dmUnread.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative"
        onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-core-black/70 rounded-lg pointer-events-none">
            <div className="border-2 border-dashed border-electric-teal/50 rounded-xl px-8 py-4 bg-core-black/80">
              <span className="text-electric-teal text-sm font-medium">Solte para anexar arquivos</span>
            </div>
          </div>
        )}
        <div className="h-14 border-b border-urban-smoke flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm tracking-wider flex items-center gap-2">
              {activeName || 'Chat'}
              {activeType === 'dm' && (() => {
                const dmUser = usuarios.find(u => u.id === activeId)
                return dmUser ? (
                  <span className={`text-[10px] font-normal ${isOnline(dmUser.last_active) ? 'text-success' : 'text-pulse-ash'}`}>
                    {isOnline(dmUser.last_active) ? '● Online' : '○ Offline'}
                  </span>
                ) : null
              })()}
              {isFixedChannel && <span className="text-pulse-ash">📢</span>}
              {activeType === 'channel' && activeChannel?.tipo === 'voz' && <span className="ml-1 text-xs text-electric-teal">🎙 Voz</span>}
            </h3>
            {activeUnread && activeUnread.count > 0 && (
              <span className="text-xs text-pulse-ash bg-urban-smoke px-2 py-0.5 rounded">
                {activeUnread.count} não lida{activeUnread.count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setActiveType(null); setActiveId(null); setDmSearch('') }}
              className="text-pulse-ash hover:text-danger transition-colors text-sm leading-none p-1"
              title="Fechar conversa">✕</button>
            {activeType === 'channel' && activeId && (
              <>
                {activeChannel?.tipo === 'voz' && (
                  <button onClick={() => setVoiceRoom(true)}
                    className="text-xs px-3 py-1.5 rounded border border-electric-teal/30 text-electric-teal hover:bg-electric-teal/10 transition-colors">
                    🎧 Áudio
                  </button>
                )}
                <button onClick={() => { setShowDetail(!showDetail); if (!showDetail) loadParticipants(activeId) }}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    showDetail ? 'border-electric-teal text-electric-teal' : 'border-urban-smoke text-pulse-ash hover:text-off-white'
                  }`}>
                  {participantes.length > 0 ? `${participantes.length} membros` : 'Membros'}
                </button>
              </>
            )}
            {activeType === 'dm' && activeId && (
              <button onClick={() => { setShowDetail(!showDetail); if (!showDetail) loadDmUserDetail(activeId) }}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  showDetail ? 'border-electric-teal text-electric-teal' : 'border-urban-smoke text-pulse-ash hover:text-off-white'
                }`}>
                Detalhes
              </button>
            )}
            <button onClick={() => { setShowSearch(!showSearch); if (!showSearch) { setSearchInput(''); setSearchQuery('') } }}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                showSearch ? 'border-electric-teal text-electric-teal' : 'border-urban-smoke text-pulse-ash hover:text-off-white'
              }`}>
              {showSearch ? '✕' : '🔍'}
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="px-6 py-3 border-b border-urban-smoke bg-rich-carbon flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Buscar mensagens..."
              className="flex-1 bg-core-black border border-urban-smoke rounded-lg px-4 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
            <button onClick={handleSearch}
              className="px-3 py-2 rounded-lg text-xs bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
              Buscar
            </button>
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchInput(''); loadMessages() }}
                className="px-3 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Limpar
              </button>
            )}
          </div>
        )}
        {searchQuery && (
          <div className="px-6 py-1.5 bg-electric-teal/5 border-b border-electric-teal/20 text-xs text-pulse-ash">
            Buscando por: "{searchQuery}" — {mensagens.length} resultado{mensagens.length !== 1 ? 's' : ''}
          </div>
        )}

        <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {msgLoading && mensagens.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Carregando mensagens...</div>
            </div>
          )}

          {!activeType && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4">💬</div>
                <div className="text-pulse-ash text-sm">Selecione um canal ou conversa</div>
              </div>
            </div>
          )}

          {grouped.map((g, gi) => (
            <div key={gi}>
              <div className="flex items-center justify-center py-3">
                <div className="text-xs text-pulse-ash bg-urban-smoke px-3 py-1 rounded-full tracking-wider">
                  {g.date}
                </div>
              </div>
              {g.msgs.map((msg) => {
                const isMe = msg.de_user_id === myId
                const msgLinkPreview = linkPreviews[msg.id]

                return (
                  <div key={msg.id} className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1`}>
                    {msg.resposta_para_id && (
                      <div className="text-xs text-pulse-ash mb-1 px-2 border-l-2 border-urban-smoke pl-2 max-w-xs">
                        <span className="text-electric-teal">↰</span>{' '}
                        {(() => {
                          const replied = mensagens.find(m => m.id === msg.resposta_para_id)
                          return replied ? (
                            <span>
                              <span className="text-pulse-ash">{replied.de_user_name}: </span>
                              <span className="italic">{replied.conteudo.slice(0, 80)}{replied.conteudo.length > 80 ? '...' : ''}</span>
                            </span>
                          ) : (
                            <span className="italic">Respondendo a uma mensagem</span>
                          )
                        })()}
                      </div>
                    )}

                    <div className={`max-w-md px-4 py-2.5 rounded-2xl text-sm relative ${
                      isMe
                        ? 'bg-electric-teal/20 text-off-white rounded-tr-sm'
                        : 'bg-urban-smoke text-off-white rounded-tl-sm'
                    }`}>
                      {activeType === 'channel' && !isMe && (
                        <div className="text-xs text-electric-teal tracking-wider mb-1">{msg.de_user_name}</div>
                      )}

                      <div className="whitespace-pre-wrap break-words">{msg.conteudo}</div>

                      {msgLinkPreview && (
                        <a href={msgLinkPreview.url} target="_blank" rel="noreferrer"
                          className="mt-2 block bg-core-black rounded-lg overflow-hidden border border-urban-smoke hover:border-electric-teal transition-colors max-w-xs">
                          {msgLinkPreview.preview.image && (
                            <img src={msgLinkPreview.preview.image} alt=""
                              className="w-full h-28 object-cover" />
                          )}
                          <div className="p-2.5">
                            <div className="text-[11px] text-off-white font-medium mb-0.5 line-clamp-2">{msgLinkPreview.preview.title}</div>
                            {msgLinkPreview.preview.description && (
                              <div className="text-xs text-pulse-ash mb-1 line-clamp-2">{msgLinkPreview.preview.description}</div>
                            )}
                            <div className="text-xs text-electric-teal truncate">{msgLinkPreview.preview.site_name}</div>
                          </div>
                        </a>
                      )}

                      {(safeAnexos(msg.anexos).length > 0) && (
                        <div className="mt-2 space-y-2">
                          {safeAnexos(msg.anexos).map((att: any, ai: number) => {
                            const path = att.path?.startsWith('chat_uploads/') ? `/api/chat/uploads/${att.path}` : `/api/chat/uploads/${att.path}`
                            const isImage = att.nome?.match(/\.(png|jpg|jpeg|gif|webp)$/i) || att.path?.match(/\.(png|jpg|jpeg|gif|webp)$/i)
                            const isAudio = att.nome?.match(/\.(mp3|wav|ogg|webm|aac|m4a)$/i) || att.path?.match(/\.(mp3|wav|ogg|webm|aac|m4a)$/i)

                            return (
                              <div key={ai}>
                                {isImage ? (
                                  <img src={path} alt=""
                                    className="max-w-xs rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => window.open(path, '_blank')} />
                                ) : isAudio ? (
                                  <audio controls src={path}
                                    className="max-w-full h-8 rounded" preload="metadata" />
                                ) : (
                                  <a href={path} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-2 text-xs text-electric-teal hover:underline">
                                    <span>📎</span> {att.nome || 'Arquivo'}
                                  </a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {msg.reacoes && msg.reacoes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {groupReactions(msg.reacoes).map((r, ri) => (
                            <button key={ri}
                              onClick={() => toggleReaction(msg.id, r.emoji)}
                              disabled={isFixedChannel}
                              className={`px-1.5 py-0.5 rounded-full border transition-colors ${
                                 isFixedChannel
                                   ? 'border-urban-smoke bg-rich-carbon opacity-50 cursor-not-allowed'
                                   : r.hasMine ? 'border-electric-teal bg-electric-teal/10' : 'border-urban-smoke bg-rich-carbon hover:border-electric-teal/50'
                               }`}>
                               <span className="text-sm leading-none">{r.emoji}</span> {r.count > 1 ? <span className="text-xs">{r.count}</span> : ''}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-pulse-ash">{formatTime(msg.created_at)}</span>

                        {isMe && msg.id !== undefined && (
                          <button
                            onClick={(e) => fetchReadReceipts(msg.id, e)}
                            className={`text-xs transition-colors ${
                              readReceiptsMsgId === msg.id ? 'text-electric-teal' : 'text-pulse-ash hover:text-electric-teal'
                            }`}>
                            ✓✓
                          </button>
                        )}

                        <div className="hidden group-hover:flex items-center gap-1 ml-1">
                          {!isFixedChannel && (
                            <div className="relative">
                              <button onClick={() => setEmojiPicker(emojiPicker === msg.id ? null : msg.id)}
                                className="text-xl text-pulse-ash hover:text-electric-teal transition-colors px-1.5 leading-none" title="Reagir">
                                😊
                              </button>
                              {emojiPicker === msg.id && (
                                <div className="absolute bottom-full mb-1 left-0 bg-rich-carbon border border-urban-smoke rounded-lg p-1.5 shadow-lg z-20 flex gap-1"
                                  onClick={e => e.stopPropagation()}>
                                  {REACOES_COMUNS.map(emoji => (
                                    <button key={emoji} onClick={() => { toggleReaction(msg.id, emoji); setEmojiPicker(null) }}
                                      className="text-2xl hover:scale-125 transition-transform p-0.5 leading-none">{emoji}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <button onClick={() => setReplyTo({ id: msg.id, name: msg.de_user_name, text: msg.conteudo.slice(0, 60) })}
                            className="text-sm text-pulse-ash hover:text-electric-teal transition-colors px-1.5" title="Responder">↰</button>
                          <button onClick={() => openTaskModal(msg.id, msg.conteudo)}
                            className="text-sm text-pulse-ash hover:text-success transition-colors px-1.5" title="Criar tarefa">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="5" width="6" height="6" rx="1" /><path d="m3 17 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />
                            </svg>
                          </button>
                          <button onClick={() => openForward(msg.conteudo)}
                            className="text-sm text-pulse-ash hover:text-electric-teal transition-colors px-1.5" title="Encaminhar">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                            </svg>
                          </button>
                          {(userInfo.role === 'administrador' || userInfo.role === 'super_admin') && (
                            <button onClick={() => deleteMessage(msg.id)}
                              className="text-sm text-pulse-ash hover:text-danger transition-colors px-1.5" title="Apagar">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {activeType && mensagens.length === 0 && !msgLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Nenhuma mensagem ainda. Envie a primeira!</div>
            </div>
          )}
          <div ref={msgEndRef} />
        </div>

        {replyTo && (
          <div className="px-6 py-2 border-t border-urban-smoke bg-rich-carbon flex items-center justify-between">
            <div className="text-xs text-pulse-ash">
              <span className="text-electric-teal">↰ Respondendo</span> para {replyTo.name}: "{replyTo.text}"
            </div>
            <button onClick={() => setReplyTo(null)} className="text-xs text-pulse-ash hover:text-danger">✕</button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="px-6 py-2 border-t border-urban-smoke bg-rich-carbon flex gap-2 flex-wrap">
            {attachments.map((att, i) => (
              <div key={i} className="relative">
                {att.file.type.startsWith('image/') ? (
                  <img src={att.preview} alt="" className="h-16 w-16 object-cover rounded-lg" />
                ) : att.file.type.startsWith('audio/') ? (
                  <div className="h-16 w-16 bg-urban-smoke rounded-lg flex items-center justify-center text-sm">
                    🎙
                  </div>
                ) : (
                  <div className="h-16 w-16 bg-urban-smoke rounded-lg flex items-center justify-center text-xs text-pulse-ash">
                    📎
                  </div>
                )}
                <button onClick={() => removeAttachment(i)}
                  className="absolute -top-1 -right-1 bg-danger text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">✕</button>
              </div>
            ))}
          </div>
        )}

        {isRecording && (
          <div className="px-6 py-2 border-t border-urban-smoke bg-rich-carbon flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-danger"></span>
            </span>
            <span className="text-xs text-pulse-ash">Gravando... {recordingTime}s</span>
            <button onClick={stopRecording}
              className="ml-auto bg-danger text-white text-xs px-3 py-1 rounded-lg hover:bg-danger/80 transition-colors">
              Parar
            </button>
          </div>
        )}

        <div className="p-4 border-t border-urban-smoke">
          <div className="flex items-end gap-3">
            <button onClick={() => fileInputRef.current?.click()}
              className="text-pulse-ash hover:text-electric-teal transition-colors p-2 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />

            {activeType && !isFixedChannel && supportsMediaRecorder && (
              <button onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 shrink-0 transition-colors ${
                  isRecording ? 'text-danger hover:text-danger/80' : 'text-pulse-ash hover:text-electric-teal'
                }`}
                title={isRecording ? 'Parar gravação' : 'Gravar áudio'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}

            {activeType && !canPostInChannel && isFixedChannel && (
              <span className="text-pulse-ash p-2 shrink-0" title="Apenas administradores podem postar em canais fixos">🔒</span>
            )}

            <div className="relative shrink-0">
              <button onClick={() => setInputEmojiOpen(!inputEmojiOpen)}
                className="text-pulse-ash hover:text-electric-teal transition-colors p-2 shrink-0" title="Emoji">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              {inputEmojiOpen && (
                <div className="absolute bottom-full left-0 mb-2 bg-rich-carbon border border-urban-smoke rounded-xl p-3 shadow-2xl z-50 grid grid-cols-5 gap-1.5 w-52"
                  onClick={e => e.stopPropagation()}>
                  {['😀','😂','😍','😎','😢','😡','👍','❤️','🔥','🎉','🙏','💪','🤔','👀','🚀','⭐','👋','✅','❌','💯'].map(e => (
                    <button key={e} onClick={() => { setMensagemText(prev => prev + e); setInputEmojiOpen(false) }}
                      className="text-2xl hover:bg-urban-smoke rounded p-1 transition-colors leading-none">{e}</button>
                  ))}
                </div>
              )}
            </div>

            {activeType === 'channel' && activeChannel?.tipo === 'voz' ? (
              <div className="flex-1 flex items-center justify-center text-xs text-pulse-ash">
                🎙 Canal de voz — use o botão <span className="text-electric-teal mx-1">🎧 Áudio</span> para participar
              </div>
            ) : (
            <>
            <textarea
              value={mensagemText}
              onChange={e => setMensagemText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                !activeType ? 'Selecione uma conversa'
                  : !canPostInChannel ? 'Apenas administradores podem postar neste canal'
                  : 'Digite sua mensagem...'
              }
              disabled={!activeType || !canPostInChannel}
              rows={1}
              className="flex-1 bg-rich-carbon border border-urban-smoke rounded-xl px-4 py-3 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={!activeType || !canPostInChannel || (!mensagemText.trim() && attachments.length === 0) || uploading}
              className="bg-electric-teal text-white p-3 rounded-xl hover:bg-electric-teal/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
              {uploading ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
                  <path d="m21.854 2.147-10.94 10.939" />
                </svg>
              )}
            </button>
            </>
            )}
          </div>
        </div>
      </div>

      {showDetail && activeType === 'channel' && (
        <div className="w-64 shrink-0 border-l border-urban-smoke bg-rich-carbon flex flex-col">
          <div className="p-4 border-b border-urban-smoke flex items-center justify-between">
            <h3 className="text-xs tracking-wider text-pulse-ash">Membros</h3>
            <button onClick={() => setShowDetail(false)} className="text-xs text-pulse-ash hover:text-electric-teal">✕</button>
          </div>

          {isAdmin && (
            <div className="px-4 py-2 border-b border-urban-smoke/50">
              <button onClick={() => setShowAddParticipant(!showAddParticipant)}
                className="w-full text-xs text-electric-teal hover:text-off-white transition-colors py-1.5 tracking-wider">
                {showAddParticipant ? 'Fechar' : '+ Adicionar Membro'}
              </button>

              {showAddParticipant && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={participantSearchTerm}
                    onChange={e => setParticipantSearchTerm(e.target.value)}
                    placeholder="Buscar usuário..."
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-1.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                  />
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {filteredUsersForAdd.map(u => (
                      <button key={u.id}
                        onClick={() => addParticipant(u.id)}
                        className="w-full text-left px-2 py-1.5 rounded text-xs text-pulse-ash hover:bg-urban-smoke hover:text-off-white transition-colors flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-success"></span>
                        <span className="truncate">{u.display_name || u.username}</span>
                      </button>
                    ))}
                    {filteredUsersForAdd.length === 0 && (
                      <div className="text-xs text-pulse-ash italic px-2 py-1">
                        {participantSearchTerm ? 'Nenhum usuário encontrado' : 'Todos os usuários já são membros'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {participantes.map(p => (
              <div key={p.user_id} className="flex items-center gap-3 py-2 border-b border-urban-smoke/30 last:border-0 group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline(p.last_active) ? 'bg-success' : 'bg-pulse-ash'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs truncate">{p.display_name}</div>
                  <div className="text-xs text-pulse-ash">@{p.username}</div>
                </div>
                {isAdmin && p.user_id !== myId && (
                  <button onClick={() => removeParticipant(p.user_id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-pulse-ash hover:text-danger transition-all">
                    ✕
                  </button>
                )}
              </div>
            ))}
            {participantes.length === 0 && (
              <div className="text-xs text-pulse-ash italic">Carregando...</div>
            )}
          </div>
        </div>
      )}

      {showDetail && activeType === 'dm' && dmUserDetail && (
        <div className="w-96 shrink-0 border-l border-urban-smoke bg-rich-carbon flex flex-col">
          <div className="p-4 border-b border-urban-smoke flex items-center justify-between">
            <h3 className="text-xs tracking-wider text-pulse-ash">Informações</h3>
            <button onClick={() => setShowDetail(false)} className="text-xs text-pulse-ash hover:text-electric-teal">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="w-14 h-14 rounded-full bg-electric-teal/20 flex items-center justify-center text-xl font-roc text-electric-teal">
                {(dmUserDetail.display_name || dmUserDetail.username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="text-sm font-roc text-off-white text-center">{dmUserDetail.display_name || dmUserDetail.username}</div>
              <span className={`text-[10px] ${isOnline(dmUserDetail.last_active) ? 'text-success' : 'text-pulse-ash'}`}>
                {isOnline(dmUserDetail.last_active) ? '● Online' : '○ Offline'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] tracking-wider text-pulse-ash">Informações</div>
              <div className="bg-core-black rounded-lg p-3 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-pulse-ash">Usuário</span>
                  <div className="flex items-center gap-1">
                    <span className="text-off-white truncate max-w-[260px]" title={dmUserDetail.username}>@{dmUserDetail.username}</span>
                    <button onClick={() => navigator.clipboard.writeText(dmUserDetail.username)}
                      className="text-pulse-ash hover:text-electric-teal text-[10px] shrink-0" title="Copiar">📋</button>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-pulse-ash">Cargo</span>
                  <span className="text-off-white">{dmUserDetail.role_title || dmUserDetail.role || '-'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-pulse-ash">Departamento</span>
                  <span className="text-off-white">{dmUserDetail.departamento_nome || '-'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-pulse-ash">Ramal</span>
                  <span className="text-off-white">{dmUserDetail.ramal || '-'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-pulse-ash">E-mail</span>
                  <div className="flex items-center gap-1">
                    <span className="text-off-white truncate max-w-[260px]" title={dmUserDetail.username}>{dmUserDetail.username}</span>
                    <button onClick={() => navigator.clipboard.writeText(dmUserDetail.username)}
                      className="text-pulse-ash hover:text-electric-teal text-[10px] shrink-0" title="Copiar">📋</button>
                  </div>
                </div>
              </div>
            </div>

            {dmUserEmpresas.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] tracking-wider text-pulse-ash">Empresas Vinculadas</div>
                <div className="space-y-1.5">
                  {dmUserEmpresas.map(emp => (
                    <div key={emp.id} className="bg-core-black rounded-lg p-3">
                      <div className="text-xs text-off-white">{emp.name}</div>
                      {emp.cnpj && <div className="text-[10px] text-pulse-ash font-mono">{emp.cnpj}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dmUserEmpresas.length === 0 && !dmUserDetail.role_title && !dmUserDetail.departamento_nome && !dmUserDetail.ramal && (
              <div className="text-center py-8 text-pulse-ash text-xs">Nenhuma informação adicional disponível.</div>
            )}
          </div>
        </div>
      )}

      {readReceiptsMsgId && (
        <div
          ref={readReceiptsPopupRef}
          className="fixed z-50 bg-rich-carbon border border-urban-smoke rounded-xl shadow-2xl p-3 min-w-[200px] max-w-[260px]"
          style={{ top: readReceiptsPopupStyle.top, left: readReceiptsPopupStyle.left }}
        >
          <div className="text-xs tracking-wider text-pulse-ash mb-2">Visto por</div>
          {readReceiptsLoading ? (
            <div className="text-xs text-pulse-ash py-2">Carregando...</div>
          ) : readReceipts.length === 0 ? (
            <div className="text-xs text-pulse-ash py-2">Nenhuma visualização</div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {readReceipts.map(v => (
                <div key={v.user_id} className="flex items-center justify-between text-xs">
                  <span className="truncate mr-2">{v.display_name}</span>
                  <span className="text-xs text-pulse-ash shrink-0">{formatTime(v.viewed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDeleteChannelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-80 max-w-full mx-4">
            <h3 className="text-sm tracking-wider mb-2">Excluir Canal</h3>
            <p className="text-xs text-pulse-ash mb-6">
              Tem certeza que deseja excluir este canal? Esta ação é irreversível e todas as mensagens serão perdidas.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteChannelId(null)}
                className="px-4 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => deleteChannel(confirmDeleteChannelId)}
                className="px-4 py-2 rounded-lg text-xs bg-danger text-white hover:bg-danger/80 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-96 max-w-full mx-4">
            <h3 className="text-sm tracking-wider mb-4">Novo Canal</h3>

            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Nome</label>
            <input type="text" value={newCanalName} onChange={e => setNewCanalName(e.target.value)}
              placeholder="ex: geral, projetos..."
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-4 py-2.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal mb-4" />

            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Tipo</label>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setNewCanalTipo('texto')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${
                  newCanalTipo === 'texto' ? 'border-electric-teal bg-electric-teal/10 text-electric-teal' : 'border-urban-smoke text-pulse-ash'
                }`}>Texto</button>
              <button onClick={() => setNewCanalTipo('voz')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${
                  newCanalTipo === 'voz' ? 'border-electric-teal bg-electric-teal/10 text-electric-teal' : 'border-urban-smoke text-pulse-ash'
                }`}>Voz</button>
            </div>

            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Membros</label>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-4 border border-urban-smoke rounded-lg p-2">
              {usuarios.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-2 py-1.5 cursor-pointer hover:bg-urban-smoke rounded text-xs">
                  <input type="checkbox" checked={newCanalMembros.includes(u.id)} onChange={() => toggleMembro(u.id)}
                    className="accent-electric-teal" />
                  <span>{u.display_name || u.username}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Cancelar
              </button>
              <button onClick={createChannel} disabled={!newCanalName.trim() || creatingCanal}
                className="px-4 py-2 rounded-lg text-xs bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
                {creatingCanal ? 'Criando...' : 'Criar Canal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task creation modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80" onClick={() => setShowTaskModal(false)}>
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[500px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm tracking-wider mb-5">Nova Tarefa</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cliente (opcional)</label>
                <select value={taskCliente} onChange={e => setTaskCliente(e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                  <option value="">Nenhum</option>
                  {(clientes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Título</label>
                <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Ex: Apuração de ICMS"
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prioridade</label>
                  <select value={taskPri} onChange={e => setTaskPri(e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                    <option>Baixa</option><option>Média</option><option>Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Vencimento</label>
                  <input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)}
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                </div>
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Observações</label>
                <textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Detalhes adicionais..."
                  rows={3}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-urban-smoke">
              <button onClick={() => setShowTaskModal(false)} className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">Cancelar</button>
              <button onClick={confirmTask} disabled={!taskTitle.trim()}
                className="px-5 py-2 rounded-lg text-xs bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">Criar Tarefa</button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {forwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80" onClick={() => setForwardModal(false)}>
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[500px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm tracking-wider mb-2">Encaminhar Mensagem</h3>
            <p className="text-xs text-pulse-ash mb-4 truncate">{forwardText}</p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setForwardDestType('channel')}
                className={`px-3 py-1.5 rounded text-xs border ${forwardDestType === 'channel' ? 'border-electric-teal bg-electric-teal/10 text-electric-teal' : 'border-urban-smoke text-pulse-ash'}`}>Canal</button>
              <button onClick={() => setForwardDestType('dm')}
                className={`px-3 py-1.5 rounded text-xs border ${forwardDestType === 'dm' ? 'border-electric-teal bg-electric-teal/10 text-electric-teal' : 'border-urban-smoke text-pulse-ash'}`}>DM</button>
            </div>
            <select value={forwardDest} onChange={e => setForwardDest(e.target.value)}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white mb-4 focus:outline-none focus:border-electric-teal">
              <option value="">Selecionar...</option>
              {forwardDestType === 'channel' ? canais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>) : usuarios.filter(u => u.id !== myId).map(u => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setForwardModal(false)} className="px-4 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">Cancelar</button>
              <button onClick={confirmForward} disabled={!forwardDest} className="px-4 py-2 rounded-lg text-xs bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">Encaminhar</button>
            </div>
          </div>
        </div>
      )}
      {voiceRoom && activeId && activeType === 'channel' && (
        <Suspense fallback={null}>
          <VoiceRoom canalId={activeId} canalNome={activeName} onClose={() => setVoiceRoom(false)} />
        </Suspense>
      )}
    </div>
  )
}
