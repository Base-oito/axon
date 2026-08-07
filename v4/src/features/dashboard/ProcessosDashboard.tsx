import { useDashboardCompleto } from './hooks/useDashboard'
import { ChartCard, SoftBarChart } from './components/charts'
import { KPICard } from './components/KPICard'

function fmtDate(d?: string) {
  if (!d) return '-'
  return new Date(d.replace(/-03:00|T.*/, '') + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtCnpj(cnpj?: string) {
  if (!cnpj) return '-'
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function CertTable({
  title, items, badge,
}: {
  title: string
  items?: Array<{ id: number; nome: string; cnpj?: string; certificate_expires_at?: string }>
  badge: 'amber' | 'red'
}) {
  return (
    <div className="card-soft overflow-hidden rounded-lg bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          badge === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {items?.length || 0}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Cliente</th>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map(c => (
              <tr key={c.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                <td className="max-w-[260px] truncate px-4 py-2 font-medium text-foreground">{c.nome}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{fmtCnpj(c.cnpj)}</td>
                <td className={`px-3 py-2 whitespace-nowrap text-xs font-medium ${
                  badge === 'red' ? 'text-rose-600' : 'text-amber-600'
                }`}>
                  {fmtDate(c.certificate_expires_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items || []).length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum certificado {badge === 'red' ? 'vencido' : 'vencendo'}.</div>
        )}
      </div>
    </div>
  )
}

export default function ProcessosDashboard() {
  const { data, isLoading } = useDashboardCompleto()

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando processos e tarefas…</div>
  }

  const t = data.overall.tarefas
  const p = data.overall.processos
  const certs = data.certificados

  const usuarios = data.usuarios.map((u: any) => ({
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
          <div className="grid grid-cols-3 gap-3 py-4">
            {[
              { label: 'Válidos', value: certs.validos, color: 'text-emerald-600' },
              { label: 'Vencendo', value: certs.vencendo, color: 'text-amber-600' },
              { label: 'Vencidos', value: certs.vencidos, color: 'text-rose-600' },
            ].map(c => (
              <div key={c.label} className="card-soft rounded-lg p-4 text-center">
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Tabelas de certificados */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CertTable
          title="Certificados vencendo"
          items={certs.vencendo_lista}
          badge="amber"
        />
        <CertTable
          title="Certificados vencidos"
          items={certs.vencidos_lista}
          badge="red"
        />
      </div>
    </div>
  )
}
