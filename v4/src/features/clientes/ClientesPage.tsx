import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Search, Users, Pencil, X, Plus, Trash2, Phone, Mail, Loader2, Upload, CheckSquare, UserCog } from 'lucide-react'

interface ClienteList {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  ativo?: boolean
  active?: boolean
  status?: string
  certificate_expires_at?: string
  departamento?: string
}

interface ClienteDetail {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  active?: boolean
  ativo?: boolean
  status?: string
  nome_fantasia?: string
  regime?: string
  telefone?: string
  email?: string
  endereco_cep?: string
  endereco_logradouro?: string
  endereco_numero?: string
  endereco_complemento?: string
  endereco_bairro?: string
  endereco_cidade?: string
  endereco_uf?: string
  observacoes?: string
  certificate_expires_at?: string
  download_ativo?: boolean
  download_nfse_tomados?: boolean
  download_nfse_prestados?: boolean
  download_nfe_entrada?: boolean
  responsaveis?: Responsavel[]
}

interface Contato {
  id?: number
  nome: string
  email: string
  telefone: string
  whatsapp?: number
  _temp?: boolean
  _deleted?: boolean
  _notify?: boolean
  _exclude?: number[]
}

interface Responsavel {
  id: number
  user_id: number
  user_name: string
  department_id: number
  department_name: string
}

interface Departamento {
  id: number
  nome: string
}

interface Usuario {
  id: number
  display_name: string
  departamento_id: number | null
}

interface Cnae {
  codigo: string
  descricao: string
  principal: number
}

function fmtCnpj(cnpj?: string) {
  if (!cnpj) return '-'
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function fmtDate(d?: string) {
  if (!d) return '-'
  const s = String(d).replace(/-03:00|T.*/, '')
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR')
}

function statusBadge(status?: string, ativo?: boolean) {
  const st = (status || (ativo ? 'ativa' : 'inativa')).toLowerCase()
  if (st === 'prospect') return { label: 'Prospect', cls: 'bg-sky-50 text-sky-700' }
  if (st === 'lead') return { label: 'Lead', cls: 'bg-violet-50 text-violet-700' }
  if (st === 'ativa') return { label: 'Ativo', cls: 'bg-emerald-50 text-emerald-700' }
  return { label: 'Inativo', cls: 'bg-muted text-muted-foreground' }
}

function fmtPhone(t?: string) {
  if (!t) return '-'
  const c = t.replace(/\D/g, '')
  if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return t
}

function fmtCNPJInput(v: string) {
  const c = (v || '').replace(/\D/g, '').slice(0, 14)
  return c
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1.$2.$3/$4-')
    .replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3/')
    .replace(/^(\d{2})(\d{3})$/, '$1.$2.')
    .replace(/^(\d{2})$/, '$1.')
}

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Isento']

const SHEET_TABS = [
  { key: 'geral', label: 'Geral' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'contatos', label: 'Contatos' },
  { key: 'responsaveis', label: 'Responsáveis' },
  { key: 'portal', label: 'Portal' },
]

const MODAL_TABS = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'contatos', label: 'Contatos' },
  { key: 'particularidades', label: 'Particularidades' },
  { key: 'cnaes', label: 'CNAEs' },
  { key: 'responsaveis', label: 'Responsáveis' },
]

export default function ClientesPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sheetTab, setSheetTab] = useState('geral')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalTab, setModalTab] = useState('empresa')
  const [form, setForm] = useState<Record<string, any>>({})
  const [cnaes, setCnaes] = useState<Cnae[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')

  const [assigning, setAssigning] = useState(false)
  const [assignDeptId, setAssignDeptId] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [changingRespId, setChangingRespId] = useState<number | null>(null)
  const [changeUserId, setChangeUserId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')
  const [bulkErr, setBulkErr] = useState('')

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const raw = await apiFetch<ClienteList[]>('/api/clientes')
      return (raw || []).map(c => ({
        id: c.id,
        nome: c.nome || c.name || `Cliente ${c.id}`,
        cnpj: c.cnpj,
        ativo: c.ativo ?? c.active ?? true,
        certificate_expires_at: c.certificate_expires_at,
        departamento: c.departamento,
        status: c.status || (c.ativo ?? c.active ?? true ? 'ativa' : 'inativa'),
      }))
    },
    staleTime: 60_000,
  })

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['cliente', selectedId],
    queryFn: () => apiFetch<ClienteDetail>(`/api/clientes/${selectedId}`),
    enabled: !!selectedId,
  })

  const { data: contatosData, refetch: refetchContatos } = useQuery({
    queryKey: ['cliente-contatos', selectedId],
    queryFn: () => apiFetch<Contato[]>(`/api/clientes/${selectedId}/contatos`),
    enabled: !!selectedId,
  })

  const { data: departments } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<Departamento[]>('/api/departamentos'),
    staleTime: 5 * 60_000,
  })

  const { data: users } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => apiFetch<Usuario[]>('/api/usuarios?limit=500'),
    staleTime: 5 * 60_000,
  })

  const { data: portalUsers = [], refetch: refetchPortalUsers } = useQuery({
    queryKey: ['portal-users', selectedId],
    queryFn: () => (selectedId ? apiFetch<any[]>('/api/client-portal/admin/clientes/' + selectedId + '/usuarios') : Promise.resolve([])),
    enabled: !!selectedId,
    staleTime: 15_000,
  })

  const openDetail = (id: number) => {
    setSelectedId(id)
    setSheetTab('geral')
    setChangingRespId(null)
    setAssigning(false)
  }

  const openNew = () => {
    setForm({ status: 'ativa' })
    setCnaes([])
    setContatos([])
    setFormMsg('')
    setEditingId(null)
    setModalTab('empresa')
    setShowModal(true)
  }

  const openEdit = async () => {
    if (!selectedId) return
    const d = await apiFetch<ClienteDetail>(`/api/clientes/${selectedId}`).catch(() => null)
    if (!d) { alert('Erro ao carregar dados do cliente'); return }
    setForm({
      name: d.name || d.nome || '',
      cnpj: d.cnpj || '',
      nome_fantasia: d.nome_fantasia || '',
      regime: d.regime || '',
      status: d.status || (d.active ?? d.ativo) ? 'ativa' : 'inativa',
      telefone: d.telefone || '',
      email: d.email || '',
      endereco_cep: d.endereco_cep || '',
      endereco_logradouro: d.endereco_logradouro || '',
      endereco_numero: d.endereco_numero || '',
      endereco_complemento: d.endereco_complemento || '',
      endereco_bairro: d.endereco_bairro || '',
      endereco_cidade: d.endereco_cidade || '',
      endereco_uf: d.endereco_uf || '',
      observacoes: d.observacoes || '',
    })
    setCnaes([])
    setContatos([])
    setFormMsg('')
    try {
      const cts = await apiFetch<Contato[]>('/api/clientes/' + selectedId + '/contatos')
      for (const ct of cts) {
        ct._notify = true
        ct._exclude = []
        try {
          const p = await apiFetch<{ all_depts?: boolean; exclude?: number[] }>(`/api/mail/contatos/${ct.id}/permissoes`)
          ct._notify = p.all_depts ?? true
          ct._exclude = p.exclude || []
        } catch { /* mantém padrão */ }
      }
      setContatos(cts || [])
    } catch { setContatos([]) }
    setEditingId(selectedId)
    setModalTab('empresa')
    setShowModal(true)
  }

  const updateForm = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }))

  const cnpjLookup = async () => {
    const cnpj = (form.cnpj || '').replace(/\D/g, '')
    if (cnpj.length !== 14) { alert('Informe um CNPJ válido com 14 dígitos'); return }
    setCnpjLoading(true)
    try {
      const d = await apiFetch<any>(`/api/buscar-cnpj/${cnpj}`)
      const rawRegime = (d.regime || '').toLowerCase()
      const matched = REGIMES.find(r => r.toLowerCase() === rawRegime) || ''
      setForm(p => ({
        ...p,
        name: d.nome || d.razao_social || p.name || '',
        nome_fantasia: d.nome_fantasia || p.nome_fantasia || '',
        regime: matched,
        endereco_cep: d.cep || p.endereco_cep || '',
        endereco_logradouro: d.logradouro || p.endereco_logradouro || '',
        endereco_numero: d.numero || p.endereco_numero || '',
        endereco_complemento: d.complemento || p.endereco_complemento || '',
        endereco_bairro: d.bairro || p.endereco_bairro || '',
        endereco_cidade: d.municipio || p.endereco_cidade || '',
        endereco_uf: d.uf || p.endereco_uf || '',
        telefone: d.telefone || p.telefone || '',
        email: d.email || p.email || '',
      }))
      setCnaes(d.cnaes || [])
      if (d.eh_filial) {
        const c = String(d.cnpj_consultado || '').replace(/\D/g, '')
        const fmt = c.length === 14 ? `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}` : c
        alert(`CNPJ informado é uma filial e não foi localizado na consulta pública.\n\nPreenchemos os dados usando a MATRIZ (${fmt || c}). Confira e ajuste o endereço/telefone da filial antes de salvar.`)
      }
    } catch (e: any) {
      const msg = e?.message || ''
      const detail = (e?.detail || e?.responseDetail || '')
      alert(detail ? `Erro na consulta: ${detail}` : (msg && msg.includes('HTTP') ? 'CNPJ não encontrado ou serviço indisponível. Tente novamente em alguns segundos.' : 'CNPJ não encontrado ou erro na consulta'))
    }
    setCnpjLoading(false)
  }

  const saveContatos = async (clientId: number) => {
    const t = getToken()
    if (!t) return
    const depts = departments || []
    for (const ct of contatos) {
      if (ct._deleted) {
        if (ct.id && !ct._temp) {
          await fetch(`/api/clientes/${clientId}/contatos/${ct.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
        }
        continue
      }
      const payload = JSON.stringify({ nome: ct.nome, email: ct.email, telefone: ct.telefone, whatsapp: ct.whatsapp ? 1 : 0 })
      let cid: number | undefined = ct.id
      if (ct._temp) {
        const r = await fetch(`/api/clientes/${clientId}/contatos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: payload })
        const dd = await r.json().catch(() => ({}))
        cid = dd.id
      } else if (cid) {
        await fetch(`/api/clientes/${clientId}/contatos/${cid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: payload })
      }
      if (cid) {
        await fetch(`/api/mail/contatos/${cid}/permissoes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify({
            all_depts: !!ct._notify,
            exclude: ct._notify ? (ct._exclude || []) : depts.map(dd => dd.id),
          }),
        })
      }
    }
  }

  const handleSave = async () => {
    const t = getToken()
    if (!t) return
    if (!form.name?.trim()) { alert('Nome/Razão Social é obrigatório'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        cnpj: form.cnpj,
        nome_fantasia: form.nome_fantasia || '',
        regime: form.regime || '',
        status: form.status || 'ativa',
        telefone: form.telefone || '',
        email: form.email || '',
        endereco_cep: form.endereco_cep || '',
        endereco_logradouro: form.endereco_logradouro || '',
        endereco_numero: form.endereco_numero || '',
        endereco_complemento: form.endereco_complemento || '',
        endereco_bairro: form.endereco_bairro || '',
        endereco_cidade: form.endereco_cidade || '',
        endereco_uf: form.endereco_uf || '',
        observacoes: form.observacoes || '',
      }
      let clientId: number
      if (editingId) {
        const r = await fetch(`/api/clientes/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        if (!r.ok) throw new Error('HTTP ' + r.status)
        clientId = editingId
      } else {
        const r = await fetch('/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
        const dd = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(dd.detail || 'HTTP ' + r.status)
        clientId = dd.id
      }
      await saveContatos(clientId)
      setShowModal(false)
      qc.invalidateQueries({ queryKey: ['clientes'] })
      if (editingId) {
        refetchDetail()
        refetchContatos()
      }
      setFormMsg('')
    } catch (e: unknown) {
      setFormMsg('Erro ao salvar cliente: ' + (e instanceof Error ? e.message : 'tente novamente'))
    }
    setSaving(false)
  }

  const toggleActive = async (id: number, active: boolean) => {
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ active }) })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      refetchDetail()
    } catch { alert('Erro ao alterar status') }
  }

  const [dlSaving, setDlSaving] = useState(false)
  const updateDownloadConfig = async (id: number, patch: Record<string, boolean>) => {
    const t = getToken()
    if (!t || !id) return
    setDlSaving(true)
    try {
      await fetch(`/api/clientes/${id}/download-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(patch),
      })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      refetchDetail()
    } catch {
      alert('Erro ao salvar preferências de download')
    } finally {
      setDlSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('EXCLUIR PERMANENTEMENTE? Esta ação não pode ser desfeita!')) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${id}?permanente=true`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
      setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['clientes'] })
    } catch { alert('Erro ao excluir cliente') }
  }

  const assignResponsavel = async () => {
    if (!assignDeptId || !assignUserId || !selectedId) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${selectedId}/responsaveis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ user_id: parseInt(assignUserId), department_id: parseInt(assignDeptId) }),
      })
      setAssigning(false)
      setAssignDeptId('')
      setAssignUserId('')
      refetchDetail()
    } catch { alert('Erro ao atribuir responsável') }
  }

  const assignBulk = async () => {
    if (!assignDeptId || !assignUserId) return
    setBulkAssigning(true)
    setBulkErr('')
    setBulkMsg('')
    const t = getToken()
    if (!t) { setBulkAssigning(false); return }
    try {
      const r = await fetch('/api/clientes/responsaveis/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({
          cliente_ids: Array.from(selectedIds),
          user_id: parseInt(assignUserId),
          department_id: parseInt(assignDeptId),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`)
      setBulkMsg(`${d.aplicados || selectedIds.size} cliente(s) atribuído(s) com sucesso`)
      setSelectedIds(new Set())
      setShowBulkModal(false)
      setAssignDeptId('')
      setAssignUserId('')
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['cliente'] })
    } catch (e) {
      setBulkErr(e instanceof Error ? e.message : 'Erro ao atribuir responsável')
    }
    setBulkAssigning(false)
  }

  const changeResponsavel = async (respId: number) => {
    if (!changeUserId || !selectedId) return
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/clientes/${selectedId}/responsaveis/${respId}/remover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ new_user_id: parseInt(changeUserId) }),
      })
      setChangingRespId(null)
      setChangeUserId('')
      refetchDetail()
    } catch { alert('Erro ao alterar responsável') }
  }

  const removeResponsavel = async (r: Responsavel) => {
    if (!confirm('Remover ' + r.user_name + ' de ' + r.department_name + '?')) return
    const t = getToken()
    if (!t || !selectedId) return
    try {
      await fetch(`/api/clientes/${selectedId}/responsaveis/${r.id}/remover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({}),
      })
      refetchDetail()
    } catch { alert('Erro ao remover responsável') }
  }

  const filtered = (clientes || []).filter(c => {
    if (!q) return true
    const busca = q.trim().toLowerCase()
    const nome = (c.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const buscaNorm = busca.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const cnpjBusca = busca.replace(/\D/g, '')
    return nome.includes(buscaNorm) || (cnpjBusca && (c.cnpj || '').includes(cnpjBusca))
  })

  const F = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value || '-'}</p>
    </div>
  )

  const Inp = ({ label, field, placeholder, type }: { label: string; field: string; placeholder?: string; type?: string }) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type || 'text'} value={form[field] || ''} placeholder={placeholder}
        onChange={e => updateForm(field, e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  )

  const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (<div className="flex h-full min-h-[calc(100dvh-7rem)] flex-col gap-4 md:flex-row">
      {/* ── Lista ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {(clientes || []).length} empresas · {(clientes || []).filter(c => c.ativo).length} ativas
            </p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Novo cliente
          </button>
        </div>

        <div className="card-soft flex items-center gap-2 rounded-lg bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ…"
            name="busca-clientes" autoComplete="off"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>

        {/* Seleção em lote */}
        {selectedIds.size > 0 ? (
          <div className="card-soft flex flex-wrap items-center gap-3 rounded-lg border border-[#0078d4]/40 bg-[#0078d4]/5 px-4 py-3">
            <div className="text-sm font-medium text-[#0078d4]">
              <CheckSquare className="mr-1.5 inline h-4 w-4" />
              {selectedIds.size} selecionado(s)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/80">
                <UserCog className="h-4 w-4" />
                Atribuir responsável
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
                Limpar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            <button
              onClick={() => setSelectedIds(new Set(filtered.map(c => c.id)))}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <CheckSquare className="h-4 w-4" />
              Selecionar todos
            </button>
          </div>
        )}

        <div className="card-soft flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-card">
          {!clientes ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando clientes…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
          ) : (
            <div className="grid gap-px overflow-y-auto bg-border/40 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(c => (
                <div key={c.id}
                  onClick={() => openDetail(c.id)}
                  className={`group flex cursor-pointer items-center gap-3 bg-card p-4 text-left transition-colors hover:bg-muted/40 ${selectedId === c.id ? 'bg-[#0078d4]/5' : ''} ${selectedIds.has(c.id) ? 'ring-1 ring-inset ring-[#0078d4]/60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const next = new Set(selectedIds)
                      if (e.target.checked) next.add(c.id)
                      else next.delete(c.id)
                      setSelectedIds(next)
                    }}
                    className="h-4 w-4 shrink-0 rounded accent-[#0078d4]"
                  />
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0078d4]/10">
                    <Users className="h-5 w-5 text-[#0078d4]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{fmtCnpj(c.cnpj)}</p>
                    {c.certificate_expires_at && (
                      <p className={`mt-0.5 text-xs ${c.certificate_expires_at < new Date().toISOString().slice(0, 10) ? 'text-rose-600' : 'text-muted-foreground'}`}>
                        Certificado: {fmtDate(c.certificate_expires_at)}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(c.status, c.ativo).cls}`}>
                    {statusBadge(c.status, c.ativo).label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Painel lateral ── */}
      {selectedId && (
        <div className="card-soft flex w-full shrink-0 flex-col overflow-hidden rounded-lg bg-card sm:w-[400px]">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="truncate text-sm font-semibold text-foreground">{detail?.name || detail?.nome || 'Cliente'}</h3>
            <div className="flex items-center gap-1">
              <button onClick={openEdit} title="Editar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => setSelectedId(null)} title="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex shrink-0 border-b border-border/60">
            {SHEET_TABS.map(t => (
              <button key={t.key} onClick={() => setSheetTab(t.key)}
                className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors ${sheetTab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {sheetTab === 'geral' && (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0078d4]/10 text-xl font-bold text-[#0078d4]">
                    {(detail?.name || detail?.nome || '?')[0]?.toUpperCase()}
                  </div>
                  <h4 className="mt-2 text-base font-semibold text-foreground">{detail?.name || detail?.nome}</h4>
                  {detail?.nome_fantasia && <p className="text-xs text-muted-foreground">{detail.nome_fantasia}</p>}
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(detail?.status, detail?.active ?? detail?.ativo).cls}`}>
                    {statusBadge(detail?.status, detail?.active ?? detail?.ativo).label}
                  </span>
                </div>

                <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <F label="CNPJ" value={fmtCnpj(detail?.cnpj)} />
                  <F label="Regime Tributário" value={detail?.regime} />
                  <F label="Telefone" value={fmtPhone(detail?.telefone)} />
                  <F label="E-mail" value={detail?.email} />
                  <F label="Certificado vence em" value={fmtDate(detail?.certificate_expires_at)} />
                  {detail?.observacoes && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Particularidades</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-amber-800">{detail.observacoes}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(detail!.id, !(detail?.active ?? detail?.ativo ?? true))}
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                      {(detail?.active ?? detail?.ativo) ? 'Inativar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleDelete(detail!.id)}
                      className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50">
                      Excluir
                    </button>
                  </div>
                  <button onClick={openEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar cliente
                  </button>
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Certificado digital</p>
                  <CertificadoForm clienteId={detail?.id} />
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Captura de notas</p>
                    {dlSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Escolha quais notas este cliente deve buscar automaticamente.
                  </p>
                  <label className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                    <span className="text-xs font-medium text-foreground">Baixar notas deste cliente</span>
                    <input
                      type="checkbox"
                      checked={detail?.download_ativo ?? true}
                      onChange={e => updateDownloadConfig(detail!.id, { download_ativo: e.target.checked })}
                      className="h-4 w-4 accent-[#0078d4]"
                    />
                  </label>
                  <div className={detail?.download_ativo === false ? 'pointer-events-none opacity-40' : ''}>
                    <label className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                      <span className="text-xs font-medium text-foreground">NF-e de entrada</span>
                      <input
                        type="checkbox"
                        checked={detail?.download_nfe_entrada ?? true}
                        onChange={e => updateDownloadConfig(detail!.id, { download_nfe_entrada: e.target.checked })}
                        className="h-4 w-4 accent-[#0078d4]"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                      <span className="text-xs font-medium text-foreground">NFS-e prestadas</span>
                      <input
                        type="checkbox"
                        checked={detail?.download_nfse_prestados ?? true}
                        onChange={e => updateDownloadConfig(detail!.id, { download_nfse_prestados: e.target.checked })}
                        className="h-4 w-4 accent-[#0078d4]"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                      <span className="text-xs font-medium text-foreground">NFS-e tomadas</span>
                      <input
                        type="checkbox"
                        checked={detail?.download_nfse_tomados ?? true}
                        onChange={e => updateDownloadConfig(detail!.id, { download_nfse_tomados: e.target.checked })}
                        className="h-4 w-4 accent-[#0078d4]"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {sheetTab === 'endereco' && (
              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <F label="CEP" value={detail?.endereco_cep} />
                  <F label="UF" value={detail?.endereco_uf} />
                </div>
                <F label="Logradouro" value={detail?.endereco_logradouro} />
                <div className="grid grid-cols-2 gap-2.5">
                  <F label="Número" value={detail?.endereco_numero} />
                  <F label="Complemento" value={detail?.endereco_complemento} />
                </div>
                <F label="Bairro" value={detail?.endereco_bairro} />
                <F label="Cidade" value={detail?.endereco_cidade} />
              </div>
            )}

            {sheetTab === 'contatos' && (
              <div className="space-y-2">
                {(contatosData || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nenhum contato cadastrado.</p>
                ) : (
                  (contatosData || []).map(ct => (
                    <div key={ct.id || ct.email} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-sm font-medium text-foreground">{ct.nome || '-'}</p>
                      {ct.email && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{ct.email}</p>}
                      {ct.telefone && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{fmtPhone(ct.telefone)}</p>}
                    </div>
                  ))
                )}
                <button onClick={openEdit}
                  className="w-full rounded-lg border border-primary/30 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                  Gerenciar contatos
                </button>
              </div>
            )}

            {sheetTab === 'responsaveis' && (
              <div className="space-y-3">
                {(detail?.responsaveis || []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Nenhum responsável atribuído.</p>
                ) : (
                  (detail?.responsaveis || []).map(r => (
                    <div key={r.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-primary">{r.department_name}</p>
                        {changingRespId === r.id ? (
                          <button onClick={() => setChangingRespId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                        ) : (
                          <button onClick={() => { setChangingRespId(r.id); setChangeUserId('') }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                            Alterar
                          </button>
                        )}
                      </div>
                      {changingRespId === r.id ? (
                        <div className="mt-2 space-y-2">
                          <select value={changeUserId} onChange={e => setChangeUserId(e.target.value)} className={selectCls}>
                            <option value="">Selecionar novo responsável…</option>
                            {(users || []).filter(u => u.departamento_id === r.department_id || u.departamento_id === null).map(u => (
                              <option key={u.id} value={u.id}>{u.display_name}</option>
                            ))}
                          </select>
                          <button onClick={() => changeResponsavel(r.id)} disabled={!changeUserId}
                            className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
                            Confirmar alteração
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <p className="text-sm text-foreground">{r.user_name}</p>
                          <button onClick={() => removeResponsavel(r)} title="Remover"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <div className="border-t border-border/60 pt-3">
                  {assigning ? (
                    <div className="space-y-2">
                      <select value={assignDeptId} onChange={e => { setAssignDeptId(e.target.value); setAssignUserId('') }} className={selectCls}>
                        <option value="">Departamento…</option>
                        {(departments || []).filter(d => !(detail?.responsaveis || []).some(r => r.department_id === d.id)).map(d => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                      </select>
                      <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} disabled={!assignDeptId} className={selectCls}>
                        <option value="">Usuário…</option>
                        {assignDeptId && (users || []).filter(u => u.departamento_id === parseInt(assignDeptId) || u.departamento_id === null).map(u => (
                          <option key={u.id} value={u.id}>{u.display_name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => { setAssigning(false); setAssignDeptId(''); setAssignUserId('') }}
                          className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                          Cancelar
                        </button>
                        <button onClick={assignResponsavel} disabled={!assignDeptId || !assignUserId}
                          className="flex-1 rounded-lg border border-primary/30 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40">
                          Atribuir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAssigning(true)}
                      className="w-full rounded-lg border border-primary/30 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                      + Adicionar responsável
                    </button>
                  )}
                </div>
              </div>
            )}
            {sheetTab === 'portal' && (
              <PortalAcessoTab
                clienteId={selectedId}
                users={portalUsers}
                onRefresh={refetchPortalUsers}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Modal Novo/Editar ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-[760px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <h3 className="text-sm font-semibold text-foreground">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={() => setShowModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex shrink-0 gap-1 border-b border-border/60 px-6">
              {MODAL_TABS.map(t => (
                <button key={t.key} onClick={() => setModalTab(t.key)}
                  className={`border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${modalTab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'} ${t.key === 'responsaveis' && !editingId ? 'cursor-not-allowed opacity-40' : ''}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Empresa */}
              {modalTab === 'empresa' && (
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dados gerais</p>
                    <Inp label="Razão Social" field="name" placeholder="Nome ou razão social" />
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">CNPJ</label>
                      <div className="flex items-center gap-2">
                        <input value={fmtCNPJInput(form.cnpj || '')}
                          onChange={e => updateForm('cnpj', e.target.value.replace(/\D/g, '').slice(0, 14))}
                          placeholder="00.000.000/0000-00" autoComplete="off"
                          className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                        <button onClick={cnpjLookup} disabled={cnpjLoading || (form.cnpj || '').replace(/\D/g, '').length !== 14}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/30 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40">
                          {cnpjLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {cnpjLoading ? '...' : 'Buscar'}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Consulta automática via Brasil API (CNAEs e regime tributário)</p>
                    </div>
                    <Inp label="Nome Fantasia" field="nome_fantasia" placeholder="Nome fantasia" />
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Regime Tributário</label>
                      <select value={form.regime || ''} onChange={e => updateForm('regime', e.target.value)} className={selectCls}>
                        <option value="">Selecione…</option>
                        {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                      <select value={form.status || 'ativa'} onChange={e => updateForm('status', e.target.value)} className={selectCls}>
                        <option value="ativa">Ativa</option>
                        <option value="inativa">Inativa</option>
                        <option value="prospect">Prospect</option>
                        <option value="lead">Lead</option>
                      </select>
                    </div>
                    <Inp label="Telefone" field="telefone" placeholder="(00) 00000-0000" />
                    <Inp label="E-mail" field="email" type="email" placeholder="email@exemplo.com" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Endereço</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2"><Inp label="CEP" field="endereco_cep" placeholder="00000-000" /></div>
                      <Inp label="UF" field="endereco_uf" placeholder="UF" />
                    </div>
                    <Inp label="Logradouro" field="endereco_logradouro" placeholder="Rua, avenida…" />
                    <div className="grid grid-cols-2 gap-2">
                      <Inp label="Número" field="endereco_numero" placeholder="Nº" />
                      <Inp label="Complemento" field="endereco_complemento" placeholder="Sala, andar…" />
                    </div>
                    <Inp label="Bairro" field="endereco_bairro" placeholder="Bairro" />
                    <Inp label="Cidade" field="endereco_cidade" placeholder="Cidade" />
                  </div>
                </div>
              )}

              {/* Contatos */}
              {modalTab === 'contatos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Gerencie os contatos para envio de e-mails e notificações</p>
                    <button
                      onClick={() => setContatos(prev => [...prev, { nome: '', email: '', telefone: '', whatsapp: 1, _temp: true, _notify: true, _exclude: [] }])}
                      className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                      + Contato
                    </button>
                  </div>
                  {contatos.filter(c => !c._deleted).length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">Nenhum contato cadastrado</p>
                  ) : (
                    <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                      {contatos.filter(c => !c._deleted).map((ct, idx) => (
                        <div key={idx} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                              <input value={ct.nome} onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)].nome = e.target.value; setContatos(n) }} placeholder="Nome"
                                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">E-mail</label>
                              <input value={ct.email} onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)].email = e.target.value; setContatos(n) }} placeholder="email@exemplo.com"
                                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Telefone</label>
                              <input value={ct.telefone} onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)].telefone = e.target.value; setContatos(n) }} placeholder="(00) 00000-0000"
                                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                            </div>
                            <div className="flex items-end justify-between gap-2">
                              <label className="flex items-center gap-1.5 pb-2">
                                <input type="checkbox" checked={!!ct.whatsapp}
                                  onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)].whatsapp = e.target.checked ? 1 : 0; setContatos(n) }}
                                  className="h-3.5 w-3.5 rounded border-input accent-primary" />
                                <span className="text-xs text-muted-foreground">WhatsApp</span>
                              </label>
                              <button onClick={() => { const n = [...contatos]; const cc = n[contatos.indexOf(ct)]; cc._deleted = true; setContatos(n) }}
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600" title="Remover contato">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {ct.email && (
                            <div className="border-t border-border/60 pt-2">
                              <label className="flex cursor-pointer items-center gap-2">
                                <input type="checkbox" checked={!!ct._notify}
                                  onChange={e => { const n = [...contatos]; n[contatos.indexOf(ct)]._notify = e.target.checked; if (e.target.checked) n[contatos.indexOf(ct)]._exclude = []; setContatos(n) }}
                                  className="h-3.5 w-3.5 rounded border-input accent-primary" />
                                <span className="text-xs text-muted-foreground">Notificar por e-mail</span>
                              </label>
                              {ct._notify && (departments || []).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                                  {(departments || []).map(d => (
                                    <label key={d.id} className="flex cursor-pointer items-center gap-1.5">
                                      <input type="checkbox" checked={!ct._exclude?.includes(d.id)}
                                        onChange={e => {
                                          const n = [...contatos]; const i = contatos.indexOf(ct); const exc = n[i]._exclude || []
                                          if (e.target.checked) n[i]._exclude = exc.filter(x => x !== d.id)
                                          else n[i]._exclude = [...exc, d.id]
                                          setContatos(n)
                                        }}
                                        className="h-3.5 w-3.5 rounded border-input accent-primary" />
                                      <span className="text-xs text-muted-foreground">{d.nome}</span>
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

              {/* Particularidades */}
              {modalTab === 'particularidades' && (
                <div>
                  <p className="mb-3 text-xs text-muted-foreground">Informações importantes sobre este cliente</p>
                  <textarea value={form.observacoes || ''} onChange={e => updateForm('observacoes', e.target.value)}
                    placeholder="Observações, instruções especiais, particularidades do cliente…"
                    className="min-h-[150px] w-full resize-y rounded-md border-2 border-amber-500/30 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none" />
                  <p className="mt-2 text-xs text-amber-600">Campos em destaque indicam informações relevantes</p>
                </div>
              )}

              {/* CNAEs */}
              {modalTab === 'cnaes' && (
                <div>
                  <p className="mb-3 text-xs text-muted-foreground">CNAEs obtidos da consulta do CNPJ</p>
                  {cnaes.length > 0 ? (
                    <div className="space-y-1">
                      {cnaes.map((c, i) => (
                        <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${c.principal ? 'border border-primary/30 bg-primary/5' : 'border border-border/60 bg-muted/20'}`}>
                          <span className="w-16 font-mono text-muted-foreground">{c.codigo}</span>
                          <span className={c.principal ? 'font-medium text-primary' : 'text-foreground'}>{c.descricao}</span>
                          {c.principal === 1 && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-primary">Principal</span>}
                        </div>
                      ))}
                    </div>
                  ) : (form.cnpj || '').replace(/\D/g, '').length === 14 ? (
                    <p className="text-xs text-muted-foreground">Clique em "Buscar" na aba Empresa para consultar os CNAEs.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Informe um CNPJ para consultar os CNAEs.</p>
                  )}
                </div>
              )}

              {/* Responsáveis (somente edição) */}
              {modalTab === 'responsaveis' && editingId && (
                <div>
                  <p className="mb-3 text-xs text-muted-foreground">Atribua um responsável por departamento</p>
                  {(detail?.responsaveis || []).length > 0 ? (
                    <div className="mb-4 space-y-2">
                      {(detail?.responsaveis || []).map(r => (
                        <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                          <div>
                            <p className="text-xs font-medium text-foreground">{r.user_name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.department_name}</p>
                          </div>
                          <button onClick={() => removeResponsavel(r)} className="text-xs text-muted-foreground transition-colors hover:text-rose-600">✕</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-4 py-3 text-center text-xs text-muted-foreground">Nenhum responsável atribuído.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <select value={assignDeptId} onChange={e => { setAssignDeptId(e.target.value); setAssignUserId('') }} className={selectCls}>
                      <option value="">Departamento…</option>
                      {(departments || []).filter(d => !(detail?.responsaveis || []).some(r => r.department_id === d.id)).map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} disabled={!assignDeptId} className={selectCls}>
                      <option value="">Usuário…</option>
                      {assignDeptId && (users || []).filter(u => u.departamento_id === parseInt(assignDeptId) || u.departamento_id === null).map(u => (
                        <option key={u.id} value={u.id}>{u.display_name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={assignResponsavel} disabled={!assignDeptId || !assignUserId}
                    className="mt-2 w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40">
                    Atribuir
                  </button>
                </div>
              )}
              {modalTab === 'responsaveis' && !editingId && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Salve o cliente primeiro para atribuir responsáveis — por padrão, os líderes de cada departamento são indicados automaticamente.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
              <p className="min-w-0 truncate text-xs text-rose-600">{formMsg}</p>
              <div className="flex shrink-0 gap-3">
                <button onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40">
                  {saving ? 'Salvando…' : editingId ? 'Atualizar' : 'Criar Cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Atribuir responsável (em lote) ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !bulkAssigning && setShowBulkModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <h3 className="text-sm font-semibold text-foreground">Atribuir responsável</h3>
              <button onClick={() => setShowBulkModal(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-xs text-muted-foreground">
                Os <b>{selectedIds.size}</b> cliente(s) selecionado(s) ficarão sob responsabilidade do colaborador no departamento escolhido.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Departamento</label>
                <select value={assignDeptId} onChange={e => { setAssignDeptId(e.target.value); setAssignUserId('') }} className={selectCls}>
                  <option value="">Selecione…</option>
                  {(departments || []).map((d: Departamento) => (
                    <option key={d.id} value={String(d.id)}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</label>
                <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} disabled={!assignDeptId} className={selectCls}>
                  <option value="">Selecione…</option>
                  {assignDeptId && (users || []).filter(u => u.departamento_id === parseInt(assignDeptId) || u.departamento_id === null).map((u: Usuario) => (
                    <option key={u.id} value={String(u.id)}>{u.display_name}</option>
                  ))}
                </select>
              </div>
              {bulkErr && <div className="text-xs text-rose-600">{bulkErr}</div>}
              {bulkMsg && <div className="text-xs text-emerald-600">{bulkMsg}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
              <button onClick={() => setShowBulkModal(false)} disabled={bulkAssigning}
                className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={assignBulk}
                disabled={bulkAssigning || !assignDeptId || !assignUserId}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40">
                {bulkAssigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {bulkAssigning ? 'Atribuindo…' : 'Atribuir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const GRUPOS_PORTAL = [
  { slug: 'fiscal', label: 'Fiscal' },
  { slug: 'contabil', label: 'Contábil' },
  { slug: 'rh', label: 'RH / DP' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'outros', label: 'Outros' },
]

function PortalAcessoTab({ clienteId, users, onRefresh }: {
  clienteId: number
  users: any[]
  onRefresh: () => void
}) {
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [acessos, setAcessos] = useState<string[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [editarAcessos, setEditarAcessos] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const req = async (method: string, url: string, body?: any) => {
    const t = getToken()
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`)
    return d
  }

  const salvarNovo = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const d = await req('POST', `/api/client-portal/admin/clientes/${clienteId}/usuarios`, {
        nome, email, senha: senha || undefined, tipos_acesso: acessos.length ? acessos : null,
      })
      setMsg(`Usuário criado! Senha temporária: ${d.senha_temporaria}`)
      setNovo(false); setNome(''); setEmail(''); setSenha(''); setAcessos([])
      onRefresh()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao criar') }
    setBusy(false)
  }

  const alternarAtivo = async (u: any) => {
    try { await req('PUT', `/api/client-portal/admin/clientes/${clienteId}/usuarios/${u.id}`, { ativo: !u.ativo }); onRefresh() } catch {}
  }
  const resetarSenha = async (u: any) => {
    const nova = prompt('Nova senha temporária para ' + u.nome + ':')
    if (!nova) return
    try { await req('PUT', `/api/client-portal/admin/clientes/${clienteId}/usuarios/${u.id}`, { senha: nova }); setMsg('Senha redefinida') } catch (e) { setErr(e instanceof Error ? e.message : 'erro') }
  }
  const salvarAcessos = async () => {
    if (editId == null) return
    try { await req('PUT', `/api/client-portal/admin/clientes/${clienteId}/usuarios/${editId}`, { tipos_acesso: editarAcessos.length ? editarAcessos : null }); setEditId(null); onRefresh() } catch (e) { setErr(e instanceof Error ? e.message : 'erro') }
  }

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Acessos ao portal</h3>
          <p className="text-[11px] text-muted-foreground">Quem acessa e quais documentos vê</p>
        </div>
        <button onClick={() => { setNovo(true); setErr(''); setMsg('') }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Novo acesso
        </button>
      </div>

      {msg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</div>}
      {err && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}

      {/* Form novo */}
      {novo && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do usuário" className={inputCls} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail (login do portal)" className={inputCls} />
          <input value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha (deixe vazio p/ gerar automática)" className={inputCls} />
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Acesso a quais documentos?</p>
            <div className="flex flex-wrap gap-1.5">
              {GRUPOS_PORTAL.map(g => (
                <button key={g.slug} onClick={() => toggle(acessos, g.slug, setAcessos)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${acessos.includes(g.slug) ? 'bg-[#0078d4] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Vazio = acesso total.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={salvarNovo} disabled={busy || !nome.trim() || !email.trim()}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
              {busy ? 'Salvando…' : 'Criar usuário'}
            </button>
            <button onClick={() => setNovo(false)} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          Nenhum usuário do portal para este cliente.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const temas = (() => { try { const v = JSON.parse(u.tipos_acesso || 'null'); return Array.isArray(v) ? v : null } catch { return null } })()
            return (
              <div key={u.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{u.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="mt-2">
                  {editId === u.id ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Acesso a quais documentos?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {GRUPOS_PORTAL.map(g => (
                          <button key={g.slug} onClick={() => toggle(editarAcessos, g.slug, setEditarAcessos)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${editarAcessos.includes(g.slug) ? 'bg-[#0078d4] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                            {g.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={salvarAcessos} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Salvar acessos</button>
                        <button onClick={() => setEditId(null)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {temas === null ? <span className="font-medium text-emerald-600">Acesso total</span> : `Acesso: ${temas.map(t => GRUPOS_PORTAL.find(g => g.slug === t)?.label || t).join(', ')}`}
                    </p>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => { setEditId(u.id); setEditarAcessos(temas || []) }} className="rounded border border-[#0078d4]/30 px-2 py-1 text-[11px] text-[#0078d4] hover:bg-[#0078d4]/10">Editar acessos</button>
                  <button onClick={() => resetarSenha(u)} className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">Redefinir senha</button>
                  <button onClick={() => alternarAtivo(u)} className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                    {u.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CertificadoForm({ clienteId }: { clienteId?: number }) {
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPass, setCertPass] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const enviar = async () => {
    if (!certFile || !certPass || !clienteId) return
    setSending(true)
    setMsg('')
    const t = getToken()
    if (!t) return
    try {
      const fd = new FormData()
      fd.append('certificate_file', certFile)
      fd.append('certificate_password', certPass)
      fd.append('client_id', String(clienteId))
      const r = await fetch('/api/upload/certificate', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Erro ao enviar certificado')
      setCertFile(null)
      setCertPass('')
      setMsg('Certificado enviado com sucesso!')
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao enviar certificado')
    }
    setSending(false)
  }

  return (
    <div className="space-y-2">
      <input type="file" accept=".pfx,.p12" onChange={e => setCertFile(e.target.files?.[0] || null)}
        className="w-full text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-[#0078d4]/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[#0078d4]" />
      <input type="password" value={certPass} onChange={e => setCertPass(e.target.value)}
        placeholder="Senha do certificado" autoComplete="new-password"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      <button onClick={enviar} disabled={!certFile || !certPass || sending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40">
        <Upload className="h-4 w-4" />
        {sending ? 'Enviando…' : 'Enviar certificado'}
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}