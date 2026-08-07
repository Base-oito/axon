

import { formatBRL } from './charts'
import { useEvolucao } from '../hooks/useEvolucao'

interface KPICardProps {
  label: string
  value: string
  prefix?: string
  hint?: string
  trend?: number
  accent?: 'blue' | 'green' | 'amber' | 'red'
}

const ACCENTS = {
  blue: 'from-[#0078d4]/12 to-[#3b9ef5]/5 text-[#0078d4]',
  green: 'from-emerald-500/12 to-emerald-400/5 text-emerald-600',
  amber: 'from-amber-500/12 to-amber-400/5 text-amber-600',
  red: 'from-rose-500/12 to-rose-400/5 text-rose-600',
}

export function KPICard({ label, value, hint, trend, accent = 'blue' }: KPICardProps) {
  return (
    <div className="card-soft hover-lift relative overflow-hidden rounded-lg bg-card p-5">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${ACCENTS[accent]}`} />
      <p className="relative text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="relative mt-2 text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="relative mt-1 text-xs text-muted-foreground">{hint}</p>}
      {trend !== undefined && (
        <p className={`relative mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  )
}

// KPI que calcula o valor do mês atual + variação vs anterior a partir da série
export function KPIFromSeries({
  label, getter, money, accent,
}: {
  label: string
  getter: (m: any) => number
  money?: boolean
  accent?: KPICardProps['accent']
}) {
  const { data } = useEvolucao(3)
  const series = data?.series || []
  const cur = series[series.length - 1]
  const prev = series[series.length - 2]
  if (!cur) return <KPICard label={label} value="—" accent={accent} />
  const curV = getter(cur)
  const prevV = prev ? getter(prev) : 0
  const trend = prevV > 0 ? ((curV - prevV) / prevV) * 100 : undefined
  return (
    <KPICard
      label={label}
      value={money ? formatBRL(curV) : String(curV)}
      hint={cur.mes}
      trend={trend}
      accent={accent}
    />
  )
}
