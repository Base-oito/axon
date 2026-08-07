import { useState } from 'react'
import { useDashboardCompleto } from './hooks/useDashboard'
import { useEvolucao } from './hooks/useEvolucao'
import { ChartCard, SoftAreaChart, SoftBarChart } from './components/charts'
import { KPICard } from './components/KPICard'

export default function ObrigacoesDashboard() {
  const { data, isLoading } = useDashboardCompleto()
  const { data: evo } = useEvolucao(12)
  const [deptFilter, setDeptFilter] = useState('')

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total de obrigações" value={String(o.total)} hint="cadastradas" accent="blue" />
        <KPICard label="Pendentes" value={String(o.pendentes)} hint="aguardando conclusão" accent="amber" />
        <KPICard label="Concluídas" value={String(o.concluidas)} hint="no período" accent="green" />
        <KPICard label="Eficiência" value={`${o.eficiencia}%`} hint="concluídas / total" accent="blue" />
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
    </div>
  )
}
