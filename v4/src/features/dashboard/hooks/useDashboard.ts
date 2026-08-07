import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface DashboardData {
  overall: {
    clientes: { total: number; ativos: number; inativos: number }
    obrigacoes: { total: number; pendentes: number; concluidas: number; eficiencia: number }
    tarefas: { total: number; pendentes: number; concluidas: number; eficiencia: number }
    processos: { total: number; em_andamento: number; finalizados: number; cancelados: number }
  }
  departamentos: Array<{
    id: number; nome: string
    obrigacoes: { total: number; concluidas: number }
    tarefas: { total: number; concluidas: number }
    processos: { total: number }
  }>
  usuarios: Array<{
    id: number; nome: string; departamento_id?: number | null
    obrigacoes: { total: number; concluidas: number }
    tarefas: { total: number; concluidas: number }
    processos: { total: number; concluidos: number }
  }>
  certificados: {
    validos: number; vencendo: number; vencidos: number
    vencendo_lista?: Array<{ id: number; nome: string; cnpj?: string; certificate_expires_at?: string }>
    vencidos_lista?: Array<{ id: number; nome: string; cnpj?: string; certificate_expires_at?: string }>
  }
  execucoes_recentes: Array<any>
}

export function useDashboardCompleto() {
  return useQuery({
    queryKey: ['dashboard', 'completo'],
    queryFn: () => apiFetch<DashboardData>('/dashboard'),
    staleTime: 2 * 60_000,
  })
}
