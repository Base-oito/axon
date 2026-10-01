import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDashboardCompleto } from './hooks/useDashboard'
import { ChartCard } from './components/charts'
import { KPICard } from './components/KPICard'
import { apiFetch } from '@/lib/api'

interface TarefasStats {
  total: number
  concluidas: number
  tempo_medio_horas: number
  por_colaborador: Array<{ id: number; nome: string; total: number; abertas: number; concluidas: number; atrasadas: number; eficiencia: number }>
  atrasadas_por_lista: Record<string, number>
  eficiencia_por_departamento: Array<{ nome: string; total: number; concluidas: number; eficiencia: number }>
}

interface ProcessosStats {
  total: number
  ranking_por_tempo: Array<{ id: number; titulo: string; cliente: string; responsavel: string; operador: string; departamento: string; vencimento: string; etapas_total: number; etapas_concluidas: number; dias: number; status: string; atrasado: boolean }>
  atrasados: Array<{ id: number; titulo: string; cliente: string; responsavel: string; operador: string; departamento: string; vencimento: string; etapas_total: number; etapas_concluidas: number; dias: number; status: string; atrasado: boolean }>
  eficiencia_por_departamento: Array<{ nome: string; total: number; concluidos: number; eficiencia: number }>
  etapas_por_operador: Array<{ id: number; nome: string; total: number; abertas: number; concluidas: number; atrasadas: number; eficiencia: number }>
  etapas_por_departamento: Array<{ nome: string; total: number; abertas: number; concluidas: number; atrasadas: number; eficiencia: number }>
}

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

function effColor(v: number) {
  if (v >= 80) return 'bg-emerald-500'
  if (v >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

/** Lista "a fazer por usuário": mostra aberto (azul), vencidas (vermelho) e concluídas (verde). */
function FazerPorPessoa({ itens, label }: {
  itens: Array<{ nome: string; abertas: number; atrasadas: number; concluidas: number; total: number }>
  label: string
}) {
  const lista = [...itens].sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas)
  if (lista.length === 0) {
    return <p className="py-6 text-center text-xs text-emerald-600">Nada em aberto. 🎉</p>
  }
  return (
    <div className="space-y-3">
      {lista.map((x, i) => {
        const total = Math.max(x.total, 1)
        const pctConcl = Math.round((x.concluidas / total) * 100)
        const pctAtras = Math.round((x.atrasadas / total) * 100)
        const pctAberto = Math.max(Math.round((x.abertas / total) * 100), 0)
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-32 truncate text-right text-xs font-medium text-foreground">{x.nome}</span>
            <div className="min-w-0 flex-1">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${pctConcl}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${pctAtras}%` }} />
                <div className="h-full rounded-r-full bg-[#0078d4]" style={{ width: `${pctAberto}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {x.abertas} {label} a fazer · <span className="text-rose-500">{x.atrasadas} vencida{x.atrasadas === 1 ? '' : 's'}</span> · {x.concluidas} concluídas
              </p>
            </div>
            <span className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${
              x.atrasadas > 0 ? 'bg-rose-500/15 text-rose-600' : 'bg-emerald-500/15 text-emerald-600'
            }`}>
              {x.atrasadas > 0 ? 'Vencidas' : 'No prazo'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RankingBar({ nome, valor, max, suffix = '', sub }: {
  nome: string
  valor: number
  max: number
  suffix?: string
  sub?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 truncate text-right text-xs font-medium text-foreground">{nome}</span>
      <div className="min-w-0 flex-1">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0078d4] to-[#3b9ef5]" style={{ width: `${Math.max(pct, valor > 0 ? 4 : 0)}%` }} />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-semibold text-[#0078d4]">{valor}{suffix}</span>
    </div>
  )
}

export default function ProcessosDashboard() {
  const { data, isLoading } = useDashboardCompleto()
  const { data: stats } = useQuery({
    queryKey: ['dashboard-processos-tarefas'],
    queryFn: () => apiFetch<{ tarefas: TarefasStats; processos: ProcessosStats }>('/dashboard/processos-tarefas'),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
  const [tab, setTab] = useState<'tarefas' | 'processos'>('tarefas')

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando processos e tarefas…</div>
  }

  const t = data.overall.tarefas
  const p = data.overall.processos
  const certs = data.certificados
  const ts = stats?.tarefas
  const ps = stats?.processos

  const usuarios = data.usuarios.map((u: any) => ({
    nome: u.nome,
    tarefas: u.tarefas.total,
    concluidas: u.tarefas.concluidas,
    processos: u.processos.total,
  }))

  const maxTempo = Math.max(...(ps?.ranking_por_tempo || []).map(x => x.dias), 1)
  const totalVencidas = (ts?.por_colaborador || []).reduce((s, c) => s + (c.atrasadas || 0), 0)
  const totalAbertas = (ts?.por_colaborador || []).reduce((s, c) => s + (c.abertas || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Processos & Tarefas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhamento interno do escritório — tarefas, etapas de processos e projetos</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Tarefas em aberto" value={String(totalAbertas)} hint="a fazer (pessoais + processos + projetos)" accent="blue" />
        <KPICard label="Vencidas / atrasadas" value={String(totalVencidas)} hint="em aberto e fora do prazo" accent="red" />
        <KPICard label="Tarefas concluídas" value={String(ts?.concluidas ?? t.concluidas)} hint={`${ts?.por_colaborador?.length ?? 0} responsáveis`} accent="green" />
        <KPICard label="Processos" value={String(p.total)} hint={`${p.em_andamento} em andamento`} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Carga por usuário" subtitle="Tarefas totais vs concluídas">
          <div className="space-y-3">
            {usuarios.filter(u => u.tarefas > 0).map((u: any, i: number) => (
              <RankingBar key={i} nome={u.nome} valor={u.concluidas} max={u.tarefas} sub={`${u.tarefas} tarefas · ${u.processos} processos`} />
            ))}
            {usuarios.filter(u => u.tarefas > 0).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Sem tarefas atribuídas.</p>
            )}
          </div>
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

      {/* Rankings de processos e tarefas */}
      <div className="space-y-4">
        <div className="flex gap-1 border-b border-border/60">
          <button
            onClick={() => setTab('tarefas')}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'tarefas' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Tarefas
          </button>
          <button
            onClick={() => setTab('processos')}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'processos' ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Processos
          </button>
        </div>

        {tab === 'tarefas' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Eficiência por colaborador */}
              <ChartCard title="Eficiência por colaborador" subtitle="Concluídas / total">
                {!ts?.por_colaborador?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>
                ) : (
                  <div className="space-y-3">
                    {[...ts.por_colaborador].sort((a, b) => b.eficiencia - a.eficiencia).map(c => (
                      <RankingBar key={c.id} nome={c.nome} valor={c.eficiencia} max={100} suffix="%" sub={`${c.concluidas} de ${c.total} concluídas`} />
                    ))}
                  </div>
                )}
              </ChartCard>

              {/* Tempo médio de execução */}
              <ChartCard title="Tempo médio de execução" subtitle="Horas por tarefa concluída">
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-5xl font-bold text-[#0078d4]">{ts?.tempo_medio_horas ?? 0}</p>
                  <p className="mt-2 text-xs text-muted-foreground">horas em média</p>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {ts?.concluidas ?? 0} de {ts?.total ?? 0} tarefas concluídas
                  </p>
                </div>
              </ChartCard>

              {/* Ranking de atrasadas por colaborador */}
              <ChartCard title="Tarefas atrasadas por colaborador" subtitle="Ranking — mais atrasadas primeiro">
                {!ts?.por_colaborador?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>
                ) : (
                  <div className="space-y-3">
                    {ts.por_colaborador.filter(c => c.atrasadas > 0).map(c => (
                      <RankingBar key={c.id} nome={c.nome} valor={c.atrasadas} max={Math.max(...ts.por_colaborador.map(x => x.atrasadas), 1)} sub={`${c.eficiencia}% eficiência`} />
                    ))}
                    {ts.por_colaborador.every(c => c.atrasadas === 0) && (
                      <p className="py-6 text-center text-xs text-emerald-600">Nenhuma tarefa atrasada. 🎉</p>
                    )}
                  </div>
                )}
              </ChartCard>
            </div>

            <ChartCard title="O que cada usuário tem a fazer" subtitle="Tarefas em aberto e vencidas por responsável">
                <FazerPorPessoa itens={(ts?.por_colaborador || []).filter(x => (x.abertas || 0) > 0)} label="tarefa(s)" />
              </ChartCard>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Atrasadas por lista */}
              <ChartCard title="Atrasadas por lista" subtitle="Departamento / lista com tarefas vencidas">
                {!ts?.atrasadas_por_lista || Object.keys(ts.atrasadas_por_lista).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa atrasada.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(ts.atrasadas_por_lista).map(([nome, qtd]) => (
                      <RankingBar key={nome} nome={nome} valor={qtd} max={Math.max(...Object.values(ts.atrasadas_por_lista), 1)} />
                    ))}
                  </div>
                )}
              </ChartCard>

              {/* Eficiência por departamento */}
              <ChartCard title="Eficiência por departamento" subtitle="Tarefas concluídas vs total">
                {!ts?.eficiencia_por_departamento?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>
                ) : (
                  <div className="space-y-3">
                    {ts.eficiencia_por_departamento.map(d => (
                      <div key={d.nome} className="flex items-center gap-3">
                        <span className="w-28 truncate text-right text-xs font-medium text-foreground">{d.nome}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${effColor(d.eficiencia)}`} style={{ width: `${d.eficiencia}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-foreground">{d.eficiencia}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>
          </>
        )}

        {tab === 'processos' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Ranking de processos por tempo */}
              <ChartCard title="Ranking de processos por tempo" subtitle="Mais longos primeiro (dias)">
                {!ps?.ranking_por_tempo?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sem processos.</p>
                ) : (
                  <div className="space-y-3">
                    {ps.ranking_por_tempo.slice(0, 10).map(x => (
                      <RankingBar key={x.id} nome={x.titulo} valor={x.dias} max={maxTempo} suffix="d" sub={`${x.cliente} · ${x.responsavel}`} />
                    ))}
                  </div>
                )}
              </ChartCard>

              {/* Atrasados por lista */}
              <ChartCard title="Processos atrasados" subtitle="Etapa atual vencida">
                {!ps?.atrasados?.length ? (
                  <p className="py-6 text-center text-xs text-emerald-600">Nenhum processo atrasado. 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {ps.atrasados.slice(0, 10).map(x => (
                      <div key={x.id} className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-50/40 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{x.titulo}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{x.cliente} · {x.responsavel}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-rose-600">{x.dias}d</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>

              {/* Eficiência por departamento (processos) */}
              <ChartCard title="Eficiência por departamento" subtitle="Processos concluídos vs total">
                {!ps?.eficiencia_por_departamento?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sem dados.</p>
                ) : (
                  <div className="space-y-3">
                    {ps.eficiencia_por_departamento.map(d => (
                      <div key={d.nome} className="flex items-center gap-3">
                        <span className="w-28 truncate text-right text-xs font-medium text-foreground">{d.nome}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${effColor(d.eficiencia)}`} style={{ width: `${d.eficiencia}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-foreground">{d.eficiencia}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Etapas/tarefas de processos por operador */}
              <ChartCard title="Etapas de processo a fazer por operador" subtitle="Etapas das instâncias em aberto e vencidas">
                {!ps?.etapas_por_operador?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma etapa atribuída a operadores. Defina o responsável no modelo/instância para computar.</p>
                ) : (
                  <FazerPorPessoa itens={ps.etapas_por_operador.filter(x => (x.abertas || 0) > 0)} label="etapa(s)" />
                )}
              </ChartCard>

              {/* Etapas/tarefas de processos por departamento */}
              <ChartCard title="Tarefas de processos por departamento" subtitle="Etapas agrupadas pelo departamento responsável">
                {!ps?.etapas_por_departamento?.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sem etapas em processos.</p>
                ) : (
                  <div className="space-y-3">
                    {ps.etapas_por_departamento.map(d => (
                      <div key={d.nome} className="flex items-center gap-3">
                        <span className="w-32 truncate text-right text-xs font-medium text-foreground">{d.nome}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${effColor(d.eficiencia)}`} style={{ width: `${Math.min(d.eficiencia, 100)}%` }} />
                        </div>
                        <span className="w-40 shrink-0 text-right text-[11px] text-muted-foreground">{d.concluidas}/{d.total} · {d.atrasadas} atrasadas</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Tabela completa do ranking */}
            {ps?.ranking_por_tempo?.length ? (
              <ChartCard title="Todos os processos por tempo" subtitle="Ordenado pelos mais longos">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2">Processo</th>
                        <th className="px-4 py-2">Cliente</th>
                        <th className="px-4 py-2">Departamento</th>
                        <th className="px-4 py-2">Operador</th>
                        <th className="px-4 py-2">Etapas</th>
                        <th className="px-4 py-2">Vencimento</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-right">Dias</th>
                        <th className="px-4 py-2 text-center">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ps.ranking_por_tempo.map(x => (
                        <tr key={x.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                          <td className="max-w-[200px] truncate px-4 py-2 font-medium text-foreground">{x.titulo}</td>
                          <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">{x.cliente}</td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground">{x.departamento}</td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground">{x.operador}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{x.etapas_concluidas}/{x.etapas_total}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{x.vencimento ? fmtDate(x.vencimento) : '-'}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{x.status}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-foreground">{x.dias}d</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${x.atrasado ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                              {x.atrasado ? 'Atrasado' : 'No prazo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            ) : null}
          </>
        )}
      </div>

      {/* Tabelas de certificados */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Certificados vencendo</h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{certs.vencendo_lista?.length || 0}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">CNPJ</th>
                  <th className="px-4 py-2">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {(certs.vencendo_lista || []).map(c => (
                  <tr key={c.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="max-w-[260px] truncate px-4 py-2 font-medium text-foreground">{c.nome}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{fmtCnpj(c.cnpj)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-amber-600">{fmtDate(c.certificate_expires_at)}</td>
                  </tr>
                ))}
                {(certs.vencendo_lista || []).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum certificado vencendo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Certificados vencidos</h3>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{certs.vencidos_lista?.length || 0}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">CNPJ</th>
                  <th className="px-4 py-2">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {(certs.vencidos_lista || []).map(c => (
                  <tr key={c.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="max-w-[260px] truncate px-4 py-2 font-medium text-foreground">{c.nome}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{fmtCnpj(c.cnpj)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-rose-600">{fmtDate(c.certificate_expires_at)}</td>
                  </tr>
                ))}
                {(certs.vencidos_lista || []).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum certificado vencido.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
