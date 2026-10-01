import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken, openAuthedFile } from '@/lib/api'
import type { Processo, ProcessoAnexo, ProcessoComentario } from './types'
import { addComentario, listComentarios, uploadProcessoAnexo } from './api'
import { PRIORIDADE_MAP, STATUS_MAP, countCompleted, fmtDateTimeBR, safeEtapas } from './helpers'
import KanbanPorProcesso, { type UsuarioLs } from './components/KanbanPorProcesso'

function FileBadge({ anexo }: { anexo: ProcessoAnexo }) {
  const url = anexo.url || (anexo.path ? '/api/' + anexo.path : '#')
  return (
    <a
      href={url}
      onClick={e => { e.preventDefault(); void openAuthedFile(url) }}
      target="_blank"
      rel="noreferrer"
      className="mr-1.5 mt-1 inline-flex max-w-full cursor-pointer items-center gap-1 rounded border border-[#0078d4]/30 bg-[#0078d4]/10 px-2 py-0.5 text-[11px] text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
    >
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
      </svg>
      <span className="max-w-[160px] truncate">{anexo.nome}</span>
    </a>
  )
}

function DiscussionDrawer({ processoId, onClose }: { processoId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: comentarios = [] as ProcessoComentario[] } = useQuery<ProcessoComentario[]>({
    queryKey: ['processo-comentarios', processoId],
    queryFn: () => listComentarios(processoId),
  })

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['processo-comentarios', processoId] }) }

  useEffect(() => { refresh() }, [processoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async () => {
    if (!texto.trim() && files.length === 0) return
    setEnviando(true)
    try {
      const anexos: ProcessoAnexo[] = []
      setUploading(true)
      for (const f of files) {
        const up = await uploadProcessoAnexo(processoId, f)
        anexos.push({ nome: up.nome, path: up.path, url: up.url })
      }
      setUploading(false)
      await addComentario(processoId, texto.trim(), anexos)
      setTexto(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      refresh()
    } catch (err) {
      alert('Erro ao enviar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
      setEnviando(false)
    }
  }

  const documentos = (comentarios as ProcessoComentario[]).flatMap(c => (c.anexos || []).map(a => ({ ...a, comentarioId: c.id })))

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto rounded-l-xl border-l border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#0078d4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">Comentários e Documentos</h3>
            <span className="rounded-full bg-border/60 px-2 py-0.5 text-xs text-muted-foreground">{comentarios.length} · {documentos.length} doc</span>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <h4 className="text-xs tracking-wider text-muted-foreground">Conversa sobre o processo</h4>
          {comentarios.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Nenhum comentário ainda. Inicie a conversa abaixo.</div>
          ) : (
            comentarios.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0078d4]/15 text-xs font-bold text-[#0078d4]">
                  {(c.user_nome || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 rounded-lg rounded-tl-none border border-border/60 bg-muted/20 p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{c.user_nome || 'Usuário'}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDateTimeBR(c.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{c.conteudo}</p>
                  {(c.anexos || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap">
                      {(c.anexos || []).map((a, i) => <FileBadge key={i} anexo={a} />)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          <div>
            <h4 className="mb-2 text-xs tracking-wider text-muted-foreground">Documentos ({documentos.length})</h4>
            {documentos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Nenhum documento anexado.
              </div>
            ) : (
              <div className="space-y-1.5">
                {documentos.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <span className="max-w-[55%] truncate text-xs text-foreground">{doc.nome}</span>
                    <span className="text-[10px] text-muted-foreground">Comentário #{doc.comentarioId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 p-4">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-[#0078d4] focus:outline-none"
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={e => setFiles(Array.from(e.target.files || []))}
            className="mt-2 block w-full text-[11px] text-muted-foreground file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-[#0078d4]/10 file:px-3 file:py-1.5 file:text-xs file:text-[#0078d4]"
          />
          {files.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="rounded bg-border/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {f.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={enviar}
              disabled={enviando || uploading || (!texto.trim() && files.length === 0)}
              className="rounded-lg bg-[#0078d4] px-4 py-1.5 text-xs tracking-wider text-white transition-colors hover:bg-[#0078d4]/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : 'Comentar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProcessoDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const processoId = Number(id)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [processo, setProcesso] = useState<Processo | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const { data: users = [] as UsuarioLs[] } = useQuery<UsuarioLs[]>({
    queryKey: ['usuarios'],
    queryFn: () => apiFetch<UsuarioLs[]>('/api/usuarios?limit=500'),
    staleTime: 10 * 60_000,
  })
  const usersMap = Object.fromEntries(users.map(u => [String(u.id), u]))
  const { data: departamentos = [] } = useQuery<any[]>({
    queryKey: ['departamentos'],
    queryFn: () => apiFetch<any[]>('/api/departamentos'),
    staleTime: 10 * 60_000,
  })
  const deptMap = Object.fromEntries(departamentos.map((d: any) => [String(d.id), d]))

  const fetchProcesso = async () => {
    const res = await fetch(`/api/processos/${processoId}`, {
      headers: { Authorization: 'Bearer ' + (getToken() || '') },
    })
    if (res.ok) {
      setProcesso(await res.json())
      setNotFound(false)
    } else {
      setNotFound(true)
    }
  }

  const load = async () => {
    setLoading(true)
    await fetchProcesso()
    setLoading(false)
  }

  const refresh = () => { void fetchProcesso() }

  useEffect(() => { if (processoId) load() }, [processoId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Carregando processo...
      </div>
    )
  }

  if (notFound || !processo) {
    return (
      <div className="card-soft rounded-lg bg-card p-16 text-center">
        <div className="mb-2 text-sm text-muted-foreground">Processo não encontrado.</div>
        <Link to="/processos" className="text-xs tracking-wider text-[#0078d4] hover:underline">← Voltar para Processos</Link>
      </div>
    )
  }

  const etapas = safeEtapas(processo.etapas)
  const done = countCompleted(etapas)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { navigate(-1); qc.invalidateQueries({ queryKey: ['processos'] }) }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{processo.titulo}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {processo.cliente_nome || '-'} · Criado em {fmtDateTimeBR(processo.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="rounded px-2 py-0.5 text-xs"
            style={{ backgroundColor: (STATUS_MAP[processo.status]?.color || '#535353') + '18', color: STATUS_MAP[processo.status]?.color || '#535353', border: '1px solid ' + (STATUS_MAP[processo.status]?.color || '#535353') + '35' }}
          >
            {STATUS_MAP[processo.status]?.label || processo.status}
          </span>
          <span className="text-xs font-medium" style={{ color: PRIORIDADE_MAP[processo.prioridade] || '#535353' }}>
            {processo.prioridade}
          </span>
          <span className="text-xs text-muted-foreground">{done}/{etapas.length} etapas</span>
          <button
            onClick={() => setCommentsOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#0078d4]/30 bg-[#0078d4]/10 px-3 py-2 text-xs font-medium tracking-wider text-[#0078d4] transition-colors hover:bg-[#0078d4]/20"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Comentários
          </button>
        </div>
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card p-5">
        <KanbanPorProcesso processo={processo} onChanged={refresh} usersMap={usersMap} deptMap={deptMap} />
      </div>

      {commentsOpen && <DiscussionDrawer processoId={processoId} onClose={() => setCommentsOpen(false)} />}
    </div>
  )
}