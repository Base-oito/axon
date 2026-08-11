import type { Processo } from '../types'
import {
  PRIORIDADE_MAP, SITUACAO_MAP, SITUACAO_OPTIONS, STATUS_MAP, STEP_TYPE_COLORS,
  addDays, countCompleted, fmtDateBR, fmtDateTimeBR, getCurrentStep, getDependencyNames,
  hasIncompleteSubtasks, hasUnmetDependencies, safeEtapas,
} from '../helpers'

interface Props {
  processo: Processo
  saving: boolean
  editingSituacao: { id: number; situacao: string } | null
  onSetSituacao: (s: { id: number; situacao: string } | null) => void
  onSaveSituacao: () => void
  onChangeStatus: (status: string) => void
  onCompleteStep: (optionLabel?: string) => void
  onToggleSubtask: (stepId: string, subtaskId: string) => void
  onDelete: () => void
  onOpenKanban: () => void
}

export default function ProcessoDetail({
  processo, saving, editingSituacao, onSetSituacao, onSaveSituacao, onChangeStatus,
  onCompleteStep, onToggleSubtask, onDelete, onOpenKanban,
}: Props) {
  const etapas = safeEtapas(processo.etapas)
  const completed = countCompleted(etapas)
  const total = etapas.length
  const { index: currIdx, step: currentStep } = getCurrentStep(etapas)
  const isBranchStep = currentStep && (currentStep.type === 'Decisão' || currentStep.type === 'Gatilho') && !currentStep.selectedOptionId

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="card-soft space-y-5 rounded-lg bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-foreground">{processo.titulo}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {processo.cliente_nome} · Criado em {fmtDateTimeBR(processo.created_at)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded px-2 py-0.5 text-xs"
            style={{ backgroundColor: (STATUS_MAP[processo.status]?.color || '#535353') + '18', color: STATUS_MAP[processo.status]?.color || '#535353', border: '1px solid ' + (STATUS_MAP[processo.status]?.color || '#535353') + '35' }}
          >
            {STATUS_MAP[processo.status]?.label || processo.status}
          </span>
          <span className="text-xs font-medium" style={{ color: PRIORIDADE_MAP[processo.prioridade] || '#535353' }}>
            {processo.prioridade}
          </span>
          <button
            onClick={onDelete}
            className="rounded border border-red-400/30 px-3 py-1 text-xs tracking-wider text-red-400 transition-colors hover:bg-red-500/10"
          >
            Excluir
          </button>
          <button
            onClick={onOpenKanban}
            className="rounded border border-[#0078d4]/30 px-3 py-1 text-xs tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/10"
          >
            Abrir Kanban
          </button>
        </div>
      </div>

      {/* Progresso */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs tracking-wider text-muted-foreground">Progresso</span>
          <span className="text-xs text-muted-foreground">{completed}/{total} etapas ({pct}%)</span>
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: pct + '%', backgroundColor: pct === 100 ? '#10B981' : '#5C939F' }} />
        </div>
      </div>

      {/* Visibilidade */}
      {processo.visibilidade && (
        <div className="flex items-center gap-3">
          <span className="text-xs tracking-wider text-muted-foreground">Visibilidade:</span>
          <span className="text-xs capitalize text-foreground">{processo.visibilidade}</span>
        </div>
      )}

      {/* Situacao */}
      <div className="flex items-center gap-3">
        <span className="text-xs tracking-wider text-muted-foreground">Situacao:</span>
        {editingSituacao && editingSituacao.id === processo.id ? (
          <div className="flex items-center gap-2">
            <select
              value={editingSituacao.situacao}
              onChange={e => onSetSituacao({ ...editingSituacao, situacao: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-[#0078d4] focus:outline-none"
            >
              {SITUACAO_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{SITUACAO_MAP[opt]?.label || opt}</option>
              ))}
            </select>
            <button onClick={onSaveSituacao} className="rounded bg-[#0078d4] px-3 py-1 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80">
              Salvar
            </button>
            <button onClick={() => onSetSituacao(null)} className="rounded px-3 py-1 text-xs tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-xs"
              style={{ backgroundColor: (SITUACAO_MAP[processo.situacao]?.color || '#535353') + '18', color: SITUACAO_MAP[processo.situacao]?.color || '#535353', border: '1px solid ' + (SITUACAO_MAP[processo.situacao]?.color || '#535353') + '35' }}
            >
              {SITUACAO_MAP[processo.situacao]?.label || processo.situacao}
            </span>
            <button
              onClick={() => onSetSituacao({ id: processo.id, situacao: processo.situacao || 'em_execucao' })}
              className="text-xs tracking-wider text-[#0078d4] transition-colors hover:text-foreground"
            >
              Editar
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h4 className="mb-4 text-xs tracking-wider text-muted-foreground">Etapas</h4>
        {etapas.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nenhuma etapa definida.</div>
        ) : (
          <div className="space-y-0">
            {etapas.map((etapa, idx) => {
              const isDone = etapa.isCompleted
              const isCurrent = idx === currIdx
              const unmet = hasUnmetDependencies(etapa, etapas)
              const blocked = !isDone && unmet
              const incompleteSubs = hasIncompleteSubtasks(etapa)
              const dueDate = etapa.dias && processo.data_inicio ? addDays(processo.data_inicio, etapa.dias) : etapa.dueDate || undefined
              const isAtrasado = !isDone && dueDate && new Date(dueDate + 'T00:00:00') < new Date()
              let circleColor = '#535353'
              if (isDone) circleColor = '#10B981'
              else if (blocked) circleColor = '#F97316'
              else if (isAtrasado) circleColor = '#EF4444'
              else if (isCurrent) circleColor = '#3B82F6'
              const bgOpacity = isDone ? '15' : blocked ? '15' : isAtrasado ? '15' : isCurrent ? '15' : '05'
              return (
                <div key={etapa.id || idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: circleColor + bgOpacity, border: '2px solid ' + circleColor }}
                    >
                      {isDone ? (
                        <span style={{ color: '#10B981', fontSize: '10px' }}>+</span>
                      ) : isAtrasado ? (
                        <span className="animate-pulse" style={{ color: '#EF4444', fontSize: '10px' }}>!</span>
                      ) : isCurrent ? (
                        <span style={{ color: '#3B82F6', fontSize: '10px' }}>*</span>
                      ) : blocked ? (
                        <span style={{ color: '#F97316', fontSize: '10px' }}>L</span>
                      ) : (
                        <span style={{ color: '#535353', fontSize: '10px' }}>{idx + 1}</span>
                      )}
                    </div>
                    {idx < etapas.length - 1 && (
                      <div className="min-h-[20px] w-0.5 flex-1" style={{ backgroundColor: isDone ? '#10B98135' : '#53535335' }} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs" style={{ color: isDone ? '#10B981' : isAtrasado ? '#EF4444' : blocked ? '#F97316' : isCurrent ? '#3B82F6' : '#9CA3AF' }}>
                        {etapa.title || '(sem titulo)'}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-xs"
                        style={{ backgroundColor: (STEP_TYPE_COLORS[etapa.type] || '#535353') + '18', color: STEP_TYPE_COLORS[etapa.type] || '#535353' }}
                      >
                        {etapa.type}
                      </span>
                      {isCurrent && !isDone && etapa.notificar_todos && (
                        <span className="text-xs text-muted-foreground" title="Notificar todos ao concluir">*</span>
                      )}
                      {isAtrasado && <span className="text-xs font-medium text-red-400">Atrasado</span>}
                    </div>

                    {dueDate && (
                      <div className="mt-1">
                        <span className="text-xs" style={{ color: isAtrasado ? '#EF4444' : '#9CA3AF' }}>
                          Vencimento: {fmtDateBR(dueDate)}
                          {etapa.dias ? ` (${etapa.dias} dias)` : ''}
                        </span>
                      </div>
                    )}

                    {isDone && (
                      <div className="mt-1 text-xs" style={{ color: '#10B981' }}>
                        Concluído por {etapa.completedBy || 'Usuário'}
                        {etapa.completedAt && (
                          <span style={{ color: '#6B7280' }}> - {fmtDateTimeBR(etapa.completedAt)}</span>
                        )}
                      </div>
                    )}

                    {etapa.dependsOn && etapa.dependsOn.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Depende:</span>
                        {etapa.dependsOn.map(depId => {
                          const depStep = etapas.find(e => e.id === depId)
                          const depDone = depStep?.isCompleted
                          return (
                            <span
                              key={depId}
                              className="rounded px-1.5 py-0.5 text-[9px] tracking-wider"
                              style={{
                                backgroundColor: depDone ? '#10B98118' : '#53535318',
                                color: depDone ? '#10B981' : '#9CA3AF',
                                border: '1px solid ' + (depDone ? '#10B98135' : '#53535335'),
                              }}
                            >
                              {depStep?.title || depId}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {blocked && (
                      <div className="mt-1.5 text-xs text-orange-400">(Bloqueado por: {getDependencyNames(etapa, etapas)})</div>
                    )}

                    {etapa.subtasks && etapa.subtasks.length > 0 && (
                      <div className="ml-1 mt-2 space-y-1">
                        {etapa.subtasks.map(st => (
                          <label key={st.id} className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: st.isCompleted ? '#10B981' : '#9CA3AF' }}>
                            <input
                              type="checkbox"
                              checked={st.isCompleted}
                              onChange={() => onToggleSubtask(etapa.id, st.id)}
                              className="h-3 w-3 rounded accent-[#0078d4]"
                            />
                            <span style={{ textDecoration: st.isCompleted ? 'line-through' : 'none' }}>{st.title}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {isCurrent && !isDone && !isBranchStep && (
                      <div className="mt-2 flex items-center gap-2">
                        {blocked ? (
                          <span className="text-xs text-orange-400">(Etapa bloqueada)</span>
                        ) : incompleteSubs ? (
                          <span className="text-xs text-muted-foreground">Conclua todas as subtarefas primeiro!</span>
                        ) : (
                          <button
                            onClick={() => onCompleteStep()}
                            disabled={saving}
                            className="rounded bg-[#0078d4] px-3 py-0.5 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Concluir Etapa'}
                          </button>
                        )}
                      </div>
                    )}

                    {isCurrent && !isDone && isBranchStep && (
                      <div className="mt-2">
                        {blocked ? (
                          <span className="text-xs text-orange-400">(Etapa bloqueada)</span>
                        ) : incompleteSubs ? (
                          <span className="text-xs text-muted-foreground">Conclua todas as subtarefas primeiro!</span>
                        ) : etapa.options && etapa.options.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">{etapa.type === 'Gatilho' ? 'Disparar:' : 'Decisao:'}</span>
                            {etapa.options.map((opt, oi) => {
                              const nextStep = etapas.find(e => e.id === opt.nextStepId)
                              const bgClass = oi === 0
                                ? 'border border-green-500/30 bg-green-700/30 text-green-400 hover:bg-green-700/50'
                                : 'border border-red-500/30 bg-red-700/30 text-red-400 hover:bg-red-700/50'
                              return (
                                <button
                                  key={oi}
                                  onClick={() => onCompleteStep(opt.label)}
                                  disabled={saving}
                                  className={`rounded px-3 py-0.5 text-xs tracking-wider transition-colors disabled:opacity-50 ${bgClass}`}
                                >
                                  {opt.label} {nextStep ? '-> ' + (nextStep.title || '?') : ''}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">(sem opcoes de ramificacao)</span>
                        )}
                      </div>
                    )}

                    {isDone && etapa.selectedOptionId && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">({etapa.selectedOptionId})</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Alterar status */}
      <div className="flex items-center gap-3 border-t border-border/60 pt-3">
        <span className="text-xs tracking-wider text-muted-foreground">Alterar status:</span>
        <select
          value={processo.status}
          onChange={e => onChangeStatus(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-[#0078d4] focus:outline-none"
        >
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
