import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clientFetch, clearClientToken, getClientToken } from './PortalLogin'
import { authedDownload } from '@/lib/download'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, ScrollText, MessageSquare, LogOut, Plus, X, Send, Download, Loader2,
  CheckCircle2, Clock, Building2, Upload, Paperclip, Wallet, Users, ClipboardList, RefreshCw,
} from 'lucide-react'
import Financeiro from './Financeiro'
import MeusClientes from './MeusClientes'
import NotificacoesBell from './NotificacoesBell'
import ProcessosPortal from './ProcessosPortal'
import { useIsMobile } from '@/hooks/useMediaQuery'

type Tab = 'visao' | 'documentos' | 'notas' | 'solicitacoes' | 'financeiro' | 'clientes' | 'processos'

const TAB_ICON: Record<Tab, any> = {
  visao: LayoutDashboard, documentos: FileText, notas: ScrollText,
  solicitacoes: MessageSquare, financeiro: Wallet, clientes: Users, processos: ClipboardList,
}

export default function PortalPainel() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('visao')
  const [showNova, setShowNova] = useState(false)
  const [aberta, setAberta] = useState<any | null>(null)

  const me = useQuery({ queryKey: ['clime'], queryFn: () => clientFetch('/api/client-portal/auth/me'), staleTime: 60_000 })
  const obrig = useQuery({ queryKey: ['cli-obr'], queryFn: () => clientFetch('/api/client-portal/obrigacoes'), staleTime: 60_000 })
  const docs = useQuery({ queryKey: ['cli-docs'], queryFn: () => clientFetch('/api/client-portal/documentos'), staleTime: 30_000 })
  const sols = useQuery({ queryKey: ['cli-sols'], queryFn: () => clientFetch('/api/client-portal/solicitacoes'), staleTime: 20_000 })
  const tipos = useQuery({ queryKey: ['cli-tipos'], queryFn: () => clientFetch<any[]>('/api/client-portal/solicitacoes/tipos'), staleTime: 60_000 })
  const finRes = useQuery({ queryKey: ['cli-fin-res'], queryFn: () => clientFetch('/api/client-portal/financeiro/resumo'), staleTime: 30_000 })

  const sair = () => { clearClientToken(); navigate('/portal/login') }
  const nav = (t: Tab) => ({
    k: t, label: t === 'visao' ? 'Início' : t === 'documentos' ? 'Documentos' : t === 'notas' ? 'Notas'
      : t === 'solicitacoes' ? 'Solicitações' : t === 'financeiro' ? 'Financeiro' : t === 'clientes' ? 'Clientes' : 'Andamento',
  })
  const abertoCount = (sols.data?.filter((s: any) => s.status === 'aberto').length || 0)

  // Abas da barra inferior (mobile): as principais, com badges
  const mobileTabs: Tab[] = ['visao', 'documentos', 'solicitacoes', 'financeiro', 'processos']

  const go = (t: Tab) => {
    setTab(t)
    // rola para o topo ao trocar de aba no mobile
    if (isMobile) window.scrollTo(0, 0)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Topbar */}
      <header className="divider-header sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/85 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0078d4]/10 text-[#0078d4]">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="truncate">{me.data?.cliente_nome || 'Portal do Cliente'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificacoesBell />
          {!isMobile && (
            <button onClick={sair} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {/* Menu lateral (desktop) */}
        {!isMobile && (
          <aside className="w-52 shrink-0 border-r border-border/60 p-3">
            {(['visao', 'documentos', 'notas', 'solicitacoes', 'financeiro', 'clientes', 'processos'] as Tab[]).map(t => {
              const item = nav(t)
              const Icon = TAB_ICON[t]
              const count = t === 'solicitacoes' ? abertoCount : 0
              return (
                <button key={t} onClick={() => go(t)}
                  className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    tab === t ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  <Icon className="h-4 w-4 shrink-0" /> {item.label}
                  {count > 0 && (
                    <span className={`ml-auto rounded-full px-1.5 text-[10px] ${tab === t ? 'bg-white text-[#0078d4]' : 'bg-[#0078d4] text-white'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </aside>
        )}

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto p-3 pb-24 sm:p-6 sm:pb-6">
          {tab === 'visao' && <VisaoGeral obrig={obrig.data} docs={docs.data} sols={sols.data} me={me.data} fin={finRes.data} onSols={() => go('solicitacoes')} onFin={() => go('financeiro')} />}
          {tab === 'documentos' && <Documentos docs={docs.data} />}
          {tab === 'notas' && <Notas />}
          {tab === 'solicitacoes' && (
            <Solicitacoes
              sols={sols.data} tipos={tipos.data}
              aberta={aberta} setAberta={setAberta}
              onNova={() => setShowNova(true)}
              onUpdated={() => { qc.invalidateQueries({ queryKey: ['cli-sols'] }) }}
            />
          )}
          {tab === 'financeiro' && <Financeiro />}
          {tab === 'clientes' && <MeusClientes />}
          {tab === 'processos' && <ProcessosPortal />}
        </main>
      </div>

      {/* Bottom navigation (mobile) */}
      {isMobile && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
          <div className="flex">
            {mobileTabs.map(t => {
              const Icon = TAB_ICON[t]
              const count = t === 'solicitacoes' ? abertoCount : 0
              const ativo = tab === t
              return (
                <button key={t} onClick={() => go(t)}
                  className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                    ativo ? 'text-[#0078d4]' : 'text-muted-foreground'
                  }`}>
                  <Icon className="h-5 w-5" />
                  {nav(t).label}
                  {count > 0 && (
                    <span className="absolute right-[18%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{count}</span>
                  )}
                </button>
              )
            })}
            <button onClick={() => go('notas')}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${tab === 'notas' ? 'text-[#0078d4]' : 'text-muted-foreground'}`}>
              <ScrollText className="h-5 w-5" /> Notas
            </button>
            <button onClick={() => go('clientes')}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${tab === 'clientes' ? 'text-[#0078d4]' : 'text-muted-foreground'}`}>
              <Users className="h-5 w-5" /> Clientes
            </button>
          </div>
        </nav>
      )}

      {/* Sair (mobile) — botão flutuante discreto */}
      {isMobile && (
        <button onClick={sair} className="fixed bottom-20 right-3 z-40 rounded-full border border-border bg-card p-2 text-muted-foreground shadow-lg hover:text-foreground" title="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      )}

      {showNova && (
        <NovaSolicitacaoModal
          tipos={tipos.data || []}
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); qc.invalidateQueries({ queryKey: ['cli-sols'] }) }}
        />
      )}
    </div>
  )
}

function fmtDT(d?: string) { return d ? String(d).slice(0, 16).replace('T', ' ') : '-' }
const card = 'card-soft rounded-xl bg-card p-5'

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="card-soft rounded-xl bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function VisaoGeral({ obrig = [], docs = [], sols = [], me, fin, onSols, onFin }: any) {
  const pend = (obrig || []).filter((o: any) => (o.status || '').toLowerCase() !== 'concluida').length
  const abertas = (sols || []).filter((s: any) => s.status === 'aberto').length
  const f = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bem-vindo, {me?.nome || 'cliente'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Obrigações no período" value={obrig?.length || 0} color="#0078d4" />
        <Stat label="Pendências" value={pend} color="#f5a623" />
        <Stat label="Solicitações abertas" value={abertas} color="#2fbf71" />
      </div>
      {fin && (
        <button onClick={onFin} className="card-soft w-full rounded-xl bg-card p-4 text-left transition-colors hover:bg-muted/30">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Financeiro (toque para abrir)</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['A pagar (aberto)', f(fin.a_pagar_aberto), Number(fin.a_pagar_vencido) > 0 ? 'rose-600' : 'text-foreground'],
              ['A receber (aberto)', f(fin.a_receber_aberto), 'text-emerald-600'],
              ['Pagar no mês', f(fin.a_pagar_mes), 'text-foreground'],
              ['Receber no mês', f(fin.a_receber_mes), 'text-foreground'],
            ].map(([l, v, c]) => (
              <div key={l as string}>
                <p className="text-[11px] text-muted-foreground">{l}</p>
                <p className={`text-sm font-bold ${c}`}>{v}</p>
              </div>
            ))}
          </div>
        </button>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={card}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Obrigações</h3>
          {obrig?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma obrigação no período.</p>}
          <div className="space-y-2">
            {(obrig || []).slice(0, 6).map((o: any, i: number) => (
              <div key={i} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                <span className="truncate text-sm text-foreground">{o.titulo}</span>
                {(o.status || '').toLowerCase() === 'concluida'
                  ? <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> ok</span>
                  : <span className="flex shrink-0 items-center gap-1 text-xs text-amber-500"><Clock className="h-3.5 w-3.5" /> pendente</span>}
              </div>
            ))}
          </div>
        </div>
        <div className={card}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Documentos recentes</h3>
          {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento disponibilizado.</p>}
          <div className="space-y-2">
            {(docs || []).slice(0, 5).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{d.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">{d.tipo} · {fmtDT(d.created_at)}</p>
                </div>
                <button
                  onClick={() => authedDownload(`/api/client-portal/documentos/${d.id}/download`, getClientToken(), d.arquivo_nome || undefined)}
                  className="shrink-0 rounded-lg bg-[#0078d4]/10 p-1.5 text-[#0078d4] hover:bg-[#0078d4]/20"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
            {docs.length > 0 && (
              <button onClick={onSols} className="w-full pt-1 text-center text-xs text-[#0078d4] hover:underline">ver solicitações →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const TIPOS_DOC = ['Folha Ponto', 'Notas Fiscais', 'Boletos', 'DARF', 'DARE', 'Comprovantes', 'Contratos', 'Outros']

function Documentos({ docs = [], onUploaded }: any) {
  const qc = useQueryClient()
  const [recepcao, setRecepcao] = useState<'recebidos' | 'enviados'>('recebidos')
  const [enviar, setEnviar] = useState(false)
  const [tipoDoc, setTipoDoc] = useState('Folha Ponto')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const recebidos = (docs || []).filter((d: any) => d.direcao === 'enviado_escritorio')
  const enviados = (docs || []).filter((d: any) => d.direcao !== 'enviado_escritorio')

  const enviarDoc = async () => {
    if (!titulo.trim() || !arquivo) { setErr('Informe título e selecione o arquivo'); return }
    setSaving(true); setErr(''); setMsg('')
    const token = getClientToken()
    const fd = new FormData()
    fd.append('tipo', tipoDoc)
    fd.append('titulo', titulo.trim())
    fd.append('descricao', descricao.trim())
    fd.append('arquivo', arquivo)
    try {
      const r = await fetch('/api/client-portal/documentos/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`)
      setMsg('Documento enviado! A equipe vai analisar.')
      setTitulo(''); setDescricao(''); setArquivo(null); setEnviar(false)
      qc.invalidateQueries({ queryKey: ['cli-docs'] })
      if (onUploaded) onUploaded()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar')
    }
    setSaving(false)
  }

  const input = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#0078d4]'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Arquivos do escritório e envios do seu CNPJ</p>
        </div>
        <button onClick={() => { setEnviar(!enviar); setErr(''); setMsg('') }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
          <Upload className="h-4 w-4" /> Enviar documento
        </button>
      </div>

      <div className="flex gap-2">
        {(['recebidos', 'enviados'] as const).map(t => (
          <button key={t} onClick={() => setRecepcao(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${recepcao === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {t === 'recebidos' ? `Recebidos (${recebidos.length})` : `Enviados (${enviados.length})`}
          </button>
        ))}
      </div>

      {msg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600">{msg}</div>}
      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600">{err}</div>}

      {enviar && (
        <div className="card-soft rounded-lg bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Enviar documento</h3>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
                <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} className={input}>
                  {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} className={input} placeholder="Ex.: Folha ponto julho/2026" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#0078d4]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Arquivo * (máx 50MB)</label>
              <input type="file" onChange={e => setArquivo(e.target.files?.[0] || null)}
                className="w-full text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-[#0078d4]/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[#0078d4]" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEnviar(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={enviarDoc} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className={card + ' py-12 text-center text-sm text-muted-foreground'}>Nenhum documento ainda.</div>
      ) : recepcao === 'recebidos' && recebidos.length === 0 ? (
        <div className={card + ' py-10 text-center text-sm text-muted-foreground'}>Nenhum documento recebido do escritório.</div>
      ) : recepcao === 'enviados' && enviados.length === 0 ? (
        <div className={card + ' py-10 text-center text-sm text-muted-foreground'}>Você ainda não enviou documentos.</div>
      ) : (
        <div className="space-y-2">
          {(recepcao === 'recebidos' ? recebidos : enviados).map((d: any) => (
            <div key={d.id} className="card-soft flex items-center justify-between rounded-xl bg-card px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0078d4]/10 text-[#0078d4]"><Paperclip className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.titulo}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{d.tipo}</span>
                    {recepcao === 'recebidos' ? (
                      <>
                        {d.departamento_nome && <span className="rounded bg-[#0078d4]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0078d4]">{d.departamento_nome}</span>}
                        {d.tag && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">#{d.tag}</span>}
                      </>
                    ) : (
                      <span>· você · {d.status || 'enviado'}</span>
                    )}
                    <span>· {fmtDT(d.created_at)}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {recepcao === 'recebidos'
                  ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">do escritório</span>
                  : (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      d.status === 'analisado' ? 'bg-emerald-500/15 text-emerald-500' : d.status === 'enviado' ? 'bg-amber-500/15 text-amber-500' : 'bg-muted text-muted-foreground'
                    }`}>{d.status || 'enviado'}</span>
                  )}
                <button
                  onClick={() => authedDownload(`/api/client-portal/documentos/${d.id}/download`, getClientToken(), d.arquivo_nome || undefined)}
                  className="shrink-0 rounded-lg bg-[#0078d4]/10 p-1.5 text-[#0078d4] hover:bg-[#0078d4]/20"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Notas() {
  const qc = useQueryClient()
  const nfse = useQuery({ queryKey: ['cli-notas-nfse'], queryFn: () => clientFetch('/api/client-portal/notas?tipo=nfse'), staleTime: 60_000 })
  const nfe = useQuery({ queryKey: ['cli-notas-nfe'], queryFn: () => clientFetch('/api/client-portal/notas?tipo=nfe'), staleTime: 60_000 })
  const [aba, setAba] = useState<'todas' | 'entrada' | 'saida'>('todas')
  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [ordenadoPor, setOrdenadoPor] = useState('issued_at')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [gerando, setGerando] = useState<'pdf' | 'excel' | 'xmlzip' | null>(null)
  const fmtData = (d?: string) => d ? String(d).slice(0, 10) : '-'
  const fmtMoeda = (v?: number) => 'R$ ' + Number(v || 0).toFixed(2)

  const todas = [...(nfse.data || []), ...(nfe.data || [])]
  const entrar = (n: any) => ['tomados', 'entrada'].includes(n.movement_type)
  const sair = (n: any) => ['prestados', 'saida'].includes(n.movement_type)
  const base = aba === 'entrada' ? todas.filter(entrar) : aba === 'saida' ? todas.filter(sair) : todas

  const rows = base.filter((n: any) => {
    if (busca) {
      const q = busca.toLowerCase()
      const alvo = `${n.issuer_name || ''} ${n.numero || n.number || ''} ${n.status || ''}`.toLowerCase()
      if (!alvo.includes(q)) return false
    }
    if (fTipo && !(n.tipo_doc || n.tipo || '').includes(fTipo)) return false
    if (fDe && n.issued_at && String(n.issued_at).slice(0, 10) < fDe) return false
    if (fAte && n.issued_at && String(n.issued_at).slice(0, 10) > fAte) return false
    return true
  }).sort((a: any, b: any) => {
    let va = a[ordenadoPor], vb = b[ordenadoPor]
    if (ordenadoPor === 'total_value') { va = Number(va || 0); vb = Number(vb || 0) }
    else { va = String(va || ''); vb = String(vb || '') }
    const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb)
    return dir === 'asc' ? cmp : -cmp
  }).slice(0, 250)

  const ordenar = (col: string) => {
    if (ordenadoPor === col) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setOrdenadoPor(col); setDir('asc') }
  }
  const Th = ({ children, col }: any) => (
    <th className="cursor-pointer select-none whitespace-nowrap py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      onClick={() => ordenar(col)}>
      {children} {ordenadoPor === col && <span className="text-[#0078d4]">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )

  const gerarRelatorio = async (formato: 'pdf' | 'excel' | 'xmlzip') => {
    setGerando(formato)
    const token = getClientToken()
    const params = new URLSearchParams({ formato, doc_type: 'both' })
    if (fDe) params.set('issued_from', fDe)
    if (fAte) params.set('issued_to', fAte)
    if (aba === 'entrada') params.set('movement', 'tomados')
    if (aba === 'saida') params.set('movement', 'prestados')
    try {
      const r = await fetch(`/api/client-portal/notas/relatorio?${params}`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${r.status}`) }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `relatorio-notas.${formato === 'excel' ? 'xlsx' : formato === 'xmlzip' ? 'zip' : 'pdf'}`
      a.click(); URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao gerar relatório')
    }
    setGerando(null)
  }

  const inputF = 'h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notas fiscais</h1>
          <p className="mt-1 text-sm text-muted-foreground">NFS-e e NF-e do seu CNPJ — com entrada e saída</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => gerarRelatorio('pdf')} disabled={!!gerando}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">
            {gerando === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Relatório PDF
          </button>
          <button onClick={() => gerarRelatorio('excel')} disabled={!!gerando}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">
            {gerando === 'excel' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Excel
          </button>
          <button onClick={() => gerarRelatorio('xmlzip')} disabled={!!gerando}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">
            {gerando === 'xmlzip' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} XMLs (ZIP)
          </button>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['cli-notas-nfse'] })}
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Abas entrada / saída */}
      <div className="flex gap-2">
        {(['todas', 'entrada', 'saida'] as const).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${aba === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {t === 'todas' ? 'Todas' : t === 'entrada' ? 'Entrada' : 'Saída'}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="card-soft flex flex-wrap items-center gap-3 rounded-lg bg-card p-4">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar emitente, nº, status…" className={inputF + ' w-56'} />
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={inputF}>
          <option value="">Tipo: todos</option>
          <option value="NFS-e">NFS-e</option>
          <option value="NF-e">NF-e</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">De
          <input type="date" value={fDe} onChange={e => setFDe(e.target.value)} className={inputF} />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Até
          <input type="date" value={fAte} onChange={e => setFAte(e.target.value)} className={inputF} />
        </label>
        {(busca || fTipo || fDe || fAte) && (
          <button onClick={() => { setBusca(''); setFTipo(''); setFDe(''); setFAte('') }}
            className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Limpar</button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} nota(s)</span>
      </div>

      {rows.length === 0 ? (
        <div className={card + ' py-12 text-center text-sm text-muted-foreground'}>Nenhuma nota localizada{aba !== 'todas' ? ' nesta aba' : ''}.</div>
      ) : (
        <div className="card-soft overflow-hidden rounded-lg bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr className="whitespace-nowrap text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Th col="tipo_doc">Tipo</Th>
                  <Th col="status">Status</Th>
                  <Th col="movement_type">Movimento</Th>
                  <Th col="numero">Nº</Th>
                  <Th col="issued_at">Data</Th>
                  <Th col="issuer_name">Emitente</Th>
                  <Th col="total_value" >Valor</Th>
                  <th className="py-2 pr-4 text-center">XML</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n: any) => (
                  <tr key={n.id || n.access_key || n.numero} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                    <td className="py-2 pl-4 pr-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${(n.tipo_doc || n.tipo || '').includes('NF-e') ? 'bg-blue-50 text-blue-700' : 'bg-cyan-50 text-cyan-700'}`}>
                        {n.tipo_doc || n.tipo || '-'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{n.status || '-'}</td>
                    <td className="py-2 pr-3 text-xs">
                      {n.movement_type ? (
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          n.movement_type === 'prestados' || n.movement_type === 'saida' ? 'bg-blue-50 text-blue-700'
                          : n.movement_type === 'tomados' || n.movement_type === 'entrada' ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-muted text-muted-foreground'}`}>
                          {n.movement_type === 'prestados' ? 'Saída (prestados)' : n.movement_type === 'tomados' ? 'Entrada (tomados)' : n.movement_type}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{n.numero || n.number || '-'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{fmtData(n.issued_at)}</td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-xs">{n.issuer_name || n.xNome || '-'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-right text-xs font-medium">{fmtMoeda(n.total_value)}</td>
                    <td className="py-2 pr-4 text-center">
                      <button
                        onClick={() => authedDownload(`/api/client-portal/notas/${n.id}/download?tipo=${(n.tipo_doc || '').toLowerCase().includes('nfe') ? 'nfe' : 'nfse'}`, getClientToken())}
                        className="rounded px-2 py-1 text-xs font-medium text-[#0078d4] transition-colors hover:bg-[#0078d4]/10">
                        XML
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Solicitacoes({ sols = [], aberta, setAberta, onNova, onUpdated }: any) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Solicitações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Peça documentos, tire dúvidas, emita NFS-e…</p>
        </div>
        <button onClick={onNova} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova solicitação
        </button>
      </div>
      {sols.length === 0 ? (
        <div className={card + ' py-12 text-center text-sm text-muted-foreground'}>Nenhuma solicitação ainda.</div>
      ) : (
        <div className="space-y-2">
          {sols.map((s: any) => (
            <div key={s.id} onClick={() => setAberta(s)}
              className="card-soft cursor-pointer rounded-xl bg-card px-4 py-3 transition-colors hover:border-[#0078d4]/40">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.titulo}</p>
                  <p className="text-xs text-muted-foreground">{s.tipo} · {s.prioridade} · {fmtDT(s.created_at)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  s.status === 'aberto' ? 'bg-amber-500/15 text-amber-500' : s.status === 'resolvido' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'
                }`}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {aberta && <SolicitacaoDetalhe s={aberta} onClose={() => setAberta(null)} onUpdated={onUpdated} />}
    </div>
  )
}

function SolicitacaoDetalhe({ s, onClose, onUpdated }: any) {
  const qc = useQueryClient()
  const [msg, setMsg] = useState('')
  const det = useQuery({ queryKey: ['cli-sol', s.id], queryFn: () => clientFetch(`/api/client-portal/solicitacoes/${s.id}`), staleTime: 15_000 })
  const sol = det.data?.solicitacao
  const msgs = det.data?.mensagens || []
  const campos = (() => { try { return JSON.parse(sol?.campos || '{}') } catch { return {} } })()

  const enviar = async () => {
    if (!msg.trim()) return
    await clientFetch(`/api/client-portal/solicitacoes/${s.id}/mensagens`, { method: 'POST', body: JSON.stringify({ mensagem: msg.trim() }) })
    setMsg('')
    qc.invalidateQueries({ queryKey: ['cli-sol', s.id] })
  }
  const fechar = async () => {
    await clientFetch(`/api/client-portal/solicitacoes/${s.id}/fechar`, { method: 'POST', body: JSON.stringify({}) })
    onUpdated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex min-w-0 h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{sol?.titulo || 'Solicitação'}</h3>
            <p className="text-[11px] text-muted-foreground">{sol?.tipo} · {sol?.status}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {Object.keys(campos).length > 0 && (
            <div className="break-words rounded-lg bg-muted/30 p-3">
              {Object.entries(campos).map(([k, v]) => (
                <p key={k} className="break-words text-xs text-foreground"><b className="capitalize">{k.replace('_', ' ')}:</b> {String(v)}</p>
              ))}
            </div>
          )}
          {sol?.descricao && <p className="break-words text-sm text-foreground">{sol.descricao}</p>}
          <div className="space-y-2">
            {msgs.map((m: any) => (
              <div key={m.id} className={`max-w-[85%] break-words whitespace-normal rounded-lg px-3 py-2 text-sm ${m.de_client ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {m.mensagem}
                {m.anexo_path && <button onClick={() => authedDownload(`/api/client-portal/solicitacoes/${s.id}/anexos/${m.id}`, getClientToken())} className="mt-1 block text-xs underline">baixar anexo</button>}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border/60 p-3">
          {sol?.status === 'aberto' && (
            <div className="flex items-center gap-2">
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()}
                placeholder="Escreva uma mensagem…" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[#0078d4]" />
              <button onClick={enviar} className="rounded-lg bg-primary p-2 text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90"><Send className="h-4 w-4" /></button>
              <button onClick={fechar} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NovaSolicitacaoModal({ tipos, onClose, onSaved }: any) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState('duvida')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState('normal')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const modelo: any = tipos.find((t: any) => t.slug === tipo)
  const campoModelo: any[] = modelo?.campos_obrigatorios || []

  const setCampo = (k: string, v: string) => setCampos(c => ({ ...c, [k]: v }))

  const salvar = async () => {
    if (!titulo.trim()) { setErr('Informe um título'); return }
    for (const f of campoModelo) {
      if (!String(campos[f.nome] || '').trim()) { setErr(`Preencha: ${f.rotulo || f.nome}`); return }
    }
    setSaving(true); setErr('')
    try {
      await clientFetch('/api/client-portal/solicitacoes', {
        method: 'POST',
        body: JSON.stringify({ titulo: titulo.trim(), descricao: descricao.trim(), tipo, prioridade, campos }),
      })
      qc.invalidateQueries({ queryKey: ['cli-sols'] })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar')
    }
    setSaving(false)
  }

  const input = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#0078d4]'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Nova solicitação</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de solicitação</label>
            <select value={tipo} onChange={e => { setTipo(e.target.value); setCampos({}); setErr('') }} className={input}>
              {tipos.map((t: any) => <option key={t.slug} value={t.slug}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Prioridade</label>
            <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className={input}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} className={input} placeholder="Ex.: Emissão de NFS-e para a Empresa X" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#0078d4]" />
          </div>
          {campoModelo.length > 0 && (
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Dados necessários ({modelo?.nome})</p>
              <div className="space-y-2">
                {campoModelo.map((f: any) => (
                  <div key={f.nome}>
                    <label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{f.rotulo || f.nome} *</label>
                    <input type={f.tipo === 'number' ? 'number' : 'text'} value={campos[f.nome] || ''} onChange={e => setCampo(f.nome, e.target.value)} className={input} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {err && <p className="text-xs text-rose-600">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={salvar} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar solicitação
          </button>
        </div>
      </div>
    </div>
  )
}