import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const BLUE = '#0078d4'
const BLUE_LIGHT = '#3b9ef5'
const GRAY = '#64748b'
const GRID = 'rgba(15, 23, 42, 0.06)'

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(15,23,42,0.08)',
  boxShadow: '0 8px 24px rgba(15,23,42,0.10)',
  fontSize: 13,
}

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function ChartCard({ title, subtitle, action, children }: ChartCardProps) {
  return (
    <div className="card-soft rounded-lg bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

interface AreaChartProps {
  data: any[]
  xKey: string
  series: Array<{ key: string; name: string; color?: string }>
  height?: number
  money?: boolean
}

export function SoftAreaChart({ data, xKey, series, height = 260, money }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || BLUE} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color || BLUE} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: GRAY }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: GRAY }} axisLine={false} tickLine={false} width={60}
          tickFormatter={v => money ? formatBRL(v) : String(v)} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: any, name: any) => {
            const s = series.find(x => x.key === name)
            return [money ? formatBRL(Number(value)) : String(value), s?.name || name]
          }}
        />
        {series.map(s => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color || BLUE}
            strokeWidth={2.5}
            fill={`url(#grad-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface BarChartProps {
  data: any[]
  xKey: string
  series: Array<{ key: string; name: string; color?: string }>
  height?: number
  money?: boolean
  stacked?: boolean
}

export function SoftBarChart({ data, xKey, series, height = 260, money, stacked }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }} barSize={26}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: GRAY }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: GRAY }} axisLine={false} tickLine={false} width={60}
          tickFormatter={v => money ? formatBRL(v) : String(v)} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'rgba(0,120,212,0.04)' }}
          formatter={(value: any, name: any) => {
            const s = series.find(x => x.key === name)
            return [money ? formatBRL(Number(value)) : String(value), s?.name || name]
          }}
        />
        {series.map(s => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color || BLUE}
            radius={[6, 6, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

interface DonutProps {
  data: Array<{ name: string; value: number }>
  height?: number
  colors?: string[]
  centerLabel?: string
  centerValue?: string
}

export function SoftDonut({ data, height = 240, colors, centerLabel, centerValue }: DonutProps) {
  const palette = colors || [BLUE, BLUE_LIGHT, '#4ade80', '#f59e0b', '#f87171', '#a78bfa', '#2dd4bf', '#fb7185']
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-2xl font-bold text-foreground">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}
