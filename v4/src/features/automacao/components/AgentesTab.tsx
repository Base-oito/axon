import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { MonitorSmartphone, ChevronDown, Copy, Check } from 'lucide-react'
import type { Agente } from '../types'
import { editarAgente, excluirAgente, instalarCertificado, listAgenteTarefas, listAgentes, listClientesCert } from '../api'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

const TASK_TYPE_LABEL: Record<string, string> = { install: 'Instalação', default: 'Tarefa' }

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  concluida: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  downloading: { label: 'Baixando', cls: 'bg-blue-50 text-blue-700' },
  running: { label: 'Executando', cls: 'bg-blue-50 text-blue-700' },
  failed: { label: 'Falhou', cls: 'bg-red-50 text-red-700' },
  erro: { label: 'Falhou', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' },
}

const PS_COMMAND = "powershell -Command \"& { Invoke-Expression (Invoke-WebRequest -UseBasicParsing -Uri 'http://72.60.11.156:3003/downloads/agent/install').Content }\""

function fmtHeartbeat(d: string | null) {
  if (!d) return 'Nunca'
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmtDateTimeBR(d: string | null | undefined) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return d
  }
}

export default function AgentesTab() {
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [copied, setCopied] = useState(false)
  const [installAgentId, setInstallAgentId] = useState<number | null>(null)
  const [editAgent, setEditAgent] = useState<Agente | null>(null)
  const [error, setError] = useState('')

  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes'],
    queryFn: listAgentes,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes-cert'], queryFn: listClientesCert, staleTime: 10 * 60_000 })
  const { data: tarefas = [] } = useQuery({
    queryKey: ['agente-tarefas', expandedId],
    queryFn: () => (expandedId ? listAgenteTarefas(expandedId) : Promise.resolve([])),
    enabled: !!expandedId,
    staleTime: 15_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agentes'] })
    qc.invalidateQueries({ queryKey: ['agente-tarefas'] })
  }

  const online = agentes.filter(a => a.online).length
  const ativos = agentes.filter(a => a.active).length

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(PS_COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleInstall = async (clientId: number) => {
    if (installAgentId == null) return
    setError('')
    try {
      const r = await instalarCertificado(installAgentId, clientId)
      alert(`Tarefa de instalação criada (#${r.task_id}). O agente irá baixar e instalar o certificado automaticamente.`)
      setInstallAgentId(null)
      invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar tarefa')
    }
  }

  const handleDelete = async (a: Agente) => {
    if (!confirm(`Excluir o agente ${a.machine_name}?`)) return
    try {
      await excluirAgente(a.id)
      invalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir agente')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{ativos}</span> ativos de {agentes.length} ·{' '}
          <span className="font-semibold text-emerald-600">{online}</span> online
        </div>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          {showGuide ? 'Ocultar' : 'Guia PowerShell'}
        </button>
      </div>

      {showGuide && (
        <div className="card-soft rounded-lg bg-card p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Execute o PowerShell como <span className="font-semibold text-foreground">Administrador</span> na máquina Windows:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{PS_COMMAND}</code>
            <button
              onClick={copyCmd}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0078d4]/40 bg-[#0078d4]/10 px-3 py-2 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {agentes.length === 0 ? (
        <div className="card-soft rounded-lg bg-card py-14 text-center">
          <MonitorSmartphone className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-foreground">Nenhum agente registrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Instale o agente Windows em uma máquina para gerenciar certificados remotamente.
          </p>
          <div className="mx-auto mt-4 max-w-xl overflow-x-auto rounded-lg bg-muted px-4 py-3 text-left">
            <code className="font-mono text-[11px] text-foreground">curl -sSL https://axon.baseoito.org/agent/install.sh | bash</code>
          </div>
        </div>
      ) : (
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="divide-y divide-border/40">
            {agentes.map(a => {
              const isOpen = expandedId === a.id
              return (
                <div key={a.id}>
                  <div
                    className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    onClick={() => setExpandedId(isOpen ? null : a.id)}
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      {a.online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${a.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{a.machine_name}</span>
                        {a.client_name && (
                          <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700">{a.client_name}</span>
                        )}
                        <span className="text-xs text-muted-foreground">por {a.operator_name || '-'}</span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{a.machine_id}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-muted-foreground">Versão</p>
                        <p className="mt-0.5 font-mono font-medium text-foreground">{a.agent_version || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Heartbeat</p>
                        <p className="mt-0.5 font-medium text-foreground">{fmtHeartbeat(a.last_heartbeat)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.online ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {a.online ? 'Online' : 'Offline'}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-4 pb-3">
                    <button
                      onClick={e => { e.stopPropagation(); setInstallAgentId(a.id); setError('') }}
                      disabled={!a.active}
                      className="rounded bg-[#0078d4] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/80 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Instalar Certificado
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditAgent(a) }}
                      className="rounded border border-[#0078d4]/30 px-3 py-1.5 text-xs tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
                    >
                      Editar
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(a) }}
                      className="rounded border border-red-400/30 px-3 py-1.5 text-xs tracking-wider text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Excluir
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border/40 bg-muted/20 px-4 py-4">
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico de Tarefas</h4>
                      {tarefas.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa para este agente.</p>
                      ) : (
                        <HistoricoTarefas tarefas={tarefas} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal Instalar Certificado */}
      {installAgentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[560px] max-w-full rounded-xl border border-border bg-card shadow-lg">
            <div className="border-b border-border/60 px-6 py-4">
              <h3 className="text-sm font-semibold text-foreground">Instalar Certificado</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Escolha o cliente — o agente baixará o certificado e instalará automaticamente.
              </p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {clientes.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/30">
                  <div>
                    <p className="text-sm text-foreground">{c.name || c.nome || `Cliente #${c.id}`}</p>
                    {c.cnpj && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.cnpj}</p>}
                  </div>
                  <button
                    onClick={() => handleInstall(c.id)}
                    className="rounded bg-[#0078d4] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/80"
                  >
                    Instalar →
                  </button>
                </div>
              ))}
            </div>
            {error && <div className="px-6 pb-3 text-xs text-rose-600">{error}</div>}
            <div className="flex justify-end border-t border-border/60 px-6 py-4">
              <button onClick={() => setInstallAgentId(null)} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Agente */}
      {editAgent && (
        <EditAgenteModal
          agente={editAgent}
          clientes={clientes}
          onClose={() => setEditAgent(null)}
          onSaved={() => { setEditAgent(null); invalidate() }}
        />
      )}
    </div>
  )
}

function HistoricoTarefas({ tarefas }: { tarefas: import('../types').AgenteTask[] }) {
  const s = useSortable('created_at')
  const sorted = sortItems(tarefas, s.sortKey, s.sortDir, t => {
    if (s.sortKey === 'cliente') return t.client_name || ''
    if (s.sortKey === 'tipo') return t.task_type || ''
    if (s.sortKey === 'status') return t.status || ''
    if (s.sortKey === 'created') return t.created_at || ''
    if (s.sortKey === 'completed') return t.completed_at || ''
    return t.id
  })
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <SortableTh k="cliente" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Cliente</SortableTh>
            <SortableTh k="tipo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Tipo</SortableTh>
            <SortableTh k="status" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Status</SortableTh>
            <SortableTh k="created" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Criada</SortableTh>
            <SortableTh k="completed" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Concluída</SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => {
            const sc = TASK_STATUS[t.status] || { label: t.status, cls: 'bg-muted text-muted-foreground' }
            return (
              <tr key={t.id} className="border-t border-border/40">
                <td className="py-2 pr-3 font-medium text-foreground">{t.client_name || '-'}</td>
                <td className="py-2 pr-3 text-muted-foreground">{TASK_TYPE_LABEL[t.task_type] || t.task_type}</td>
                <td className="py-2 pr-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${sc.cls}`}>{sc.label}</span>
                  {t.error_message && <span className="ml-2 text-[10px] text-red-500">{t.error_message}</span>}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{fmtDateTimeBR(t.created_at)}</td>
                <td className="py-2 text-muted-foreground">{fmtDateTimeBR(t.completed_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EditAgenteModal({ agente, clientes, onClose, onSaved }: {
  agente: Agente
  clientes: { id: number; name?: string; nome?: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [machineName, setMachineName] = useState(agente.machine_name)
  const [operator, setOperator] = useState(agente.operator_name || '')
  const [clienteId, setClienteId] = useState(agente.cliente_id ? String(agente.cliente_id) : '')
  const [ativo, setAtivo] = useState(!!agente.active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await editarAgente(agente.id, {
        machine_name: machineName,
        operator_name: operator,
        cliente_id: clienteId ? Number(clienteId) : null,
        active: ativo,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[480px] max-w-full rounded-xl border border-border bg-card shadow-lg">
        <div className="border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Editar Agente</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{agente.machine_id}</p>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome da Máquina</label>
            <input type="text" value={machineName} onChange={e => setMachineName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Operador</label>
            <input type="text" value={operator} onChange={e => setOperator(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls}>
              <option value="">Nenhum</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Vincular cliente restringe as tarefas de instalação desta máquina.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="h-4 w-4 accent-[#0078d4]" />
            Ativo
          </label>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
