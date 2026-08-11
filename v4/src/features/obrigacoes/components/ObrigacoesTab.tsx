import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Download, Check, RotateCcw, FileText, Loader2, X, Upload } from 'lucide-react'
import type { Obrigacao } from '../api'
import { atualizarObrigacao, atualizarValor, criarObrigacao, excluirObrigacao, listObrigacoes, urlDownloadAnexo, uploadAnexo, alterarStatus } from '../api'
import { PRIO_BADGE, PRIORIDADES, RECORRENCIA_OPTIONS, STATUS_BADGE, fmtDateBR, fmtMoney, isOverdue, isSoon } from '../helpers'
import { useClientes, useDepartamentos } from '@/features/processos/hooks/useShared'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

function getUserRole(): string {
  try {
    const tok = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
    if (tok) return JSON.parse(atob(tok.split('.')[1])).role || ''
  } catch {
    // ignore
  }
  return ''
}

const isLeader = () => ['administrador', 'lider', 'super_admin'].includes(getUserRole())

export default function ObrigacoesTab() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editObr, setEditObr] = useState<Obrigacao | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const [anexoMsg, setAnexoMsg] = useState<{ id: number; texto: string; erro?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileTarget = useRef<number | null>(null)

  const { data: obrigacoes = [] } = useQuery({ queryKey: ['obrigacoes'], queryFn: listObrigacoes, staleTime: 30_000 })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['obrigacoes'] })

  const mutConcluir = useMutation({
    mutationFn: ({ id, concluir }: { id: number; concluir: boolean }) =>
      alterarStatus(id, concluir ? 'Concluida' : 'Pendente'),
    onSuccess: invalidate,
    onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao alterar status'),
  })

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file || fileTarget.current === null) return
    const id = fileTarget.current
    fileTarget.current = null
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setAnexoMsg({ id, texto: 'Somente arquivos PDF são aceitos', erro: true })
      return
    }
    setUploading(id)
    setAnexoMsg(null)
    try {
      await uploadAnexo(id, file)
      setAnexoMsg({ id, texto: 'Documento anexado' })
      invalidate()
    } catch (e) {
      setAnexoMsg({ id, texto: e instanceof Error ? e.message : 'Falha no upload', erro: true })
    }
    setUploading(null)
  }

  const triggerUpload = (id: number) => {
    fileTarget.current = id
    fileRef.current?.click()
  }

  const handleConcluir = (o: Obrigacao) => {
    if (o.documento_requerido && !o.arquivo_path) {
      alert('Esta obrigação requer documento anexado (PDF) para ser concluída.')
      return
    }
    mutConcluir.mutate({ id: o.id, concluir: o.status !== 'Concluida' })
  }

  const mutDelete = useMutation({ mutationFn: excluirObrigacao, onSuccess: invalidate })

  const mutValor = useMutation({
    mutationFn: ({ id, valor }: { id: number; valor: number | null }) => atualizarValor(id, valor),
    onSuccess: invalidate,
  })

  const s = useSortable('titulo')
  const filtered = useMemo(() => {
    let arr: Obrigacao[] = obrigacoes
    if (q.trim()) {
      const t = q.trim().toLowerCase()
      arr = arr.filter(o => (o.titulo || '').toLowerCase().includes(t) || (o.client_name || '').toLowerCase().includes(t))
    }
    if (statusFiltro === 'Atrasada') {
      arr = arr.filter(o => isOverdue(o))
    } else if (statusFiltro) {
      arr = arr.filter(o => o.status === statusFiltro)
    }
    return sortItems<Obrigacao>(arr, s.sortKey, s.sortDir, o => {
      if (s.sortKey === 'cliente') return o.client_name || ''
      if (s.sortKey === 'depto') return o.departamento_nome || ''
      if (s.sortKey === 'meta') return o.meta_interna_date || ''
      if (s.sortKey === 'venc') return o.vencimento_legal_date || ''
      if (s.sortKey === 'status') return o.status || ''
      if (s.sortKey === 'prioridade') return o.prioridade || ''
      if (s.sortKey === 'responsavel') return o.responsavel_nome || ''
      if (s.sortKey === 'valor') return o.valor_total ?? -1
      return o.titulo || ''
    })
  }, [obrigacoes, q, statusFiltro, s.sortKey, s.sortDir])

  const total = filtered.length
  const pendentes = filtered.filter(o => o.status === 'Pendente').length
  const concluidas = filtered.filter(o => o.status === 'Concluida' || o.status === 'Concluída').length
  const atrasadas = filtered.filter(o => isOverdue(o)).length

  const editValor = (o: Obrigacao) => {
    const raw = prompt('Novo valor total (R$):', o.valor_total != null ? String(o.valor_total) : '')
    if (raw === null) return
    const v = parseFloat(raw.replace(',', '.'))
    if (isNaN(v)) {
      alert('Valor inválido')
      return
    }
    mutValor.mutate({ id: o.id, valor: v })
  }

  const confirmDelete = (o: Obrigacao) => {
    if (!confirm(`Excluir a obrigação "${o.titulo}"?`)) return
    mutDelete.mutate(o.id)
  }

  const openNew = () => { setEditObr(null); setShowModal(true) }
  const openEdit = (o: Obrigacao) => { setEditObr(o); setShowModal(true) }

  return (
    <div className="space-y-5">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: total, cls: 'text-[#0078d4]' },
          { label: 'Pendentes', value: pendentes, cls: 'text-amber-600' },
          { label: 'Concluídas', value: concluidas, cls: 'text-emerald-600' },
          { label: 'Atrasadas', value: atrasadas, cls: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="card-soft rounded-lg bg-card p-4">
            <div className={`text-xs font-medium ${c.cls}`}>{c.label}</div>
            <div className="mt-1 text-xl font-bold text-foreground">{c.value.toLocaleString('pt-BR')}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card-soft flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por título ou cliente..."
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos</option>
            <option value="Pendente">Pendente</option>
            <option value="Concluida">Concluída</option>
            <option value="Atrasada">Atrasada</option>
          </select>
        </div>
        <button
          onClick={openNew}
          disabled={!isLeader()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Nova Obrigação
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
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
                <SortableTh k="meta" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Meta Interna</SortableTh>
                <SortableTh k="venc" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Venc. Legal</SortableTh>
                <SortableTh k="status" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Status</SortableTh>
                <SortableTh k="prioridade" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Prioridade</SortableTh>
                <SortableTh k="responsavel" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Responsável</SortableTh>
                <SortableTh k="valor" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="right">Valor</SortableTh>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anexo</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const overdue = isOverdue(o)
                const soon = isSoon(o)
                return (
                  <tr key={o.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <button onClick={() => openEdit(o)} disabled={!isLeader()} className="text-left font-medium text-foreground transition-colors hover:text-[#0078d4] disabled:cursor-default disabled:hover:text-foreground">
                        {o.titulo}
                      </button>
                      {o.documento_requerido && <FileText className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Documento requerido" />}
                      {(o.status === 'Concluida' || o.status === 'Concluída') && o.concluido_por_nome && (
                        <div className="text-[10px] text-muted-foreground">
                          {o.concluido_por_nome} em {fmtDateBR(o.concluida_em)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.client_name || '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.departamento_nome || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fmtDateBR(o.meta_interna_date)}</td>
                    <td className={`px-4 py-2.5 font-mono text-xs ${overdue ? 'font-medium text-red-600' : soon ? 'font-medium text-amber-600' : 'text-muted-foreground'}`}>
                      {fmtDateBR(o.vencimento_legal_date)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[o.status] || 'bg-muted text-muted-foreground'}`}>
                        {overdue ? 'Atrasada' : (o.status || 'Pendente')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${PRIO_BADGE[o.prioridade] || 'bg-muted text-muted-foreground'}`}>
                        {o.prioridade || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.responsavel_nome || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isLeader() ? (
                        <button onClick={() => editValor(o)} title="Clique para editar" className="font-mono text-xs text-foreground transition-colors hover:text-[#0078d4]">
                          {fmtMoney(o.valor_total)}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-foreground">{fmtMoney(o.valor_total)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {o.arquivo_path ? (
                          o.pode_download === false ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title="Documento entregue — apenas o responsável pode baixar">
                              <FileText className="h-3.5 w-3.5" /> Entregue
                            </span>
                          ) : (
                            <a
                              href={urlDownloadAnexo(o.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#0078d4] transition-colors hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" /> Baixar
                            </a>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        {o.pode_download !== false && (
                          <button
                            onClick={() => triggerUpload(o.id)}
                            disabled={uploading === o.id}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-[#0078d4]"
                            title="Anexar PDF"
                          >
                            {uploading === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      {anexoMsg?.id === o.id && (
                        <div className={`mt-0.5 text-[10px] ${anexoMsg.erro ? 'text-red-600' : 'text-emerald-600'}`}>{anexoMsg.texto}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {o.pode_download !== false && (
                          <>
                            <button
                              onClick={() => handleConcluir(o)}
                              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ${
                                (o.status === 'Concluida' || o.status === 'Concluída')
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={(o.status === 'Concluida' || o.status === 'Concluída') ? 'Reabrir' : 'Concluir'}
                            >
                              {(o.status === 'Concluida' || o.status === 'Concluída') ? (
                                <><RotateCcw className="h-3.5 w-3.5" /> Reabrir</>
                              ) : (
                                <><Check className="h-3.5 w-3.5" /> Concluir</>
                              )}
                            </button>
                            {isLeader() && (
                              <>
                                <button onClick={() => openEdit(o)} className="rounded p-1 text-muted-foreground transition-colors hover:text-[#0078d4]" title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => confirmDelete(o)} className="rounded p-1 text-muted-foreground transition-colors hover:text-red-500" title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {obrigacoes.length === 0 ? 'Nenhuma obrigação cadastrada.' : 'Nenhuma obrigação encontrada com os filtros atuais.'}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <ObrigacaoModal
          obr={editObr}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); invalidate() }}
        />
      )}
    </div>
  )
}

function ObrigacaoModal({ obr, onClose, onSaved }: { obr: Obrigacao | null; onClose: () => void; onSaved: () => void }) {
  const { data: clientes = [] } = useClientes()
  const { data: departamentos = [] } = useDepartamentos()
  const [titulo, setTitulo] = useState(obr?.titulo || '')
  const [clienteId, setClienteId] = useState(obr?.cliente_id ? String(obr.cliente_id) : '')
  const [deptoId, setDeptoId] = useState(obr?.departamento_id ? String(obr.departamento_id) : '')
  const [prioridade, setPrioridade] = useState(obr?.prioridade || 'Media')
  const [recorrencia, setRecorrencia] = useState(obr?.recorrencia || 'Unica')
  const [metaInterna, setMetaInterna] = useState(obr?.meta_interna_date?.slice(0, 10) || '')
  const [vencLegal, setVencLegal] = useState(obr?.vencimento_legal_date?.slice(0, 10) || '')
  const [status, setStatus] = useState('')
  const [valor, setValor] = useState(obr?.valor_total != null ? String(obr.valor_total) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (!titulo.trim()) { setError('Título é obrigatório'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        titulo: titulo.trim(),
        recorrencia,
        prioridade,
        departamento_id: deptoId ? Number(deptoId) : null,
        meta_interna_date: metaInterna || null,
        vencimento_legal_date: vencLegal || null,
      }
      if (obr) {
        if (clienteId) body.cliente_id = Number(clienteId)
        if (status) body.status = status
        if (valor !== '') body.valor_total = parseFloat(valor.replace(',', '.'))
      } else {
        body.cliente_id = clienteId ? Number(clienteId) : null
      }
      if (obr) await atualizarObrigacao(obr.id, body)
      else await criarObrigacao(body)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{obr ? 'Editar Obrigação' : 'Nova Obrigação'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.nome || c.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Departamento</label>
              <select value={deptoId} onChange={e => setDeptoId(e.target.value)} className={inputCls}>
                <option value="">Nenhum</option>
                {departamentos.map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Prioridade</label>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className={inputCls}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Recorrência</label>
              <select value={recorrencia} onChange={e => setRecorrencia(e.target.value)} className={inputCls}>
                {RECORRENCIA_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Meta Interna</label>
              <input type="date" value={metaInterna} onChange={e => setMetaInterna(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Vencimento Legal</label>
              <input type="date" value={vencLegal} onChange={e => setVencLegal(e.target.value)} className={inputCls} />
            </div>
          </div>
          {obr && (
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                    <option value="">Não alterar</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Concluida">Concluída</option>
                    <option value="Atrasada">Atrasada</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor (R$)</label>
                  <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Salvando...' : obr ? 'Salvar' : 'Criar Obrigação'}
          </button>
        </div>
      </div>
    </div>
  )
}
