import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

type Obrigacao = {
  id: number
  titulo: string
  client_name: string
  departamento_nome: string
  vencimento_legal_date: string | null
  meta_interna_date: string | null
  status: string
  prioridade: string
  recorrencia: string
  responsavel_nome: string
  valor_total: number | null
  documento_requerido: boolean
  cliente_id: number
  departamento_id: number
  user_id: number
  arquivo_path?: string | null
  concluido_por?: number | null
  concluido_por_nome?: string | null
  concluida_em?: string | null
}

type Cliente = { id: number; name: string }
type Departamento = { id: number; nome: string }
type Usuario = { id: number; nome?: string; username?: string; display_name?: string }

type Modelo = {
  id: number
  titulo: string
  recorrencia: string
  prioridade: string
  departamento_nome: string
  total_clientes: number
  clientes: { id: number; name: string }[]
  dia_vencimento: number | null
  dia_meta_interna: number | null
  documento_requerido: boolean
  departamento_id: number
}

type AuditoriaItem = {
  id: number
  titulo: string
  client_name: string
  departamento_nome: string
  responsavel_nome: string
  concluido_por_nome: string
  concluida_em: string
  valor_total: number | null
}

type AuditoriaFiltros = {
  clientes: { id: number; name: string }[]
  titulos: string[]
  colaboradores: { id: number; nome: string }[]
}

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

function getUserName(): string {
  try {
    const t = getToken()
    if (!t) return 'Usuário'
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.display_name || p.username || 'Usuário'
  } catch { return 'Usuário' }
}

function getUserId(): number | null {
  try {
    const t = getToken()
    if (!t) return null
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.sub ? Number(p.sub) : null
  } catch { return null }
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return '-'
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch { return '-' }
}

function formatCurrency(v: number | null): string {
  if (v == null) return '-'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isOverdue(date: string | null): boolean {
  if (!date) return false
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return d < today
  } catch { return false }
}

function isWithinDays(date: string | null, days: number): boolean {
  if (!date) return false
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= days
  } catch { return false }
}

const STATUS_COLORS: Record<string, string> = {
  Pendente: 'bg-infrared/10 text-infrared',
  Concluida: 'bg-success/10 text-success',
  Concluída: 'bg-success/10 text-success',
  Atrasada: 'bg-danger/10 text-danger',
}

const PRIORITY_COLORS: Record<string, string> = {
  Alta: 'bg-danger/10 text-danger',
  Média: 'bg-success/10 text-success',
  Baixa: 'bg-[#59A993]/10 text-[#59A993]',
}

export default function Obrigacoes() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('obrigacoes')

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/obrigacoes" />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Obrigações</h1>
              <p className="text-pulse-ash text-sm">Gerenciamento de obrigações acessórias</p>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke">
            {[
              { key: 'obrigacoes', label: 'Obrigações' },
              { key: 'modelos', label: 'Modelos' },
              { key: 'auditoria', label: 'Auditoria' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  tab === t.key
                    ? 'text-electric-teal border-electric-teal'
                    : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'obrigacoes' && <ObrigacoesTab />}
          {tab === 'modelos' && <ModelosTab />}
          {tab === 'auditoria' && <AuditoriaTab />}
        </div>
      </main>
    </div>
  )
}

function ObrigacoesTab() {
  const navigate = useNavigate()
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    cliente_id: '',
    departamento_id: '',
    user_id: '',
    prioridade: 'Média',
    recorrencia: 'Única',
    meta_interna_date: '',
    vencimento_legal_date: '',
    documento_requerido: false,
    status: '',
    valor_total: '',
    arquivo_path: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadObrigacoes = useCallback(async () => {
    const t = getToken()
    if (!t) return
    try {
      const res = await fetch('/api/obrigacoes', { headers: { Authorization: 'Bearer ' + t } })
      if (!res.ok) throw new Error('Erro ao carregar obrigações')
      const data = await res.json()
      setObrigacoes(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar obrigações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    loadObrigacoes()
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setDepartamentos(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/usuarios?limit=500', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setUsuarios(Array.isArray(d) ? d : [])).catch(() => {})
  }, [loadObrigacoes])

  const filtered = obrigacoes.filter(o => {
    const matchSearch = !search || o.titulo.toLowerCase().includes(search.toLowerCase()) || (o.client_name && o.client_name.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = !statusFilter || o.status === statusFilter || (statusFilter === 'Atrasada' && o.status !== 'Concluida' && o.status !== 'Concluída' && isOverdue(o.vencimento_legal_date))
    return matchSearch && matchStatus
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const total = filtered.length
  const pendentes = filtered.filter(o => o.status === 'Pendente').length
  const concluidas = filtered.filter(o => o.status === 'Concluida' || o.status === 'Concluída').length
  const atrasadas = filtered.filter(o => o.status !== 'Concluida' && o.status !== 'Concluída' && isOverdue(o.vencimento_legal_date)).length

  const openNewModal = () => {
    setEditingId(null)
    setForm({
      titulo: '', cliente_id: '', departamento_id: '', user_id: '',
      prioridade: 'Média', recorrencia: 'Única',
      meta_interna_date: '', vencimento_legal_date: '',
      documento_requerido: false, status: '', valor_total: '', arquivo_path: '',
    })
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (ob: Obrigacao) => {
    setEditingId(ob.id)
    setForm({
      titulo: ob.titulo || '',
      cliente_id: ob.cliente_id ? String(ob.cliente_id) : '',
      departamento_id: ob.departamento_id ? String(ob.departamento_id) : '',
      user_id: ob.user_id ? String(ob.user_id) : '',
      prioridade: ob.prioridade || 'Média',
      recorrencia: ob.recorrencia || 'Única',
      meta_interna_date: ob.meta_interna_date ? ob.meta_interna_date.slice(0, 10) : '',
      vencimento_legal_date: ob.vencimento_legal_date ? ob.vencimento_legal_date.slice(0, 10) : '',
      documento_requerido: !!ob.documento_requerido,
      status: ob.status || '',
      valor_total: ob.valor_total != null ? String(ob.valor_total) : '',
      arquivo_path: ob.arquivo_path || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditingId(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.titulo.trim()) {
      setFormError('Título é obrigatório')
      return
    }
    setSubmitting(true)
    const t = getToken()
    if (!t) return

    const body: Record<string, any> = {
      titulo: form.titulo.trim(),
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
      user_id: form.user_id ? Number(form.user_id) : null,
      prioridade: form.prioridade,
      recorrencia: form.recorrencia,
      meta_interna_date: form.meta_interna_date || null,
      vencimento_legal_date: form.vencimento_legal_date || null,
      documento_requerido: form.documento_requerido,
    }

    if (editingId) {
      if (form.status) body.status = form.status
      if (form.valor_total) body.valor_total = parseFloat(form.valor_total)
      if (form.arquivo_path) body.arquivo_path = form.arquivo_path
    }

    try {
      const url = editingId ? `/api/obrigacoes/${editingId}` : '/api/obrigacoes'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error((errData as any).detail || 'Erro ao salvar obrigação')
      }
      closeModal()
      setLoading(true)
      await loadObrigacoes()
    } catch (e: any) {
      setFormError(e.message || 'Erro ao salvar obrigação')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta obrigação?')) return
    const t = getToken()
    if (!t) return
    try {
      const res = await fetch(`/api/obrigacoes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!res.ok) throw new Error('Erro ao excluir')
      setObrigacoes(prev => prev.filter(o => o.id !== id))
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir obrigação')
    }
  }

  const handleToggleStatus = async (ob: Obrigacao) => {
    const t = getToken()
    if (!t) return
    const userId = getUserId()
    const isConcluida = ob.status === 'Concluida' || ob.status === 'Concluída'

    const body: Record<string, any> = isConcluida
      ? { status: 'Pendente', concluida_em: null }
      : { status: 'Concluida', concluida_em: new Date().toISOString(), concluido_por: userId }

    try {
      const res = await fetch(`/api/obrigacoes/${ob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Erro ao alterar status')
      await loadObrigacoes()
    } catch (e: any) {
      alert(e.message || 'Erro ao alterar status')
    }
  }

  const handleEditValor = async (ob: Obrigacao) => {
    const t = getToken()
    if (!t) return
    const novo = prompt('Novo valor total (R$):', ob.valor_total != null ? String(ob.valor_total) : '')
    if (novo === null) return
    const valorNum = parseFloat(novo.replace(',', '.'))
    if (isNaN(valorNum)) { alert('Valor inválido'); return }

    try {
      const res = await fetch(`/api/obrigacoes/${ob.id}/valor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ valor_total: valorNum }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar valor')
      await loadObrigacoes()
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar valor')
    }
  }

  const handleDownloadArquivo = (id: number) => {
    const t = getToken()
    if (!t) return
    window.open(`/api/obrigacoes/${id}/arquivo?token=${encodeURIComponent(t)}`, '_blank')
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total" value={total} color="#3B82F6" />
        <SummaryCard label="Pendentes" value={pendentes} color="#FF8C42" />
        <SummaryCard label="Concluídas" value={concluidas} color="#59A993" />
        <SummaryCard label="Atrasadas" value={atrasadas} color="#CB3500" />
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar por título ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-rich-carbon border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-rich-carbon border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
          <option value="">Todos</option>
          <option value="Pendente">Pendente</option>
          <option value="Concluida">Concluída</option>
          <option value="Atrasada">Atrasada</option>
        </select>
        <button onClick={openNewModal}
          className="px-5 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2">
          <span>+</span> Nova Obrigação
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-pulse-ash text-sm">Carregando obrigações...</div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-sm text-danger mb-6">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                  <th className="text-left py-3 px-3">Título</th>
                  <th className="text-left py-3 px-3">Cliente</th>
                  <th className="text-left py-3 px-3">Depto</th>
                  <th className="text-left py-3 px-3">Meta Interna</th>
                  <th className="text-left py-3 px-3">Venc. Legal</th>
                  <th className="text-center py-3 px-3">Status</th>
                  <th className="text-center py-3 px-3">Prioridade</th>
                  <th className="text-left py-3 px-3">Responsável</th>
                  <th className="text-left py-3 px-3">Valor</th>
                  <th className="text-center py-3 px-3">Anexo</th>
                  <th className="text-center py-3 px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const concluida = o.status === 'Concluida' || o.status === 'Concluída'
                  const overdue = isOverdue(o.vencimento_legal_date) && !concluida
                  const soon = isWithinDays(o.vencimento_legal_date, 7) && !concluida && !overdue
                  return (
                    <tr key={o.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {o.documento_requerido && (
                            <span className="text-xs" title="Documento requerido">📄</span>
                          )}
                          <button onClick={() => openEditModal(o)} className="text-left hover:text-electric-teal transition-colors">
                            {o.titulo}
                          </button>
                        </div>
                        {concluida && o.concluida_em && (
                          <div className="text-[10px] text-pulse-ash mt-0.5">
                            {o.concluido_por_nome || '-'} em {formatDate(o.concluida_em)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-pulse-ash">{o.client_name || '-'}</td>
                      <td className="py-3 px-3 text-pulse-ash">{o.departamento_nome || '-'}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-pulse-ash">{formatDate(o.meta_interna_date)}</td>
                      <td className={`py-3 px-3 font-mono text-[11px] ${overdue ? 'text-danger font-medium' : soon ? 'text-infrared' : ''}`}>
                        {formatDate(o.vencimento_legal_date)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] tracking-wider ${STATUS_COLORS[o.status] || 'bg-pulse-ash/10 text-pulse-ash'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] tracking-wider ${PRIORITY_COLORS[o.prioridade] || 'bg-pulse-ash/10 text-pulse-ash'}`}>
                          {o.prioridade || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-pulse-ash">{o.responsavel_nome || '-'}</td>
                      <td className="py-3 px-3">
                        <button onClick={() => handleEditValor(o)} className="hover:text-electric-teal transition-colors font-mono text-[11px] cursor-pointer" title="Clique para editar">
                          {formatCurrency(o.valor_total)}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {o.arquivo_path ? (
                          <button onClick={() => handleDownloadArquivo(o.id)} className="text-electric-teal hover:underline text-[10px]" title="Download">
                            📎 Baixar
                          </button>
                        ) : (
                          <span className="text-pulse-ash">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={e => { e.stopPropagation(); handleToggleStatus(o) }}
                            className={`text-[10px] tracking-wider transition-colors ${
                              concluida ? 'text-infrared hover:text-infrared/70' : 'text-[#59A993] hover:text-[#59A993]/70'
                            }`}
                          >
                            {concluida ? '↺ Reabrir' : '✓ Concluir'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); openEditModal(o) }}
                            className="text-pulse-ash hover:text-off-white transition-colors text-[10px] tracking-wider">
                            Editar
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(o.id) }}
                            className="text-pulse-ash hover:text-danger transition-colors text-[10px] tracking-wider">
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-pulse-ash text-sm">
              {search || statusFilter ? 'Nenhuma obrigação encontrada com os filtros atuais.' : 'Nenhuma obrigação cadastrada.'}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-core-black/80 backdrop-blur-sm">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm tracking-wider text-off-white font-roc" style={{ fontWeight: 500 }}>
                  {editingId ? 'Editar Obrigação' : 'Nova Obrigação'}
                </h3>
                <button onClick={closeModal} className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">&times;</button>
              </div>

              {formError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-xs text-danger mb-4">{formError}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Título *</label>
                  <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Cliente</label>
                    <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Selecione...</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
                    <select value={form.departamento_id} onChange={e => setForm(f => ({ ...f, departamento_id: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Selecione...</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Responsável</label>
                    <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Selecione...</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.display_name || u.username || u.nome || u.id}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prioridade</label>
                    <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Recorrência</label>
                    <select value={form.recorrencia} onChange={e => setForm(f => ({ ...f, recorrencia: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="Única">Única</option>
                      <option value="Mensal">Mensal</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Anual">Anual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Meta Interna</label>
                    <input type="date" value={form.meta_interna_date} onChange={e => setForm(f => ({ ...f, meta_interna_date: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Vencimento Legal</label>
                    <input type="date" value={form.vencimento_legal_date} onChange={e => setForm(f => ({ ...f, vencimento_legal_date: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.documento_requerido}
                    onChange={e => setForm(f => ({ ...f, documento_requerido: e.target.checked }))}
                    className="accent-electric-teal" />
                  <span className="text-xs text-pulse-ash">Documento Requerido</span>
                </label>

                {editingId && (
                  <div className="border-t border-urban-smoke pt-4 mt-2 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs tracking-wider text-pulse-ash mb-1">Status</label>
                        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                          className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                          <option value="">Não alterar</option>
                          <option value="Pendente">Pendente</option>
                          <option value="Concluida">Concluída</option>
                          <option value="Atrasada">Atrasada</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs tracking-wider text-pulse-ash mb-1">Valor Total (R$)</label>
                        <input type="number" step="0.01" value={form.valor_total}
                          onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))}
                          className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                      </div>
                      <div>
                        <label className="block text-xs tracking-wider text-pulse-ash mb-1">Arquivo</label>
                        <input type="text" value={form.arquivo_path}
                          onChange={e => setForm(f => ({ ...f, arquivo_path: e.target.value }))}
                          placeholder="caminho/arquivo.pdf"
                          className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50">
                    {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Obrigação'}
                  </button>
                  <button type="button" onClick={closeModal}
                    className="px-4 py-2.5 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white border border-urban-smoke transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-4">
      <div className="text-[10px] tracking-wider text-pulse-ash mb-2">{label}</div>
      <div className="text-2xl font-mono" style={{ color }}>{value}</div>
    </div>
  )
}

function ModelosTab() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    titulo: '', recorrencia: 'Mensal', prioridade: 'Média',
    dia_vencimento: '', dia_meta_interna: '',
    departamento_id: '', documento_requerido: false,
    cliente_ids: [] as number[],
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadModelos = useCallback(async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const res = await fetch('/api/modelos', { headers: { Authorization: 'Bearer ' + t } })
      if (!res.ok) throw new Error('Erro ao carregar modelos')
      const data = await res.json()
      setModelos(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = getToken()
    if (!t) return
    loadModelos()
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setDepartamentos(Array.isArray(d) ? d : [])).catch(() => {})
  }, [loadModelos])

  const openNewModal = () => {
    setEditingId(null)
    setForm({
      titulo: '', recorrencia: 'Mensal', prioridade: 'Média',
      dia_vencimento: '', dia_meta_interna: '',
      departamento_id: '', documento_requerido: false,
      cliente_ids: [],
    })
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (m: Modelo) => {
    setEditingId(m.id)
    setForm({
      titulo: m.titulo || '',
      recorrencia: m.recorrencia || 'Mensal',
      prioridade: m.prioridade || 'Média',
      dia_vencimento: m.dia_vencimento ? String(m.dia_vencimento) : '',
      dia_meta_interna: m.dia_meta_interna ? String(m.dia_meta_interna) : '',
      departamento_id: m.departamento_id ? String(m.departamento_id) : '',
      documento_requerido: !!m.documento_requerido,
      cliente_ids: (m.clientes || []).map(c => c.id),
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditingId(null) }

  const toggleCliente = (id: number) => {
    setForm(f => ({
      ...f,
      cliente_ids: f.cliente_ids.includes(id)
        ? f.cliente_ids.filter(cid => cid !== id)
        : [...f.cliente_ids, id],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.titulo.trim()) {
      setFormError('Título é obrigatório')
      return
    }
    setSubmitting(true)
    const t = getToken()
    if (!t) return

    const body: Record<string, any> = {
      titulo: form.titulo.trim(),
      recorrencia: form.recorrencia,
      prioridade: form.prioridade,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      dia_meta_interna: form.dia_meta_interna ? Number(form.dia_meta_interna) : null,
      departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
      documento_requerido: form.documento_requerido,
      client_ids: form.cliente_ids,
    }

    try {
      const url = editingId ? `/api/modelos/${editingId}` : '/api/modelos'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error((errData as any).detail || 'Erro ao salvar modelo')
      }
      closeModal()
      await loadModelos()
    } catch (e: any) {
      setFormError(e.message || 'Erro ao salvar modelo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este modelo?')) return
    const t = getToken()
    if (!t) return
    try {
      const res = await fetch(`/api/modelos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!res.ok) throw new Error('Erro ao excluir')
      setModelos(prev => prev.filter(m => m.id !== id))
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir modelo')
    }
  }

  const handleGerar = async (id: number, titulo: string) => {
    if (!confirm(`Gerar obrigações do modelo "${titulo}"?`)) return
    const t = getToken()
    if (!t) return
    try {
      const res = await fetch(`/api/modelos/${id}/gerar`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!res.ok) throw new Error('Erro ao gerar obrigações')
      const data = await res.json().catch(() => ({}))
      alert(`Obrigações geradas com sucesso! Total: ${(data as any).count || (data as any).total || 'OK'}`)
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar obrigações')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm tracking-wider text-pulse-ash">Modelos de Obrigações</h2>
        <button onClick={openNewModal}
          className="px-5 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2">
          <span>+</span> Novo Modelo
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-pulse-ash text-sm">Carregando modelos...</div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-sm text-danger mb-6">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                  <th className="text-left py-3 px-3">Título</th>
                  <th className="text-left py-3 px-3">Recorrência</th>
                  <th className="text-left py-3 px-3">Depto</th>
                  <th className="text-center py-3 px-3">Clientes</th>
                  <th className="text-center py-3 px-3">Dia Venc.</th>
                  <th className="text-center py-3 px-3">Dia Meta</th>
                  <th className="text-center py-3 px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map(m => (
                  <tr key={m.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {m.documento_requerido && <span className="text-xs" title="Documento requerido">📄</span>}
                        <span>{m.titulo}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] tracking-wider bg-pulse-ash/10 text-pulse-ash">
                        {m.recorrencia || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-pulse-ash">{m.departamento_nome || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      {m.total_clientes != null ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-electric-teal/10 text-electric-teal">
                          {m.total_clientes}
                        </span>
                      ) : (
                        <span className="text-pulse-ash">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px]">
                      {m.dia_vencimento ? String(m.dia_vencimento).padStart(2, '0') : '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-pulse-ash">
                      {m.dia_meta_interna ? String(m.dia_meta_interna).padStart(2, '0') : '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => handleGerar(m.id, m.titulo)}
                          className="text-[#59A993] hover:text-[#59A993]/70 transition-colors text-[10px] tracking-wider">
                          Gerar
                        </button>
                        <button onClick={() => openEditModal(m)}
                          className="text-pulse-ash hover:text-off-white transition-colors text-[10px] tracking-wider">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(m.id)}
                          className="text-pulse-ash hover:text-danger transition-colors text-[10px] tracking-wider">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {modelos.length === 0 && (
            <div className="text-center py-10 text-pulse-ash text-sm">Nenhum modelo cadastrado.</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-core-black/80 backdrop-blur-sm">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm tracking-wider text-off-white font-roc" style={{ fontWeight: 500 }}>
                  {editingId ? 'Editar Modelo' : 'Novo Modelo'}
                </h3>
                <button onClick={closeModal} className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">&times;</button>
              </div>

              {formError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-xs text-danger mb-4">{formError}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-1">Título *</label>
                  <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required
                    className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Recorrência</label>
                    <select value={form.recorrencia} onChange={e => setForm(f => ({ ...f, recorrencia: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="Mensal">Mensal</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Anual">Anual</option>
                      <option value="Única">Única</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Prioridade</label>
                    <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
                    <select value={form.departamento_id} onChange={e => setForm(f => ({ ...f, departamento_id: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Selecione...</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Dia Vencimento (1-31)</label>
                    <input type="number" min="1" max="31" value={form.dia_vencimento}
                      onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Dia Meta Interna (1-31)</label>
                    <input type="number" min="1" max="31" value={form.dia_meta_interna}
                      onChange={e => setForm(f => ({ ...f, dia_meta_interna: e.target.value }))}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal" />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.documento_requerido}
                    onChange={e => setForm(f => ({ ...f, documento_requerido: e.target.checked }))}
                    className="accent-electric-teal" />
                  <span className="text-xs text-pulse-ash">Documento Requerido</span>
                </label>

                <div>
                  <label className="block text-xs tracking-wider text-pulse-ash mb-2">Clientes</label>
                  <div className="max-h-48 overflow-y-auto border border-urban-smoke rounded-lg p-3 space-y-1.5 bg-core-black">
                    {clientes.length === 0 && (
                      <div className="text-xs text-pulse-ash py-2 text-center">Nenhum cliente disponível</div>
                    )}
                    {clientes.map(c => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:text-off-white transition-colors">
                        <input type="checkbox" checked={form.cliente_ids.includes(c.id)}
                          onChange={() => toggleCliente(c.id)}
                          className="accent-electric-teal rounded" />
                        <span className="text-xs text-pulse-ash">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  {form.cliente_ids.length > 0 && (
                    <div className="text-[10px] text-pulse-ash mt-1">
                      {form.cliente_ids.length} cliente(s) selecionado(s)
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50">
                    {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Modelo'}
                  </button>
                  <button type="button" onClick={closeModal}
                    className="px-4 py-2.5 rounded-lg text-xs tracking-wider text-pulse-ash hover:text-off-white border border-urban-smoke transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AuditoriaTab() {
  const [auditoria, setAuditoria] = useState<AuditoriaItem[]>([])
  const [filtros, setFiltros] = useState<AuditoriaFiltros>({ clientes: [], titulos: [], colaboradores: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroTitulo, setFiltroTitulo] = useState('')
  const [filtroColaborador, setFiltroColaborador] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  const loadAuditoria = useCallback(async () => {
    const t = getToken()
    if (!t) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroCliente) params.set('cliente_id', filtroCliente)
      if (filtroTitulo) params.set('titulo', filtroTitulo)
      if (filtroColaborador) params.set('colaborador_id', filtroColaborador)
      if (filtroDataInicio) params.set('data_inicio', filtroDataInicio)
      if (filtroDataFim) params.set('data_fim', filtroDataFim)

      const qs = params.toString()
      const url = '/api/obrigacoes/auditoria' + (qs ? '?' + qs : '')
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } })
      if (!res.ok) throw new Error('Erro ao carregar auditoria')
      const data = await res.json()
      setAuditoria(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar auditoria')
    } finally {
      setLoading(false)
    }
  }, [filtroCliente, filtroTitulo, filtroColaborador, filtroDataInicio, filtroDataFim])

  useEffect(() => {
    const t = getToken()
    if (!t) return
    loadAuditoria()
    fetch('/api/obrigacoes/auditoria/filtros', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => {
        setFiltros({
          clientes: Array.isArray(d.clientes) ? d.clientes : [],
          titulos: Array.isArray(d.titulos) ? d.titulos : [],
          colaboradores: Array.isArray(d.colaboradores) ? d.colaboradores : [],
        })
      }).catch(() => {})
  }, [loadAuditoria])

  return (
    <div>
      <h2 className="text-sm tracking-wider text-pulse-ash mb-6">Auditoria de Obrigações Concluídas</h2>

      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-4 mb-6">
        <div className="grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[10px] tracking-wider text-pulse-ash mb-1">Cliente</label>
            <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Todos</option>
              {filtros.clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] tracking-wider text-pulse-ash mb-1">Obrigação</label>
            <select value={filtroTitulo} onChange={e => setFiltroTitulo(e.target.value)}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Todas</option>
              {filtros.titulos.map((t, i) => <option key={i} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] tracking-wider text-pulse-ash mb-1">Colaborador</label>
            <select value={filtroColaborador} onChange={e => setFiltroColaborador(e.target.value)}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
              <option value="">Todos</option>
              {filtros.colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] tracking-wider text-pulse-ash mb-1">Data Início</label>
            <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
          </div>
          <div>
            <label className="block text-[10px] tracking-wider text-pulse-ash mb-1">Data Fim</label>
            <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)}
              className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-pulse-ash text-sm">Carregando auditoria...</div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-sm text-danger mb-6">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                  <th className="text-left py-3 px-3">Título</th>
                  <th className="text-left py-3 px-3">Cliente</th>
                  <th className="text-left py-3 px-3">Depto</th>
                  <th className="text-left py-3 px-3">Responsável</th>
                  <th className="text-left py-3 px-3">Concluído por</th>
                  <th className="text-left py-3 px-3">Data Conclusão</th>
                  <th className="text-right py-3 px-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map(a => (
                  <tr key={a.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                    <td className="py-3 px-3">{a.titulo || '-'}</td>
                    <td className="py-3 px-3 text-pulse-ash">{a.client_name || '-'}</td>
                    <td className="py-3 px-3 text-pulse-ash">{a.departamento_nome || '-'}</td>
                    <td className="py-3 px-3 text-pulse-ash">{a.responsavel_nome || '-'}</td>
                    <td className="py-3 px-3 text-pulse-ash">{a.concluido_por_nome || '-'}</td>
                    <td className="py-3 px-3 font-mono text-[11px]">{formatDate(a.concluida_em)}</td>
                    <td className="py-3 px-3 text-right font-mono text-[11px]">{formatCurrency(a.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditoria.length === 0 && (
            <div className="text-center py-10 text-pulse-ash text-sm">Nenhuma obrigação concluída encontrada.</div>
          )}
        </div>
      )}
    </div>
  )
}
