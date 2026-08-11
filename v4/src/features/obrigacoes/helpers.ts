export const STATUS_BADGE: Record<string, string> = {
  Pendente: 'bg-amber-50 text-amber-700',
  Concluida: 'bg-emerald-50 text-emerald-700',
  Concluída: 'bg-emerald-50 text-emerald-700',
  Atrasada: 'bg-red-50 text-red-700',
}

export const PRIO_BADGE: Record<string, string> = {
  Alta: 'bg-red-50 text-red-700',
  Média: 'bg-amber-50 text-amber-700',
  Media: 'bg-amber-50 text-amber-700',
  Baixa: 'bg-emerald-50 text-emerald-700',
}

export const RECORRENCIA_OPTIONS = ['Única', 'Mensal', 'Trimestral', 'Anual']
export const STATUS_OPTIONS = ['Pendente', 'Concluida', 'Atrasada']
export const PRIORIDADES = ['Baixa', 'Média', 'Alta']

export function isOverdue(o: { status: string; vencimento_legal_date: string | null }): boolean {
  if (o.status === 'Concluida' || o.status === 'Concluída') return false
  if (!o.vencimento_legal_date) return false
  const d = new Date(o.vencimento_legal_date + 'T00:00:00')
  return !isNaN(d.getTime()) && d.getTime() < new Date().setHours(0, 0, 0, 0)
}

export function isSoon(o: { status: string; vencimento_legal_date: string | null }): boolean {
  if (o.status === 'Concluida' || o.status === 'Concluída') return false
  if (!o.vencimento_legal_date) return false
  const d = new Date(o.vencimento_legal_date + 'T00:00:00')
  if (isNaN(d.getTime())) return false
  const hoje = new Date().setHours(0, 0, 0, 0)
  const seteDias = hoje + 7 * 86400000
  return d.getTime() >= hoje && d.getTime() <= seteDias
}

export function fmtDateBR(d: string | null | undefined): string {
  if (!d) return '-'
  const s = String(d).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    try {
      return new Date(d).toLocaleDateString('pt-BR')
    } catch {
      return '-'
    }
  }
  const [y, m, dd] = s.split('-')
  return `${dd}/${m}/${y}`
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '-'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pad2(n: number | null | undefined): string {
  if (n == null) return '-'
  return String(n).padStart(2, '0')
}
