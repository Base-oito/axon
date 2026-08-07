import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Cliente {
  id: number
  nome: string
  cnpj?: string
  ativo?: boolean
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiFetch<Cliente[]>('/api/clientes'),
    staleTime: 10 * 60_000,
  })
}
