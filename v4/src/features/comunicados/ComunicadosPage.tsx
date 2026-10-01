import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { Megaphone, Plus, Trash2, Eye, X, Loader2, CalendarClock, ImagePlus } from 'lucide-react'

interface Comunicado {
  id: number
  titulo: string
  conteudo: string
  imagem_url: string | null
  ativo: boolean
  scheduled_at: string | null
  publicado_em: string | null
  created_at: string
  criador_nome: string | null
}

interface Visualizacao {
  user_id: number
  display_name: string
  username: string
  viewed_at: string
}

function fmtDT(d?: string | null) {
  if (!d) return '-'
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return '-'
    return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

export default function ComunicadosPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [verVistos, setVerVistos] = useState<Comunicado | null>(null)

  const { data: comunicados = [] } = useQuery({
    queryKey: ['comunicados'],
    queryFn: () => apiFetch<Comunicado[]>('/api/comunicados'),
    staleTime: 30_000,
  })

  const { data: visualizacoes = { visualizaram: [], faltam: [] } as { visualizaram: Visualizacao[]; faltam: Visualizacao[] } } = useQuery({
    queryKey: ['comunicado-vistos', verVistos?.id],
    queryFn: () => apiFetch<{ visualizaram: Visualizacao[]; faltam: Visualizacao[] }>(`/api/comunicados/${verVistos!.id}/visualizacoes`),
    enabled: !!verVistos,
  })

  const excluir = async (id: number) => {
    if (!confirm('Excluir este comunicado?')) return
    const t = getToken()
    const r = await fetch(`/api/comunicados/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })
    if (!r.ok) { const d = await r.json().catch(() => null); alert(d?.detail || 'Erro ao excluir'); return }
    qc.invalidateQueries({ queryKey: ['comunicados'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Comunicados</h1>
          <p className="text-sm text-muted-foreground">Avisos internos — vão para o grupo Comunicados e exigem ciência</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/90"
        >
          <Plus className="h-4 w-4" />
          Novo comunicado
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Criado por</th>
              <th className="px-4 py-3">Agendado para</th>
              <th className="px-4 py-3">Publicado em</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(comunicados as Comunicado[]).map(c => {
              const agendado = c.scheduled_at && !c.publicado_em
              return (
                <tr key={c.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                  <td className="max-w-[280px] px-4 py-3">
                    <p className="truncate font-medium text-foreground">{c.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.conteudo}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.criador_nome || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmtDT(c.scheduled_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmtDT(c.publicado_em)}</td>
                  <td className="px-4 py-3 text-center">
                    {agendado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        <CalendarClock className="h-3 w-3" /> Agendado
                      </span>
                    ) : c.ativo ? (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setVerVistos(c)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-[#0078d4]"
                        title="Ver quem visualizou"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => excluir(c.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {comunicados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum comunicado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <NovoComunicadoModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['comunicados'] }) }}
        />
      )}

      {verVistos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setVerVistos(null)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Eye className="h-4 w-4 text-[#0078d4]" />
                  Visualizações
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{verVistos.titulo}</p>
              </div>
              <button onClick={() => setVerVistos(null)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
              {/* Quem visualizou */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Quem visualizou</h4>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">{(visualizacoes.visualizaram as Visualizacao[]).length}</span>
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-2">
                  {(visualizacoes.visualizaram as Visualizacao[]).length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Ninguém visualizou ainda.</p>
                  ) : (
                    (visualizacoes.visualizaram as Visualizacao[]).map(v => (
                      <div key={v.user_id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                        <span className="truncate text-sm text-foreground">{v.display_name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDT(v.viewed_at)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quem ainda falta */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-600">Quem ainda falta</h4>
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600">{(visualizacoes.faltam as Visualizacao[]).length}</span>
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-2">
                  {(visualizacoes.faltam as Visualizacao[]).length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Todos visualizaram! 🎉</p>
                  ) : (
                    (visualizacoes.faltam as Visualizacao[]).map(v => (
                      <div key={v.user_id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                        <span className="truncate text-sm text-foreground">{v.display_name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">pendente</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NovoComunicadoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [agendar, setAgendar] = useState(false)
  const [agendadoPara, setAgendadoPara] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [imagemPreview, setImagemPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Apenas imagens são aceitas'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Imagem máxima de 5MB'); return }
    setImagemPreview(URL.createObjectURL(file))
    setUploading(true)
    setError('')
    try {
      const t = getToken()
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/comunicados/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
        body: fd,
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || 'Erro no upload')
      }
      const d = await r.json()
      setImagemUrl(d.url || d.path || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no upload da imagem')
      setImagemPreview('')
    }
    setUploading(false)
  }

  const handleSave = async () => {
    setError('')
    if (!titulo.trim()) { setError('Título obrigatório'); return }
    if (!conteudo.trim()) { setError('Conteúdo obrigatório'); return }
    setSaving(true)
    try {
      const t = getToken()
      const body: Record<string, unknown> = {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        imagem_url: imagemUrl,
      }
      if (agendar && agendadoPara) {
        body.scheduled_at = new Date(agendadoPara).toISOString()
      }
      const r = await fetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || 'Erro ao criar comunicado')
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar comunicado')
    }
    setSaving(false)
  }

  const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-[#0078d4]" />
            Novo comunicado
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Reunião geral sexta-feira" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Conteúdo *</label>
            <textarea
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              rows={6}
              placeholder="Escreva o comunicado..."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Imagem (opcional)</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {imagemPreview ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img src={imagemPreview} alt="Preview" className="max-h-48 w-full object-contain" />
                <button
                  onClick={() => { setImagemPreview(''); setImagemUrl('') }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                  title="Remover imagem"
                >
                  <X className="h-4 w-4" />
                </button>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-24 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><ImagePlus className="h-4 w-4" /> Clique para enviar uma imagem</>
                )}
              </button>
            )}
          </div>
          <div>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={agendar}
                onChange={e => setAgendar(e.target.checked)}
                className="h-4 w-4 rounded accent-[#0078d4]"
              />
              Agendar publicação
            </label>
            {agendar && (
              <input
                type="datetime-local"
                value={agendadoPara}
                onChange={e => setAgendadoPara(e.target.value)}
                className={inputCls}
              />
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              {agendar ? 'Será publicado no grupo Comunicados no horário agendado' : 'Será publicado imediatamente no grupo Comunicados'}
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0078d4]/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Criando...' : agendar ? 'Agendar' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
