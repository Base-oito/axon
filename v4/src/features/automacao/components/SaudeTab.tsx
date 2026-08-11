import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { MonitorSmartphone, RefreshCw } from 'lucide-react'

interface Agente {
  id: number
  machine_name: string
  operator_name?: string
  agent_version?: string
  cliente_id?: number | null
  client_name?: string | null
  active?: boolean
  online?: boolean
  last_heartbeat?: string | null
  heartbeat_interval?: number
}

function fmtLastSeen(d?: string | null) {
  if (!d) return 'nunca'
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function SaudeTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['agentes'],
    queryFn: () => apiFetch<Agente[]>('/api/agentes'),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const agentes = data || []
  const online = agentes.filter(a => a.online).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{agentes.length}</span> computadores ·{' '}
          <span className="font-semibold text-emerald-600">{online}</span> online
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agentes.map(a => (
          <div key={a.id} className="card-soft hover-lift rounded-lg bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.online ? 'bg-emerald-50' : 'bg-muted'}`}>
                  <MonitorSmartphone className={`h-5 w-5 ${a.online ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{a.machine_name}</p>
                  <p className="text-xs text-muted-foreground">{a.operator_name || '—'}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.online ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {a.online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Versão</p>
                <p className="mt-0.5 font-mono font-medium text-foreground">{a.agent_version || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Última conexão</p>
                <p className="mt-0.5 font-medium text-foreground">{fmtLastSeen(a.last_heartbeat)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && agentes.length === 0 && (
        <div className="card-soft rounded-lg bg-card py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum agente registrado.</p>
        </div>
      )}
    </div>
  )
}
