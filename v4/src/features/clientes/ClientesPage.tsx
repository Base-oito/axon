import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Search, Users, Pencil, X, Save, Upload, Plus, Trash2, Phone, Mail } from 'lucide-react'

interface ClienteRaw {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  active?: boolean
  ativo?: boolean
  certificate_expires_at?: string
  departamento?: string
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
  certificate_path?: string
}

interface Contato {
  id?: number
  nome: string
  email: string
  telefone: string
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

function fmtPhone(t?: string) {
  if (!t) return '-'
  const c = t.replace(/\D/g, '')
  if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return t
}

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Isento']

export default function ClientesPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [contatos, setContatos] = useState<Contato[]>([])
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPass, setCertPass] = useState('')

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const raw = await apiFetch<ClienteRaw[]>('/api/clientes')
      return (raw || []).map(c => ({
        id: c.id,
        nome: c.nome || c.name || `Cliente ${c.id}`,
        cnpj: c.cnpj,
        ativo: c.ativo ?? c.active ?? true,
        certificate_expires_at: c.certificate_expires_at,
        departamento: c.departamento,
      }))
    },
    staleTime: 60_000,
  })

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['cliente', selectedId],
    queryFn: () => apiFetch<ClienteRaw>(`/api/clientes/${selectedId}`),
    enabled: !!selectedId,
  })

  const { data: contatosData } = useQuery({
    queryKey: ['cliente-contatos', selectedId],
    queryFn: () => apiFetch<Contato[]>(`/api/clientes/${selectedId}/contatos`),
    enabled: !!selectedId,
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const t = getToken()
      const r = await fetch(`/api/clientes/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({
          name: form.name, cnpj: form.cnpj, nome_fantasia: form.nome_fantasia,
          regime: form.regime, telefone: form.telefone, email: form.email,
          endereco_cep: form.endereco_cep, endereco_logradouro: form.endereco_logradouro,
          endereco_numero: form.endereco_numero, endereco_complemento: form.endereco_complemento,
          endereco_bairro: form.endereco_bairro, endereco_cidade: form.endereco_cidade,
          endereco_uf: form.endereco_uf, observacoes: form.observacoes || '',
        }),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    },
    onSuccess: () => {
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['clientes'] })
      refetchDetail()
    },
    onError: () => alert('Erro ao salvar cliente'),
  })

  const enviarCertificado = useMutation({
    mutationFn: async () => {
      if (!certFile || !certPass) throw new Error('Selecione arquivo e senha')
      const t = getToken()
      const fd = new FormData()
      fd.append('certificate_file', certFile)
      fd.append('certificate_password', certPass)
      fd.append('client_id', String(selectedId))
      const r = await fetch('/api/upload/certificate', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.detail || 'Erro ao enviar certificado')
      }
      return r.json()
    },
    onSuccess: () => {
      setCertFile(null)
      setCertPass('')
      alert('Certificado enviado com sucesso!')
      refetchDetail()
      qc.invalidateQueries({ queryKey: ['clientes'] })
    },
    onError: (e: any) => alert(e.message || 'Erro ao enviar certificado'),
  })

  const adicionarContato = () => setContatos(prev => [...prev, { nome: '', email: '', telefone: '' }] as any)
  const removerContato = (idx: number) => setContatos(prev => prev.filter((_, i) => i !== idx))

  const salvarContatos = async () => {
    const t = getToken()
    try {
      for (const ct of contatos) {
        const method = ct.id ? 'PUT' : 'POST'
        const url = ct.id ? `/api/clientes/${selectedId}/contatos/${ct.id}` : `/api/clientes/${selectedId}/contatos`
        await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ nome: ct.nome, email: ct.email, telefone: ct.telefone }) })
      }
      alert('Contatos salvos!')
      qc.invalidateQueries({ queryKey: ['cliente-contatos', selectedId] })
    } catch { alert('Erro ao salvar contatos') }
  }

  const openDetail = (c: any) => {
    setSelectedId(c.id)
    setEditing(false)
    setContatos([])
  }

  const startEdit = () => {
    if (!detail) return
    setForm({
      name: detail.name || detail.nome, cnpj: detail.cnpj, nome_fantasia: detail.nome_fantasia,
      regime: detail.regime, telefone: detail.telefone, email: detail.email,
      endereco_cep: detail.endereco_cep, endereco_logradouro: detail.endereco_logradouro,
      endereco_numero: detail.endereco_numero, endereco_complemento: detail.endereco_complemento,
      endereco_bairro: detail.endereco_bairro, endereco_cidade: detail.endereco_cidade,
      endereco_uf: detail.endereco_uf, observacoes: detail.observacoes,
    })
    setContatos((contatosData || []).map(c => ({ id: c.id, nome: c.nome, email: c.email, telefone: c.telefone })))
    setEditing(true)
  }

  const filtered = (clientes || []).filter(c =>
    !q || c.nome.toLowerCase().includes(q.toLowerCase()) || (c.cnpj || '').includes(q))

  const F = ({ label, value }: { label: string; value?: string }) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value || '-'}</p>
    </div>
  )

  const Inp = ({ label, field, placeholder, type }: { label: string; field: string; placeholder?: string; type?: string }) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type || 'text'} value={form[field] || ''} placeholder={placeholder}
        onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  )

  return (
    <div className="flex h-full min-h-[calc(100vh-7rem)] gap-4">
      {/* ── Lista ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {(clientes || []).length} empresas · {(clientes || []).filter(c => c.ativo).length} ativas
            </p>
          </div>
          <button
            onClick={() => alert('Cadastro de novo cliente — em breve.')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Novo cliente
          </button>
        </div>

        <div className="card-soft flex items-center gap-2 rounded-lg bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>

        <div className="card-soft overflow-hidden rounded-lg bg-card">
          {!clientes ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando clientes…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
          ) : (
            <div className="grid gap-px bg-border/40 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(c => (
                <button key={c.id} onClick={() => openDetail(c)}
                  className={`group flex items-center gap-3 bg-card p-4 text-left transition-colors hover:bg-muted/40 ${selectedId === c.id ? 'bg-[#0078d4]/5' : ''}`}>
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Painel lateral ── */}
      {selectedId && (
        <div className="card-soft flex w-[380px] shrink-0 flex-col overflow-hidden rounded-lg bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Cliente</h3>
            <div className="flex items-center gap-1">
              {!editing && (
                <button onClick={startEdit} title="Editar"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setSelectedId(null)} title="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {!editing ? (
              <>
                {/* Cabeçalho */}
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0078d4]/10 text-xl font-bold text-[#0078d4]">
                    {(detail?.name || detail?.nome || '?')[0]?.toUpperCase()}
                  </div>
                  <h4 className="mt-2 text-base font-semibold text-foreground">{detail?.name || detail?.nome}</h4>
                  {detail?.nome_fantasia && <p className="text-xs text-muted-foreground">{detail.nome_fantasia}</p>}
                </div>

                {/* Geral */}
                <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <F label="CNPJ" value={fmtCnpj(detail?.cnpj)} />
                  <F label="Regime Tributário" value={detail?.regime} />
                  <F label="Telefone" value={fmtPhone(detail?.telefone)} />
                  <F label="E-mail" value={detail?.email} />
                  <F label="Status" value={detail?.ativo ? 'Ativo' : 'Inativo'} />
                  <F label="Certificado vence em" value={fmtDate(detail?.certificate_expires_at)} />
                </div>

                {/* Endereço */}
                <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <F label="CEP" value={detail?.endereco_cep} />
                  <F label="Logradouro" value={detail?.endereco_logradouro} />
                  <F label="Número" value={detail?.endereco_numero} />
                  <F label="Complemento" value={detail?.endereco_complemento} />
                  <F label="Bairro" value={detail?.endereco_bairro} />
                  <F label="Cidade / UF" value={detail?.endereco_cidade ? `${detail.endereco_cidade}${detail.endereco_uf ? ' / ' + detail.endereco_uf : ''}` : detail?.endereco_uf} />
                </div>

                {/* Contatos */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contatos</p>
                  <div className="space-y-1.5">
                    {(contatosData || []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato cadastrado.</p>}
                    {(contatosData || []).map(ct => (
                      <div key={ct.id || ct.email} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <p className="text-sm font-medium text-foreground">{ct.nome || '-'}</p>
                        {ct.email && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{ct.email}</p>}
                        {ct.telefone && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{fmtPhone(ct.telefone)}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Certificado */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Certificado digital</p>
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <input type="file" accept=".pfx,.p12" onChange={e => setCertFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-[#0078d4]/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[#0078d4]" />
                    <input type="password" value={certPass} onChange={e => setCertPass(e.target.value)}
                      placeholder="Senha do certificado"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    <button onClick={() => enviarCertificado.mutate()} disabled={!certFile || !certPass || enviarCertificado.isPending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40">
                      <Upload className="h-4 w-4" />
                      {enviarCertificado.isPending ? 'Enviando…' : 'Enviar certificado'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Formulário de edição */}
                <div className="space-y-3">
                  <Inp label="Razão Social" field="name" />
                  <Inp label="Nome Fantasia" field="nome_fantasia" />
                  <Inp label="CNPJ" field="cnpj" />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Regime Tributário</label>
                    <select value={form.regime || ''} onChange={e => setForm((p: any) => ({ ...p, regime: e.target.value }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">Selecione…</option>
                      {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <Inp label="Telefone" field="telefone" placeholder="(00) 00000-0000" />
                  <Inp label="E-mail" field="email" type="email" />
                  <div className="grid grid-cols-2 gap-2">
                    <Inp label="CEP" field="endereco_cep" />
                    <Inp label="UF" field="endereco_uf" />
                  </div>
                  <Inp label="Logradouro" field="endereco_logradouro" />
                  <div className="grid grid-cols-2 gap-2">
                    <Inp label="Número" field="endereco_numero" />
                    <Inp label="Complemento" field="endereco_complemento" />
                  </div>
                  <Inp label="Bairro" field="endereco_bairro" />
                  <Inp label="Cidade" field="endereco_cidade" />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
                    <textarea value={form.observacoes || ''} onChange={e => setForm((p: any) => ({ ...p, observacoes: e.target.value }))} rows={3}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                </div>

                {/* Contatos (edição) */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contatos</p>
                    <button onClick={adicionarContato} className="text-xs font-medium text-[#0078d4] hover:underline">+ Adicionar</button>
                  </div>
                  <div className="space-y-2">
                    {contatos.map((ct, i) => (
                      <div key={i} className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <input value={ct.nome} onChange={e => { const n = [...contatos]; n[i].nome = e.target.value; setContatos(n) }} placeholder="Nome"
                          className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        <input value={ct.email} onChange={e => { const n = [...contatos]; n[i].email = e.target.value; setContatos(n) }} placeholder="E-mail"
                          className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        <div className="flex items-center gap-1.5">
                          <input value={ct.telefone} onChange={e => { const n = [...contatos]; n[i].telefone = e.target.value; setContatos(n) }} placeholder="Telefone"
                            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                          <button onClick={() => removerContato(i)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {contatos.length > 0 && (
                      <button onClick={salvarContatos}
                        className="w-full rounded-lg border border-[#0078d4]/30 py-1.5 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
                        Salvar contatos
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-40">
                    <Save className="h-4 w-4" />
                    Salvar alterações
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
