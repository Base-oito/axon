import { useState } from 'react'
import { useEvolucao, type DashboardFilters } from './hooks/useEvolucao'
import { ChartCard, SoftAreaChart, SoftBarChart, formatBRL } from './components/charts'
import { KPIFromSeries } from './components/KPICard'
import { DashboardFilters as FilterBar } from './components/DashboardFilters'

export default function NFeDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({})
  const { data, isLoading } = useEvolucao(12, filters)

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando indicadores de NF-e…</div>
  }

  const tot = data.totais || { nfe_total: 0, nfe_hoje: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">NF-e — Notas de Entrada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Captura automática via SEFAZ · {data.months} meses
          </p>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPIFromSeries label="Notas no mês" getter={m => m.nfe_qtd} accent="blue" />
        <KPIFromSeries label="Valor capturado" getter={m => m.nfe_valor} money accent="green" />
        <KPIFromSeries label="ICMS no mês" getter={m => m.nfe_icms} money accent="amber" />
        <div className="card-soft rounded-lg bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total registrado</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{tot.nfe_total.toLocaleString('pt-BR')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tot.nfe_hoje} baixada{tot.nfe_hoje === 1 ? '' : 's'} hoje</p>
        </div>
      </div>

      {/* Evolução de valor */}
      <ChartCard title="Evolução do valor capturado" subtitle="Valor total das NF-e de entrada por mês">
        <SoftAreaChart
          data={data.series}
          xKey="mes"
          money
          series={[{ key: 'nfe_valor', name: 'Valor' }]}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Volume mensal */}
        <ChartCard title="Volume de notas por mês" subtitle="Quantidade de NF-e de entrada capturadas">
          <SoftBarChart
            data={data.series}
            xKey="mes"
            series={[{ key: 'nfe_qtd', name: 'Notas' }]}
          />
        </ChartCard>

        {/* Por UF */}
        <ChartCard title="Notas por UF" subtitle="Distribuição das entradas por estado (12 meses)">
          <SoftBarChart
            data={data.por_uf}
            xKey="uf"
            series={[{ key: 'qtd', name: 'Notas', color: '#0078d4' }]}
          />
        </ChartCard>
      </div>

      {/* Top emitentes */}
      <ChartCard title="Principais emitentes" subtitle="Maiores fornecedores por volume de notas (12 meses)">
        <div className="space-y-3">
          {data.top_emitentes.map((e, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 text-right text-xs font-semibold text-muted-foreground">{i + 1}º</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-foreground">{e.nome}</span>
                  <span className="ml-2 whitespace-nowrap text-muted-foreground">
                    {e.qtd} · {formatBRL(e.valor)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#0078d4]"
                    style={{ width: `${(e.qtd / data.top_emitentes[0].qtd) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
