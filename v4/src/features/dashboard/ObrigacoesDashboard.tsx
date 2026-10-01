import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useDashboardCompleto } from './hooks/useDashboard'
import { useEvolucao } from './hooks/useEvolucao'
import { ChartCard, SoftAreaChart, SoftBarChart } from './components/charts'
import { KPICard } from './components/KPICard'
import { listAuditoriaReunioes } from '@/features/obrigacoes/api'
import { fmtHorasHM } from '@/lib/utils'

export default function ObrigacoesDashboard() {
  const { data, isLoading } = useDashboardCompleto()
  const { data: evo } = useEvolucao(12)
  const { data: reunioes } = useQuery({ queryKey: ['obrigacoes-auditoria-reunioes'], queryFn: listAuditoriaReunioes, staleTime: 60_000 })
  const [deptFilter, setDeptFilter] = useState('')
  const [mesReunioes, setMesReunioes] = useState(-1)

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando obrigações…</div>
  }

  const o = data.overall.obrigacoes
  const depts = data.departamentos

  // Filtra departamentos e usuários pelo departamento selecionado
  const deptsFiltered = deptFilter ? depts.filter((d: any) => String(d.id) === deptFilter) : depts
  const usuariosFiltrados = deptFilter
    ? data.usuarios.filter((u: any) => String(u.departamento_id ?? '') === deptFilter)
    : data.usuarios

  // Colaboradores com obrigações (eficiência)
  const colaboradores = usuariosFiltrados
    .map((u: any) => ({
      nome: u.nome,
      total: u.obrigacoes.total,
      concluidas: u.obrigacoes.concluidas,
      pendentes: u.obrigacoes.total - u.obrigacoes.concluidas,
      eficiencia: u.obrigacoes.total > 0 ? Math.round((u.obrigacoes.concluidas / u.obrigacoes.total) * 100) : 0,
    }))
    .filter(u => u.total > 0)
    .sort((a: any, b: any) => b.eficiencia - a.eficiencia)

  const eficBarData = deptsFiltered.map((d: any) => ({
    nome: d.nome,
    concluidas: d.obrigacoes.concluidas,
    pendentes: d.obrigacoes.total - d.obrigacoes.concluidas,
  }))

  // Tempo em reuniões: total do mês atual + por colaborador
  const mesesReunioes = reunioes?.meses || []
  const idxMesAtual = mesesReunioes.length - 1
  const idxMesSel = mesReunioes >= 0 && mesReunioes < mesesReunioes.length ? mesReunioes : idxMesAtual
  const horasMesAtual = (() => {
    if (!reunioes?.colaboradores?.length) return 0
    let total = 0
    for (const c of reunioes.colaboradores) {
      total += c.serie?.[idxMesAtual]?.horas || 0
    }
    return Math.round(total * 100) / 100
  })()
  const horasTotais = reunioes?.total_horas || 0
  const reunioesFiltradas = deptFilter
    ? (reunioes?.colaboradores || []).filter((c: any) => String(c.id ?? '') === deptFilter)
    : reunioes?.colaboradores || []
  const maxHorasMesSel = Math.max(...reunioesFiltradas.map((c: any) => c.serie?.[idxMesSel]?.horas || 0), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Obrigações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhamento interno do escritório</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Departamento</label>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="h-9 min-w-[200px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos os departamentos</option>
            {depts.map(d => (
              <option key={d.id} value={String(d.id)}>{d.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Total de obrigações" value={String(o.total)} hint="cadastradas" accent="blue" />
        <KPICard label="Pendentes" value={String(o.pendentes)} hint="aguardando conclusão" accent="amber" />
        <KPICard label="Concluídas" value={String(o.concluidas)} hint="no período" accent="green" />
        <KPICard label="Eficiência" value={`${o.eficiencia}%`} hint="concluídas / total" accent="blue" />
        <KPICard label="Reuniões no mês" value={fmtHorasHM(horasMesAtual)} hint={`${fmtHorasHM(horasTotais)} nos últimos 6 meses`} accent="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Eficiência por departamento" subtitle="Concluídas vs pendentes">
          <SoftBarChart
            data={eficBarData}
            xKey="nome"
            stacked
            series={[
              { key: 'concluidas', name: 'Concluídas', color: '#0078d4' },
              { key: 'pendentes', name: 'Pendentes', color: '#cbd5e1' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Obrigações concluídas por mês" subtitle="Série mensal">
          <SoftAreaChart
            data={evo?.series || []}
            xKey="mes"
            series={[{ key: 'obrigacoes', name: 'Concluídas' }]}
          />
        </ChartCard>
      </div>

      {/* Eficiência por colaborador */}
      <ChartCard title="Eficiência por colaborador" subtitle={deptFilter ? 'Filtrado pelo departamento selecionado' : 'Todos os departamentos'}>
        {colaboradores.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma obrigação atribuída a colaboradores{deptFilter ? ' neste departamento' : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {colaboradores.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-28 truncate text-right text-xs font-medium text-foreground">{c.nome}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${c.eficiencia >= 80 ? 'bg-emerald-500' : c.eficiencia >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${c.eficiencia}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-semibold text-foreground">{c.eficiencia}%</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.concluidas} de {c.total} concluídas · {c.pendentes} pendentes
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Tempo em reuniões por colaborador */}
      <ChartCard
        title="Tempo em reuniões por colaborador"
        subtitle={deptFilter ? 'Filtrado pelo departamento selecionado' : 'Horas em reuniões'}
        action={
          mesesReunioes.length > 0 && (
            <select
              value={idxMesSel}
              onChange={e => setMesReunioes(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {mesesReunioes.map((m: string, i: number) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )
        }
      >
        {!reunioes?.colaboradores?.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma reunião registrada nos últimos 6 meses.
          </div>
        ) : (
          <>
            {/* Donut: interna vs externa */}
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div className="relative h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Internas', value: (reunioes.internas_serie?.[idxMesSel] || 0) },
                        { name: 'Externas', value: (reunioes.externas_serie?.[idxMesSel] || 0) },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="88%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      <Cell fill="#34c759" />
                      <Cell fill="#0078d4" />
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtHorasHM(Number(v))}
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-foreground">{fmtHorasHM((reunioes.internas_serie?.[idxMesSel] || 0) + (reunioes.externas_serie?.[idxMesSel] || 0))}</span>
                  <span className="text-[10px] text-muted-foreground">total</span>
                </div>
              </div>
              <div className="flex flex-col justify-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-[#34c759]" />
                  <span className="flex-1 text-sm text-foreground">Internas</span>
                  <span className="text-sm font-semibold text-foreground">{fmtHorasHM(reunioes.internas_serie?.[idxMesSel] || 0)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-[#0078d4]" />
                  <span className="flex-1 text-sm text-foreground">Externas</span>
                  <span className="text-sm font-semibold text-foreground">{fmtHorasHM(reunioes.externas_serie?.[idxMesSel] || 0)}</span>
                </div>
                <div className="mt-1 rounded-lg bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  {(reunioes.internas_serie?.[idxMesSel] || 0) + (reunioes.externas_serie?.[idxMesSel] || 0) > 0
                    ? `${Math.round(((reunioes.internas_serie?.[idxMesSel] || 0) / ((reunioes.internas_serie?.[idxMesSel] || 0) + (reunioes.externas_serie?.[idxMesSel] || 0))) * 100)}% do tempo foi em reuniões internas em ${mesesReunioes[idxMesSel]}`
                    : 'Sem dados de divisão interna/externa neste mês'}
                </div>
              </div>
            </div>
            <div className="space-y-3">
            {[...reunioesFiltradas]
              .sort((a: any, b: any) => (b.serie?.[idxMesSel]?.horas || 0) - (a.serie?.[idxMesSel]?.horas || 0))
              .map((c: any) => {
                const horas = c.serie?.[idxMesSel]?.horas || 0
                const horasArred = Math.round(horas * 100) / 100
                const pct = Math.min(100, Math.round((horas / Math.max(maxHorasMesSel, 1)) * 100))
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-28 truncate text-right text-xs font-medium text-foreground">{c.nome}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#0078d4] to-[#3b9ef5]"
                            style={{ width: `${horas > 0 ? Math.max(pct, 4) : 0}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs font-semibold text-[#0078d4]">
                          {horas > 0 ? fmtHorasHM(horasArred) : '—'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {horas > 0 ? `${fmtHorasHM(horasArred)} em reuniões em ${mesesReunioes[idxMesSel]}` : 'Sem reuniões neste mês'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </ChartCard>
    </div>
  )
}
