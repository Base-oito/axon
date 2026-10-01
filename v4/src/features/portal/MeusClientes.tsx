import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clientFetch } from './PortalLogin'
import { Plus, X, Pencil, Trash2, Loader2, Phone, Mail, Users } from 'lucide-react'

type CrmC = {
  id: number; nome: string; cnpj?: string; email?: string; telefone?: string
  endereco?: string; observacao?: string; a_receber?: number
}

const input = 'h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring'

export default function MeusClientes() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<CrmC | null>(null)
  const [busca, setBusca] = useState('')

  const q = useQuery({
    queryKey: ['cli-crm'],
    queryFn: () => clientFetch<CrmC[]>('/api/client-portal/crm/clientes'),
    staleTime: 30_000,
  })
  const list = (q.data || []).filter((c: CrmC) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Meus clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu CRM: clientes, contatos e valores a receber</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className={input + ' w-52'} />
          <button onClick={() => { setEditando(null); setShowModal(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        </div>
      </div>

      <div className="card-soft rounded-xl bg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Cliente</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">CNPJ/CPF</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Contato</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">A receber</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum cliente cadastrado.</td></tr>
            )}
            {list.map((c: CrmC) => (
              <tr key={c.id} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{c.nome}</p>
                  {c.observacao && <p className="truncate max-w-64 text-xs text-muted-foreground">{c.observacao}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">{c.cnpj || '-'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {c.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.telefone}</span>}
                    {c.email && <span className="flex items-center gap-1 truncate max-w-52"><Mail className="h-3 w-3" /> {c.email}</span>}
                    {!c.telefone && !c.email && <span className="text-muted-foreground">-</span>}
                  </div>
                </td>
                <td className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium ${Number(c.a_receber) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {(Number(c.a_receber) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <button onClick={() => { setEditando(c); setShowModal(true) }} className="p-1 text-muted-foreground hover:text-[#0078d4] rounded"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => excluir(c, qc)} className="p-1 text-muted-foreground hover:text-rose-600 rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {list.length} cliente(s). Use a aba Financeiro → Contas a receber para lançar valores vinculados a cada cliente.
      </div>

      {showModal && (
        <CrmModal
          c={editando}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['cli-crm'] }) }}
        />
      )}
    </div>
  )
}

async function excluir(c: CrmC, qc: any) {
  if (!confirm(`Excluir "${c.nome}"?`)) return
  await clientFetch(`/api/client-portal/crm/clientes/${c.id}`, { method: 'DELETE' })
  qc.invalidateQueries({ queryKey: ['cli-crm'] })
}

function CrmModal({ c, onClose, onSaved }: { c: CrmC | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: c?.nome || '', cnpj: c?.cnpj || '', email: c?.email || '', telefone: c?.telefone || '',
    endereco: c?.endereco || '', observacao: c?.observacao || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [err, setErr] = useState('')
  const f = (k: string) => (e: any) => setForm(x => ({ ...x, [k]: e.target.value }))

  const salvar = async () => {
    if (!form.nome.trim()) { setErr('Informe o nome'); return }
    setSalvando(true); setErr('')
    try {
      await clientFetch(c ? `/api/client-portal/crm/clientes/${c.id}` : '/api/client-portal/crm/clientes', {
        method: c ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao salvar') }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{c ? 'Editar cliente' : 'Novo cliente'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input autoFocus value={form.nome} onChange={f('nome')} placeholder="Nome *" className={input + ' w-full'} />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.cnpj} onChange={f('cnpj')} placeholder="CNPJ/CPF" className={input} />
            <input value={form.telefone} onChange={f('telefone')} placeholder="Telefone" className={input} />
          </div>
          <input value={form.email} onChange={f('email')} placeholder="E-mail" type="email" className={input + ' w-full'} />
          <input value={form.endereco} onChange={f('endereco')} placeholder="Endereço" className={input + ' w-full'} />
          <textarea value={form.observacao} onChange={f('observacao')} placeholder="Observações" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button onClick={salvar} disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85 disabled:opacity-40">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}