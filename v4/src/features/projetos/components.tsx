import { useEffect, useState } from 'react'
import { Plus, Trash2, X, Pencil, Target, TrendingUp, Clock } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { Objetivo, TarefaProjeto } from './api'
import { useIndicadorLogs } from './api'

const STATUS = [
  { k: 'nao_iniciado', label: 'Não iniciado', cls: 'bg-muted text-muted-foreground' },
  { k: 'em_andamento', label: 'Em andamento', cls: 'bg-blue-50 text-blue-600' },
  { k: 'bloqueado', label: 'Bloqueado', cls: 'bg-amber-50 text-amber-600' },
  { k: 'concluido', label: 'Concluído', cls: 'bg-emerald-50 text-emerald-600' },
]

export function EsforcoTag({ n }: { n: number }) {
  return <span className="rounded bg-[#0078d4]/10 px-1.5 text-[10px] font-medium text-[#0078d4]">{'●'.repeat(n)}</span>
}

export function ObjetivoCard({ o, mutTarefa, mutObj, usuarios, podeEditar }: {
  o: Objetivo
  mutTarefa: { create: any; upd: any; del: any }
  mutObj?: { del?: any; indicador?: any; indicadorUpd?: any; indicadorDel?: any; ganho?: any; ganhoDel?: any }
  usuarios?: any[]
  podeEditar?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [indModal, setIndModal] = useState<{ open: boolean; edit?: any; objetivoId: number }>({ open: false, objetivoId: o.id })
  const [justModal, setJustModal] = useState<{ tarefa?: TarefaProjeto } | null>(null)
  const [tarefaModal, setTarefaModal] = useState<{ open: boolean; edit?: TarefaProjeto; objetivoId: number } | null>(null)
  const venc = o.prazo ? new Date(o.prazo + 'T00:00:00') : null
  const dias = venc ? Math.ceil((venc.getTime() - Date.now()) / 86400000) : null
  const horas = o.horas || 0
  const usrs = usuarios || []

  const confirmJustificativa = async (just: string) => {
    const t = justModal?.tarefa
    if (!t) return
    await mutTarefa.upd.mutateAsync({ id: t.id, status: 'concluido', justificativa_atraso: just.trim() })
    setJustModal(null)
  }
  const persistTarefa = async (payload: any) => {
    if (tarefaModal?.edit?.id) {
      await mutTarefa.upd.mutateAsync({ id: tarefaModal.edit.id, ...payload })
    } else {
      await mutTarefa.create.mutateAsync({ objetivoId: tarefaModal!.objetivoId, ...payload })
    }
  }
  const respNome = (id?: number | null) => usrs.find(u => u.id === id)?.display_name || usrs.find(u => u.id === id)?.username || ''

  return (
    <div className="card-soft rounded-lg bg-card">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0078d4]/10 text-[#0078d4]"><Target className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold text-foreground">{o.titulo}</p>
            {o.descricao && <p className="text-[11px] text-muted-foreground">{o.descricao}</p>}
            {dias !== null && (
              <p className={`text-[10px] ${dias < 0 ? 'text-rose-600' : dias <= 30 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {dias < 0 ? `Atrasado ${-dias}d` : `${dias}d restantes`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {mutObj?.del && podeEditar && (
            <button
              onClick={() => {
                if (confirm(`Excluir o objetivo "${o.titulo}"? As tarefas, indicadores e ganhos dele também serão removidos.`))
                  mutObj.del!.mutate(o.id)
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
              title="Excluir objetivo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="rounded-lg px-2 py-1 text-xs font-medium text-[#0078d4] hover:bg-[#0078d4]/10">
            {open ? 'Ocultar' : 'Detalhes'}
          </button>
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Progresso (peso {o.peso_total || 0} · feito {o.peso_realizado || 0})</span>
          <span className="font-semibold text-foreground">{o.progresso}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#0078d4] transition-all" style={{ width: `${Math.min(Number(o.progresso) || 0, 100)}%` }} />
        </div>
      </div>

      {/* Tarefas */}
      <div className="border-t border-border/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{o.tarefas.length} tarefa(s)</span>
          <div className="flex items-center gap-2">
            {horas > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" /> {horas}h</span>}
            <button onClick={() => setTarefaModal({ open: true, edit: undefined, objetivoId: o.id })}
              className="inline-flex items-center gap-1 rounded-md bg-[#0078d4] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0078d4]/80">
              <Plus className="h-3.5 w-3.5" /> Tarefa
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {o.tarefas.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">Nenhuma tarefa.</p>}
          {o.tarefas.map(t => {
            const st = STATUS.find(s => s.k === t.status) || STATUS[0]
            const atrasada = t.prazo && t.status !== 'concluido' && new Date(t.prazo + 'T00:00:00') < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
            return (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5">
                <EsforcoTag n={t.esforco || 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs text-foreground">{t.titulo}</span>
                    {t.justificativa_atraso ? (
                      <span title={t.justificativa_atraso} className="cursor-help rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">atraso justificado</span>
                    ) : atrasada && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">VENCIDA</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t.prazo ? `Vence ${String(t.prazo).slice(0, 10)}` : 'Sem vencimento'}
                    {respNome(t.responsavel_id) ? ` · ${respNome(t.responsavel_id)}` : ' · Sem responsável'}
                  </p>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                <button onClick={() => setTarefaModal({ open: true, edit: t, objetivoId: o.id })} className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Editar tarefa">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => mutTarefa.del.mutate(Number(t.id))} className="rounded p-1 text-muted-foreground hover:text-rose-500" title="Excluir tarefa"><Trash2 className="h-3 w-3" /></button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Indicadores + ganhos */}
      {open && (
        <div className="border-t border-border/50 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Indicadores</div>
          {o.indicadores.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhum indicador definido.</p>
          ) : (
            <div className="space-y-1.5">
              {o.indicadores.map(i => {
                const pct = i.meta && i.meta > 0 ? (i.atual ? (i.atual / i.meta) * 100 : 0) : 0
                return (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-foreground">{i.indicador}</p>
                      <p className="text-[10px] text-muted-foreground">{i.base ?? 0} → {i.meta ?? 0} · atual {i.atual ?? 0}</p>
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <span className={`text-xs font-semibold ${i.direcao === 'Reduzir' && (i.atual ?? 0) <= (i.meta ?? 0) ? 'text-emerald-600' : 'text-[#0078d4]'}`}>{pct.toFixed(0)}%</span>
                      <button onClick={() => setIndModal({ open: true, edit: i, objetivoId: o.id })}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Editar">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => mutObj?.indicadorDel?.mutate(i.id)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600" title="Excluir">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {mutObj && (
            <button onClick={() => setIndModal({ open: true, edit: undefined, objetivoId: o.id })}
              className="mt-2 inline-flex items-center gap-1 rounded border border-[#0078d4]/30 px-2 py-1 text-[11px] font-medium text-[#0078d4] hover:bg-[#0078d4]/10"><Plus className="h-3 w-3" /> Indicador</button>
          )}
          {open && o.ganhos && o.ganhos.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ganhos</p>
              {o.ganhos.map(g => (
                <div key={g.id} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-foreground">
                  {g.descricao} <span className="text-[10px] text-muted-foreground">· {g.tipo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {indModal.open && (
        <IndicadorModal
          edit={indModal.edit}
          onClose={() => setIndModal({ open: false, objetivoId: o.id })}
          onSaved={async (payload) => {
            if (indModal.edit?.id) await mutObj?.indicadorUpd?.mutateAsync({ id: indModal.edit.id, ...payload })
            else await mutObj?.indicador?.mutateAsync({ objetivoId: indModal.objetivoId, ...payload })
          }}
        />
      )}
      {justModal && (
        <JustificativaModal tarefa={justModal.tarefa} onClose={() => setJustModal(null)} onConfirm={confirmJustificativa} />
      )}
      {tarefaModal?.open && (
        <TarefaModal
          edit={tarefaModal.edit}
          usuarios={usrs}
          onClose={() => setTarefaModal(null)}
          onVencida={() => { if (tarefaModal.edit) { setTarefaModal(null); setJustModal({ tarefa: tarefaModal.edit }) } }}
          onSaved={async (payload) => { await persistTarefa(payload); setTarefaModal(null) }}
        />
      )}
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

export function TarefaModal({ edit, usuarios, onClose, onVencida, onSaved }: {
  edit?: TarefaProjeto
  usuarios: any[]
  onClose: () => void
  onVencida: () => void
  onSaved: (t: any) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(edit?.titulo || '')
  const [esforco, setEsforco] = useState(edit?.esforco || 1)
  const [responsavel, setResponsavel] = useState(edit?.responsavel_id ? String(edit.responsavel_id) : '')
  const [prazo, setPrazo] = useState(edit?.prazo ? String(edit.prazo).slice(0, 10) : '')
  const [status, setStatusL] = useState(edit?.status || 'nao_iniciado')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!titulo.trim()) return
    const payload: any = {
      titulo: titulo.trim(),
      esforco: Math.min(5, Math.max(1, Number(esforco) || 1)),
      responsavel_id: responsavel ? Number(responsavel) : null,
      prazo: prazo || null,
    }
    if (edit) payload.status = status
    // Concluir tarefa VENCIDA exige justificativa: abre o modal de justificativa
    const vencData = prazo ? new Date(prazo + 'T00:00:00') : null
    const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
    const marcandoConcluido = (payload.status || 'nao_iniciado') === 'concluido'
    const semJustificativa = !edit?.justificativa_atraso
    if (vencData && vencData < hoje && marcandoConcluido && semJustificativa) {
      onVencida()
      return
    }
    setSaving(true)
    await onSaved(payload)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{edit ? 'Editar tarefa' : 'Nova tarefa'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-6">
          <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Esforço (1–5)</label>
              <select value={esforco} onChange={e => setEsforco(Number(e.target.value))} className={inputCls}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</label>
              <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls}>
                <option value="">Sem responsável</option>
                {usuarios.map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Vencimento</label>
              <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} /></div>
            {edit && (
              <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                <select value={status} onChange={e => setStatusL(e.target.value)} className={inputCls}>
                  {STATUS.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
                </select></div>
            )}
          </div>
          {edit?.justificativa_atraso && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">Justificativa de atraso: {edit.justificativa_atraso}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} disabled={!titulo.trim() || saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">
            {saving ? 'Salvando…' : edit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function JustificativaModal({ tarefa, onClose, onConfirm }: {
  tarefa?: TarefaProjeto
  onClose: () => void
  onConfirm: (just: string) => Promise<void>
}) {
  const [just, setJust] = useState(tarefa?.justificativa_atraso || '')
  const [saving, setSaving] = useState(false)
  const ok = just.trim().length >= 50
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Justificar atraso</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs text-muted-foreground">
            Esta tarefa está <b className="text-rose-600">VENCIDA</b>. Para concluí-la é necessário
            informar a justificativa do atraso (mínimo de <b>50 caracteres</b>).
          </p>
          <textarea
            value={just}
            onChange={e => setJust(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Descreva o motivo do atraso…"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <p className={`text-[11px] ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
            {just.trim().length}/50 caracteres {ok ? '· ok' : '· obrigatório'}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm(just); setSaving(false) }} disabled={!ok || saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">
            {saving ? 'Salvando…' : 'Concluir com justificativa'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function IndicadorModal({ edit, onClose, onSaved }: { edit?: any; onClose: () => void; onSaved: (i: any) => Promise<void> }) {
  const [indicador, setIndicador] = useState(edit?.indicador || '')
  const [tipo, setTipo] = useState(edit?.tipo || 'Eficiencia')
  const [unidade, setUnidade] = useState(edit?.unidade || 'Unidade')
  const [base, setBase] = useState(edit?.base != null ? String(edit.base) : '')
  const [meta, setMeta] = useState(edit?.meta != null ? String(edit.meta) : '')
  const [atual, setAtual] = useState(edit?.atual != null ? String(edit.atual) : '')
  const [direcao, setDirecao] = useState(edit?.direcao || 'Reduzir')
  const [operador, setOperador] = useState(edit?.operador || (edit?.direcao === 'Aumentar' ? '>=' : '<='))
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: logs = [] } = useIndicadorLogs(edit?.id)

  const save = async () => {
    if (!indicador.trim()) return
    setSaving(true)
    await onSaved({
      indicador: indicador.trim(), tipo, unidade,
      base: base ? Number(base) : null,
      meta: meta ? Number(meta) : null,
      atual: atual ? Number(atual) : null,
      direcao, operador, observacao: observacao.trim() || undefined,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{edit ? 'Editar indicador' : 'Novo indicador'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-6">
          <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Indicador *</label>
            <input value={indicador} onChange={e => setIndicador(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
                <option>Eficiencia</option><option>Comunicacao</option><option>Financeiro</option><option>Qualidade</option><option>Outro</option>
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade</label>
              <input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Unidade, Minutos, Dias…" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Base</label>
              <input type="number" value={base} onChange={e => setBase(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Meta</label>
              <input type="number" value={meta} onChange={e => setMeta(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Atual</label>
              <input type="number" value={atual} onChange={e => setAtual(e.target.value)} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Direção</label>
              <select value={direcao} onChange={e => { setDirecao(e.target.value); setOperador(e.target.value === 'Aumentar' ? '>=' : '<=') }} className={inputCls}>
                <option>Reduzir</option><option>Aumentar</option>
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Operador</label>
              <select value={operador} onChange={e => setOperador(e.target.value)} className={inputCls}>
                <option>&lt;=</option><option>&lt;</option><option>&gt;=</option><option>&gt;</option>
              </select></div>
          </div>
          {edit?.id && (
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Observação desta atualização (opcional)</label>
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
                placeholder="Ex.: redução obtida pela automação…"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          )}
          {edit?.id && logs.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Histórico de evolução</label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2">
                {logs.map((l: any, idx: number) => (
                  <div key={l.id || idx} className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[11px] text-foreground">{l.observacao || 'Atualização'}</p>
                      {l.user_name && <p className="text-[10px] text-muted-foreground">{l.user_name}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold text-[#0078d4]">{l.valor ?? '-'}</p>
                      <p className="text-[10px] text-muted-foreground">{String(l.criado_em || '').slice(0, 10)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} disabled={!indicador.trim() || saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">
            {saving ? 'Salvando…' : edit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProjetoModal({ projeto, onClose, onSaved }: { projeto: any | null; onClose: () => void; onSaved: (p: any, id?: number) => Promise<void> }) {
  const [titulo, setTitulo] = useState(projeto?.titulo || '')
  const [prazo, setPrazo] = useState(projeto?.prazo ? String(projeto.prazo).slice(0, 10) : '')
  const [responsavel, setResponsavel] = useState(projeto?.responsavel_id ? String(projeto.responsavel_id) : '')
  const [desc, setDesc] = useState(projeto?.descricao || '')
  const [users, setUsers] = useState<any[]>([])
  useEffect(() => {
    let alive = true
    apiFetch<any[]>('/api/usuarios?limit=500').then(d => { if (alive && Array.isArray(d)) setUsers(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const save = async () => {
    await onSaved({ titulo, prazo: prazo || null, responsavel_id: responsavel ? Number(responsavel) : null, descricao: desc }, projeto?.id)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{projeto ? 'Editar projeto' : 'Novo projeto'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-6">
          <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label><input value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Prazo</label><input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</label>
              <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
              </select>
            </div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" /></div>
        </div>
        <div className="flex justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} disabled={!titulo.trim()} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export function ObjetivoModal({ onClose, onSaved }: { onClose: () => void; onSaved: (o: any) => Promise<void> }) {
  const [titulo, setTitulo] = useState('')
  const [peso, setPeso] = useState(1)
  const [prazo, setPrazo] = useState('')
  const save = async () => { if (titulo.trim()) { await onSaved({ titulo: titulo.trim(), peso, prazo: prazo || null }); onClose() } }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Novo objetivo</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-6">
          <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Objetivo *</label><input value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Peso (influência)</label>
              <select value={peso} onChange={e => setPeso(Number(e.target.value))} className={inputCls}>{[1,2,3,4,5,10,15,18,20,25,30,40,50].map(n => <option key={n} value={n}>{n}</option>)}</select>
            </div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Prazo</label><input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} disabled={!titulo.trim()} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">Criar</button>
        </div>
      </div>
    </div>
  )
}