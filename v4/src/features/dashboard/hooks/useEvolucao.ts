import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface EvolucaoMes {
  mes: string
  key: string
  nfe_qtd: number
  nfe_valor: number
  nfe_icms: number
  nfse_tomados: number
  nfse_prestados: number
  nfse_valor_tomados: number
  nfse_valor_prestados: number
  obrigacoes: number
}

export interface EvolucaoData {
  months: number
  series: EvolucaoMes[]
  top_emitentes: Array<{ nome: string; qtd: number; valor: number }>
  por_uf: Array<{ uf: string; qtd: number }>
  totais?: {
    nfse_total: number
    nfse_hoje: number
    nfe_total: number
    nfe_hoje: number
  }
}

export interface DashboardFilters {
  cliente_id?: string
  issued_from?: string
  issued_to?: string
}

export function useEvolucao(months = 12, filters: DashboardFilters = {}) {
  const params = new URLSearchParams({ months: String(months) })
  if (filters.cliente_id) params.set('cliente_id', filters.cliente_id)
  if (filters.issued_from) params.set('issued_from', filters.issued_from)
  if (filters.issued_to) params.set('issued_to', filters.issued_to)
  const qs = params.toString()

  return useQuery({
    queryKey: ['dashboard', 'evolucao', qs],
    queryFn: () => apiFetch<EvolucaoData>(`/dashboard/evolucao?${qs}`),
    staleTime: 5 * 60_000,
  })
}
