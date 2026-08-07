import { useDashboardCompleto } from './hooks/useDashboard'
import { ChartCard, SoftBarChart } from './components/charts'
import { KPICard } from './components/KPICard'

export default function ProcessosDashboard() {
  const { data, isLoading } = useDashboardCompleto()

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando processos e tarefas…</div>
  }

  const t = data.overall.tarefas
  const p = data.overall.processos

  const usuarios = data.usuarios.map(u => ({
    nome: u.nome,
    tarefas: u.tarefas.total,
    concluidas: u.tarefas.concluidas,
    processos: u.processos.total,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Processos & Tarefas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhamento interno do escritório</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Tarefas" value={String(t.total)} hint={`${t.pendentes} pendentes`} accent="blue" />
        <KPICard label="Tarefas concluídas" value={String(t.concluidas)} hint={`${t.eficiencia}% eficiência`} accent="green" />
        <KPICard label="Processos" value={String(p.total)} hint={`${p.em_andamento} em andamento`} accent="amber" />
        <KPICard label="Processos finalizados" value={String(p.finalizados)} hint="encerrados" accent="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Carga por usuário" subtitle="Tarefas totais vs concluídas">
          <SoftBarChart
            data={usuarios}
            xKey="nome"
            series={[
              { key: 'tarefas', name: 'Tarefas', color: '#0078d4' },
              { key: 'concluidas', name: 'Concluídas', color: '#3b9ef5' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Clientes por status de certificado" subtitle="Validade dos certificados digitais">
          <div className="grid grid-cols-3 gap-3 py-6">
            {[
              { label: 'Válidos', value: data.certificados.validos, color: 'text-emerald-600' },
              { label: 'Vencendo', value: data.certificados.vencendo, color: 'text-amber-600' },
              { label: 'Vencidos', value: data.certificados.vencidos, color: 'text-rose-600' },
            ].map(c => (
              <div key={c.label} className="card-soft rounded-lg p-4 text-center">
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
