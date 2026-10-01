import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { User, LogOut, KeyRound, Camera, X, Loader2, Bell, Moon, Sun, Mail, FolderKanban, MessageSquare, Award, Megaphone, FileText, Users, Briefcase, CalendarClock, CheckSquare } from 'lucide-react'
import { apiFetch, getToken } from '@/lib/api'
import { storageRemove } from '@/lib/storage'
import MacSwitch from '@/components/ui/MacSwitch'
import { applyTheme, getInitialTheme } from '@/lib/theme'

const NOTIF_TIPOS: { tipo: string; label: string; icon: any }[] = [
  { tipo: 'certificado', label: 'Certificados digitais', icon: Award },
  { tipo: 'chat', label: 'Chat (canais)', icon: MessageSquare },
  { tipo: 'dm', label: 'Mensagens diretas (DM)', icon: Mail },
  { tipo: 'processo', label: 'Processos', icon: FolderKanban },
  { tipo: 'tarefa', label: 'Tarefas', icon: CheckSquare },
  { tipo: 'comunicado', label: 'Comunicados', icon: Megaphone },
  { tipo: 'reuniao', label: 'Reuniões', icon: CalendarClock },
  { tipo: 'relatorio', label: 'Relatórios', icon: FileText },
  { tipo: 'crm', label: 'CRM', icon: Briefcase },
  { tipo: 'obrigacao', label: 'Obrigações', icon: CalendarClock },
  { tipo: 'portfolio', label: 'Portal do cliente', icon: Users },
  { tipo: 'vencimento', label: 'Vencimentos', icon: CalendarClock },
]

interface Me {
  id: number
  username: string
  display_name: string
  role: string
  role_title?: string
  ramal?: string
  departamento_id?: number | null
  departamento_nome?: string | null
  avatar?: string
  is_admin?: boolean
}

interface Departamento {
  id: number
  nome: string
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  administrador: 'Administrador',
  lider: 'Líder',
  colaborador: 'Colaborador',
  recepcao: 'Recepção',
}

export default function UserMenu() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<Me>('/api/me'),
    staleTime: 2 * 60_000,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const logout = () => {
    storageRemove('nfse_token')
    window.location.href = '/login'
  }

  const initials = (me?.display_name || me?.username || '?')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const trigger = (
    <button
      onClick={() => setOpen(!open)}
      className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition-colors hover:bg-muted/70"
      title="Meu perfil"
    >
      {me?.avatar ? (
        <img src={me.avatar} alt="Avatar" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-foreground">{initials}</span>
      )}
    </button>
  )

  return (
    <div className="relative" ref={ref}>
      {trigger}

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-3 border-b border-border/60 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {me?.avatar ? (
                <img src={me.avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-foreground">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{me?.display_name || '-'}</p>
              <p className="truncate text-xs text-muted-foreground">{me?.username}</p>
            </div>
          </div>
          <div className="p-1.5">
            <button
              onClick={() => { setOpen(false); setShowModal(true) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              Meu perfil
            </button>
            <button
              onClick={() => { setOpen(false); setShowModal(true) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Alterar senha
            </button>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      )}

      {showModal &&
        createPortal(
          <PerfilModal
            me={me}
            onClose={() => setShowModal(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['me'] })
              setShowModal(false)
            }}
          />,
          document.body,
        )}
    </div>
  )
}

function PerfilModal({ me, onClose, onSaved }: { me?: Me; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(me?.display_name || '')
  const [username, setUsername] = useState(me?.username || '')
  const [roleTitle, setRoleTitle] = useState(me?.role_title || '')
  const [ramal, setRamal] = useState(me?.ramal || '')
  const [deptoId, setDeptoId] = useState(me?.departamento_id ? String(me.departamento_id) : '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [sendingAvatar, setSendingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [dark, setDark] = useState(() => getInitialTheme() === 'dark')
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )

  // Preferências de notificação por tipo (quais tipos geram alerta de browser)
  const [notifPrefs, setNotifPrefs] = useState<string[]>([])
  useEffect(() => {
    apiFetch<{ tipos: string[]; ativos: string[] }>('/api/notifications/prefs').catch(() => null).then(d => {
      if (d) setNotifPrefs(d.ativos)
    })
  }, [])

  const toggleNotifTipo = async (tipo: string, ativo: boolean) => {
    const novo = ativo ? [...notifPrefs, tipo] : notifPrefs.filter(t => t !== tipo)
    setNotifPrefs(novo)
    const t = getToken()
    try {
      await fetch('/api/notifications/prefs', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ ativos: novo }),
      })
    } catch { /* falha silenciosa */ }
  }

  const toggleDark = () => {
    setDark(d => {
      applyTheme(d ? 'light' : 'dark')
      return !d
    })
  }

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotifPerm(p)
    if (p === 'denied') {
      alert('As notificações foram bloqueadas pelo navegador. Desbloqueie as notificações do site nas configurações do navegador e tente novamente.')
    }
  }

  const { data: deptos = [] } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<Departamento[]>('/api/departamentos'),
    staleTime: 10 * 60_000,
  })

  const sendAvatar = async (file: File) => {
    const t = getToken()
    if (!t) return
    const form = new FormData()
    form.append('file', file)
    const r = await fetch('/api/me/avatar', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t },
      body: form,
    })
    if (!r.ok) {
      const d = await r.json().catch(() => null)
      throw new Error(d?.detail || `HTTP ${r.status}`)
    }
    return r.json()
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!displayName.trim()) { setError('Nome de exibição é obrigatório'); return }
    if (password && password.length < 4) { setError('A senha deve ter pelo menos 4 caracteres'); return }
    if (password && password !== passwordConfirm) { setError('As senhas não conferem'); return }

    setSaving(true)
    try {
      const body: Record<string, unknown> = { display_name: displayName.trim() }
      if (username.trim() && username.trim() !== me?.username) body.username = username.trim()
      if (roleTitle !== (me?.role_title || '')) body.role_title = roleTitle
      if (ramal !== (me?.ramal || '')) body.ramal = ramal
      if (deptoId !== (me?.departamento_id ? String(me.departamento_id) : '')) {
        body.departamento_id = deptoId ? Number(deptoId) : null
      }
      if (password) body.password = password

      const t = getToken()
      if (!t) throw new Error('Sem token')
      const r = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || 'Erro ao atualizar perfil')
      }
      if (avatarFile) {
        setSendingAvatar(true)
        try {
          await sendAvatar(avatarFile)
          setAvatarFile(null)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro ao enviar foto')
        }
        setSendingAvatar(false)
      }
      setSuccess('Perfil atualizado com sucesso!')
      setPassword('')
      setPasswordConfirm('')
      setTimeout(onSaved, 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar perfil')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  const previewAvatar = avatarFile ? URL.createObjectURL(avatarFile) : me?.avatar || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[520px] max-w-full rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Meu Perfil</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                {previewAvatar ? (
                  <img src={previewAvatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-foreground">
                    {(displayName || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow transition-colors hover:text-[#0078d4]"
                title="Alterar foto"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setAvatarFile(f)
                    setError('')
                  }
                }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{displayName || '-'}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL[me?.role || ''] || me?.role || '-'}
                {me?.departamento_nome ? ` · ${me.departamento_nome}` : ''}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome de Exibição *</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail (login) *</label>
            <input type="email" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo / Função</label>
              <input
                type="text"
                value={roleTitle}
                onChange={e => setRoleTitle(e.target.value)}
                placeholder="Ex: Contador Sênior"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ramal</label>
              <input type="text" value={ramal} onChange={e => setRamal(e.target.value)} placeholder="1234" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Departamento</label>
            <select value={deptoId} onChange={e => setDeptoId(e.target.value)} className={inputCls}>
              <option value="">Nenhum</option>
              {deptos.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-border/60 p-4">
            <h4 className="mb-3 text-xs font-semibold text-foreground">Preferências</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">Notificações</p>
                    <p className="text-[11px] text-muted-foreground">
                      {notifPerm === 'granted'
                        ? 'Ativadas — você recebe alertas de chat, processos e certificados'
                        : notifPerm === 'denied'
                          ? 'Bloqueadas pelo navegador — desbloqueie nas configurações'
                          : 'Receba alertas de chat, processos e certificados'}
                    </p>
                  </div>
                </div>
                <MacSwitch
                  checked={notifPerm === 'granted'}
                  onChange={checked => {
                    if (checked) enableNotifications()
                    else setNotifPerm('default')
                  }}
                  ariaLabel="Ativar notificações"
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2.5">
                  {dark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm text-foreground">Tema escuro</p>
                    <p className="text-[11px] text-muted-foreground">{dark ? 'Modo escuro ativo' : 'Modo claro ativo'}</p>
                  </div>
                </div>
                <MacSwitch checked={dark} onChange={toggleDark} ariaLabel="Alternar tema claro/escuro" />
              </div>

              <div className="border-t border-border/60 pt-3">
                <p className="mb-1 text-sm text-foreground">Tipos de notificação</p>
                <p className="mb-2 text-[11px] text-muted-foreground">Escolha quais tipos geram alerta no navegador</p>
                <div className="grid grid-cols-1 gap-1">
                  {NOTIF_TIPOS.map(nt => {
                    const Icon = nt.icon
                    const ativo = notifPrefs.includes(nt.tipo)
                    return (
                      <div key={nt.tipo} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 hover:bg-muted/40">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-[13px] text-foreground">{nt.label}</span>
                        </div>
                        <MacSwitch checked={ativo} onChange={c => toggleNotifTipo(nt.tipo, c)} ariaLabel={`Notificação de ${nt.label}`} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-4">
            <h4 className="mb-3 text-xs font-semibold text-foreground">Alterar Senha</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nova Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Deixe em branco para manter"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirmar</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {error && <div className="text-xs text-rose-600">{error}</div>}
          {success && <div className="text-xs text-emerald-600">{success}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || sendingAvatar}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {(saving || sendingAvatar) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving || sendingAvatar ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
