import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface ClienteOpt {
  id: number
  name?: string
  nome?: string
  cnpj?: string
  status?: string
  ativo?: boolean
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

/** Clientes elegíveis para atribuir obrigação/tarefa/processo (exclui Prospect e Lead). */
export function useClientesOperacionais() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiFetch<ClienteOpt[]>('/api/clientes?limit=5000'),
    staleTime: 10 * 60_000,
    select: (data) =>
      (data || []).filter(c => {
        const st = (c.status || (c.ativo ? 'ativa' : 'inativa')).toLowerCase()
        return st !== 'prospect' && st !== 'lead'
      }),
  })
}

export function useDepartamentos() {
  return useQuery({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<Departamento[]>('/api/departamentos'),
    staleTime: 10 * 60_000,
  })
}
