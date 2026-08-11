import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Users, Building2, Plus, Pencil, Trash2, Loader2, X, Search } from 'lucide-react'

interface Usuario {
  id: number
  username: string
  display_name: string
  role: string
  role_title?: string
  ativo: boolean
  departamento_id?: number | null
  departamento_nome?: string | null
  ramal?: string
  permissoes?: Record<string, boolean> | string[]
  last_active?: string
}

interface Departamento {
  id: number
  nome: string
  cor: string
  lider_id?: number | null
  lider_nome?: string | null
}

const ROLES: Array<{ value: string; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'lider', label: 'Líder' },
  { value: 'recepcao', label: 'Recepção' },
  { value: 'colaborador', label: 'Colaborador' },
]

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  administrador: 'bg-[#0078d4]/10 text-[#0078d4]',
  lider: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  recepcao: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  colaborador: 'bg-muted text-muted-foreground',
}

const CORES = ['#3b82f6', '#5C939F', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899', '#64748b', '#14b8a6']

function getMyRole(): string {
  try {
    const t = getToken()
    if (t) {
      const p = JSON.parse(atob(t.split('.')[1]))
      return p.role || ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

const IS_ADMIN = ['administrador', 'super_admin']

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<'equipe' | 'departamentos'>('equipe')
  const myRole = getMyRole()
  const isAdmin = IS_ADMIN.includes(myRole)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gestão de equipe e departamentos</p>
      </div>

      <div className="flex gap-1 border-b border-border/60">
        <button
          onClick={() => setTab('equipe')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
            tab === 'equipe'
              ? 'border-[#0078d4] text-[#0078d4]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          Equipe
        </button>
        <button
          onClick={() => setTab('departamentos')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
            tab === 'departamentos'
              ? 'border-[#0078d4] text-[#0078d4]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Departamentos
        </button>
      </div>

      {tab === 'equipe' && <EquipeTab isAdmin={isAdmin} />}
      {tab === 'departamentos' && <DepartamentosTab isAdmin={isAdmin} />}
    </div>
  )
}

/* ── TAB: EQUIPE ── */

function EquipeTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [search, setSearch] = useState('')

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => apiFetch<Usuario[]>('/api/usuarios'),
    staleTime: 30_000,
  })

  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<Departamento[]>('/api/departamentos'),
    staleTime: 30_000,
  })

  const inativar = useMutation({
    mutationFn: async (id: number) => {
      const t = getToken()
      const r = await fetch(`/api/usuarios/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
    onError: () => alert('Erro ao inativar usuário'),
  })

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
        <Users className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Acesso Restrito</p>
        <p className="mt-1 text-xs text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>
      </div>
    )
  }

  const filtrados = (usuarios as Usuario[]).filter(u =>
    !search.trim()
    || (u.display_name || '').toLowerCase().includes(search.toLowerCase())
    || (u.username || '').toLowerCase().includes(search.toLowerCase())
    || (u.role_title || '').toLowerCase().includes(search.toLowerCase())
  )

  const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuário…"
              className="h-9 w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtrados.length} usuário{filtrados.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/90"
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(u => (
                <tr key={u.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{u.display_name || u.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[u.role] || 'bg-muted text-muted-foreground'}`}>
                      {u.role_title || roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.departamento_nome || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${u.ativo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(u)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-[#0078d4]"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {u.ativo && (
                        <button
                          onClick={() => {
                            if (confirm('Inativar este usuário?')) inativar.mutate(u.id)
                          }}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                          title="Inativar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <UserModal
          departamentos={departamentos as Departamento[]}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['usuarios'] }) }}
        />
      )}
      {editing && (
        <UserModal
          user={editing}
          departamentos={departamentos as Departamento[]}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['usuarios'] }) }}
        />
      )}
    </div>
  )
}

/* ── MODAL USUÁRIO ── */

function UserModal({ user, departamentos, onClose, onSaved }: {
  user?: Usuario
  departamentos: Departamento[]
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role || 'colaborador')
  const [roleTitle, setRoleTitle] = useState(user?.role_title || '')
  const [deptoId, setDeptoId] = useState(user?.departamento_id ? String(user.departamento_id) : '')
  const [ramal, setRamal] = useState(user?.ramal || '')
  const [ativo, setAtivo] = useState(user?.ativo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: modulos = {} } = useQuery({
    queryKey: ['modulos-disponiveis'],
    queryFn: () => apiFetch<Record<string, string>>('/api/modulos-disponiveis'),
    staleTime: 10 * 60_000,
  })

  const initialPerms = (() => {
    const p = user?.permissoes
    if (!p) return Object.keys(modulos)
    if (Array.isArray(p)) return p
    return Object.entries(p).filter(([, v]) => v).map(([k]) => k)
  })()

  const [permissoes, setPermissoes] = useState<string[]>(initialPerms)

  const togglePerm = (nome: string) => {
    setPermissoes(prev => prev.includes(nome) ? prev.filter(p => p !== nome) : [...prev, nome])
  }

  const handleSave = async () => {
    setError('')
    if (!displayName.trim()) { setError('Nome de exibição é obrigatório'); return }
    if (!user && (!username.trim() || !password.trim())) { setError('Username e senha são obrigatórios'); return }
    setSaving(true)
    try {
      const t = getToken()
      const body: Record<string, unknown> = {
        display_name: displayName.trim(),
        role,
        role_title: roleTitle,
        departamento_id: deptoId ? Number(deptoId) : null,
        ramal,
        ativo,
        permissoes: Object.keys(modulos).reduce<Record<string, boolean>>((acc, m) => {
          acc[m] = permissoes.includes(m)
          return acc
        }, {}),
      }
      if (user) {
        if (password) body.password = password
        const r = await fetch(`/api/usuarios/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
        if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.detail || 'HTTP ' + r.status) }
      } else {
        body.username = username.trim()
        body.password = password
        const r = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
        if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.detail || 'HTTP ' + r.status) }
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar usuário')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[560px] max-w-full rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{user ? 'Editar Usuário' : 'Novo Usuário'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome de Exibição *</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo</label>
              <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {!user && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Username *</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="nome.usuario" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha *</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
          {user && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Redefinir Senha (deixe em branco para manter)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nova senha" className={inputCls} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Título do Cargo</label>
              <input type="text" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="Ex: Contador Sênior" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ramal</label>
              <input type="text" value={ramal} onChange={e => setRamal(e.target.value)} placeholder="1234" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Departamento</label>
              <select value={deptoId} onChange={e => setDeptoId(e.target.value)} className={inputCls}>
                <option value="">Nenhum</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setAtivo(!ativo)}
                className={`relative inline-flex h-[26px] w-[46px] items-center rounded-full transition-colors ${ativo ? 'bg-[#34c759]' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
              </button>
              <span className="ml-3 pb-0.5 text-sm text-foreground">{ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Permissões de Módulos</label>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border/60 p-3">
              {Object.entries(modulos).map(([nome, label]) => (
                <label key={nome} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissoes.includes(nome)}
                    onChange={() => togglePerm(nome)}
                    className="h-4 w-4 rounded border-border text-[#0078d4] focus:ring-[#0078d4]"
                  />
                  <span className="text-sm text-foreground">{label as string}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Salvando...' : user ? 'Atualizar' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── TAB: DEPARTAMENTOS ── */

function DepartamentosTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Departamento | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#3b82f6')
  const [liderId, setLiderId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<Departamento[]>('/api/departamentos'),
    staleTime: 30_000,
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => apiFetch<Usuario[]>('/api/usuarios'),
    staleTime: 30_000,
  })

  const openNew = () => {
    setEditing(null)
    setNome('')
    setCor('#3b82f6')
    setLiderId('')
    setError('')
    setShowModal(true)
  }

  const openEdit = (d: Departamento) => {
    setEditing(d)
    setNome(d.nome)
    setCor(d.cor)
    setLiderId(d.lider_id ? String(d.lider_id) : '')
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setError('')
    if (!nome.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const t = getToken()
      const body = { nome: nome.trim(), cor, lider_id: liderId ? Number(liderId) : null }
      const r = editing
        ? await fetch(`/api/departamentos/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        : await fetch('/api/departamentos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.detail || 'HTTP ' + r.status) }
      setShowModal(false)
      qc.invalidateQueries({ queryKey: ['departamentos'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar departamento')
    }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este departamento?')) return
    try {
      const t = getToken()
      const r = await fetch(`/api/departamentos/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      qc.invalidateQueries({ queryKey: ['departamentos'] })
    } catch {
      alert('Erro ao excluir departamento')
    }
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{departamentos.length} departamento{departamentos.length !== 1 ? 's' : ''}</span>
        {isAdmin && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/90"
          >
            <Plus className="h-4 w-4" />
            Novo Departamento
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Líder</th>
                <th className="px-4 py-3">Cor</th>
                {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {(departamentos as Departamento[]).map(d => (
                <tr key={d.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{d.nome}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.lider_nome || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded border border-border" style={{ backgroundColor: d.cor }} />
                      <span className="font-mono text-xs text-muted-foreground">{d.cor}</span>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(d)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-[#0078d4]"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {departamentos.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhum departamento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[440px] max-w-full rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <h3 className="text-sm font-semibold text-foreground">{editing ? 'Editar Departamento' : 'Novo Departamento'}</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do departamento" className={inputCls} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Cor</label>
                <div className="grid grid-cols-10 gap-2">
                  {CORES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCor(c)}
                      className={`h-8 rounded-lg border-2 transition-all ${cor === c ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground">{cor}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Líder</label>
                <select value={liderId} onChange={e => setLiderId(e.target.value)} className={inputCls}>
                  <option value="">Nenhum</option>
                  {(usuarios as Usuario[]).map(u => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
                </select>
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
