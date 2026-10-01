import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { authedDownload } from '@/lib/download'
import { Download, RefreshCw, Search, X, Loader2, Send, Paperclip } from 'lucide-react'

interface Doc { id: number; cliente_id: number; cliente_nome: string; tipo: string; titulo: string; descricao: string; status: string; autor_nome: string; direcao?: string; tag?: string; departamento_nome?: string; escritorio_nome?: string; created_at?: string }

const input = 'h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring'

export default function DocRecebidos() {
  const qc = useQueryClient()
  const [aba, setAba] = useState<'recebidos' | 'enviados'>('recebidos')
  const [showEnviar, setShowEnviar] = useState(false)
  const [fCliente, setFCliente] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fBusca, setFBusca] = useState('')
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: () => apiFetch<any[]>('/api/clientes'), staleTime: 60_000 })
  const { data: depts = [] } = useQuery({ queryKey: ['departamentos'], queryFn: () => apiFetch<any[]>('/api/departamentos'), staleTime: 60_000 })
  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ['client-docs-recebidos'],
    queryFn: () => apiFetch<Doc[]>('/api/client-portal/admin/documentos'),
    refetchInterval: 20_000,
    staleTime: 10_000,
  })

  const recebidos = docs.filter(d => (d.direcao || 'enviado_cliente') !== 'enviado_escritorio')
  const enviados = docs.filter(d => d.direcao === 'enviado_escritorio')
  const tipos = Array.from(new Set(docs.map(d => d.tipo).filter(Boolean))).sort()

  const visiveis = (aba === 'recebidos' ? recebidos : enviados).filter(d => {
    if (fCliente && String(d.cliente_id) !== fCliente) return false
    if (fTipo && d.tipo !== fTipo) return false
    if (fBusca) {
      const q = fBusca.toLowerCase()
      return (d.titulo || '').toLowerCase().includes(q) || (d.cliente_nome || '').toLowerCase().includes(q)
    }
    return true
  })

  const atualizarStatus = async (id: number, status: string) => {
    const t = getToken()
    await fetch(`/api/client-portal/admin/documentos/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ status }),
    })
    qc.invalidateQueries({ queryKey: ['client-docs-recebidos'] })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Documentos do cliente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Receba arquivos dos clientes e envie documentos com etiqueta de departamento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={() => setShowEnviar(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85">
            <Send className="h-4 w-4" /> Enviar documento ao cliente
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['recebidos', 'enviados'] as const).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${aba === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {t === 'recebidos' ? `Recebidos (${recebidos.length})` : `Enviados pelo escritório (${enviados.length})`}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="card-soft flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={fBusca} onChange={e => setFBusca(e.target.value)} placeholder="Buscar cliente ou título…" className="h-9 w-52 bg-transparent text-sm outline-none" />
        </div>
        <select value={fCliente} onChange={e => setFCliente(e.target.value)} className={input}>
          <option value="">Todos os clientes</option>
          {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome || c.name || c.id}</option>)}
        </select>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={input}>
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="card-soft rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
          Nenhum documento {aba === 'recebidos' ? 'recebido' : 'enviado'}{' com os filtros atuais'}.
        </div>
      ) : (
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pl-4 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Título</th>
                  <th className="py-2 pr-3">Departamento / Tag</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Autor</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-4 text-center">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((d) => (
                  <tr key={d.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                    <td className="max-w-[200px] truncate py-2 pl-4 pr-3 font-medium text-foreground">{d.cliente_nome || `#${d.cliente_id}`}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded bg-[#0078d4]/10 px-2 py-0.5 text-xs font-medium text-[#0078d4]">{d.tipo || '—'}</span>
                    </td>
                    <td className="max-w-[240px] truncate py-2 pr-3 text-foreground" title={d.titulo}>{d.titulo}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {d.departamento_nome
                          && <span className="rounded bg-[#0078d4]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0078d4]">{d.departamento_nome}</span>}
                        {d.tag && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">#{d.tag}</span>}
                        {aba === 'recebidos' && !d.departamento_nome && !d.tag && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <select value={d.status || 'enviado'} onChange={e => atualizarStatus(d.id, e.target.value)}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium outline-none ${
                          d.status === 'analisado' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                        }`}>
                        <option value="enviado">Enviado</option>
                        <option value="analisado">Analisado</option>
                      </select>
                    </td>
                    <td className="max-w-[160px] truncate py-2 pr-3 text-xs text-muted-foreground">{d.autor_nome || d.escritorio_nome || '—'}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">{String(d.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2 pr-4 text-center">
                      <button onClick={() => authedDownload(`/api/client-portal/admin/documentos/${d.id}/download`, getToken())} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEnviar && (
        <EnviarDocModal
          clientes={clientes} depts={depts}
          onClose={() => setShowEnviar(false)}
          onSaved={() => { setShowEnviar(false); setAba('enviados'); qc.invalidateQueries({ queryKey: ['client-docs-recebidos'] }) }}
        />
      )}
    </div>
  )
}

function EnviarDocModal({ clientes, depts, onClose, onSaved }: any) {
  const [form, setForm] = useState({ cliente_id: '', tipo: 'Relatório', titulo: '', descricao: '', tag: '', departamento_id: '' })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const f = (k: string) => (e: any) => setForm(x => ({ ...x, [k]: e.target.value }))

  const salvar = async () => {
    if (!form.cliente_id || !form.titulo.trim() || !arquivo) { setErr('Selecione cliente, título e arquivo'); return }
    setSending(true); setErr('')
    const fd = new FormData()
    fd.append('cliente_id', form.cliente_id)
    fd.append('tipo', form.tipo)
    fd.append('titulo', form.titulo)
    fd.append('descricao', form.descricao || '')
    fd.append('tag', form.tag || '')
    fd.append('departamento_id', form.departamento_id || '0')
    fd.append('arquivo', arquivo)
    const t = getToken()
    try {
      const r = await fetch('/api/client-portal/admin/documentos/enviar', {
        method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd,
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`)
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao enviar') }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Enviar documento ao cliente</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <select value={form.cliente_id} onChange={f('cliente_id')} className={input + ' w-full'}>
            <option value="">Cliente *</option>
            {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome || c.name || c.id}</option>)}
          </select>
          <input value={form.titulo} onChange={f('titulo')} placeholder="Título * (ex.: Relatório PIS/COFINS)" className={input + ' w-full'} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.tipo} onChange={f('tipo')} className={input}>
              {['Relatório', 'Nota Fiscal', 'Guia', 'Declaração', 'Contrato', 'Comprovante', 'Obrigação', 'Outro'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={form.departamento_id} onChange={f('departamento_id')} className={input}>
              <option value="">Departamento</option>
              {depts.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <input value={form.tag} onChange={f('tag')} placeholder="Tag (ex.: pis-cofins, fiscal)" className={input + ' w-full'} />
          <textarea value={form.descricao} onChange={f('descricao')} rows={2} placeholder="Descrição (o que compõe o valor, etc.)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
          <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30">
            <Paperclip className="h-4 w-4" />
            {arquivo ? arquivo.name : 'Anexar arquivo * (máx 50MB)'}
            <input type="file" className="hidden" onChange={e => setArquivo(e.target.files?.[0] || null)} />
          </label>
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button onClick={salvar} disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85 disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? 'Enviando…' : 'Enviar para o cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}