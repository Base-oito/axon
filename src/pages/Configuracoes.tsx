import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

function getUserRole(): string {
  try {
    const t = getToken()
    if (!t) return ''
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.role || ''
  } catch { return '' }
}

function getUserId(): number {
  try {
    const t = getToken()
    if (!t) return 0
    const p = JSON.parse(atob(t.split('.')[1]))
    return parseInt(p.sub) || 0
  } catch { return 0 }
}

type Usuario = {
  id: number
  username: string
  display_name: string
  role: string
  role_title: string
  ativo: boolean
  departamento_id: number | null
  departamento_nome: string
  ramal: string
  permissoes: string[]
  last_active: string
  created_at: string
}

type Departamento = {
  id: number
  nome: string
  cor: string
  lider_id: number | null
  lider_nome: string | null
}

type ModuloDisponivel = {
  nome: string
  label: string
}

type MailConfig = {
  configured: boolean
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_ssl: boolean
  smtp_from: string
}

type UserProfile = {
  id: number
  username: string
  display_name: string
  role: string
  departamento_nome: string
  departamento_id: number | null
  ramal: string
  permissoes: string[]
}

type CnaeCodigo = {
  codigo: string
  descricao: string
  tipo: string
}

type MailContato = {
  id: number
  nome: string
  email: string
  client_id: number
  cliente_nome?: string
  departamento_ids: number[]
}

const ROLES = [
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'lider', label: 'Líder' },
  { value: 'administrador', label: 'Administrador' },
]

const CORES = [
  { value: '#5C939F', label: 'Teal' },
  { value: '#59A993', label: 'Verde' },
  { value: '#ED6D40', label: 'Infrared' },
  { value: '#A78BFA', label: 'Púrpura' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#64748B', label: 'Slate' },
]

export default function Configuracoes() {
  const navigate = useNavigate()
  const userRole = getUserRole()
  const isAdmin = userRole === 'administrador' || userRole === 'super_admin'

  const [tab, setTab] = useState('equipe')

  const allTabs = [
    { key: 'equipe', label: 'Equipe', adminOnly: !can.configuracoes.equipe() },
    { key: 'departamentos', label: 'Departamentos', adminOnly: !can.configuracoes.departamentos() },
    { key: 'downloads', label: 'Downloads', adminOnly: !can.configuracoes.downloads() },
    { key: 'email', label: 'Email/SMTP', adminOnly: !can.configuracoes.email() },
    { key: 'meuperfil', label: 'Meu Perfil', adminOnly: false },
  ]

  const visibleTabs = allTabs.filter(t => !t.adminOnly || isAdmin)

  // Set default tab to first visible if current tab is not allowed
  const currentTab = visibleTabs.some(t => t.key === tab) ? tab : (visibleTabs[0]?.key || 'meuperfil')
  const setCurrentTab = (k: string) => setTab(k)

  // Sync tab if needed
  if (tab !== currentTab) setTab(currentTab)

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/configuracoes" />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Configurações</h1>
              <p className="text-pulse-ash text-sm">Gestão de equipe, departamentos, perfil e sistema</p>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke overflow-x-auto">
            {visibleTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px shrink-0 ${
                  tab === t.key
                    ? 'text-electric-teal border-electric-teal'
                    : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'equipe' && <EquipeTab isAdmin={isAdmin} />}
          {tab === 'departamentos' && <DepartamentosTab />}
          {tab === 'downloads' && <DownloadsTab />}
          {tab === 'email' && <EmailTab />}
          {tab === 'meuperfil' && <MeuPerfilTab />}
        </div>
      </main>
    </div>
  )
}

/* ── TAB: EQUIPE ── */

function EquipeTab({ isAdmin }: { isAdmin: boolean }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [modulos, setModulos] = useState<ModuloDisponivel[]>([])
  const [loading, setLoading] = useState(true)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)

  const loadData = async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const [uRes, dRes, mRes] = await Promise.all([
        fetch('/api/usuarios', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('/api/modulos-disponiveis', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ])
      setUsuarios(Array.isArray(uRes) ? uRes : [])
      setDepartamentos(Array.isArray(dRes) ? dRes : [])
      setModulos(
        mRes && typeof mRes === 'object' && !Array.isArray(mRes)
          ? Object.entries(mRes).map(([nome, label]) => ({ nome, label: label as string }))
          : []
      )
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Inativar este usuário?')) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/usuarios/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      loadData()
    } catch { alert('Erro ao inativar usuário') }
  }

  if (!isAdmin) {
    return (
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-12 text-center">
        <div className="text-xs tracking-wider text-pulse-ash mb-2">Acesso Restrito</div>
        <p className="text-sm text-pulse-ash">Apenas administradores podem gerenciar usuários.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-pulse-ash text-sm">Carregando usuários...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-pulse-ash">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2"
        >
          <span>+</span> Novo Usuário
        </button>
      </div>

      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon z-10">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">Username</th>
                <th className="text-left py-3 px-4">Cargo</th>
                <th className="text-left py-3 px-4">Departamento</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-center py-3 px-4">Módulos</th>
                <th className="text-center py-3 px-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium">{u.display_name || u.username}</div>
                  </td>
                  <td className="py-3 px-4 text-pulse-ash font-mono text-xs">{u.username}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                      u.role === 'administrador' ? 'bg-electric-teal/10 text-electric-teal' :
                      u.role === 'lider' ? 'bg-infrared/10 text-infrared' :
                      'bg-pulse-ash/10 text-pulse-ash'
                    }`}>
                      {u.role_title || ROLES.find(r => r.value === u.role)?.label || u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-pulse-ash">{u.departamento_nome || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${
                      u.ativo ? 'bg-success/10 text-success' : 'bg-pulse-ash/10 text-pulse-ash'
                    }`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {(u.permissoes && u.permissoes.length > 0) ? (
                      <div className="flex items-center justify-center gap-1 flex-wrap max-w-[120px]">
                        {u.permissoes.slice(0, 3).map(p => (
                          <span key={p} className="px-1.5 py-0.5 rounded bg-electric-teal/10 text-electric-teal text-[9px] tracking-wider">{p}</span>
                        ))}
                        {u.permissoes.length > 3 && (
                          <span className="text-pulse-ash text-[9px]">+{u.permissoes.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-pulse-ash text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setEditingUser(u); setShowEditModal(true) }}
                        className="text-pulse-ash hover:text-electric-teal transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {u.ativo && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-pulse-ash hover:text-danger transition-colors"
                          title="Inativar"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M15 9l-6 6M9 9l6 6"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 && (
            <div className="text-center py-10 text-pulse-ash text-sm">Nenhum usuário cadastrado.</div>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewUserModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); loadData() }}
        />
      )}

      {showEditModal && editingUser && (
        <EditUserModal
          user={editingUser}
          departamentos={departamentos}
          modulos={modulos}
          onClose={() => { setShowEditModal(false); setEditingUser(null) }}
          onSaved={() => { setShowEditModal(false); setEditingUser(null); loadData() }}
        />
      )}
    </>
  )
}

/* ── NEW USER MODAL ── */

function NewUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'colaborador' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.display_name.trim()) {
      alert('Preencha todos os campos obrigatórios')
      return
    }
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSaved()
    } catch { alert('Erro ao criar usuário') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[480px] max-w-full mx-4">
        <h3 className="text-sm tracking-wider mb-6">Novo Usuário</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Nome de Exibição *</label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
              placeholder="Nome completo"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Username *</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="nome.usuario"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Senha *</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cargo</label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
          >
            {saving ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── EDIT USER MODAL ── */

function EditUserModal({
  user,
  departamentos,
  modulos,
  onClose,
  onSaved,
}: {
  user: Usuario
  departamentos: Departamento[]
  modulos: ModuloDisponivel[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    display_name: user.display_name || '',
    role: user.role || 'colaborador',
    role_title: user.role_title || '',
    departamento_id: String(user.departamento_id ?? ''),
    ramal: user.ramal || '',
    ativo: user.ativo,
    new_password: '',
  })
  const [permissoes, setPermissoes] = useState<string[]>(() => {
    const p = user.permissoes
    if (Array.isArray(p)) return p
    if (p && typeof p === 'object') return Object.entries(p).filter(([,v]) => v).map(([k]) => k)
    return []
  })
  const [saving, setSaving] = useState(false)

  const togglePermissao = (nome: string) => {
    setPermissoes(prev =>
      prev.includes(nome) ? prev.filter(p => p !== nome) : [...prev, nome]
    )
  }

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      alert('Nome de exibição é obrigatório')
      return
    }
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const body: Record<string, any> = {
        display_name: form.display_name,
        role: form.role,
        role_title: form.role_title,
        departamento_id: form.departamento_id ? parseInt(form.departamento_id) : null,
        ramal: form.ramal,
        ativo: form.ativo,
        permissoes,
      }
      if (form.new_password) body.password = form.new_password
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      onSaved()
    } catch { alert('Erro ao atualizar usuário') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[560px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm tracking-wider mb-6">Editar Usuário</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-wider text-pulse-ash mb-1">Nome de Exibição</label>
              <input
                type="text"
                value={form.display_name}
                onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cargo</label>
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Título do Cargo</label>
            <input
              type="text"
              value={form.role_title}
              onChange={e => setForm(p => ({ ...p, role_title: e.target.value }))}
              placeholder="Ex: Contador Sênior"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
              <select
                value={form.departamento_id}
                onChange={e => setForm(p => ({ ...p, departamento_id: e.target.value }))}
                className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal"
              >
                <option value="">Nenhum</option>
                {departamentos.map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs tracking-wider text-pulse-ash mb-1">Ramal</label>
              <input
                type="text"
                value={form.ramal}
                onChange={e => setForm(p => ({ ...p, ramal: e.target.value }))}
                placeholder="1234"
                className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-wider text-pulse-ash">Status</span>
            <button
              onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.ativo ? 'bg-success' : 'bg-urban-smoke'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  form.ativo ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">
              Redefinir Senha (deixe em branco para manter)
            </label>
            <input
              type="password"
              value={form.new_password}
              onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))}
              placeholder="Nova senha"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>

          {modulos.length > 0 && (
            <div>
              <label className="block text-xs tracking-wider text-pulse-ash mb-2">Permissões de Módulos</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-core-black border border-urban-smoke rounded-lg p-3">
                {modulos.map(m => (
                  <label key={m.nome} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissoes.includes(m.nome)}
                      onChange={() => togglePermissao(m.nome)}
                      className="w-3.5 h-3.5 rounded bg-urban-smoke border-pulse-ash text-electric-teal focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-off-white">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
          >
            {saving ? 'Salvando...' : 'Atualizar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── TAB: DEPARTAMENTOS ── */

function DepartamentosTab() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', cor: '#5C939F' })
  const [liderId, setLiderId] = useState('')
  const [users, setUsers] = useState<{ id: number; display_name: string }[]>([])
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const res = await fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } })
      setDepartamentos(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/usuarios?limit=200', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const openNewModal = () => {
    setForm({ nome: '', cor: '#5C939F' })
    setLiderId('')
    setEditingId(null)
    setShowModal(true)
  }

  const openEditModal = (d: Departamento) => {
    setForm({ nome: d.nome, cor: d.cor })
    setLiderId(d.lider_id ? String(d.lider_id) : '')
    setEditingId(d.id)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) { alert('Nome é obrigatório'); return }
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      if (editingId) {
        await fetch(`/api/departamentos/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify({ ...form, lider_id: liderId ? parseInt(liderId) : null }),
        })
      } else {
        await fetch('/api/departamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(form),
        })
      }
      setShowModal(false)
      loadData()
    } catch { alert('Erro ao salvar departamento') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este departamento?')) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/departamentos/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      loadData()
    } catch { alert('Erro ao excluir departamento') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-pulse-ash text-sm">Carregando departamentos...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-pulse-ash">{departamentos.length} departamento{departamentos.length !== 1 ? 's' : ''}</div>
        <button
          onClick={openNewModal}
          className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2"
        >
          <span>+</span> Novo Departamento
        </button>
      </div>

      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon z-10">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">Líder</th>
                <th className="text-left py-3 px-4">Cor</th>
                <th className="text-center py-3 px-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {departamentos.map(d => (
                <tr key={d.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{d.nome}</td>
                  <td className="py-3 px-4 text-pulse-ash">{d.lider_nome || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border border-urban-smoke shrink-0"
                        style={{ backgroundColor: d.cor }}
                      />
                      <span className="text-pulse-ash font-mono text-xs">{d.cor}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditModal(d)}
                        className="text-pulse-ash hover:text-electric-teal transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-pulse-ash hover:text-danger transition-colors"
                        title="Excluir"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {departamentos.length === 0 && (
            <div className="text-center py-10 text-pulse-ash text-sm">Nenhum departamento cadastrado.</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[420px] max-w-full mx-4">
            <h3 className="text-sm tracking-wider mb-6">
              {editingId ? 'Editar Departamento' : 'Novo Departamento'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome do departamento"
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cor</label>
                <div className="grid grid-cols-5 gap-2">
                  {CORES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm(p => ({ ...p, cor: c.value }))}
                      className={`h-8 rounded-lg border-2 transition-all ${
                        form.cor === c.value ? 'border-off-white scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
                <div className="mt-2 text-xs text-pulse-ash font-mono">{form.cor}</div>
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Líder</label>
                <select value={liderId} onChange={e => setLiderId(e.target.value)}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                  <option value="">Nenhum</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── TAB: EMAIL / SMTP ── */

function EmailTab() {
  const [config, setConfig] = useState<MailConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [form, setForm] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_ssl: true,
    smtp_from: '',
  })
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    const t = getToken()
    if (!t) return
    fetch('/api/mail/config', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json())
      .then((d: MailConfig) => {
        setConfig(d)
        setForm({
          smtp_host: d.smtp_host || '',
          smtp_port: String(d.smtp_port || 587),
          smtp_user: d.smtp_user || '',
          smtp_pass: '',
          smtp_ssl: d.smtp_ssl ?? true,
          smtp_from: d.smtp_from || '',
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!form.smtp_host.trim()) { alert('SMTP Host é obrigatório'); return }
    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const body: Record<string, any> = {
        smtp_host: form.smtp_host,
        smtp_port: parseInt(form.smtp_port) || 587,
        smtp_user: form.smtp_user,
        smtp_ssl: form.smtp_ssl,
        smtp_from: form.smtp_from,
      }
      if (form.smtp_pass) body.smtp_pass = form.smtp_pass
      const res = await fetch('/api/mail/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setConfig(prev => prev ? {
        ...prev,
        smtp_host: form.smtp_host,
        smtp_port: parseInt(form.smtp_port) || 587,
        smtp_user: form.smtp_user,
        smtp_ssl: form.smtp_ssl,
        smtp_from: form.smtp_from,
        configured: true,
      } : null)
      setForm(p => ({ ...p, smtp_pass: '' }))
      alert('Configuração salva com sucesso!')
    } catch { alert('Erro ao salvar configuração') }
    setSaving(false)
  }

  const handleTest = async () => {
    const dest = testEmail.trim()
    if (!dest) { alert('Informe um e-mail de destino para o teste'); return }
    const t = getToken()
    if (!t) return
    setTesting(true)
    try {
      const res = await fetch('/api/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ to: dest }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'E-mail de teste enviado com sucesso!')
      } else {
        alert(data.detail || 'Erro ao enviar e-mail de teste')
      }
    } catch { alert('Erro ao testar envio') }
    setTesting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-pulse-ash text-sm">Carregando configurações de e-mail...</div>
      </div>
    )
  }

  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <span className={`w-2 h-2 rounded-full ${config?.configured ? 'bg-success' : 'bg-pulse-ash'}`} />
        <span className="text-xs tracking-wider text-pulse-ash">
          {config?.configured ? 'Configurado' : 'Não configurado'}
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">SMTP Host</label>
            <input
              type="text"
              value={form.smtp_host}
              onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Porta</label>
            <input
              type="text"
              value={form.smtp_port}
              onChange={e => setForm(p => ({ ...p, smtp_port: e.target.value }))}
              placeholder="587"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs tracking-wider text-pulse-ash mb-1">Usuário SMTP</label>
          <input
            type="text"
            value={form.smtp_user}
            onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))}
            placeholder="seu@email.com"
            className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
          />
        </div>
        <div>
          <label className="block text-xs tracking-wider text-pulse-ash mb-1">Senha SMTP</label>
          <input
            type="password"
            value={form.smtp_pass}
            onChange={e => setForm(p => ({ ...p, smtp_pass: e.target.value }))}
            placeholder={config?.configured ? '•••••••• (deixe em branco para manter)' : 'Senha do SMTP'}
            className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
          />
        </div>
        <div>
          <label className="block text-xs tracking-wider text-pulse-ash mb-1">E-mail Remetente</label>
          <input
            type="text"
            value={form.smtp_from}
            onChange={e => setForm(p => ({ ...p, smtp_from: e.target.value }))}
            placeholder="sistema@empresa.com.br"
            className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs tracking-wider text-pulse-ash">SSL / TLS</span>
          <button
            onClick={() => setForm(p => ({ ...p, smtp_ssl: !p.smtp_ssl }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              form.smtp_ssl ? 'bg-success' : 'bg-urban-smoke'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                form.smtp_ssl ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-urban-smoke">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
        >
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>

      {config?.configured && (
        <div className="mt-6 pt-4 border-t border-urban-smoke">
          <h4 className="text-xs tracking-wider text-pulse-ash mb-3">Testar Envio</h4>
          <div className="flex items-center gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="email@teste.com"
              className="flex-1 bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 rounded-lg text-xs tracking-wider border border-electric-teal/30 text-electric-teal hover:bg-electric-teal/10 transition-colors disabled:opacity-30 shrink-0"
            >
              {testing ? 'Enviando...' : 'Enviar Teste'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── DOWNLOADS TAB ── */

function DownloadsTab() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setClientes).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleFlag = async (clienteId: number, field: string, value: boolean) => {
    const t = getToken(); if (!t) return
    setSaving(clienteId)
    try {
      await fetch(`/api/clientes/${clienteId}/download-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ [field]: value }),
      })
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, [field]: value } : c))
    } catch {}
    setSaving(null)
  }

  const filtered = clientes.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-center py-20 text-pulse-ash text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs tracking-wider text-pulse-ash">Configuração de Downloads por Cliente</h3>
        <p className="text-xs text-pulse-ash mt-1">Desmarque empresas que não devem ter notas baixadas automaticamente.</p>
      </div>

      <div className="flex gap-3 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
          className="bg-rich-carbon border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal w-64" />
        <span className="text-xs text-pulse-ash">{filtered.length} de {clientes.length} clientes</span>
      </div>

      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon">
                <th className="text-left py-3 px-4">Cliente</th>
                <th className="text-center py-3 px-3 w-24">Ativo</th>
                <th className="text-center py-3 px-3 w-28">NFS-e Tomados</th>
                <th className="text-center py-3 px-3 w-28">NFS-e Prestados</th>
                <th className="text-center py-3 px-3 w-28">NF-e Entrada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30">
                  <td className="py-2 px-4"><div className="text-off-white">{c.name}</div><div className="text-xs text-pulse-ash font-mono">{c.cnpj}</div></td>
                  <td className="py-2 px-3 text-center"><ToggleCheck checked={c.download_ativo !== false} onChange={v => toggleFlag(c.id, 'download_ativo', v)} loading={saving === c.id} /></td>
                  <td className="py-2 px-3 text-center"><ToggleCheck checked={c.download_nfse_tomados !== false} onChange={v => toggleFlag(c.id, 'download_nfse_tomados', v)} loading={saving === c.id} disabled={c.download_ativo === false} /></td>
                  <td className="py-2 px-3 text-center"><ToggleCheck checked={c.download_nfse_prestados !== false} onChange={v => toggleFlag(c.id, 'download_nfse_prestados', v)} loading={saving === c.id} disabled={c.download_ativo === false} /></td>
                  <td className="py-2 px-3 text-center"><ToggleCheck checked={c.download_nfe_entrada !== false} onChange={v => toggleFlag(c.id, 'download_nfe_entrada', v)} loading={saving === c.id} disabled={c.download_ativo === false} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhum cliente encontrado.</div>}
      </div>
    </div>
  )
}

function ToggleCheck({ checked, onChange, loading, disabled }: { checked: boolean; onChange: (v: boolean) => void; loading: boolean; disabled?: boolean }) {
  return (
    <button onClick={() => !loading && !disabled && onChange(!checked)} disabled={loading || disabled}
      className={`inline-flex w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-electric-teal' : 'bg-urban-smoke'} ${(loading || disabled) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[14px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

/* ── TAB: MEU PERFIL ── */

function MeuPerfilTab() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deptos, setDeptos] = useState<{ id: number; nome: string }[]>([])
  const [form, setForm] = useState({
    display_name: '',
    role_title: '',
    ramal: '',
    departamento_id: '',
    password: '',
    password_confirm: '',
  })

  useEffect(() => {
    const t = getToken()
    if (!t) return
    Promise.all([
      fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => []),
    ]).then(([d, deps]) => {
      setProfile(d)
      setForm({
        display_name: d.display_name || '',
        role_title: d.role_title || '',
        ramal: d.ramal || '',
        departamento_id: d.departamento_id ? String(d.departamento_id) : '',
        password: '',
        password_confirm: '',
      })
      setDeptos(Array.isArray(deps) ? deps : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!form.display_name.trim()) { setError('Nome de exibição é obrigatório'); return }
    if (form.password && form.password.length < 4) { setError('A senha deve ter pelo menos 4 caracteres'); return }
    if (form.password && form.password !== form.password_confirm) { setError('As senhas não conferem'); return }

    const t = getToken()
    if (!t) return
    setSaving(true)
    try {
      const body: Record<string, any> = {
        display_name: form.display_name,
        role_title: form.role_title,
        ramal: form.ramal,
      }
      if (form.departamento_id) body.departamento_id = parseInt(form.departamento_id)
      if (form.password) body.password = form.password
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Erro ao atualizar perfil')
      }
      setSuccess('Perfil atualizado com sucesso!')
      setForm(p => ({ ...p, password: '', password_confirm: '' }))
    } catch (e: any) { setError(e.message || 'Erro ao atualizar perfil') }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-pulse-ash text-sm">Carregando perfil...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-pulse-ash text-sm">Não foi possível carregar o perfil.</div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
        <h3 className="text-sm tracking-wider mb-6">Meu Perfil</h3>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-2 text-xs text-danger mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-2 text-xs text-success mb-4">{success}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Username</label>
            <input
              type="text"
              value={profile.username}
              disabled
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-pulse-ash placeholder-pulse-ash cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Nome de Exibição</label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
              placeholder="Seu nome"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cargo / Função</label>
            <input
              type="text"
              value={form.role_title}
              onChange={e => setForm(p => ({ ...p, role_title: e.target.value }))}
              placeholder="Ex: Contador Sênior"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Ramal</label>
            <input
              type="text"
              value={form.ramal}
              onChange={e => setForm(p => ({ ...p, ramal: e.target.value }))}
              placeholder="1234"
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
            <select value={form.departamento_id}
              onChange={e => setForm(p => ({ ...p, departamento_id: e.target.value }))}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Nenhum</option>
              {deptos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>

          <div className="border-t border-urban-smoke pt-4 mt-6">
            <h4 className="text-xs tracking-wider text-pulse-ash mb-4">Alterar Senha</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Deixe em branco para manter"
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={form.password_confirm}
                  onChange={e => setForm(p => ({ ...p, password_confirm: e.target.value }))}
                  placeholder="Repita a nova senha"
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── TAB: CNAE ── */


/* ── TAB: CONTATOS DE NOTIFICAÇÃO ── */

