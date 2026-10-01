import { useEffect, useState } from 'react'
import type { Etapa, Processo } from '../types'
import { updateProcesso, uploadProcessoAnexo, solicitarAprovacao, aprovarEtapa, reprovarEtapa, cienciaReprovacao } from '../api'
import { getToken, openAuthedFile } from '@/lib/api'
import {
  STEP_TYPE_COLORS, addDays, fmtDateTimeBR, getCurrentStep, getDependencyNames, getDisplayName,
  hasIncompleteSubtasks, hasUnmetDependencies, podeConcluirEtapa, safeEtapas, pedirAnexo,
} from '../helpers'
import {
  DndContext, PointerSensor, TouchSensor, closestCorners, useDroppable, useDraggable,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { FileCheck2, FileWarning, XCircle } from 'lucide-react'

export interface UsuarioLs { id: number; display_name?: string; username?: string }

function getMe(): { id: number; role: string } {
  try {
    const tok = getToken()
    if (!tok) return { id: 0, role: '' }
    const p = JSON.parse(atob(tok.split('.')[1]))
    return { id: Number(p.sub) || 0, role: p.role || '' }
  } catch {
    return { id: 0, role: '' }
  }
}

function podeAprovar(me: { id: number; role: string }, etapa: Etapa, processo: Processo): boolean {
  if (me.role === 'administrador' || me.role === 'super_admin') return true
  const aprovador = etapa.aprovador_id || processo.user_id
  return !!aprovador && String(aprovador) === String(me.id)
}

function temChecklistPendente(etapa: Etapa): boolean {
  const docs = etapa.documentos_exigidos || []
  if (!docs.length) return false
  const itens = Object.fromEntries((etapa.checklist || []).map(i => [String(i.id), i]))
  return docs.some(d => !(itens[String(d.id)]?.anexo))
}

interface Props {
  processo: Processo
  onChanged?: () => void
  usersMap?: Record<string, UsuarioLs>
  deptMap?: Record<string, any>
}

function getStepStatus(s: Etapa, idx: number, currIdx: number, dataInicio?: string) {
  if (s.isCompleted) return 'Concluida'
  const dueDate = s.dias && dataInicio ? addDays(dataInicio, s.dias) : s.dueDate
  const isOverdue = !s.isCompleted && dueDate && new Date(dueDate + 'T00:00:00') < new Date()
  if (isOverdue) return 'Atrasado'
  if (idx === currIdx) return 'Em Andamento'
  return 'Pendente'
}

function StepCard({ s, colKey, current, etapas, usersMap, deptMap, me, onDropEnd, onOpen, onToggleSubtask }: {
  s: Etapa
  colKey: string
  current: Processo
  etapas: Etapa[]
  usersMap?: Record<string, UsuarioLs>
  deptMap?: Record<string, any>
  me: { id: number; role: string }
  onDropEnd: (stepId: string, toCol: string) => void
  onOpen: (step: Etapa) => void
  onToggleSubtask: (stepId: string, subtaskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: s.id })
  const { isOver } = useDroppable({ id: s.id })
  const dueDate = s.dias && current.data_inicio ? addDays(current.data_inicio, s.dias) : s.dueDate
  const isOverdue = colKey === 'Atrasado'
  const incompleteSubs = hasIncompleteSubtasks(s)
  const unmet = hasUnmetDependencies(s, etapas)
  const blocked = !s.isCompleted && unmet
  const podeEtapa = podeConcluirEtapa(me, s, current)
  const responsavelNome = (s.user_id && usersMap && usersMap[String(s.user_id)])
    ? (usersMap[String(s.user_id)].display_name || usersMap[String(s.user_id)].username || '')
    : (s.assignee || (s.user_id ? String(s.user_id) : ''))
  const deptNome = s.departamento_id && deptMap && deptMap[String(s.departamento_id)]
    ? (deptMap[String(s.departamento_id)].nome || '')
    : ''
  const color = colKey === 'Em Andamento' || colKey === 'Atrasado'
    ? (colKey === 'Em Andamento' ? '#3B82F6' : '#EF4444')
    : '#1B1B1B'

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      draggable={false}
      onClick={e => { e.stopPropagation(); onOpen(s) }}
      className="cursor-grab rounded-lg border bg-background p-3 transition-colors hover:border-[#0078d4]/40 active:cursor-grabbing"
      style={{
        borderColor: isOver ? color + '55' : (isDragging ? color + '55' : color + '40'),
        borderWidth: '1px',
        opacity: isDragging ? 0.35 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
      }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="rounded px-1.5 py-0.5 text-xs tracking-wider"
          style={{ backgroundColor: (STEP_TYPE_COLORS[s.type] || '#535353') + '18', color: STEP_TYPE_COLORS[s.type] || '#535353', border: '1px solid ' + (STEP_TYPE_COLORS[s.type] || '#535353') + '35' }}
        >
          {s.type}
        </span>
        <select
          value={colKey}
          onChange={e => { if (e.target.value !== colKey) onDropEnd(s.id, e.target.value) }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="cursor-pointer rounded border border-border/50 bg-transparent px-1 py-0.5 text-[9px] text-muted-foreground focus:outline-none"
          style={{ maxWidth: '80px' }}
        >
          <option value="Pendente">Pendente</option>
          <option value="Em Andamento">Em Andam.</option>
          <option value="Concluida" disabled={!podeEtapa}>{!podeEtapa ? 'Concluída (somente resp.)' : 'Concluída'}</option>
        </select>
      </div>
      <div className="mb-1.5 text-xs font-medium text-foreground">{s.title || '(sem titulo)'}</div>
      {s.aprovacao_status === 'pendente' && (
        <div className="mb-1.5 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
          Aguardando aprovação
        </div>
      )}
      {s.aprovacao_status === 'reprovada' && (
        <div className="mb-1.5 inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
          Reprovada — reenviar
        </div>
      )}
      {isOverdue && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-medium text-red-400">Atrasado</span>
        </div>
      )}
      {dueDate && (
        <div className="mb-1.5 text-xs" style={{ color: isOverdue ? '#EF4444' : '#9CA3AF' }}>
          Vence: {new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          {s.dias ? <span className="ml-1 text-muted-foreground">({s.dias}d)</span> : null}
        </div>
      )}
      {responsavelNome && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          <span className="truncate">{responsavelNome}</span>
        </div>
      )}
      {deptNome && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 12h18" />
          </svg>
          <span className="truncate">{deptNome}</span>
        </div>
      )}
      {s.exige_documento && (
        <div className="mb-1.5 flex items-center gap-1">
          {s.anexo ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">
              <FileCheck2 className="h-3 w-3" /> anexo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
              <FileWarning className="h-3 w-3" /> exige anexo
            </span>
          )}
        </div>
      )}
      {s.dependsOn && s.dependsOn.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {s.dependsOn.map(did => {
            const dep = etapas.find(e => e.id === did)
            return (
              <span
                key={did}
                className="rounded px-1.5 py-0.5 text-[9px]"
                style={{ backgroundColor: dep?.isCompleted ? '#10B98118' : '#EF444418', color: dep?.isCompleted ? '#10B981' : '#EF4444' }}
              >
                {dep?.title || did}
              </span>
            )
          })}
        </div>
      )}
      {s.subtasks && s.subtasks.length > 0 && (
        <div className="mb-1.5">
          <div className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
            Subtarefas {s.subtasks.filter(st => st.isCompleted).length}/{s.subtasks.length}
          </div>
          <div className="space-y-0.5">
            {s.subtasks.map(st => (
              <label key={st.id} className="flex cursor-pointer items-center gap-1.5 text-[11px]" style={{ color: st.isCompleted ? '#10B981' : '#9CA3AF' }} onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={st.isCompleted}
                  disabled={!podeEtapa}
                  onChange={() => onToggleSubtask(s.id, st.id)}
                  className="h-3 w-3 rounded accent-[#0078d4] disabled:cursor-not-allowed"
                />
                <span className="truncate" style={{ textDecoration: st.isCompleted ? 'line-through' : 'none' }}>{st.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {blocked && <div className="mb-1 text-xs text-orange-400">(Bloqueado: {getDependencyNames(s, etapas)})</div>}
      {incompleteSubs && colKey !== 'Concluida' && <div className="mb-1 text-xs text-muted-foreground">(Subtarefas pendentes)</div>}
      {s.isCompleted && (
        <div className="mt-1 border-t border-border/30 pt-1 text-xs" style={{ color: '#10B981' }}>
          {s.completedBy || 'Usuário'}
          {s.completedAt && (
            <span style={{ color: '#6B7280' }}>
              {' - '}
              {new Date(s.completedAt).toLocaleDateString('pt-BR')} {new Date(s.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Column({ col, current, etapas, usersMap, deptMap, me, onDropEnd, onOpenStep, onToggleSubtask }: {
  col: { key: string; label: string; color: string; steps: Etapa[] }
  current: Processo
  etapas: Etapa[]
  usersMap?: Record<string, UsuarioLs>
  deptMap?: Record<string, any>
  me: { id: number; role: string }
  onDropEnd: (stepId: string, toCol: string, fromCol: string) => void
  onOpenStep: (step: Etapa) => void
  onToggleSubtask: (stepId: string, subtaskId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, data: { col: col.key } })
  return (
    <div ref={setNodeRef} className="flex flex-col" style={{ minHeight: '420px' }}>
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
          <h4 className="text-xs tracking-wider" style={{ color: col.color }}>{col.label}</h4>
        </div>
        <span className="rounded-full bg-border/50 px-2 py-0.5 text-xs text-muted-foreground">{col.steps.length}</span>
      </div>
      <div
        className="flex-1 space-y-2 overflow-y-auto rounded-lg border-2 p-2 transition-colors"
        style={{
          borderStyle: 'dashed',
          borderColor: isOver ? col.color + '70' : (col.key === 'Em Andamento' || col.key === 'Atrasado' ? col.color + '30' : '#1B1B1B'),
          backgroundColor: isOver ? col.color + '12' : (col.key === 'Atrasado' ? '#EF444408' : 'transparent'),
        }}
      >
        {col.steps.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs italic text-muted-foreground">Vazio</div>
        ) : (
          col.steps.map(s => (
            <StepCard key={s.id} s={s} colKey={col.key} current={current} etapas={etapas} usersMap={usersMap} deptMap={deptMap} me={me} onDropEnd={(stepId, toCol) => onDropEnd(stepId, toCol, col.key)} onOpen={onOpenStep} onToggleSubtask={onToggleSubtask} />
          ))
        )}
      </div>
    </div>
  )
}

function StepDetailDrawer({ step, etapas, processo, usersMap, deptMap, me, onClose, onToggleSubtask, onComplete, onSelectOption, onAnexar, onAprovar, onReprovar, onReenviar, onAnexarChecklist }: {
  step: Etapa
  etapas: Etapa[]
  processo: Processo
  usersMap?: Record<string, UsuarioLs>
  deptMap?: Record<string, any>
  me: { id: number; role: string }
  onClose: () => void
  onToggleSubtask: (stepId: string, subtaskId: string) => void
  onComplete: (step: Etapa) => void
  onSelectOption: (stepId: string, label: string) => void
  onAnexar: (stepId: string) => void
  onAprovar: (step: Etapa) => void
  onReprovar: (step: Etapa, comentario: string) => void
  onReenviar: (step: Etapa) => void
  onAnexarChecklist: (stepId: string, docId: string) => void
}) {
  const isDone = !!step.isCompleted
  const unmet = hasUnmetDependencies(step, etapas)
  const blocked = !isDone && unmet
  const incompleteSubs = hasIncompleteSubtasks(step)
  const dueDate = step.dias && processo.data_inicio ? addDays(processo.data_inicio, step.dias) : step.dueDate
  const isAtrasado = !isDone && dueDate && new Date(dueDate + 'T00:00:00') < new Date()
  const isBranch = (step.type === 'Decisão' || step.type === 'Gatilho') && !step.selectedOptionId
  const responsavelNome = (step.user_id && usersMap && usersMap[String(step.user_id)])
    ? (usersMap[String(step.user_id)].display_name || usersMap[String(step.user_id)].username || '')
    : ''
  const deptNome = step.departamento_id && deptMap && deptMap[String(step.departamento_id)]
    ? (deptMap[String(step.departamento_id)].nome || '')
    : ''
  const docsExigidos = step.documentos_exigidos || []
  const checklistMap = Object.fromEntries((step.checklist || []).map(i => [String(i.id), i]))
  const aprovandoPendente = step.aprovacao_status === 'pendente'
  const reprovada = step.aprovacao_status === 'reprovada'
  const podeDecidir = podeAprovar(me, step, processo)
  const podeEtapa = podeConcluirEtapa(me, step, processo)
  const [comentario, setComentario] = useState('')

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto rounded-l-xl border-l border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-xs tracking-wider"
              style={{ backgroundColor: (STEP_TYPE_COLORS[step.type] || '#535353') + '18', color: STEP_TYPE_COLORS[step.type] || '#535353', border: '1px solid ' + (STEP_TYPE_COLORS[step.type] || '#535353') + '35' }}
            >
              {step.type}
            </span>
            <span className="text-xs text-muted-foreground">{isDone ? 'Concluída' : isAtrasado ? 'Atrasada' : 'Em andamento'}</span>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-5">
          <h3 className="text-base font-bold text-foreground">{step.title || '(sem título)'}</h3>

          {step.dias && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{step.dias}</span> {step.dias === 1 ? 'dia' : 'dias'} para execução
              {dueDate && (
                <span>
                  · Vence <span className="font-medium" style={{ color: isAtrasado ? '#EF4444' : '#9CA3AF' }}>{new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </span>
              )}
            </div>
          )}

          {(step.assignee || step.user_id) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Responsável: <span className="font-medium text-foreground">{responsavelNome || step.assignee || step.user_id}</span>
            </div>
          )}
          {deptNome && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Departamento: <span className="font-medium text-foreground">{deptNome}</span>
            </div>
          )}

          {/* Status de aprovação */}
          {step.aprovacao_status && (
            <div className={`rounded-lg border p-3 text-xs ${
              step.aprovacao_status === 'aprovada' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
              : step.aprovacao_status === 'reprovada' ? 'border-rose-500/30 bg-rose-500/10 text-rose-600'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
            }`}>
              <div className="font-semibold">
                {step.aprovacao_status === 'pendente' ? 'Aguardando aprovação'
                  : step.aprovacao_status === 'aprovada' ? 'Aprovada'
                  : 'Reprovada'}
              </div>
              {step.aprovacao_comentario && <div className="mt-1">Motivo: {step.aprovacao_comentario}</div>}
            </div>
          )}

          {/* Checklist de documentos exigidos */}
          {docsExigidos.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground">Documentos exigidos</div>
              <div className="space-y-1.5">
                {docsExigidos.map(doc => {
                  const item = checklistMap[String(doc.id)]
                  const anexo = item?.anexo
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {anexo ? <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <FileWarning className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        <span className="truncate text-xs text-foreground">{doc.nome || '(sem nome)'}</span>
                      </div>
                      {anexo ? (
                        <a href={anexo.url} onClick={e => { e.preventDefault(); void openAuthedFile(anexo.url) }} target="_blank" rel="noreferrer" className="shrink-0 cursor-pointer text-[11px] text-[#0078d4] underline">ver</a>
                      ) : (
                        !isDone && !aprovandoPendente && (
                          <button onClick={() => onAnexarChecklist(step.id, doc.id)} className="shrink-0 rounded bg-[#0078d4]/10 px-2 py-0.5 text-[11px] font-medium text-[#0078d4] hover:bg-[#0078d4]/20">anexar</button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step.dependsOn && step.dependsOn.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground">Dependências</div>
              <div className="flex flex-wrap gap-1.5">
                {step.dependsOn.map(did => {
                  const dep = etapas.find(e => e.id === did)
                  return (
                    <span
                      key={did}
                      className="rounded px-2 py-1 text-[11px]"
                      style={{ backgroundColor: dep?.isCompleted ? '#10B98118' : '#EF444418', color: dep?.isCompleted ? '#10B981' : '#EF4444', border: '1px solid ' + (dep?.isCompleted ? '#10B98135' : '#EF444435') }}
                    >
                      {dep?.isCompleted ? '✓ ' : '⏳ '}{dep?.title || did}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {step.subtasks && step.subtasks.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground">Subtarefas</div>
              <div className="space-y-1.5">
                {step.subtasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={st.isCompleted}
                      onChange={() => onToggleSubtask(step.id, st.id)}
                      disabled={!podeEtapa}
                      className="h-3.5 w-3.5 rounded accent-[#0078d4] disabled:cursor-not-allowed"
                    />
                    <span className="text-xs" style={{ textDecoration: st.isCompleted ? 'line-through' : 'none', color: st.isCompleted ? '#10B981' : '#9CA3AF' }}>
                      {st.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isBranch && step.options && step.options.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground">Escolha uma opção</div>
              <div className="space-y-1.5">
                {step.options.map((opt, oi) => {
                  const nextStep = etapas.find(e => e.id === opt.nextStepId)
                  const selected = step.selectedOptionId === opt.label
                  return (
                    <button
                      key={oi}
                      disabled={isDone}
                      onClick={() => onSelectOption(step.id, opt.label)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-xs transition-colors ${
                        selected
                          ? 'border-[#0078d4] bg-[#0078d4]/10 text-[#0078d4]'
                          : isDone
                            ? 'cursor-not-allowed border-border bg-muted/20 text-muted-foreground'
                            : 'border-border bg-background text-foreground hover:border-[#0078d4]/40 hover:bg-[#0078d4]/5'
                      }`}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      {nextStep && <span className="text-xs text-muted-foreground">→ {nextStep.title || '?'}</span>}
                      {selected && <span className="text-xs font-bold">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {isDone && step.selectedOptionId && (
            <div className="text-xs text-muted-foreground">Opção escolhida: <span className="font-medium text-foreground">{step.selectedOptionId}</span></div>
          )}

          {isDone && (
            <div className="border-t border-border/30 pt-2 text-xs" style={{ color: '#10B981' }}>
              Concluído por {step.completedBy || 'Usuário'}
              {step.completedAt && <span className="text-muted-foreground"> - {fmtDateTimeBR(step.completedAt)}</span>}
            </div>
          )}

          {step.exige_documento && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {step.anexo ? (
                  <a
                    href={step.anexo.url}
                    onClick={ev => { ev.preventDefault(); void openAuthedFile(step.anexo!.url) }}
                    target="_blank" rel="noreferrer"
                    className="inline-flex cursor-pointer items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/25"
                  >
                    <FileCheck2 className="h-3 w-3" /> {step.anexo.nome}
                  </a>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <FileWarning className="h-3 w-3" /> Exige documento/relatório
                    </span>
                    <button
                      onClick={() => onAnexar(step.id)}
                      className="rounded bg-[#0078d4]/10 px-2 py-1 text-[11px] font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
                    >
                      Anexar documento
                    </button>
                  </>
                )}
              </div>
            )}

          {!isDone && (
            <div className="space-y-2 pt-2">
              {aprovandoPendente ? (
                podeDecidir ? (
                  <>
                    <textarea
                      value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      placeholder="Comentário (obrigatório para reprovar)"
                      rows={2}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onAprovar(step); setComentario('') }}
                        className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium tracking-wider text-white transition-colors hover:bg-emerald-700"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => {
                          if (comentario.trim().length < 3) { alert('Informe o motivo da reprovação (mín. 3 caracteres)'); return }
                          onReprovar(step, comentario.trim()); setComentario('')
                        }}
                        className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-medium tracking-wider text-white transition-colors hover:bg-rose-700"
                      >
                        Reprovar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-500">
                    Aguardando aprovação de {(step.aprovador_id && usersMap?.[String(step.aprovador_id)])
                      ? (usersMap[String(step.aprovador_id)].display_name || usersMap[String(step.aprovador_id)].username)
                      : 'responsável do processo'}.
                  </div>
                )
              ) : reprovada ? (
                <button
                  onClick={() => onReenviar(step)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] px-4 py-2.5 text-xs font-medium tracking-wider text-white transition-colors hover:bg-[#0078d4]/80"
                >
                  Reenviar para aprovação
                </button>
              ) : blocked ? (
                <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 p-3 text-xs text-orange-400">
                  Etapa bloqueada por: {getDependencyNames(step, etapas)}
                </div>
              ) : incompleteSubs ? (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-500">
                  Conclua todas as subtarefas primeiro!
                </div>
              ) : !podeEtapa ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                  Você não é o responsável por esta tarefa. Somente o responsável ou um administrador pode concluí-la.
                </div>
              ) : (
                <button
                  onClick={() => onComplete(step)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] px-4 py-2.5 text-xs font-medium tracking-wider text-white transition-colors hover:bg-[#0078d4]/80"
                >
                  {step.exige_aprovacao ? 'Enviar para aprovação' : 'Concluir Etapa'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReprovacaoCienciaModal({ etapa, onConfirm }: {
  etapa: Etapa
  onConfirm: () => void
}) {
  const [ciente, setCiente] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const motivo = etapa.aprovacao_comentario || ''
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        <div className="px-6 pt-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Reprovação</span>
          </div>
          <h3 className="text-base font-semibold text-foreground">Tarefa reprovada</h3>
          <p className="mt-1 text-xs text-muted-foreground">Etapa: {etapa.title || '(sem título)'}</p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-5">
          <div className="whitespace-pre-wrap rounded-lg border border-rose-500/20 bg-rose-50/40 p-4 text-sm leading-relaxed text-foreground">
            {motivo || 'A etapa foi reprovada. Ajuste e reenvie para aprovação.'}
          </div>
        </div>

        <div className="space-y-3 px-6 pb-6">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              checked={ciente}
              onChange={e => setCiente(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-[#0078d4]"
            />
            <span className="text-xs font-medium text-foreground">Tenho ciência de que esta tarefa foi reprovada e entendo o motivo da reprovação</span>
          </label>
          <button
            onClick={() => { setConfirming(true); onConfirm() }}
            disabled={!ciente || confirming}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] py-3 text-xs font-semibold text-white transition-colors hover:bg-[#0078d4]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <XCircle className="h-4 w-4" />
            {confirming ? 'Registrando...' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KanbanPorProcesso({ processo, onChanged, usersMap, deptMap }: Props) {
  const [current, setCurrent] = useState(processo)
  const [selectedStep, setSelectedStep] = useState<Etapa | null>(null)
  const [reprovacaoModal, setReprovacaoModal] = useState<Etapa | null>(null)
  const me = getMe()

  useEffect(() => setCurrent(processo), [processo])

  const etapas = safeEtapas(current.etapas)
  const currIdx = getCurrentStep(etapas).index

  // Modal de ciência da reprovação para o responsável da etapa
  useEffect(() => {
    const reprovada = etapas.find(e =>
      e.aprovacao_status === 'reprovada' && !e.ciencia_reprovacao && String(e.user_id) === String(me.id))
    setReprovacaoModal(prev => prev || reprovada || null)
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmarCiencia = async () => {
    if (!reprovacaoModal) return
    try {
      await cienciaReprovacao(current.id, reprovacaoModal.id)
      await reload(); notify()
    } catch (e) {
      alert('Falha ao registrar ciência: ' + (e instanceof Error ? e.message : 'erro'))
    }
    setReprovacaoModal(null)
  }

  const columns = [
    { key: 'Pendente', label: 'Pendente', color: '#94A3B8', steps: etapas.filter((s, i) => getStepStatus(s, i, currIdx, current.data_inicio) === 'Pendente') },
    { key: 'Em Andamento', label: 'Em Andamento', color: '#3B82F6', steps: etapas.filter((s, i) => getStepStatus(s, i, currIdx, current.data_inicio) === 'Em Andamento') },
    { key: 'Atrasado', label: 'Atrasado', color: '#EF4444', steps: etapas.filter((s, i) => getStepStatus(s, i, currIdx, current.data_inicio) === 'Atrasado') },
    { key: 'Concluida', label: 'Concluída', color: '#10B981', steps: etapas.filter(s => s.isCompleted) },
  ]

  const notify = () => { onChanged?.() }

  const reload = async () => {
    try {
      const res = await fetch(`/api/processos/${processo.id}`, { headers: { Authorization: 'Bearer ' + (JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token || '') } })
      if (res.ok) setCurrent(await res.json())
    } catch {
      // ignore
    }
  }

  const completeStepLocal = async (stepId: string) => {
    const step = etapas.find(e => e.id === stepId)
    if (!step) return
    if (step.exige_documento && !step.anexo) {
      alert('Esta etapa exige documento/relatório atualizado. Anexe antes de concluir.')
      return
    }
    if (temChecklistPendente(step)) {
      alert('Anexe todos os documentos exigidos antes de concluir.')
      return
    }
    // Etapa que exige aprovação: envia para aprovação (não conclui direto)
    if (step.exige_aprovacao) {
      try {
        await solicitarAprovacao(current.id, stepId)
        await reload(); notify()
        setSelectedStep(null)
      } catch (e) {
        alert('Falha ao enviar para aprovação: ' + (e instanceof Error ? e.message : 'erro'))
      }
      return
    }
    const updatedEtapas = etapas.map(e => {
      if (e.id !== stepId) return e
      return { ...e, isCompleted: true, completedBy: getDisplayName(), completedAt: new Date().toISOString() }
    })
    const allDone = updatedEtapas.every(e => e.isCompleted)
    try {
      await updateProcesso(current.id, { etapas: updatedEtapas, status: allDone ? 'Concluida' : 'em_execucao' })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao concluir etapa')
      return
    }
    await reload(); notify()
    setSelectedStep(null)
  }

  const aprovarStepLocal = async (step: Etapa) => {
    try {
      await aprovarEtapa(current.id, step.id)
      await reload(); notify()
      setSelectedStep(null)
    } catch (e) {
      alert('Falha ao aprovar: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  const reprovarStepLocal = async (step: Etapa, comentario: string) => {
    try {
      await reprovarEtapa(current.id, step.id, comentario)
      await reload(); notify()
      setSelectedStep(null)
    } catch (e) {
      alert('Falha ao reprovar: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  const reenviarStepLocal = async (step: Etapa) => {
    try {
      await solicitarAprovacao(current.id, step.id)
      await reload(); notify()
      setSelectedStep(null)
    } catch (e) {
      alert('Falha ao reenviar: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  const anexarChecklistItem = async (stepId: string, docId: string) => {
    const file = await pedirAnexo()
    if (!file) return
    try {
      const anexo = await uploadProcessoAnexo(current.id, file)
      const updatedEtapas = etapas.map(e => {
        if (e.id !== stepId) return e
        const docs = e.documentos_exigidos || []
        const list = [...(e.checklist || [])]
        const idx = list.findIndex(i => String(i.id) === String(docId))
        const item = { id: docId, nome: docs.find(d => String(d.id) === String(docId))?.nome || '', anexo }
        if (idx >= 0) list[idx] = { ...list[idx], ...item }
        else list.push(item)
        return { ...e, checklist: list }
      })
      await updateProcesso(current.id, { etapas: updatedEtapas })
      await reload(); notify()
    } catch (e) {
      alert('Falha ao anexar o documento: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  const anexarStep = async (stepId: string) => {
    const file = await pedirAnexo()
    if (!file) return
    try {
      const anexo = await uploadProcessoAnexo(current.id, file)
      const updatedEtapas = etapas.map(e => (e.id === stepId ? { ...e, anexo } : e))
      await updateProcesso(current.id, { etapas: updatedEtapas })
      await reload(); notify()
    } catch (e) {
      alert('Falha ao anexar o documento: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  const undoStep = async (stepId: string, newStatus?: string) => {
    const updatedEtapas = etapas.map(e => (e.id === stepId ? { ...e, isCompleted: false, completedBy: undefined, completedAt: undefined } : e))
    await updateProcesso(current.id, { etapas: updatedEtapas, status: newStatus || 'em_execucao' }).catch(() => {})
    await reload(); notify()
  }

  const toggleSubtaskLocal = async (stepId: string, subtaskId: string) => {
    const updatedEtapas = etapas.map(e => {
      if (e.id !== stepId || !e.subtasks) return e
      return { ...e, subtasks: e.subtasks.map(st => (st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st)) }
    })
    await updateProcesso(current.id, { etapas: updatedEtapas }).catch(() => {})
    await reload(); notify()
  }

  const selectOptionLocal = async (stepId: string, label: string) => {
    const updatedEtapas = etapas.map(e => (e.id === stepId ? { ...e, selectedOptionId: label } : e))
    await updateProcesso(current.id, { etapas: updatedEtapas }).catch(() => {})
    await reload(); notify()
  }

  const handleDrop = async (stepId: string, toCol: string, fromCol: string) => {
    if (fromCol === toCol) return

    if (toCol === 'Concluida' && (fromCol === 'Em Andamento' || fromCol === 'Atrasado')) {
      if (current.situacao && current.situacao !== 'em_execucao') {
        alert("Processo precisa estar 'Em Execução'")
        return
      }
      const step = etapas.find(s => s.id === stepId)
      if (step) {
        if (!podeConcluirEtapa(me, step, current)) {
          alert('Você só pode concluir as tarefas pelas quais é responsável')
          return
        }
        if (hasUnmetDependencies(step, etapas)) {
          alert('Etapas pendentes: ' + getDependencyNames(step, etapas))
          return
        }
        if (hasIncompleteSubtasks(step)) {
          alert('Conclua todas as subtarefas primeiro!')
          return
        }
      }
      await completeStepLocal(stepId)
    } else if ((toCol === 'Pendente' || toCol === 'Em Andamento') && fromCol === 'Concluida') {
      await undoStep(stepId, 'em_execucao')
    } else if (toCol === 'Pendente' && fromCol === 'Atrasado') {
      await undoStep(stepId)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeFromCol, setActiveFromCol] = useState<string | null>(null)

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    const col = columns.find(c => c.steps.some(s => s.id === e.active.id))
    setActiveFromCol(col?.key ?? null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const fromCol = activeFromCol
    setActiveId(null); setActiveFromCol(null)
    if (!e.over || !fromCol) return
    const toCol = e.over.id as string
    if (!columns.some(c => c.key === toCol)) return
    void handleDrop(String(e.active.id), toCol, fromCol)
  }

  const done = etapas.filter(e => e.isCompleted).length

  // Etapa aberta no drawer sempre "viva" (após reload/conclusão, reflete na hora)
  const selectedStepLive = selectedStep ? (etapas.find(e => e.id === selectedStep.id) || selectedStep) : null

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{current.titulo}</h3>
        <p className="text-xs text-muted-foreground">
          {current.cliente_nome} · {current.status} · {done}/{etapas.length} etapas
        </p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-2" style={{ minWidth: '900px' }}>
          {columns.map(col => (
            <Column key={col.key} col={col} current={current} etapas={etapas} usersMap={usersMap} deptMap={deptMap} me={me} onDropEnd={handleDrop} onOpenStep={setSelectedStep} onToggleSubtask={toggleSubtaskLocal} />
          ))}
        </div>
      </DndContext>
      {activeId && (
        <div className="pointer-events-none fixed left-0 top-0 z-[60] rounded-lg border bg-background/90 p-3 text-xs text-foreground shadow-xl">
          {etapas.find(e => e.id === activeId)?.title || ''}
        </div>
      )}
      {selectedStepLive && (
        <StepDetailDrawer
          step={selectedStepLive}
          etapas={etapas}
          processo={current}
          usersMap={usersMap}
          deptMap={deptMap}
          me={me}
          onClose={() => setSelectedStep(null)}
          onToggleSubtask={toggleSubtaskLocal}
          onComplete={(step) => completeStepLocal(step.id)}
          onSelectOption={selectOptionLocal}
          onAnexar={anexarStep}
          onAprovar={aprovarStepLocal}
          onReprovar={reprovarStepLocal}
          onReenviar={reenviarStepLocal}
          onAnexarChecklist={anexarChecklistItem}
        />
      )}
      {reprovacaoModal && (
        <ReprovacaoCienciaModal etapa={reprovacaoModal} onConfirm={confirmarCiencia} />
      )}
    </div>
  )
}