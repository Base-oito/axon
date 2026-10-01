import { useState } from 'react'
import { useEvolucao, type DashboardFilters } from './hooks/useEvolucao'
import { ChartCard, SoftAreaChart, SoftBarChart, SoftDonut, formatBRL } from './components/charts'
import { KPIFromSeries } from './components/KPICard'
import { DashboardFilters as FilterBar } from './components/DashboardFilters'

export default function NfseDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({})
  const { data, isLoading } = useEvolucao(12, filters)

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando indicadores de NFS-e…</div>
  }

  const totalTomados = data.series.reduce((s, m) => s + m.nfse_tomados, 0)
  const totalPrestados = data.series.reduce((s, m) => s + m.nfse_prestados, 0)
  const valTomados = data.series.reduce((s, m) => s + m.nfse_valor_tomados, 0)
  const valPrestados = data.series.reduce((s, m) => s + m.nfse_valor_prestados, 0)
  const tot = data.totais || { nfse_total: 0, nfse_hoje: 0 }

  const donutData = [
    { name: 'Prestados', value: totalPrestados },
    { name: 'Tomados', value: totalTomados },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">NFS-e — Notas de Serviço</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Captura automática via ADN Nacional · {data.months} meses
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-2 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total registrado</p>
          <p className="text-xl font-bold text-foreground">{tot.nfse_total.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">{tot.nfse_hoje} baixada{tot.nfse_hoje === 1 ? '' : 's'} hoje</p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPIFromSeries label="Prestadas no mês" getter={m => m.nfse_prestados} accent="blue" />
        <KPIFromSeries label="Tomadas no mês" getter={m => m.nfse_tomados} accent="green" />
        <KPIFromSeries label="Valor prestados" getter={m => m.nfse_valor_prestados} money accent="amber" />
        <KPIFromSeries label="Valor tomados" getter={m => m.nfse_valor_tomados} money accent="red" />
      </div>

      {/* Evolução de valor */}
      <ChartCard title="Evolução do valor de serviços" subtitle="Prestados vs tomados por mês">
        <SoftAreaChart
          data={data.series}
          xKey="mes"
          money
          series={[
            { key: 'nfse_valor_prestados', name: 'Prestados', color: '#0078d4' },
            { key: 'nfse_valor_tomados', name: 'Tomados', color: '#3b9ef5' },
          ]}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Volume de notas por mês" subtitle="Prestados vs tomados">
          <SoftBarChart
            data={data.series}
            xKey="mes"
            series={[
              { key: 'nfse_prestados', name: 'Prestados', color: '#0078d4' },
              { key: 'nfse_tomados', name: 'Tomados', color: '#3b9ef5' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Composição" subtitle={`Distribuição acumulada (12 meses) · ${tot.nfse_total.toLocaleString('pt-BR')} notas no total`}>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <SoftDonut
              data={donutData}
              centerValue={String(totalPrestados + totalTomados)}
              centerLabel={`de ${tot.nfse_total.toLocaleString('pt-BR')} notas`}
              colors={['#0078d4', '#3b9ef5']}
            />
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-foreground">Prestados</p>
                <p className="text-muted-foreground">{totalPrestados.toLocaleString('pt-BR')} · {formatBRL(valPrestados)}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Tomados</p>
                <p className="text-muted-foreground">{totalTomados.toLocaleString('pt-BR')} · {formatBRL(valTomados)}</p>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
