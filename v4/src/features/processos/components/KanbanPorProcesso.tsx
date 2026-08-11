import { useEffect, useState } from 'react'
import type { Etapa, Processo } from '../types'
import { updateProcesso } from '../api'
import {
  STEP_TYPE_COLORS, addDays, getCurrentStep, getDependencyNames, getDisplayName,
  hasIncompleteSubtasks, hasUnmetDependencies, safeEtapas,
} from '../helpers'

interface Props {
  processo: Processo
  onClose: () => void
}

function getStepStatus(s: Etapa, idx: number, currIdx: number, dataInicio?: string) {
  if (s.isCompleted) return 'Concluida'
  const dueDate = s.dias && dataInicio ? addDays(dataInicio, s.dias) : s.dueDate
  const isOverdue = !s.isCompleted && dueDate && new Date(dueDate + 'T00:00:00') < new Date()
  if (isOverdue) return 'Atrasado'
  if (idx === currIdx) return 'Em Andamento'
  return 'Pendente'
}

export default function KanbanPorProcesso({ processo, onClose }: Props) {
  const [current, setCurrent] = useState(processo)

  useEffect(() => setCurrent(processo), [processo])

  const etapas = safeEtapas(current.etapas)
  const currIdx = getCurrentStep(etapas).index

  const columns = [
    { key: 'Pendente', label: 'Pendente', color: '#94A3B8', steps: etapas.filter((s, i) => getStepStatus(s, i, currIdx, current.data_inicio) === 'Pendente') },
    { key: 'Em Andamento', label: 'Em Andamento', color: '#3B82F6', steps: etapas.filter((s, i) => getStepStatus(s, i, currIdx, current.data_inicio) === 'Em Andamento') },
    { key: 'Atrasado', label: 'Atrasado', color: '#EF4444', steps: etapas.filter((s, i) => getStepStatus(s, i, currIdx, current.data_inicio) === 'Atrasado') },
    { key: 'Concluida', label: 'Concluída', color: '#10B981', steps: etapas.filter(s => s.isCompleted) },
  ]

  const reload = async () => {
    try {
      const res = await fetch(`/api/processos/${processo.id}`, { headers: { Authorization: 'Bearer ' + (JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token || '') } })
      if (res.ok) setCurrent(await res.json())
    } catch {
      // ignore
    }
  }

  const completeStepLocal = async (stepId: string) => {
    const updatedEtapas = etapas.map(e => {
      if (e.id !== stepId) return e
      return { ...e, isCompleted: true, completedBy: getDisplayName(), completedAt: new Date().toISOString() }
    })
    const allDone = updatedEtapas.every(e => e.isCompleted)
    await updateProcesso(current.id, { etapas: updatedEtapas, status: allDone ? 'Concluida' : 'em_execucao' })
    await reload()
  }

  const undoStep = async (stepId: string, newStatus?: string) => {
    const updatedEtapas = etapas.map(e => (e.id === stepId ? { ...e, isCompleted: false, completedBy: undefined, completedAt: undefined } : e))
    await updateProcesso(current.id, { etapas: updatedEtapas, status: newStatus || 'em_execucao' }).catch(() => {})
    await reload()
  }

  const handleDrop = async (e: React.DragEvent, toCol: string) => {
    e.preventDefault()
    const data = JSON.parse(e.dataTransfer.getData('text/plain'))
    const { stepId, fromCol } = data
    if (fromCol === toCol) return

    if (toCol === 'Concluida' && (fromCol === 'Em Andamento' || fromCol === 'Atrasado')) {
      if (current.situacao && current.situacao !== 'em_execucao') {
        alert("Processo precisa estar 'Em Execução'")
        return
      }
      const step = etapas.find(s => s.id === stepId)
      if (step) {
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

  const changeStepStatus = async (stepId: string, newStatus: string) => {
    if (newStatus === 'Concluida') {
      if (current.situacao && current.situacao !== 'em_execucao') {
        alert("Processo precisa estar 'Em Execução'")
        return
      }
      const step = etapas.find(s => s.id === stepId)
      if (step && hasUnmetDependencies(step, etapas)) {
        alert('Etapas pendentes: ' + getDependencyNames(step, etapas))
        return
      }
      if (step && hasIncompleteSubtasks(step)) {
        alert('Conclua todas as subtarefas primeiro!')
        return
      }
      await completeStepLocal(stepId)
    } else if (newStatus === 'Pendente') {
      await undoStep(stepId, 'em_execucao')
    }
  }

  const done = etapas.filter(e => e.isCompleted).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="mx-4 flex max-h-[92vh] w-[95vw] max-w-[1400px] flex-col rounded-xl border border-border bg-card" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{current.titulo}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {current.cliente_nome} · {current.status} · {done}/{etapas.length} etapas
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-x-auto p-5">
          <div className="grid grid-cols-4 gap-4" style={{ minWidth: '900px' }}>
            {columns.map(col => (
              <div key={col.key} className="flex flex-col" style={{ minHeight: '500px' }}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                    <h4 className="text-xs tracking-wider" style={{ color: col.color }}>{col.label}</h4>
                  </div>
                  <span className="rounded-full bg-border/50 px-2 py-0.5 text-xs text-muted-foreground">{col.steps.length}</span>
                </div>
                <div
                  className="flex-1 space-y-2 overflow-y-auto rounded-lg border-2 border-dashed p-2 transition-colors"
                  style={{
                    borderColor: col.key === 'Em Andamento' || col.key === 'Atrasado' ? col.color + '30' : '#1B1B1B',
                    backgroundColor: col.key === 'Atrasado' ? '#EF444408' : 'transparent',
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, col.key)}
                >
                  {col.steps.length === 0 ? (
                    <div className="flex h-24 items-center justify-center text-xs italic text-muted-foreground">Vazio</div>
                  ) : (
                    col.steps.map(s => {
                      const dueDate = s.dias && current.data_inicio ? addDays(current.data_inicio, s.dias) : s.dueDate
                      const isOverdue = col.key === 'Atrasado'
                      const incompleteSubs = hasIncompleteSubtasks(s)
                      const unmet = hasUnmetDependencies(s, etapas)
                      const blocked = !s.isCompleted && unmet
                      return (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ stepId: s.id, fromCol: col.key }))}
                          className="cursor-grab rounded-lg border bg-background p-3 transition-colors hover:border-border active:cursor-grabbing"
                          style={{ borderColor: col.key === 'Em Andamento' || col.key === 'Atrasado' ? col.color + '40' : '#1B1B1B' }}
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <span
                              className="rounded px-1.5 py-0.5 text-xs tracking-wider"
                              style={{ backgroundColor: (STEP_TYPE_COLORS[s.type] || '#535353') + '18', color: STEP_TYPE_COLORS[s.type] || '#535353', border: '1px solid ' + (STEP_TYPE_COLORS[s.type] || '#535353') + '35' }}
                            >
                              {s.type}
                            </span>
                            <select
                              value={col.key}
                              onChange={e => { if (e.target.value !== col.key) changeStepStatus(s.id, e.target.value) }}
                              onClick={e => e.stopPropagation()}
                              className="cursor-pointer rounded border border-border/50 bg-transparent px-1 py-0.5 text-[9px] text-muted-foreground focus:outline-none"
                              style={{ maxWidth: '80px' }}
                            >
                              <option value="Pendente">Pendente</option>
                              <option value="Em Andamento">Em Andam.</option>
                              <option value="Concluida">Concluída</option>
                            </select>
                          </div>
                          <div className="mb-1.5 text-xs font-medium text-foreground">{s.title || '(sem titulo)'}</div>
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
                            <div className="mb-1.5 text-xs text-muted-foreground">
                              Subtarefas: {s.subtasks.filter(st => st.isCompleted).length}/{s.subtasks.length}
                            </div>
                          )}
                          {blocked && <div className="mb-1 text-xs text-orange-400">(Bloqueado: {getDependencyNames(s, etapas)})</div>}
                          {incompleteSubs && col.key !== 'Concluida' && <div className="mb-1 text-xs text-muted-foreground">(Subtarefas pendentes)</div>}
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
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
