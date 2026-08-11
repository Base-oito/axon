import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Play, FileText, X, Loader2 } from 'lucide-react'
import type { Modelo } from '../api'
import { atualizarModelo, criarModelo, excluirModelo, gerarModelo, listModelos } from '../api'
import { PRIO_BADGE, RECORRENCIA_OPTIONS, pad2 } from '../helpers'
import { useClientes, useDepartamentos } from '@/features/processos/hooks/useShared'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

export default function ModelosTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editModelo, setEditModelo] = useState<Modelo | null>(null)
  const { data: modelos = [] } = useQuery({ queryKey: ['modelos'], queryFn: listModelos, staleTime: 2 * 60_000 })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['modelos'] })

  const mutDelete = useMutation({ mutationFn: excluirModelo, onSuccess: invalidate })
  const mutGerar = useMutation({ mutationFn: gerarModelo, onSuccess: invalidate })

  const s = useSortable('titulo')
  const sorted = useMemo(() => sortItems(modelos, s.sortKey, s.sortDir, m => {
    if (s.sortKey === 'recorrencia') return m.recorrencia || ''
    if (s.sortKey === 'depto') return m.departamento_nome || ''
    if (s.sortKey === 'clientes') return m.total_clientes ?? 0
    if (s.sortKey === 'dia_venc') return m.dia_vencimento ?? 99
    if (s.sortKey === 'dia_meta') return m.dia_meta_interna ?? 99
    return m.titulo || ''
  }), [modelos, s.sortKey, s.sortDir])

  const confirmDelete = (m: Modelo) => {
    if (!confirm(`Excluir o modelo "${m.titulo}"?`)) return
    mutDelete.mutate(m.id)
  }

  const handleGerar = (m: Modelo) => {
    if (!confirm(`Gerar obrigações do modelo "${m.titulo}"?`)) return
    mutGerar.mutate(m.id, {
      onSuccess: (d) => {
        const qtd = (d as { geradas?: number }).geradas ?? (d as { count?: number }).count ?? 0
        alert(`${qtd} obrigação(ões) gerada(s)`)
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{modelos.length}</span> modelo(s) — vincule clientes e gere obrigações recorrentes
        </div>
        <button
          onClick={() => { setEditModelo(null); setShowModal(true) }}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Modelo
        </button>
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-border/60 bg-card shadow-sm">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SortableTh k="titulo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Título</SortableTh>
                <SortableTh k="recorrencia" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Recorrência</SortableTh>
                <SortableTh k="depto" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Depto</SortableTh>
                <SortableTh k="clientes" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Clientes</SortableTh>
                <SortableTh k="dia_venc" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Dia Venc.</SortableTh>
                <SortableTh k="dia_meta" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Dia Meta</SortableTh>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr key={m.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-foreground">{m.titulo}</span>
                    {m.documento_requerido && <FileText className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Documento requerido" />}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${PRIO_BADGE[m.prioridade] || 'bg-muted text-muted-foreground'}`}>
                      {m.recorrencia || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.departamento_nome || '-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{m.total_clientes ?? 0}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-muted-foreground">{pad2(m.dia_vencimento)}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-muted-foreground">{pad2(m.dia_meta_interna)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleGerar(m)}
                        disabled={mutGerar.isPending}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-emerald-600 transition-colors hover:bg-emerald-50"
                        title="Gerar obrigações"
                      >
                        <Play className="h-3 w-3" /> Gerar
                      </button>
                      <button onClick={() => { setEditModelo(m); setShowModal(true) }} className="rounded p-1 text-muted-foreground transition-colors hover:text-[#0078d4]" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => confirmDelete(m)} className="rounded p-1 text-muted-foreground transition-colors hover:text-red-500" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {modelos.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum modelo cadastrado.</div>
          )}
        </div>
      </div>

      {showModal && (
        <ModeloModal
          modelo={editModelo}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); invalidate() }}
        />
      )}
    </div>
  )
}

function ModeloModal({ modelo, onClose, onSaved }: { modelo: Modelo | null; onClose: () => void; onSaved: () => void }) {
  const { data: clientes = [] } = useClientes()
  const { data: departamentos = [] } = useDepartamentos()
  const [titulo, setTitulo] = useState(modelo?.titulo || '')
  const [recorrencia, setRecorrencia] = useState(modelo?.recorrencia || 'Mensal')
  const [prioridade, setPrioridade] = useState(modelo?.prioridade || 'Media')
  const [deptoId, setDeptoId] = useState(modelo?.departamento_id ? String(modelo.departamento_id) : '')
  const [diaVenc, setDiaVenc] = useState(modelo?.dia_vencimento != null ? String(modelo.dia_vencimento) : '')
  const [diaMeta, setDiaMeta] = useState(modelo?.dia_meta_interna != null ? String(modelo.dia_meta_interna) : '')
  const [docRequerido, setDocRequerido] = useState(!!modelo?.documento_requerido)
  const [clientIds, setClientIds] = useState<number[]>(modelo?.clientes?.map(c => c.id) || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleClient = (id: number) =>
    setClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

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
        documento_requerido: docRequerido,
        client_ids: clientIds,
      }
      if (diaVenc) body.dia_vencimento = parseInt(diaVenc)
      if (diaMeta) body.dia_meta_interna = parseInt(diaMeta)
      if (modelo) await atualizarModelo(modelo.id, body)
      else await criarModelo(body)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar modelo')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{modelo ? 'Editar Modelo' : 'Novo Modelo de Obrigação'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Recorrência</label>
              <select value={recorrencia} onChange={e => setRecorrencia(e.target.value)} className={inputCls}>
                {RECORRENCIA_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Prioridade</label>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className={inputCls}>
                <option value="Alta">Alta</option>
                <option value="Media">Média</option>
                <option value="Baixa">Baixa</option>
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Dia Vencimento (1-31)</label>
              <input type="number" min={1} max={31} value={diaVenc} onChange={e => setDiaVenc(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Dia Meta Interna (1-31)</label>
              <input type="number" min={1} max={31} value={diaMeta} onChange={e => setDiaMeta(e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={docRequerido} onChange={e => setDocRequerido(e.target.checked)} className="h-4 w-4 accent-[#0078d4]" />
            Documento Requerido
          </label>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Clientes vinculados ({clientIds.length})</label>
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background p-3">
              {clientes.length === 0 && <div className="py-2 text-center text-xs text-muted-foreground">Nenhum cliente disponível</div>}
              {clientes.map(c => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs text-foreground transition-colors hover:text-[#0078d4]">
                  <input type="checkbox" checked={clientIds.includes(c.id)} onChange={() => toggleClient(c.id)} className="h-4 w-4 rounded accent-[#0078d4]" />
                  <span className="min-w-0 flex-1 truncate">{c.name || c.nome || c.id}</span>
                  {c.cnpj && <span className="font-mono text-[10px] text-muted-foreground">{c.cnpj}</span>}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Ao salvar, obrigações futuras são geradas automaticamente para os clientes selecionados.
            </p>
          </div>
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
            {saving ? 'Salvando...' : modelo ? 'Salvar' : 'Criar Modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}
