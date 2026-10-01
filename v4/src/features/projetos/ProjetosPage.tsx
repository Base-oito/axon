import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Plus, Trash2, Loader2, Clock, MessageSquare } from 'lucide-react'
import { apiFetch, getToken } from '@/lib/api'
import { useProjetos, useObjetivos, useMutationProjeto, useObjetivoMutations, useTarefaMutations, useComentarios, useComentarioMutations } from './api'
import { ObjetivoCard, ProjetoModal, ObjetivoModal } from './components'

function isAdmin() {
  try {
    const t = getToken()
    if (!t) return false
    const p = JSON.parse(atob(t.split('.')[1]))
    return ['administrador', 'super_admin'].includes(p.role)
  } catch { return false }
}

function currentUserId(): number {
  try {
    const t = getToken()
    if (!t) return 0
    const p = JSON.parse(atob(t.split('.')[1]))
    return Number(p.sub) || 0
  } catch { return 0 }
}

function isLeader(): boolean {
  try {
    const t = getToken()
    if (!t) return false
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.role === 'lider'
  } catch { return false }
}

function podeEditarProjeto(projeto: any, o: any): boolean {
  const uid = currentUserId()
  if (isAdmin()) return true
  if (projeto?.responsavel_id && Number(projeto.responsavel_id) === uid) return true
  if (o?.responsavel_id && Number(o.responsavel_id) === uid) return true
  // líder pode (backend também valida por departamento — libera no tempo do erro)
  return isLeader()
}

export default function ProjetosPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return id ? <ProjetoDetalhe projetoId={Number(id)} onBack={() => navigate('/projetos')} /> : <ProjetosLista onOpen={p => navigate(`/projetos/${p.id}`)} />
}

function ProjetosLista({ onOpen }: { onOpen: (p: any) => void }) {
  const { data: projetos = [], isLoading } = useProjetos()
  const [showModal, setShowModal] = useState(false)
  const [edit, setEdit] = useState<any | null>(null)
  const mut = useMutationProjeto()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Objetivos, tarefas ponderadas e progresso — mapeie tudo que deve ser feito</p>
        </div>
        <button onClick={() => { setEdit(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo projeto
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : projetos.length === 0 ? (
        <div className="card-soft rounded-lg bg-card py-16 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-foreground">Nenhum projeto criado</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie o primeiro projeto para começar a mapear objetivos e tarefas.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map(p => {
            const venc = p.prazo ? new Date(p.prazo + 'T00:00:00') : null
            const dias = venc ? Math.ceil((venc.getTime() - Date.now()) / 86400000) : null
            return (
              <div key={p.id} onClick={() => onOpen(p)}
                className="group card-soft cursor-pointer rounded-lg bg-card p-5 transition-colors hover:border-[#0078d4]/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: (p.cor || '#0078d4') + '18', color: p.cor || '#0078d4' }}>
                      <FolderKanban className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">{p.responsavel_nome || 'Sem responsável'} · {p.qtd_objetivos} objetivo(s)</p>
                    </div>
                  </div>
                  {isAdmin() && (
                    <button onClick={e => { e.stopPropagation(); if (confirm('Excluir projeto? Esta ação remove objetivos, tarefas e histórico.')) mut.del.mutate(Number(p.id)) }}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600" title="Excluir projeto (somente admin)">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progresso</span><span className="font-semibold text-foreground">{p.progresso}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Number(p.progresso) || 0, 100)}%`, background: p.cor || '#0078d4' }} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.horas} h</span>
                  {dias !== null && (
                    <span className={dias < 0 ? 'text-rose-600 font-medium' : dias <= 30 ? 'text-amber-600 font-medium' : ''}>
                      {dias < 0 ? `Atrasado ${-dias}d` : `${dias} dias restantes`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <ProjetoModal
          projeto={edit}
          onClose={() => setShowModal(false)}
          onSaved={async (payload: any, id?: number) => {
            if (id) await mut.upd.mutateAsync({ id, ...payload })
            else await mut.create.mutateAsync(payload)
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function ProjetoDetalhe({ projetoId, onBack }: { projetoId: number; onBack: () => void }) {
  const { data: objetivos = [], isLoading } = useObjetivos(projetoId)
  const { data: projeto } = useProjetos()
  const proj = (projeto || []).find(p => p.id === projetoId)
  const mutObj = useObjetivoMutations(projetoId)
  const mutTarefa = useTarefaMutations(projetoId)
  const mutProj = useMutationProjeto()
  const { data: comentarios = [] } = useComentarios(projetoId)
  const mutCom = useComentarioMutations(projetoId)
  const [comentario, setComentario] = useState('')
  const { data: usuarios = [] } = useQuery({ queryKey: ['projetos-usuarios'], queryFn: () => apiFetch<any[]>('/api/usuarios?limit=500'), staleTime: 5 * 60_000 })
  const [showObj, setShowObj] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{proj?.titulo || `Projeto #${projetoId}`}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {proj?.qtd_objetivos || 0} objetivo(s) · {proj?.horas || 0}h apontadas
              {proj?.prazo ? ` · prazo ${String(proj.prazo).slice(0, 10)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Responsável
            <select
              value={proj?.responsavel_id ? String(proj.responsavel_id) : ''}
              onChange={e => { const v = e.target.value; mutProj.upd.mutate({ id: projetoId, responsavel_id: v ? Number(v) : null }) }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">—</option>
              {usuarios.map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
            </select>
          </label>
        </div>
      </div>

      {proj && (
        <div className="card-soft rounded-lg bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso do projeto</span><span className="text-base font-bold text-foreground">{proj.progresso}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Number(proj.progresso) || 0, 100)}%`, background: proj.cor || '#0078d4' }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Objetivos</h2>
        <button onClick={() => setShowObj(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#0078d4]/30 px-3 py-1.5 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
          <Plus className="h-3.5 w-3.5" /> Objetivo
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : objetivos.length === 0 ? (
        <div className="card-soft rounded-lg bg-card py-12 text-center text-sm text-muted-foreground">Nenhum objetivo. Crie o primeiro para começar.</div>
      ) : (
        <div className="space-y-4">
          {objetivos.map(o => (
            <ObjetivoCard key={o.id} o={o} mutTarefa={mutTarefa} mutObj={mutObj} usuarios={usuarios} podeEditar={podeEditarProjeto(proj, o)} />
          ))}
        </div>
      )}

      {showObj && (
        <ObjetivoModal onClose={() => setShowObj(false)} onSaved={async (payload) => { await mutObj.create.mutateAsync(payload); setShowObj(false) }} />
      )}

      {/* Diário do projeto */}
      <div className="card-soft rounded-lg bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#0078d4]" />
          <h3 className="text-sm font-semibold text-foreground">Diário do projeto</h3>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{comentarios.length}</span>
        </div>
        <div className="mb-3 flex items-start gap-2">
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario() } }}
            placeholder="Registre uma anotação, andamento ou problema…"
            rows={2}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={enviarComentario}
            disabled={comentario.trim().length < 3}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            Registrar
          </button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {comentarios.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma anotação ainda — este é o diário do projeto.</p>
          ) : comentarios.map((c: any) => (
            <div key={c.id} className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[#0078d4]">{c.user_name || 'Usuário'}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{String(c.criado_em || '').slice(0, 16).replace('T', ' ')}</span>
                  <button onClick={() => mutCom.del.mutate(c.id)} className="rounded p-0.5 text-muted-foreground hover:text-rose-500" title="Excluir">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-foreground">{c.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  function enviarComentario() {
    if (comentario.trim().length < 3) return
    mutCom.create.mutate({ texto: comentario.trim() })
    setComentario('')
  }
}