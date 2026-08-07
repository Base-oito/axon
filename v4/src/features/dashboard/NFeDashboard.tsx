import { useEvolucao } from './hooks/useEvolucao'
import { ChartCard, SoftAreaChart, SoftBarChart, formatBRL } from './components/charts'
import { KPIFromSeries } from './components/KPICard'

export default function NFeDashboard() {
  const { data, isLoading } = useEvolucao(12)

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando indicadores de NF-e…</div>
  }

  const totalAno = data.series.reduce((s, m) => s + m.nfe_qtd, 0)
  const totalValor = data.series.reduce((s, m) => s + m.nfe_valor, 0)
  const totalIcms = data.series.reduce((s, m) => s + m.nfe_icms, 0)

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

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPIFromSeries label="Notas no mês" getter={m => m.nfe_qtd} accent="blue" />
        <KPIFromSeries label="Valor capturado" getter={m => m.nfe_valor} money accent="green" />
        <KPIFromSeries label="ICMS no mês" getter={m => m.nfe_icms} money accent="amber" />
        <div className="card-soft rounded-lg bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acumulado (12m)</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalAno.toLocaleString('pt-BR')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatBRL(totalValor)} · ICMS {formatBRL(totalIcms)}</p>
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
