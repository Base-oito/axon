import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getToken } from '@/lib/api'
import { authedDownload } from '@/lib/download'
import { X, Send, Loader2, RefreshCw, Inbox, Paperclip } from 'lucide-react'

interface Solic {
  id: number; cliente_id: number; cliente_nome: string; titulo: string; descricao: string
  tipo: string; prioridade: string; status: string; departamento_destino?: number | null
  campos?: string; created_at?: string; updated_at?: string; mensagens: number; responsavel_nome?: string
}

export default function PortalAdmin() {
  const [filter, setFilter] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fDept, setFDept] = useState('')
  const [fResp, setFResp] = useState('')
  const [fPri, setFPri] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [txtFiltro, setTxtFiltro] = useState('')
  const qc = useQueryClient()

  const params = new URLSearchParams()
  if (filter) params.set('status', filter)
  if (fTipo) params.set('tipo', fTipo)
  if (fDept) params.set('departamento_id', fDept)
  if (fResp) params.set('responsavel_id', fResp)
  if (fPri) params.set('prioridade', fPri)
  const qs = params.toString()

  const { data: sols = [], isLoading } = useQuery({
    queryKey: ['portal-admin-sols', qs],
    queryFn: () => apiFetch<Solic[]>(`/api/client-portal/admin/solicitacoes${qs ? `?${qs}` : ''}`),
    refetchInterval: 15_000, staleTime: 10_000,
  })
  const { data: tipos = [] } = useQuery({
    queryKey: ['portal-admin-tipos'],
    queryFn: () => apiFetch<any[]>('/api/client-portal/admin/solicitacoes/tipos'),
    staleTime: 60_000,
  })
  const { data: usuarios = [] } = useQuery({
    queryKey: ['portal-admin-usuarios'],
    queryFn: () => apiFetch<any[]>('/api/usuarios?limit=500'),
    staleTime: 60_000,
  })
  const { data: det, refetch: refetchDet } = useQuery({
    queryKey: ['portal-admin-sol', openId],
    queryFn: () => apiFetch<{ solicitacao: any; mensagens: any[] }>(`/api/client-portal/admin/solicitacoes/${openId}/detalhe`),
    enabled: !!openId, staleTime: 10_000,
  })
  // departamentos fixo (suficiente p/ rotear)
  const { data: depts = [] } = useQuery({
    queryKey: ['portal-admin-depts'],
    queryFn: () => apiFetch<any[]>('/api/departamentos'),
    staleTime: 60_000,
  })

  const inval = () => { qc.invalidateQueries({ queryKey: ['portal-admin-sols'] }); refetchDet() }

  const updateSolic = async (id: number, body: any) => {
    const t = getToken()
    await fetch(`/api/client-portal/admin/solicitacoes/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(body),
    })
    inval()
  }
  const responder = async () => {
    if (!msg.trim() || openId == null) return
    const t = getToken()
    await fetch(`/api/client-portal/admin/solicitacoes/${openId}/mensagens`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ mensagem: msg.trim() }),
    })
    setMsg(''); refetchDet()
  }

  const fecharNota = async (sid: number, anexo: File, notaMsg: string) => {
    const t = getToken()
    const fd = new FormData()
    fd.append('anexo', anexo)
    fd.append('mensagem', notaMsg || 'Nota fiscal emitida.')
    const r = await fetch(`/api/client-portal/admin/solicitacoes/${sid}/fechar-nota`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd,
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${r.status}`) }
    inval()
  }

  const filtrados = sols.filter(s => {
    if (!txtFiltro) return true
    const q = txtFiltro.toLowerCase()
    return (s.titulo || '').toLowerCase().includes(q) || (s.cliente_nome || '').toLowerCase().includes(q) || (s.tipo || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Portal de Atendimento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Atenda, responda e encaminhe solicitações dos clientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={txtFiltro} onChange={e => setTxtFiltro(e.target.value)} placeholder="Buscar cliente, título, tipo…"
            className="h-9 w-52 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
          <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring">
            <option value="">Status: todos</option>
            <option value="aberto">Aberto</option>
            <option value="em_atendimento">Em atendimento</option>
            <option value="resolvido">Resolvido</option>
            <option value="fechado">Fechado</option>
          </select>
          <select value={fTipo} onChange={e => setFTipo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring">
            <option value="">Tipo: todos</option>
            {tipos.map((t: any) => <option key={t.slug} value={t.slug}>{t.nome}</option>)}
          </select>
          <select value={fDept} onChange={e => setFDept(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring">
            <option value="">Departamento: todos</option>
            {depts.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select value={fResp} onChange={e => setFResp(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring">
            <option value="">Responsável: todos</option>
            {usuarios.map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
          </select>
          <select value={fPri} onChange={e => setFPri(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring">
            <option value="">Prioridade: todas</option>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <button onClick={() => { setFilter(''); setFTipo(''); setFDept(''); setFResp(''); setFPri(''); setTxtFiltro('') }}
            className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Limpar</button>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['portal-admin-sols'] })} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="card-soft rounded-lg bg-card py-16 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-foreground">Nenhuma solicitação{filter ? ` com status "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="divide-y divide-border/40">
            {filtrados.map(s => (
              <div key={s.id} onClick={() => setOpenId(s.id)}
                className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.status === 'aberto' ? 'bg-amber-500' : s.status === 'resolvido' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{s.titulo}</span>
                    <span className="rounded bg-[#0078d4]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0078d4]">{s.tipo}</span>
                    {s.prioridade && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        s.prioridade === 'urgente' ? 'bg-red-500/20 text-red-500' : s.prioridade === 'alta' ? 'bg-orange-500/20 text-orange-500' : s.prioridade === 'normal' ? 'bg-sky-500/15 text-sky-600' : 'bg-muted text-muted-foreground'
                      }`}>{s.prioridade}</span>
                    )}
                    {s.responsavel_nome && <span className="text-[10px] text-muted-foreground">→ {s.responsavel_nome}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.cliente_nome} · atualizada {String(s.updated_at || '').slice(0, 16).replace('T', ' ')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  s.status === 'aberto' ? 'bg-amber-50 text-amber-700' : s.status === 'resolvido' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                }`}>{s.status}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.mensagens} msg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {openId && det && (
        <AdminDetalhe
          det={det}
          tipos={tipos}
          depts={depts}
          msg={msg} setMsg={setMsg} responder={responder}
          updateSolic={updateSolic}
          fecharNota={fecharNota}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function AdminDetalhe({ det, tipos, depts, msg, setMsg, responder, updateSolic, fecharNota, onClose }: any) {
  const s = det.solicitacao
  const campos = (() => { try { return JSON.parse(s.campos || '{}') } catch { return {} } })()
  const statusOpcoes = ['aberto', 'em_atendimento', 'resolvido', 'fechado']
  const input = 'h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring'
  const ehNfse = (s.tipo || '') === 'emissao_nfse'
  const [notaFile, setNotaFile] = useState<File | null>(null)
  const [notaMsg, setNotaMsg] = useState('')
  const [fechando, setFechando] = useState(false)
  const [fErr, setFErr] = useState('')

  const anexarEFechar = async () => {
    if (!notaFile) { setFErr('Selecione o arquivo da nota fiscal'); return }
    setFechando(true); setFErr('')
    try {
      await fecharNota(s.id, notaFile, notaMsg)
    } catch (e) {
      setFErr(e instanceof Error ? e.message : 'Erro ao fechar')
    }
    setFechando(false)
    setNotaFile(null); setNotaMsg('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{s.titulo}</h3>
            <p className="text-[11px] text-muted-foreground">{s.cliente_nome} · #{s.id}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Campos do modelo + ações */}
        <div className="min-w-0 border-b border-border/60 p-4">
          {Object.keys(campos).length > 0 && (
            <div className="mb-3 break-words rounded-lg bg-muted/30 p-3">
              {Object.entries(campos).map(([k, v]) => (
                <p key={k} className="break-words text-xs text-foreground"><b className="capitalize">{k.replace('_', ' ')}:</b> {String(v)}</p>
              ))}
            </div>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select value={s.status} onChange={e => updateSolic(s.id, { status: e.target.value })} className={input}>
              {statusOpcoes.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
            </select>
            <select value={s.tipo || ''} onChange={e => updateSolic(s.id, { tipo: e.target.value })} className={input}>
              <option value="">—</option>
              {tipos.map((t: any) => <option key={t.slug} value={t.slug}>{t.nome}</option>)}
            </select>
            <select value={s.departamento_destino || ''} onChange={e => updateSolic(s.id, { departamento_destino: e.target.value ? Number(e.target.value) : null })} className={input}>
              <option value="">Sem depto</option>
              {depts.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          {s.descricao && <p className="break-words text-sm text-muted-foreground">{s.descricao}</p>}
        </div>

        {/* Mensagens */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {det.mensagens.map((m: any) => (
            <div key={m.id} className={`max-w-[85%] break-words whitespace-normal rounded-lg px-3 py-2 text-sm ${m.de_client ? 'mr-auto bg-muted text-foreground' : 'ml-auto bg-[#0078d4] text-white'}`}>
              <p className="text-[10px] opacity-70">{m.autor_nome || (m.de_client ? 'Cliente' : 'Escritório')}</p>
              {m.mensagem}
              {m.anexo_path && <button onClick={() => authedDownload(`/api/client-portal/admin/solicitacoes/${s.id}/anexos/${m.id}`, getToken())} className="mt-1 block text-xs underline">baixar anexo</button>}
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 p-3">
          {ehNfse && (
            <div className="mb-2 rounded-lg border border-[#0078d4]/30 bg-[#0078d4]/5 p-3">
              <p className="mb-2 text-[11px] font-semibold text-[#0078d4]">Fechar solicitando a nota emitida (envie o arquivo da NFS-e)</p>
              <div className="space-y-2">
                <input type="file" onChange={e => setNotaFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-[#0078d4]/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[#0078d4]" />
                <input value={notaMsg} onChange={e => setNotaMsg(e.target.value)} placeholder="Mensagem ao cliente (ex.: nota emitida em anexo)"
                  className={input + ' w-full'} />
                {fErr && <p className="text-xs text-rose-600">{fErr}</p>}
                <button onClick={anexarEFechar} disabled={fechando || !notaFile}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
                  {fechando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {fechando ? 'Fechando…' : 'Anexar nota e fechar'}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && responder()}
              placeholder="Responder ao cliente…" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={responder} className="rounded-lg bg-[#0078d4] p-2 text-white hover:bg-[#0078d4]/85"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}