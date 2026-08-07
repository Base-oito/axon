import { useDashboardCompleto } from './hooks/useDashboard'
import { useEvolucao } from './hooks/useEvolucao'
import { ChartCard, SoftAreaChart, SoftBarChart } from './components/charts'
import { KPICard } from './components/KPICard'

export default function ObrigacoesDashboard() {
  const { data, isLoading } = useDashboardCompleto()
  const { data: evo } = useEvolucao(12)

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando obrigações…</div>
  }

  const o = data.overall.obrigacoes
  const pendentes = o.pendentes
  const eficiencia = o.eficiencia
  const porDept = data.departamentos

  const eficBarData = porDept.map(d => ({
    nome: d.nome,
    concluidas: d.obrigacoes.concluidas,
    pendentes: d.obrigacoes.total - d.obrigacoes.concluidas,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Obrigações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhamento interno do escritório</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total de obrigações" value={String(o.total)} hint="cadastradas" accent="blue" />
        <KPICard label="Pendentes" value={String(pendentes)} hint="aguardando conclusão" accent="amber" />
        <KPICard label="Concluídas" value={String(o.concluidas)} hint="no período" accent="green" />
        <KPICard label="Eficiência" value={`${eficiencia}%`} hint="concluídas / total" accent="blue" />
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
    </div>
  )
}
