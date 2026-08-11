import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Hourglass, CheckCircle2, AlertTriangle, TrendingUp, FileText, Download } from 'lucide-react'
import { listAuditoria, listAuditoriaEficiencia, listAuditoriaFiltros } from '../api'
import type { AuditoriaItem } from '../api'
import { fmtDateBR, fmtMoney } from '../helpers'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

type StatusFiltro = '' | 'abertas' | 'concluidas'

function diasBadge(dias: number, concluida: boolean): { label: string; cls: string } {
  if (concluida) {
    if (dias <= 0) return { label: 'no prazo', cls: 'bg-emerald-100 text-emerald-700' }
    if (dias <= 5) return { label: `${dias}d`, cls: 'bg-emerald-50 text-emerald-600' }
    if (dias <= 15) return { label: `${dias}d`, cls: 'bg-amber-50 text-amber-600' }
    return { label: `${dias}d`, cls: 'bg-rose-50 text-rose-600' }
  }
  if (dias <= 0) return { label: 'no prazo', cls: 'bg-emerald-100 text-emerald-700' }
  if (dias <= 5) return { label: `${dias}d aberto`, cls: 'bg-amber-50 text-amber-600' }
  if (dias <= 15) return { label: `${dias}d aberto`, cls: 'bg-orange-50 text-orange-600' }
  return { label: `${dias}d aberto`, cls: 'bg-rose-50 text-rose-600 animate-pulse' }
}

export default function AuditoriaTab() {
  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [colaboradorId, setColaboradorId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [status, setStatus] = useState<StatusFiltro>('')

  const { data: itens = [] } = useQuery({ queryKey: ['obrigacoes-auditoria'], queryFn: listAuditoria, staleTime: 60_000 })
  const { data: efic } = useQuery({ queryKey: ['obrigacoes-auditoria-eficiencia'], queryFn: listAuditoriaEficiencia, staleTime: 60_000 })
  const { data: filtros } = useQuery({ queryKey: ['obrigacoes-auditoria-filtros'], queryFn: listAuditoriaFiltros, staleTime: 10 * 60_000 })

  const s = useSortable('titulo')
  const filtered = useMemo(() => {
    let arr = itens
    if (status === 'abertas') arr = arr.filter(i => i.status !== 'Concluida' && i.status !== 'Concluída')
    if (status === 'concluidas') arr = arr.filter(i => i.status === 'Concluida' || i.status === 'Concluída')
    if (clienteId) arr = arr.filter(i => i.client_name === filtros?.clientes.find(c => c.id === Number(clienteId))?.name)
    if (titulo) arr = arr.filter(i => i.titulo === titulo)
    if (colaboradorId) arr = arr.filter(i => i.concluido_por_nome === filtros?.colaboradores.find(c => c.id === Number(colaboradorId))?.name)
    if (dataInicio) arr = arr.filter(i => (i.concluida_em || '').slice(0, 10) >= dataInicio)
    if (dataFim) arr = arr.filter(i => (i.concluida_em || '').slice(0, 10) <= dataFim)
    return sortItems<AuditoriaItem>(arr, s.sortKey, s.sortDir, i => {
      if (s.sortKey === 'cliente') return i.client_name || ''
      if (s.sortKey === 'depto') return i.departamento_nome || ''
      if (s.sortKey === 'responsavel') return i.responsavel_nome || ''
      if (s.sortKey === 'concluido_por') return i.concluido_por_nome || ''
      if (s.sortKey === 'data') return i.concluida_em || ''
      if (s.sortKey === 'valor') return i.valor_total ?? -1
      if (s.sortKey === 'dias') return i.dias_em_aberto ?? 0
      if (s.sortKey === 'venc') return i.vencimento_legal_date || ''
      return i.titulo || ''
    })
  }, [itens, clienteId, titulo, colaboradorId, dataInicio, dataFim, status, filtros, s.sortKey, s.sortDir])

  const abertas = itens.filter(i => i.status !== 'Concluida' && i.status !== 'Concluída')
  const concluidas = itens.filter(i => i.status === 'Concluida' || i.status === 'Concluída')
  const atrasadas = abertas.filter(i => i.dias_em_aberto > 0)
  const mediaAtraso = abertas.length > 0
    ? Math.round(atrasadas.reduce((acc, i) => acc + i.dias_em_aberto, 0) / abertas.length)
    : 0

  const eficColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500'
    if (pct >= 50) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  const inputCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card-soft rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[#0078d4]">
            <Hourglass className="h-3.5 w-3.5" /> Em aberto
          </div>
          <div className="mt-1 text-xl font-bold text-foreground">{abertas.length}</div>
        </div>
        <div className="card-soft rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Atrasadas
          </div>
          <div className="mt-1 text-xl font-bold text-foreground">{atrasadas.length}</div>
          <div className="text-[10px] text-muted-foreground">média {mediaAtraso}d em aberto</div>
        </div>
        <div className="card-soft rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídas
          </div>
          <div className="mt-1 text-xl font-bold text-foreground">{concluidas.length}</div>
        </div>
        <div className="card-soft rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[#0078d4]">
            <TrendingUp className="h-3.5 w-3.5" /> Eficiência
          </div>
          <div className="mt-1 text-xl font-bold text-foreground">
            {itens.length > 0 ? Math.round((concluidas.length / itens.length) * 100) : 0}%
          </div>
          <div className="text-[10px] text-muted-foreground">concluídas / total</div>
        </div>
      </div>

      {/* Eficiência mensal por colaborador */}
      {efic && efic.colaboradores.length > 0 && (
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Eficiência mensal por colaborador</h3>
              <p className="text-xs text-muted-foreground">Obrigações atribuídas × concluídas nos últimos 6 meses</p>
            </div>
            <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
              {efic.colaboradores.length} colaboradores
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-card shadow-sm">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Colaborador</th>
                  {efic.meses.map(m => (
                    <th key={m} className="px-3 py-2.5 text-center">{m}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center">Total</th>
                  <th className="px-4 py-2.5 text-right">Eficiência</th>
                </tr>
              </thead>
              <tbody>
                {efic.colaboradores.map(c => (
                  <tr key={c.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.nome}</td>
                    {c.serie.map(m => (
                      <td key={m.mes} className="px-3 py-2.5 text-center">
                        {m.total === 0 ? (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        ) : (
                          <span className={`inline-flex min-w-[44px] items-center justify-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            m.concluidas === m.total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {m.concluidas}/{m.total}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-medium text-foreground">{c.concluidas}/{c.total}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${eficColor(c.eficiencia)}`} style={{ width: `${c.eficiencia}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-foreground">{c.eficiencia}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{filtered.length}</span> obrigação(ões)
        {status === 'abertas' ? ' em aberto' : status === 'concluidas' ? ' concluída(s)' : ''}
      </div>

      {/* Filtros */}
      <div className="card-soft flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Situação</label>
          <select value={status} onChange={e => setStatus(e.target.value as StatusFiltro)} className={`${inputCls} w-40`}>
            <option value="">Todas</option>
            <option value="abertas">Em aberto</option>
            <option value="concluidas">Concluídas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={`${inputCls} w-44`}>
            <option value="">Todos</option>
            {(filtros?.clientes || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Obrigação</label>
          <select value={titulo} onChange={e => setTitulo(e.target.value)} className={`${inputCls} w-44`}>
            <option value="">Todas</option>
            {(filtros?.titulos || []).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Colaborador</label>
          <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)} className={`${inputCls} w-40`}>
            <option value="">Todos</option>
            {(filtros?.colaboradores || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Fim</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Tabela */}
      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-border/60 bg-card shadow-sm">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SortableTh k="titulo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Título</SortableTh>
                <SortableTh k="cliente" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Cliente</SortableTh>
                <SortableTh k="depto" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Depto</SortableTh>
                <SortableTh k="venc" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Venc. Legal</SortableTh>
                <SortableTh k="responsavel" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Responsável</SortableTh>
                <SortableTh k="concluido_por" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Concluído por</SortableTh>
                <SortableTh k="data" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Data Conclusão</SortableTh>
                <SortableTh k="dias" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Dias em aberto</SortableTh>
                <SortableTh k="valor" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="right">Valor</SortableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const concluida = i.status === 'Concluida' || i.status === 'Concluída'
                const badge = diasBadge(i.dias_em_aberto, concluida)
                return (
                  <tr key={i.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        {i.titulo}
                        {i.documento_requerido && <FileText className="h-3.5 w-3.5 text-amber-500" aria-label="Documento requerido" />}
                        {concluida && i.arquivo_path && (
                          <a href={`/api/obrigacoes/${i.id}/arquivo`} target="_blank" rel="noreferrer" className="text-[#0078d4] hover:underline" title="Anexo">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </span>
                      {!concluida && (
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          i.dias_em_aberto > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {i.dias_em_aberto > 0 ? 'Atrasada' : 'No prazo'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{i.client_name || '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{i.departamento_nome || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fmtDateBR(i.vencimento_legal_date)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{i.responsavel_nome || '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{concluida ? (i.concluido_por_nome || '-') : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{concluida ? fmtDateBR(i.concluida_em) : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-foreground">{fmtMoney(i.valor_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma obrigação encontrada.</div>
          )}
        </div>
      </div>
    </div>
  )
}
