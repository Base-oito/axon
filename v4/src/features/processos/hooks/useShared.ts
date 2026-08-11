import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface ClienteOpt {
  id: number
  name?: string
  nome?: string
  cnpj?: string
}

export interface Departamento {
  id: number
  nome: string
  cor?: string
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiFetch<ClienteOpt[]>('/api/clientes?limit=5000'),
    staleTime: 10 * 60_000,
  })
}

export function useDepartamentos() {
  return useQuery({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<Departamento[]>('/api/departamentos'),
    staleTime: 10 * 60_000,
  })
}
