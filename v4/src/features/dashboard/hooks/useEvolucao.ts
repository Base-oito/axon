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
}

export function useEvolucao(months = 12) {
  return useQuery({
    queryKey: ['dashboard', 'evolucao', months],
    queryFn: () => apiFetch<EvolucaoData>(`/dashboard/evolucao?months=${months}`),
    staleTime: 5 * 60_000,
  })
}
