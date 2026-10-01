import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { FolderKanban, Target, CheckCircle2, Clock, TrendingUp, AlertTriangle, Filter, ChevronDown } from 'lucide-react'

interface KPI {
  projetos: number; objetivos: number; tarefas_total: number; tarefas_concluidas: number
  tarefas_pendentes: number; horas: number; progresso_medio: number
  atrasados: number; em_dia: number; sem_prazo: number
  indicadores_total: number; indicadores_acima: number; indicadores_abaixo: number; indicadores_sem_feedback: number
}
interface ProjRes { id: number; titulo: string; prazo?: string; status: string; responsavel_nome?: string; progresso: number; peso_total: number; tarefas: number; tarefas_concluidas: number; horas: number; cor?: string }
interface IndRes { id: number; projeto_id: number; projeto_titulo: string; objetivo_titulo: string; indicador: string; direcao: string; base?: number|null; meta?: number|null; atual?: number|null; unidade: string }

interface Res { kpis: KPI; projetos: ProjRes[]; indicadores: IndRes[] }

function fmtBR(v?: string | null) { return v ? String(v).slice(0, 10).split('-').reverse().join('/') : '-' }

export default function ProjetosResultados() {
  const [fProjeto, setFProjeto] = useState('')
  const [fResponsavel, setFResponsavel] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fIndicadores, setFIndicadores] = useState(false)

  const { data: projetos = [] } = useQuery({ queryKey: ['projetos'], queryFn: () => apiFetch<any[]>('/api/projetos'), staleTime: 30_000 })
  const { data: usuarios = [] } = useQuery({ queryKey: ['projetos-usuarios'], queryFn: () => apiFetch<any[]>('/api/usuarios?limit=500'), staleTime: 5 * 60_000 })

  const params = new URLSearchParams()
  if (fProjeto) params.set('projeto_id', fProjeto)
  if (fResponsavel) params.set('responsavel_id', fResponsavel)
  if (fStatus) params.set('status', fStatus)
  const qs = params.toString()

  const { data: res } = useQuery<Res>({
    queryKey: ['projetos-dashboard', qs],
    queryFn: () => apiFetch<Res>(`/api/projetos/dashboard-analitico${qs ? `?${qs}` : ''}`),
    staleTime: 20_000,
  })

  const kpis = res?.kpis
  const projLista = (res?.projetos || [])
  const inds = (res?.indicadores || [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Resultados de Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">KPIs, progresso e indicadores de todos os projetos do escritório</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-soft flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Filter className="h-4 w-4" /> Filtros</div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Projeto</label>
          <select value={fProjeto} onChange={e => setFProjeto(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos</option>
            {projetos.map((p: any) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Responsável</label>
          <select value={fResponsavel} onChange={e => setFResponsavel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos</option>
            {usuarios.map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Status</label>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <button onClick={() => { setFProjeto(''); setFResponsavel(''); setFStatus('') }}
          className="h-9 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Limpar</button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPI label="Projetos" value={kpis.projetos} icon={<FolderKanban className="h-5 w-5" />} color="#0078d4" sub={`${kpis.em_dia} em dia · ${kpis.atrasados} atrasados`} />
          <KPI label="Objetivos" value={kpis.objetivos} icon={<Target className="h-5 w-5" />} color="#8b5cf6" sub={`${kpis.sem_prazo} sem prazo`} />
          <KPI label="Tarefas" value={kpis.tarefas_total} icon={<CheckCircle2 className="h-5 w-5" />} color="#2fbf71" sub={`${kpis.tarefas_concluidas} concluídas · ${kpis.tarefas_pendentes} pendentes`} />
          <KPI label="Progresso médio" value={`${kpis.progresso_medio}%`} icon={<TrendingUp className="h-5 w-5" />} color="#f5a623" sub={`${kpis.horas} h apontadas`} />
          <KPI label="Atrasados" value={kpis.atrasados} icon={<AlertTriangle className="h-5 w-5" />} color="#e5484d" sub={`${kpis.em_dia} dentro do prazo`} />
          <KPI label="Horas totais" value={kpis.horas} icon={<Clock className="h-5 w-5" />} color="#0ea5e9" sub={`média ${kpis.horas ? (kpis.horas / (kpis.projetos || 1)).toFixed(1) : 0}h/projeto`} />
          <KPI label="Indicadores" value={kpis.indicadores_total} icon={<TrendingUp className="h-5 w-5" />} color="#14b8a6" sub={`${kpis.indicadores_acima} acima · ${kpis.indicadores_abaixo} abaixo · ${kpis.indicadores_sem_feedback} sem atual`} />
          <KPI label="Eficiência (tarefas)" value={kpis.tarefas_total ? `${Math.round(kpis.tarefas_concluidas / kpis.tarefas_total * 100)}%` : '—'} icon={<CheckCircle2 className="h-5 w-5" />} color="#f59e0b" sub={`${kpis.tarefas_concluidas} de ${kpis.tarefas_total}`} />
        </div>
      )}

      {/* Progresso por projeto */}
      <div className="card-soft rounded-lg bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Progresso por projeto</h3>
        {projLista.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
        ) : (
          <div className="space-y-3">
            {projLista.map(p => (
              <div key={p.id} className="rounded-lg border border-border/50 bg-muted/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: (p.cor || '#0078d4') + '18', color: p.cor || '#0078d4' }}>
                      <FolderKanban className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.titulo}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.responsavel_nome || 'Sem responsável'} · prazo {fmtBR(p.prazo)} · {p.tarefas} tarefas ({p.tarefas_concluidas} concluídas) · {p.horas}h
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-foreground">{p.progresso}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Number(p.progresso) || 0, 100)}%`, background: p.cor || '#0078d4' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Indicadores */}
      <div className="card-soft rounded-lg bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Indicadores</h3>
          <button onClick={() => setFIndicadores(!fIndicadores)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Detalhes <ChevronDown className={`h-3.5 w-3.5 transition-transform ${fIndicadores ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {inds.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum indicador definido nos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Indicador</th><th className="px-2 py-2">Projeto</th><th className="px-2 py-2">Objetivo</th>
                  <th className="px-2 py-2">Base</th><th className="px-2 py-2">Meta</th><th className="px-2 py-2">Atual</th><th className="px-2 py-2 text-right">% Meta</th>
                </tr>
              </thead>
              <tbody>
                {inds.map(i => {
                  const pct = i.meta && i.meta > 0 ? (i.atual ? (i.atual / i.meta) * 100 : 0) : 0
                  const ok = i.meta ? (i.direcao === 'Reduzir' ? (i.atual ?? 9999) <= i.meta : (i.atual ?? -9999) >= i.meta) : null
                  return (
                    <tr key={i.id} className="border-t border-border/40">
                      <td className="px-2 py-2 font-medium text-foreground">{i.indicador} <span className="text-[10px] text-muted-foreground">({i.unidade})</span></td>
                      <td className="px-2 py-2 text-muted-foreground">{i.projeto_titulo}</td>
                      <td className="px-2 py-2 text-muted-foreground">{i.objetivo_titulo || '-'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{i.base ?? '-'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{i.meta ?? '-'}</td>
                      <td className="px-2 py-2 text-foreground">{i.atual ?? '-'}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ok === true ? 'bg-emerald-50 text-emerald-600' : ok === false ? 'bg-rose-50 text-rose-600' : 'bg-muted text-muted-foreground'}`}>
                          {i.meta ? `${pct.toFixed(0)}%` : 'Sem meta'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!fIndicadores && inds.length > 5 && (
              <p className="pt-2 text-center text-[11px] text-muted-foreground">Expanda para ver todos os {inds.length} indicadores.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, icon, color, sub }: { label: string; value: number | string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="card-soft rounded-lg bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: color + '18', color }}>{icon}</span>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}