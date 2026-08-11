import { useClientes } from '../hooks/useClientes'
import type { DashboardFilters } from '../hooks/useEvolucao'

interface FilterBarProps {
  filters: DashboardFilters
  onChange: (f: DashboardFilters) => void
}

function fmtCnpj(v?: string) {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function DashboardFilters({ filters, onChange }: FilterBarProps) {
  const { data: clientes } = useClientes()

  return (
    <div className="card-soft flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa</label>
        <select
          value={filters.cliente_id || ''}
          onChange={e => onChange({ ...filters, cliente_id: e.target.value })}
          className="h-9 min-w-[200px] rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todas as empresas</option>
          {(clientes || []).map(c => (
            <option key={c.id} value={String(c.id)}>
              {c.nome}{c.cnpj ? ` — ${fmtCnpj(c.cnpj)}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
        <input
          type="date"
          value={filters.issued_from || ''}
          onChange={e => onChange({ ...filters, issued_from: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
        <input
          type="date"
          value={filters.issued_to || ''}
          onChange={e => onChange({ ...filters, issued_to: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {(filters.cliente_id || filters.issued_from || filters.issued_to) && (
        <button
          onClick={() => onChange({})}
          className="h-9 rounded-md px-3 text-sm text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
