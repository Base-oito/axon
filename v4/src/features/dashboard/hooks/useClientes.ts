import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Cliente {
  id: number
  nome: string
  cnpj?: string
  ativo?: boolean
}

interface ClienteRaw {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  active?: boolean
  ativo?: boolean
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const raw = await apiFetch<ClienteRaw[]>('/api/clientes')
      return (raw || []).map(c => ({
        id: c.id,
        nome: c.nome || c.name || `Cliente ${c.id}`,
        cnpj: c.cnpj,
        ativo: c.ativo ?? c.active ?? true,
      }))
    },
    staleTime: 10 * 60_000,
  })
}
