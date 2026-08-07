import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Plus, Search, Users } from 'lucide-react'

interface ClienteRaw {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  active?: boolean
  ativo?: boolean
  certificate_expires_at?: string
  departamento?: string
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

export default function ClientesPage() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({
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

  const filtered = (data || []).filter(c =>
    !q || c.nome.toLowerCase().includes(q.toLowerCase()) || (c.cnpj || '').includes(q))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(data || []).length} empresas · {(data || []).filter(c => c.ativo).length} ativas
          </p>
        </div>
        <button
          onClick={() => alert('Cadastro de cliente — em construção. Use o Axon V3 para cadastrar por enquanto.')}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="card-soft flex items-center gap-2 rounded-lg bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nome ou CNPJ…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {/* Lista */}
      <div className="card-soft overflow-hidden rounded-lg bg-card">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando clientes…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
        ) : (
          <div className="grid gap-px bg-border/40 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-card p-4 transition-colors hover:bg-muted/40">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
