import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

type Cliente = {
  id: number; name: string; cnpj: string; active: boolean
  nome_fantasia: string; regime: string; telefone: string; email: string
  endereco_cep: string; endereco_logradouro: string; endereco_numero: string
  endereco_complemento: string; endereco_bairro: string; endereco_cidade: string
  endereco_uf: string
}

type Contato = { id: number; nome: string; email: string; cargo: string; telefone: string }
type Responsavel = { id: number; user_id: number; user_name: string; department_id: number; department_name: string }
type Departamento = { id: number; nome: string }
type Usuario = { id: number; display_name: string; role: string; departamento_id: number | null }

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

function formatCNPJ(cnpj: string): string {
  const d = (cnpj || '').replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return phone
}

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Isento']

export default function Clientes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<(Cliente & { contatos: Contato[]; responsaveis: Responsavel[] }) | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sheetTab, setSheetTab] = useState('geral')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [modalTab, setModalTab] = useState('empresa')
  const [contatos, setContatos] = useState<any[]>([])
  const [cnpjLoading, setCnpjLoading] = useState(false)

  const [departments, setDepartments] = useState<Departamento[]>([])
  const [users, setUsers] = useState<Usuario[]>([])

  const [showAssign, setShowAssign] = useState(false)
  const [assignDeptId, setAssignDeptId] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  const [changingRespId, setChangingRespId] = useState<number | null>(null)
  const [changeUserId, setChangeUserId] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    loadClients(t)
    fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setDepartments).catch(() => {})
    fetch('/api/usuarios?limit=500', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(setUsers).catch(() => {})
  }, [navigate])

  const loadClients = async (tok?: string) => {
    const t = tok || getToken()
    if (!t) return
    try {
      const r = await fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })
      setClients(await r.json())
    } catch {}
    setLoading(false)
  }

  const loadDetail = async (id: number) => {
    const t = getToken()
    if (!t) return
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/clientes/${id}`, { headers: { Authorization: 'Bearer ' + t } })
      setDetail(await r.json())
    } catch {}
    setDetailLoading(false)
  }

  const openDetail = (id: number) => {
    setSelectedId(id)
    setSheetTab('geral')
    setShowAssign(false)
    setChangingRespId(null)
    loadDetail(id)
  }

  const closeDetail = () => { setSelectedId(null); setDetail(null) }

  const loadContatosPermissoes = async (contatosList: any[]) => {
    const t = getToken()
    if (!t) return
    for (const ct of contatosList) {
      if (!ct.id) continue
      try {
        const r = await fetch(`/api/mail/contatos/${ct.id}/permissoes`, { headers: { Authorization: 'Bearer ' + t } })
        const p = await r.json()
        ct._notify = p.all_depts ?? true
        ct._exclude = p.exclude || []
      } catch { ct._notify = true; ct._exclude = [] }
    }
  }

  const openNewModal = () => {
    setForm({})
    setEditingId(null)
    setContatos([])
    setModalTab('empresa')
    setShowModal(true)
  }

  const openEditModal = async (c: Cliente) => {
    setForm({
      name: c.name || '',
      cnpj: c.cnpj || '',
      nome_fantasia: c.nome_fantasia || '',
      regime: c.regime || '',
      telefone: c.telefone || '',
      email: c.email || '',
      endereco_cep: c.endereco_cep || '',
      endereco_logradouro: c.endereco_logradouro || '',
      endereco_numero: c.endereco_numero || '',
      endereco_complemento: c.endereco_complemento || '',
      endereco_bairro: c.endereco_bairro || '',
      endereco_cidade: c.endereco_cidade || '',
      endereco_uf: c.endereco_uf || '',
      observacoes: (c as any).observacoes || '',
    })
    setEditingId(c.id)
    setModalTab('empresa')
    setShowModal(true)
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/clientes/${c.id}`, { headers: { Authorization: 'Bearer ' + t } })
      const data = await r.json()
      const ctList = (data.contatos || []).map((ct: any) => ({ ...ct, _notify: true, _exclude: [] }))
      await loadContatosPermissoes(ctList)
      setContatos(ctList)
    } catch { setContatos([]) }
  }

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleCNPJLookup = async () => {
    const cnpj = (form.cnpj || '').replace(/\D/g, '')
    if (!cnpj || cnpj.length !== 14) { alert('Informe um CNPJ válido com 14 dígitos'); return }
    const t = getToken()
    if (!t) return
    setCnpjLoading(true)
    try {
      const r = await fetch(`/api/buscar-cnpj/${cnpj}`, { headers: { Authorization: 'Bearer ' + t } })
      if (!r.ok) throw new Error('CNPJ não encontrado')
      const data = await r.json()
      const rawRegime = (data.regime || '').toLowerCase()
      const matchedRegime = REGIMES.find(r => r.toLowerCase() === rawRegime) || ''
      setForm(prev => ({
        ...prev,
        name: data.nome || data.razao_social || prev.name || '',
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia || '',
        regime: matchedRegime,
        endereco_cep: data.cep || prev.endereco_cep || '',
        endereco_logradouro: data.logradouro || prev.endereco_logradouro || '',
        endereco_numero: data.numero || prev.endereco_numero || '',
        endereco_complemento: data.complemento || prev.endereco_complemento || '',
        endereco_bairro: data.bairro || prev.endereco_bairro || '',
        endereco_cidade: data.municipio || prev.endereco_cidade || '',
        endereco_uf: data.uf || prev.endereco_uf || '',
        telefone: data.telefone || prev.telefone || '',
        email: data.email || prev.email || '',
        _cnaes: data.cnaes || [],
      }))
    } catch { alert('CNPJ não encontrado ou erro na consulta') }
    setCnpjLoading(false)
  }

  const saveContatos = async (clientId: number) => {
    const t = getToken()
    if (!t) return
    for (const ct of contatos) {
      try {
        if (ct._deleted) {
          if (ct.id && !ct._temp) await fetch(`/api/clientes/${clientId}/contatos/${ct.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
          continue
        }
        const body = { nome: ct.nome, email: ct.email, telefone: ct.telefone, whatsapp: ct.whatsapp ? 1 : 0 }
        let cid = ct.id
        if (ct._temp) {
          const r = await fetch(`/api/clientes/${clientId}/contatos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
          const d = await r.json()
          cid = d.id
        } else {
          await fetch(`/api/clientes/${clientId}/contatos/${ct.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        }
        if (cid && ct._notify !== undefined) {
          await fetch(`/api/mail/contatos/${cid}/permissoes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
            body: JSON.stringify({ all_depts: ct._notify, exclude: ct._notify ? (ct._exclude || []) : departments.map((d: any) => d.id) }),
          })
        }
      } catch {}
    }
  }

  const handleSave = async () => {
    const t = getToken()
    if (!t) return
    if (!form.name?.trim()) { alert('Nome/Razão Social é obrigatório'); return }
    setSaving(true)
    try {
      const body: Record<string, any> = {
        name: form.name, cnpj: form.cnpj, nome_fantasia: form.nome_fantasia,
        regime: form.regime, telefone: form.telefone, email: form.email,
        endereco_cep: form.endereco_cep, endereco_logradouro: form.endereco_logradouro,
        endereco_numero: form.endereco_numero, endereco_complemento: form.endereco_complemento,
        endereco_bairro: form.endereco_bairro, endereco_cidade: form.endereco_cidade,
        endereco_uf: form.endereco_uf, observacoes: form.observacoes || '',
      }
      let clientId: number | null = null
      if (editingId) {
        body.active = clients.find(c => c.id === editingId)?.active ?? true
        await fetch(`/api/clientes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
        clientId = editingId
      } else {
        const r = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
        const d = await r.json()
        clientId = d.id
      }
      if (clientId) await saveContatos(clientId)
      setShowModal(false)
      loadClients()
      if (editingId && selectedId === editingId) loadDetail(editingId)
    } catch { alert('Erro ao salvar cliente') }
    setSaving(false)
  }

  const handleToggleActive = async (id: number, active: boolean) => {
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ active }),
      })
      loadClients()
      if (selectedId === id) loadDetail(id)
    } catch {}
  }

  const handleInactivate = async (id: number) => {
    if (!confirm('Inativar este cliente?')) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      loadClients()
      closeDetail()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm('EXCLUIR PERMANENTEMENTE? Esta ação não pode ser desfeita!')) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${id}?permanente=true`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      loadClients()
      closeDetail()
    } catch {}
  }

  const handleAssignResponsible = async () => {
    if (!assignDeptId || !assignUserId) { alert('Selecione departamento e usuário'); return }
    if (!selectedId) return
    const t = getToken()
    if (!t) return
    setAssignLoading(true)
    try {
      await fetch(`/api/clientes/${selectedId}/responsaveis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ user_id: parseInt(assignUserId), department_id: parseInt(assignDeptId) }),
      })
      setShowAssign(false)
      setAssignDeptId('')
      setAssignUserId('')
      loadDetail(selectedId)
    } catch {}
    setAssignLoading(false)
  }

  const handleChangeResponsible = async (respId: number) => {
    if (!changeUserId || !selectedId) return
    const t = getToken()
    if (!t) return
    setChangeLoading(true)
    try {
      await fetch(`/api/clientes/${selectedId}/responsaveis/${respId}/remover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ new_user_id: parseInt(changeUserId) }),
      })
      setChangingRespId(null)
      setChangeUserId('')
      loadDetail(selectedId)
    } catch {}
    setChangeLoading(false)
  }

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.name || '').toLowerCase().includes(q) ||
           (c.cnpj || '').includes(q) ||
           (c.nome_fantasia || '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="h-screen bg-core-black text-off-white flex items-center justify-center">
        <div className="text-pulse-ash text-sm">Carregando clientes...</div>
      </div>
    )
  }

  const currentClient = selectedId ? clients.find(c => c.id === selectedId) : null

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/clientes" />

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Clientes</h1>
              <p className="text-pulse-ash text-sm">Gestão de clientes do escritório</p>
            </div>
            <button onClick={openNewModal}
              className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors flex items-center gap-2">
              <span>+</span> Novo Cliente
            </button>
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou nome fantasia..."
              className="w-full bg-rich-carbon border border-urban-smoke rounded-xl px-4 py-3 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
            />
          </div>

          <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider sticky top-0 bg-rich-carbon z-10">
                    <th className="text-left py-3 px-4">Nome</th>
                    <th className="text-left py-3 px-4">CNPJ</th>
                    <th className="text-left py-3 px-4">Cidade/UF</th>
                    <th className="text-left py-3 px-4">Telefone</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-center py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}
                      onClick={() => openDetail(c.id)}
                      className={`border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors cursor-pointer ${selectedId === c.id ? 'bg-electric-teal/5' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="font-medium">{c.name || '-'}</div>
                        {c.nome_fantasia && <div className="text-pulse-ash text-xs">{c.nome_fantasia}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-pulse-ash">{formatCNPJ(c.cnpj) || '-'}</td>
                      <td className="py-3 px-4 text-pulse-ash">
                        {c.endereco_cidade && c.endereco_uf ? `${c.endereco_cidade}/${c.endereco_uf}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-pulse-ash">{formatPhone(c.telefone) || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${c.active ? 'bg-success/10 text-success' : 'bg-pulse-ash/10 text-pulse-ash'}`}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={e => { e.stopPropagation(); openEditModal(c) }}
                          className="text-pulse-ash hover:text-electric-teal transition-colors" title="Editar">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-10 text-pulse-ash text-sm">
                  {search ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Detail Sheet ── */}
      {selectedId !== null && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-core-black/60" onClick={closeDetail} />
          <div className="relative w-[480px] max-w-full h-full bg-rich-carbon border-l border-urban-smoke flex flex-col animate-[slideLeft_0.2s_ease-out]">
            <div className="p-5 border-b border-urban-smoke flex items-center justify-between shrink-0">
              <h3 className="text-sm tracking-wider truncate">
                {detail?.name || currentClient?.name || 'Cliente'}
              </h3>
              <button onClick={closeDetail} className="text-pulse-ash hover:text-off-white transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <div className="flex border-b border-urban-smoke shrink-0">
              {[
                { key: 'geral', label: 'Geral' },
                { key: 'endereco', label: 'Endereço' },
                { key: 'contatos', label: 'Contatos' },
                { key: 'responsaveis', label: 'Responsáveis' },
              ].map(t => (
                <button key={t.key} onClick={() => setSheetTab(t.key)}
                  className={`flex-1 py-2.5 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                    sheetTab === t.key ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
                  }`}>{t.label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-pulse-ash text-sm">Carregando...</div>
                </div>
              ) : detail ? (
                <>
                  {/* Geral */}
                  {sheetTab === 'geral' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${detail.active ? 'bg-success/10 text-success' : 'bg-pulse-ash/10 text-pulse-ash'}`}>
                          {detail.active ? 'Ativo' : 'Inativo'}
                        </span>
                        <button
                          onClick={() => handleToggleActive(detail.id, !detail.active)}
                          className="text-xs tracking-wider text-electric-teal hover:text-off-white border border-electric-teal/30 px-3 py-1 rounded transition-colors">
                          {detail.active ? 'Inativar' : 'Ativar'}
                        </button>
                      </div>
                      <DetailField label="Razão Social" value={detail.name} />
                      <DetailField label="Nome Fantasia" value={detail.nome_fantasia} />
                      <DetailField label="CNPJ" value={formatCNPJ(detail.cnpj)} mono />
                      <DetailField label="Regime Tributário" value={detail.regime} />
                      <DetailField label="Telefone" value={formatPhone(detail.telefone)} />
                      <DetailField label="E-mail" value={detail.email} />
                      <div className="flex gap-3 pt-4">
                        <button onClick={() => openEditModal(detail)}
                          className="flex-1 px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                          Editar
                        </button>
                        <button onClick={() => handleInactivate(detail.id)}
                          className="px-4 py-2 rounded-lg text-xs tracking-wider border border-infrared/30 text-infrared hover:bg-infrared/10 transition-colors">
                          Inativar
                        </button>
                      </div>
                      <button onClick={() => handleDelete(detail.id)}
                        className="w-full px-4 py-2 rounded-lg text-xs tracking-wider border border-danger/30 text-danger hover:bg-danger/10 transition-colors">
                        Excluir Permanentemente
                      </button>
                    </div>
                  )}

                  {/* Endereço */}
                  {sheetTab === 'endereco' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <DetailField label="CEP" value={detail.endereco_cep} />
                        <DetailField label="UF" value={detail.endereco_uf} />
                      </div>
                      <DetailField label="Logradouro" value={detail.endereco_logradouro} />
                      <div className="grid grid-cols-2 gap-4">
                        <DetailField label="Número" value={detail.endereco_numero} />
                        <DetailField label="Complemento" value={detail.endereco_complemento} />
                      </div>
                      <DetailField label="Bairro" value={detail.endereco_bairro} />
                      <DetailField label="Cidade" value={detail.endereco_cidade} />
                    </div>
                  )}

                  {/* Contatos */}
                  {sheetTab === 'contatos' && (
                    <div className="space-y-3">
                      {detail.contatos && detail.contatos.length > 0 ? (
                        detail.contatos.map(co => (
                          <div key={co.id} className="bg-core-black border border-urban-smoke rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{co.nome || 'Sem nome'}</span>
                              {co.cargo && <span className="text-xs text-pulse-ash tracking-wider">{co.cargo}</span>}
                            </div>
                            {co.email && <div className="text-xs text-electric-teal">{co.email}</div>}
                            {co.telefone && <div className="text-xs text-pulse-ash">{formatPhone(co.telefone)}</div>}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-pulse-ash text-sm">Nenhum contato cadastrado.</div>
                      )}
                    </div>
                  )}

                  {/* Responsáveis */}
                  {sheetTab === 'responsaveis' && (
                    <div className="space-y-4">
                      {detail.responsaveis && detail.responsaveis.length > 0 ? (
                        detail.responsaveis.map(r => (
                          <div key={r.id} className="bg-core-black border border-urban-smoke rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs tracking-wider text-electric-teal">{r.department_name}</span>
                              {changingRespId === r.id ? (
                                <button onClick={() => setChangingRespId(null)}
                                  className="text-xs text-pulse-ash hover:text-off-white transition-colors">Cancelar</button>
                              ) : (
                                <button onClick={() => { setChangingRespId(r.id); setChangeUserId('') }}
                                  className="text-xs text-electric-teal hover:text-off-white border border-electric-teal/30 px-2 py-0.5 rounded transition-colors">
                                  Alterar
                                </button>
                              )}
                            </div>
                            {changingRespId === r.id ? (
                              <div className="space-y-2">
                                <select value={changeUserId} onChange={e => setChangeUserId(e.target.value)}
                                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                                  <option value="">Selecionar novo responsável...</option>
                                  {users.filter(u => u.departamento_id === r.department_id || u.departamento_id === null).map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name}</option>
                                  ))}
                                </select>
                                <button onClick={() => handleChangeResponsible(r.id)} disabled={!changeUserId || changeLoading}
                                  className="w-full px-3 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
                                  {changeLoading ? 'Alterando...' : 'Confirmar Alteração'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                                <span className="text-off-white">{r.user_name}</span>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-pulse-ash text-sm">Nenhum responsável atribuído.</div>
                      )}

                      <div className="border-t border-urban-smoke pt-4">
                        {showAssign ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs tracking-wider text-pulse-ash mb-1">Departamento</label>
                              <select value={assignDeptId} onChange={e => { setAssignDeptId(e.target.value); setAssignUserId('') }}
                                className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                                <option value="">Selecionar...</option>
                                {departments.filter(d => !detail.responsaveis?.some(r => r.department_id === d.id)).map(d => (
                                  <option key={d.id} value={d.id}>{d.nome}</option>
                                ))}
                              </select>
                            </div>
                            {assignDeptId && (
                              <div>
                                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Usuário</label>
                                <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                                  <option value="">Selecionar...</option>
                                  {users.filter(u => u.departamento_id === parseInt(assignDeptId) || u.departamento_id === null).map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => { setShowAssign(false); setAssignDeptId(''); setAssignUserId('') }}
                                className="flex-1 px-3 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                                Cancelar
                              </button>
                              <button onClick={handleAssignResponsible} disabled={!assignDeptId || !assignUserId || assignLoading}
                                className="flex-1 px-3 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
                                {assignLoading ? 'Atribuindo...' : 'Atribuir'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowAssign(true)}
                            className="w-full px-4 py-2 rounded-lg text-xs tracking-wider border border-electric-teal/30 text-electric-teal hover:bg-electric-teal/10 transition-colors">
                            + Adicionar Responsável
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-pulse-ash text-sm">Erro ao carregar dados do cliente.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 w-[740px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm tracking-wider mb-4">
              {editingId ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>

            {/* Tab Bar */}
            <div className="flex gap-1 border-b border-urban-smoke mb-5">
              {[
                { key: 'empresa', label: 'Empresa' },
                { key: 'contatos', label: 'Contatos' },
                { key: 'particularidades', label: 'Particularidades' },
                { key: 'cnaes', label: 'CNAEs' },
                { key: 'responsaveis', label: 'Responsáveis' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setModalTab(tab.key)}
                  className={`px-4 py-2 text-xs tracking-wider transition-colors border-b-2 -mb-px ${
                    modalTab === tab.key
                      ? 'text-electric-teal border-electric-teal'
                      : 'text-pulse-ash border-transparent hover:text-off-white'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Empresa */}
            {modalTab === 'empresa' && (
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="text-xs tracking-wider text-electric-teal mb-2">Dados Gerais</div>
                  <ModalField label="Razão Social" value={form.name || ''} onChange={v => updateForm('name', v)} placeholder="Nome ou Razão Social" />
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">CNPJ</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formatCNPJ(form.cnpj || '')}
                        onChange={e => { const raw = e.target.value.replace(/\D/g, '').slice(0, 14); updateForm('cnpj', raw) }}
                        placeholder="00.000.000/0000-00"
                        className="flex-1 bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal font-mono"
                      />
                      <button onClick={handleCNPJLookup} disabled={cnpjLoading}
                        className="px-3 py-2 rounded-lg text-xs tracking-wider bg-electric-teal/10 text-electric-teal border border-electric-teal/20 hover:bg-electric-teal/20 transition-colors disabled:opacity-50 shrink-0">
                        {cnpjLoading ? '...' : 'Buscar'}
                      </button>
                    </div>
                  </div>
                  <ModalField label="Nome Fantasia" value={form.nome_fantasia || ''} onChange={v => updateForm('nome_fantasia', v)} placeholder="Nome fantasia" />
                  <div>
                    <label className="block text-xs tracking-wider text-pulse-ash mb-1">Regime Tributário</label>
                    <select value={form.regime || ''} onChange={e => updateForm('regime', e.target.value)}
                      className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white focus:outline-none focus:border-electric-teal">
                      <option value="">Selecionar...</option>
                      {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <ModalField label="Telefone" value={formatPhone(form.telefone || '')} onChange={v => updateForm('telefone', v.replace(/\D/g, '').slice(0, 11))} placeholder="(00) 00000-0000" />
                  <ModalField label="E-mail" value={form.email || ''} onChange={v => updateForm('email', v)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-3">
                  <div className="text-xs tracking-wider text-electric-teal mb-2">Endereço</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2"><ModalField label="CEP" value={form.endereco_cep || ''} onChange={v => updateForm('endereco_cep', v)} placeholder="00000-000" /></div>
                    <ModalField label="UF" value={form.endereco_uf || ''} onChange={v => updateForm('endereco_uf', v)} placeholder="UF" />
                  </div>
                  <ModalField label="Logradouro" value={form.endereco_logradouro || ''} onChange={v => updateForm('endereco_logradouro', v)} placeholder="Rua, Avenida..." />
                  <div className="grid grid-cols-2 gap-2">
                    <ModalField label="Número" value={form.endereco_numero || ''} onChange={v => updateForm('endereco_numero', v)} placeholder="Nº" />
                    <ModalField label="Complemento" value={form.endereco_complemento || ''} onChange={v => updateForm('endereco_complemento', v)} placeholder="Sala, Andar..." />
                  </div>
                  <ModalField label="Bairro" value={form.endereco_bairro || ''} onChange={v => updateForm('endereco_bairro', v)} placeholder="Bairro" />
                  <ModalField label="Cidade" value={form.endereco_cidade || ''} onChange={v => updateForm('endereco_cidade', v)} placeholder="Cidade" />
                </div>
              </div>
            )}

            {/* Tab: Contatos */}
            {modalTab === 'contatos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-pulse-ash">Gerencie os contatos para envio de e-mails e notificações</span>
                  <button onClick={() => setContatos(prev => [...prev, { _temp: true, nome: '', email: '', telefone: '', whatsapp: true, _notify: true, _exclude: [] }])}
                    className="px-3 py-1.5 rounded-lg text-xs tracking-wider bg-electric-teal/10 text-electric-teal border border-electric-teal/20 hover:bg-electric-teal/20 transition-colors">
                    + Contato
                  </button>
                </div>
                {contatos.filter(c => !c._deleted).length === 0 ? (
                  <div className="text-center py-8 text-pulse-ash text-xs">Nenhum contato cadastrado</div>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {contatos.filter(c => !c._deleted).map((ct, idx) => (
                      <div key={idx} className="bg-core-black/50 border border-urban-smoke rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <ModalField label="Nome" value={ct.nome || ''} onChange={v => { const n = [...contatos]; n[contatos.indexOf(ct)].nome = v; setContatos(n) }} placeholder="Nome do contato" />
                            <ModalField label="E-mail" value={ct.email || ''} onChange={v => { const n = [...contatos]; n[contatos.indexOf(ct)].email = v; setContatos(n) }} placeholder="email@exemplo.com" />
                            <ModalField label="Telefone" value={ct.telefone || ''} onChange={v => { const n = [...contatos]; n[contatos.indexOf(ct)].telefone = v; setContatos(n) }} placeholder="(00) 00000-0000" />
                            <div className="flex items-center gap-2 pt-5">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={!!ct.whatsapp} onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)].whatsapp = e.target.checked ? 1 : 0; setContatos(n) }}
                                  className="accent-electric-teal" />
                                <span className="text-xs text-pulse-ash">WhatsApp</span>
                              </label>
                            </div>
                          </div>
                          <button onClick={() => { const n = [...contatos]; const c = n[contatos.indexOf(ct)]; c._deleted = true; setContatos(n) }}
                            className="text-pulse-ash hover:text-danger transition-colors shrink-0 mt-1" title="Remover contato">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                        {ct.email && (
                          <div className="border-t border-urban-smoke pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!ct._notify} onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)]._notify = e.target.checked; if (e.target.checked) n[contatos.indexOf(ct)]._exclude = []; setContatos(n) }}
                                className="accent-electric-teal" />
                              <span className="text-xs text-pulse-ash">Notificar por e-mail</span>
                            </label>
                            {ct._notify && departments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {departments.map((d: any) => (
                                  <label key={d.id} className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" checked={!ct._exclude?.includes(d.id)} onChange={e => {
                                      const n = [...contatos]; const idx = contatos.indexOf(ct); const exc = n[idx]._exclude || []
                                      if (e.target.checked) n[idx]._exclude = exc.filter((x: number) => x !== d.id)
                                      else n[idx]._exclude = [...exc, d.id]
                                      setContatos(n)
                                    }} className="accent-electric-teal" />
                                    <span className="text-xs text-pulse-ash">{d.nome}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Particularidades */}
            {modalTab === 'particularidades' && (
              <div>
                <div className="text-xs text-pulse-ash mb-3">Informações importantes sobre este cliente</div>
                <textarea value={form.observacoes || ''} onChange={e => updateForm('observacoes', e.target.value)}
                  placeholder="Observações, instruções especiais, particularidades do cliente..."
                  className="w-full bg-core-black border-2 border-amber-500/30 focus:border-amber-500 rounded-lg px-4 py-3 text-xs text-off-white placeholder-pulse-ash focus:outline-none min-h-[150px] resize-y" />
                <div className="flex items-center gap-2 mt-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="text-xs text-amber-400">Campos em destaque indicam informações relevantes</span>
                </div>
              </div>
            )}

            {/* Tab: CNAEs */}
            {modalTab === 'cnaes' && (
              <div>
                <div className="text-xs text-pulse-ash mb-3">CNAEs obtidos da consulta do CNPJ</div>
                {(form as any)._cnaes && (form as any)._cnaes.length > 0 ? (
                  <div className="space-y-1">
                    {(form as any)._cnaes.map((c: any, i: number) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${c.principal ? 'bg-electric-teal/10 border border-electric-teal/20' : 'bg-core-black/50 border border-urban-smoke'}`}>
                        <span className="font-mono text-pulse-ash w-16">{c.codigo}</span>
                        <span className={c.principal ? 'text-electric-teal font-medium' : 'text-off-white'}>{c.descricao}</span>
                        {c.principal === 1 && <span className="text-[10px] tracking-wider text-electric-teal ml-auto">Principal</span>}
                      </div>
                    ))}
                  </div>
                ) : form.cnpj?.length === 14 ? (
                  <div className="text-xs text-pulse-ash">Clique em "Buscar" na aba Empresa para consultar os CNAEs.</div>
                ) : (
                  <div className="text-xs text-pulse-ash">Informe um CNPJ para consultar os CNAEs.</div>
                )}
              </div>
            )}
            {modalTab === 'responsaveis' && editingId && (
              <div>
                <div className="text-xs text-pulse-ash mb-3">Atribua um responsável por departamento</div>
                {detail?.responsaveis && detail.responsaveis.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {detail.responsaveis.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-core-black/50 border border-urban-smoke rounded-lg px-3 py-2">
                        <div>
                          <div className="text-xs text-off-white">{r.user_name}</div>
                          <div className="text-[10px] text-pulse-ash">{r.department_name}</div>
                        </div>
                        <button onClick={async () => {
                          if (!confirm(`Remover ${r.user_name} de ${r.department_name}?`)) return
                          const t = getToken(); if (!t || !editingId) return
                          await fetch(`/api/clientes/${editingId}/responsaveis/${r.id}/remover`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
                            body: JSON.stringify({}),
                          })
                          loadDetail(editingId)
                        }} className="text-pulse-ash hover:text-danger text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-pulse-ash mb-4">Nenhum responsável atribuído.</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <select value={assignDeptId} onChange={e => { setAssignDeptId(e.target.value); setAssignUserId('') }}
                    className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white">
                    <option value="">Departamento...</option>
                    {departments.filter(d => !detail?.responsaveis?.some(r => r.department_id === d.id)).map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                  <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} disabled={!assignDeptId}
                    className="bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white disabled:opacity-30">
                    <option value="">Usuário...</option>
                    {assignDeptId && users.filter(u => u.departamento_id === parseInt(assignDeptId) || u.departamento_id === null).map(u => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={async () => {
                  if (!assignDeptId || !assignUserId || !editingId) return
                  setAssignLoading(true)
                  const t = getToken(); if (!t) return
                  await fetch(`/api/clientes/${editingId}/responsaveis`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
                    body: JSON.stringify({ user_id: parseInt(assignUserId), department_id: parseInt(assignDeptId) }),
                  }).catch(() => {})
                  setAssignDeptId(''); setAssignUserId(''); setAssignLoading(false)
                  loadDetail(editingId)
                }} disabled={!assignDeptId || !assignUserId || assignLoading}
                  className="w-full mt-2 px-3 py-2 rounded-lg text-xs tracking-wider bg-electric-teal/20 text-electric-teal hover:bg-electric-teal/30 transition-colors disabled:opacity-30">
                  {assignLoading ? 'Atribuindo...' : 'Atribuir'}
                </button>
              </div>
            )}
            {modalTab === 'responsaveis' && !editingId && (
              <div className="text-center py-6 text-xs text-pulse-ash">Salve o cliente primeiro para atribuir responsáveis.</div>
            )}

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-urban-smoke">
              <button onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-lg text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs tracking-wider text-pulse-ash mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono text-xs' : ''} ${value ? 'text-off-white' : 'text-pulse-ash italic'}`}>
        {value || 'Não informado'}
      </div>
    </div>
  )
}

function ModalField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs tracking-wider text-pulse-ash mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-core-black border border-urban-smoke rounded-lg px-3 py-2 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
      />
    </div>
  )
}
