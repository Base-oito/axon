import { useQuery } from '@tanstack/react-query'
import { clientFetch } from './PortalLogin'
import { ClipboardList, CheckCircle2, Clock, CalendarDays } from 'lucide-react'

type Proz = {
  id: number; titulo: string; status: string; situacao?: string
  etapa_atual?: string | null; pct: number; concluidas: number; total: number
  data_inicio?: string | null; updated_at?: string
}

export default function ProcessosPortal() {
  const q = useQuery({ queryKey: ['cli-proc'], queryFn: () => clientFetch<Proz[]>('/api/client-portal/processos'), staleTime: 30_000 })

  const list = q.data || []
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Andamento de processos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe o progresso dos serviços solicitados ao seu escritório</p>
      </div>

      {q.isLoading ? (
        <div className="card-soft rounded-xl bg-card p-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : list.length === 0 ? (
        <div className="card-soft rounded-xl bg-card py-12 text-center text-sm text-muted-foreground">
          Seus processos em andamento aparecerão aqui quando o escritório liberar o acompanhamento.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map(p => (
            <div key={p.id} className="card-soft rounded-xl bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0078d4]/10 text-[#0078d4]">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p.titulo}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <StatusBadge status={p.status} />
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#0078d4]/10 px-2.5 py-1 text-xs font-bold text-[#0078d4]">{p.pct}%</span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0078d4] to-emerald-500 transition-all" style={{ width: `${p.pct}%` }} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> {p.concluidas} de {p.total} etapas</span>
                {p.etapa_atual && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Atual: {p.etapa_atual}</span>}
                {p.data_inicio && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Início {fmt(p.data_inicio)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pendente: 'bg-amber-500/15 text-amber-500',
    em_execucao: 'bg-[#0078d4]/10 text-[#0078d4]',
    Aguardando_Decisao: 'bg-purple-500/15 text-purple-500',
    Aguardando_Cliente: 'bg-orange-500/15 text-orange-500',
    Concluida: 'bg-emerald-500/15 text-emerald-500',
    Cancelada: 'bg-muted text-muted-foreground',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>{status || '—'}</span>
}

function fmt(d?: string | null) {
  if (!d) return ''
  return String(d).slice(0, 10)
}