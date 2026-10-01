import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clientFetch } from './PortalLogin'
import { Plus, X, Trash2, CheckCircle2, Download, Loader2, TrendingUp, TrendingDown, CircleDollarSign, AlertTriangle } from 'lucide-react'

export type ContaF = {
  id: number; descricao: string; categoria: string; valor: number; vencimento?: string | null
  pago_em?: string | null; recebido_em?: string | null; metodo?: string; observacao?: string
  status: string; crm_cliente_id?: number | null
}

const input = 'h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring'
const catOpcoes = ['Fiscal', 'Trabalhista', 'Fornecedores', 'Aluguel', 'Energia', 'Internet', 'Combustível', 'Marketing', 'Folha', 'Impostos', 'Serviços', 'Outros']

export default function Financeiro() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'dashboard' | 'pagar' | 'receber'>('dashboard')
  const [showNovo, setShowNovo] = useState<'pagar' | 'receber' | null>(null)
  const [crm, setCrm] = useState<any[]>([])

  const q = useQuery({ queryKey: ['cli-fin'], queryFn: () => clientFetch('/api/client-portal/financeiro'), staleTime: 20_000 })
  const resumo = useQuery({ queryKey: ['cli-fin-res'], queryFn: () => clientFetch('/api/client-portal/financeiro/resumo'), staleTime: 30_000 })
  useQuery({
    queryKey: ['cli-crm'],
    queryFn: async () => {
      const d = await clientFetch<any[]>('/api/client-portal/crm/clientes')
      setCrm(d || [])
      return d
    },
    staleTime: 60_000,
  })

  const r = resumo.data as any
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controle suas contas a pagar e a receber</p>
        </div>
        <button onClick={() => exportarCSV(q.data)} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<TrendingDown className="h-4 w-4" />} label="A pagar (aberto)" value={fmtBRL(r?.a_pagar_aberto)} sub={fmtParcial(r?.a_pagar_vencido, 'vencido')} color="#d64545" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="A receber (aberto)" value={fmtBRL(r?.a_receber_aberto)} sub={fmtParcial(r?.a_receber_vencido, 'vencido')} color="#2fbf71" />
        <StatCard icon={<CircleDollarSign className="h-4 w-4" />} label="Pagar no mês" value={fmtBRL(r?.a_pagar_mes)} color="#0078d4" />
        <StatCard icon={<CircleDollarSign className="h-4 w-4" />} label="Receber no mês" value={fmtBRL(r?.a_receber_mes)} color="#0078d4" />
      </div>

      <FluxoCaixa pagar={(q.data?.pagar || []).filter((c: ContaF) => !c.pago_em)} receber={(q.data?.receber || []).filter((c: ContaF) => !c.recebido_em)} />

      <div className="flex gap-2">
        {(['dashboard', 'pagar', 'receber'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {t === 'dashboard' ? 'Resumo' : t === 'pagar' ? 'Contas a pagar' : 'Contas a receber'}
          </button>
        ))}
        <button
          onClick={() => setShowNovo(tab === 'receber' ? 'receber' : 'pagar')}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85">
          <Plus className="h-4 w-4" /> {tab === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}
        </button>
      </div>

      {tab === 'pagar' && <TabelaContas tipo="pagar" itens={q.data?.pagar || []} crm={crm} onChange={() => qc.invalidateQueries({ queryKey: ['cli-fin'] })} />}
      {tab === 'receber' && <TabelaContas tipo="receber" itens={q.data?.receber || []} crm={crm} onChange={() => qc.invalidateQueries({ queryKey: ['cli-fin'] })} />}
      {tab === 'dashboard' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProximosVencimentos titulo="Próximos vencimentos (pagar)" itens={(q.data?.pagar || []).filter((c: ContaF) => !c.pago_em)} tipo="pagar" />
          <ProximosVencimentos titulo="Próximos vencimentos (receber)" itens={(q.data?.receber || []).filter((c: ContaF) => !c.recebido_em)} tipo="receber" />
        </div>
      )}

      {showNovo && (
        <NovaContaModal
          tipo={showNovo}
          crm={crm}
          onClose={() => setShowNovo(null)}
          onSaved={() => { setShowNovo(null); qc.invalidateQueries({ queryKey: ['cli-fin'] }); qc.invalidateQueries({ queryKey: ['cli-fin-res'] }) }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: any) {
  return (
    <div className="card-soft rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ color }}>
        {icon} {label}
      </div>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-rose-600">{sub}</p>}
    </div>
  )
}

function FluxoCaixa({ pagar, receber }: any) {
  const dias = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const arr: { label: string; pagar: number; receber: number }[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoje); d.setDate(d.getDate() + 7 * i)
      const fim = new Date(d); fim.setDate(fim.getDate() + 6)
      const p = (pagar || []).filter((c: ContaF) => c.vencimento && new Date(c.vencimento) >= d && new Date(c.vencimento) <= fim)
        .reduce((s: number, c: ContaF) => s + Number(c.valor || 0), 0)
      const r = (receber || []).filter((c: ContaF) => c.vencimento && new Date(c.vencimento) >= d && new Date(c.vencimento) <= fim)
        .reduce((s: number, c: ContaF) => s + Number(c.valor || 0), 0)
      arr.push({ label: `Sem ${i + 1}`, pagar: p, receber: r })
    }
    return arr
  }, [pagar, receber])
  const max = Math.max(...dias.map(d => Math.max(d.pagar, d.receber)), 1)
  return (
    <div className="card-soft rounded-xl bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Fluxo de caixa projetado (próximas 6 semanas)</h3>
      <div className="flex h-28 items-end gap-4">
        {dias.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-1" style={{ height: 88 }}>
              <div className="w-4 rounded-t bg-emerald-500/80" style={{ height: `${Math.max(4, (d.receber / max) * 84)}px` }} title={`Receber ${fmtBRL(d.receber)}`} />
              <div className="w-4 rounded-t bg-rose-500/80" style={{ height: `${Math.max(4, (d.pagar / max) * 84)}px` }} title={`Pagar ${fmtBRL(d.pagar)}`} />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabelaContas({ tipo, itens, crm, onChange }: any) {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const colData = tipo === 'pagar' ? 'pago_em' : 'recebido_em'
  const list = (itens || []).filter((c: ContaF) => {
    if (busca && !(c.descricao || '').toLowerCase().includes(busca.toLowerCase())) return false
    if (cat && c.categoria !== cat) return false
    const quitado = colData === 'pago_em' ? c.pago_em : c.recebido_em
    if (filtro === 'aberto' && quitado) return false
    if (filtro === 'quitado' && !quitado) return false
    return true
  })

  const marcar = async (c: ContaF) => {
    const fechar = colData === 'pago_em'
    await clientFetch(`/api/client-portal/financeiro/${fechar ? 'pagar' : 'receber'}/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [fechar ? 'pago' : 'recebido']: fechar ? !c.pago_em : !c.recebido_em }),
    })
    qc.invalidateQueries({ queryKey: ['cli-fin'] }); qc.invalidateQueries({ queryKey: ['cli-fin-res'] }); onChange()
  }
  const remover = async (c: ContaF) => {
    if (!confirm(`Excluir "${c.descricao}"?`)) return
    await clientFetch(`/api/client-portal/financeiro/${colData === 'pago_em' ? 'pagar' : 'receber'}/${c.id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['cli-fin'] }); qc.invalidateQueries({ queryKey: ['cli-fin-res'] }); onChange()
  }

  const crmNome = (id?: number | null) => {
    if (!id) return ''
    const c = (crm || []).find((x: any) => x.id === id)
    return c ? c.nome : ''
  }

  return (
    <div className="card-soft rounded-xl bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 p-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className={input + ' w-52'} />
        <select value={cat} onChange={e => setCat(e.target.value)} className={input + ' w-40'}>
          <option value="">Categoria: todas</option>
          {catOpcoes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className={input + ' w-36'}>
          <option value="todos">Todos</option>
          <option value="aberto">Em aberto</option>
          <option value="quitado">Quitados</option>
        </select>
      </div>
      <table className="w-full">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Descrição</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Categoria</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Valor</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Vencimento</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Cliente</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Ações</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</td></tr>
          )}
          {list.map((c: ContaF) => {
            const fechado = colData === 'pago_em' ? c.pago_em : c.recebido_em
            return (
              <tr key={c.id} className="border-t border-border/40 hover:bg-muted/20">
                <td className="truncate px-3 py-2.5 text-sm text-foreground max-w-56">{c.descricao}</td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className="rounded bg-[#0078d4]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0078d4]">{c.categoria}</span></td>
                <td className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium text-foreground`}>{fmtBRL(c.valor)}</td>
                <td className={`whitespace-nowrap px-3 py-2.5 text-sm ${fechado ? 'text-muted-foreground line-through' : vencido(c.vencimento) && !fechado ? 'font-semibold text-rose-600' : 'text-foreground'}`}>
                  {fmtData(c.vencimento)}{fechado && <span className="ml-1 text-emerald-600">✓{fmtData(fechado)}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{crmNome(c.crm_cliente_id)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <button onClick={() => marcar(c)} title={fechado ? 'Reabrir' : 'Marcar como quitado'}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded"><CheckCircle2 className="h-4 w-4" /></button>
                  <button onClick={() => remover(c)} className="p-1 text-muted-foreground hover:text-rose-600 rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProximosVencimentos({ titulo, itens, tipo }: any) {
  const prox = [...(itens || [])].sort((a: ContaF, b: ContaF) => String(a.vencimento || '').localeCompare(String(b.vencimento || ''))).slice(0, 6)
  return (
    <div className={card}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {tipo === 'pagar' ? <TrendingDown className="h-4 w-4 text-rose-500" /> : <TrendingUp className="h-4 w-4 text-emerald-500" />}
        {titulo}
      </h3>
      {prox.length === 0 ? <p className="text-sm text-muted-foreground">Nada em aberto.</p> : (
        <div className="space-y-2">
          {prox.map((c: ContaF) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{c.descricao}</p>
                <p className={`text-[11px] ${vencido(c.vencimento) ? 'text-rose-600' : 'text-muted-foreground'}`}>
                  <AlertTriangle className={`mr-0.5 inline h-3 w-3 ${vencido(c.vencimento) ? 'text-rose-500' : ''}`} />
                  {fmtData(c.vencimento)}
                </p>
              </div>
              <span className="whitespace-nowrap text-sm font-semibold text-foreground">{fmtBRL(c.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NovaContaModal({ tipo, crm, onClose, onSaved }: any) {
  const [form, setForm] = useState({ descricao: '', categoria: 'Outros', valor: '', vencimento: '', metodo: '', observacao: '', crm_cliente_id: '' })
  const [salvando, setSalvando] = useState(false)
  const [err, setErr] = useState('')
  const f = (k: string) => (e: any) => setForm(x => ({ ...x, [k]: e.target.value }))

  const salvar = async () => {
    if (!form.descricao.trim()) { setErr('Informe a descrição'); return }
    setSalvando(true); setErr('')
    try {
      await clientFetch(`/api/client-portal/financeiro/${tipo}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, valor: Number(form.valor || 0) || 0, vencimento: form.vencimento || null, crm_cliente_id: form.crm_cliente_id ? Number(form.crm_cliente_id) : null }),
      })
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao salvar') }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{tipo === 'pagar' ? 'Nova conta a pagar' : 'Nova conta a receber'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input autoFocus value={form.descricao} onChange={f('descricao')} placeholder="Descrição *" className={input + ' w-full'} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.categoria} onChange={f('categoria')} className={input}>
              {catOpcoes.map(c => <option key={c}>{c}</option>)}
            </select>
            <input value={form.valor} onChange={f('valor')} placeholder="Valor (R$)" type="number" step="0.01" className={input} />
          </div>
          {tipo === 'receber' && (
            <select value={form.crm_cliente_id} onChange={f('crm_cliente_id')} className={input + ' w-full'}>
              <option value="">Cliente (meus clientes)</option>
              {(crm || []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input value={form.vencimento} onChange={f('vencimento')} type="date" className={input} />
            <input value={form.metodo} onChange={f('metodo')} placeholder="Método (Pix, boleto…)" className={input} />
          </div>
          <textarea value={form.observacao} onChange={f('observacao')} placeholder="Observações" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button onClick={salvar} disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078d4] py-2 text-sm font-medium text-white hover:bg-[#0078d4]/85 disabled:opacity-40">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

const card = 'card-soft rounded-xl bg-card p-5'
function fmtBRL(v: any) {
  const n = Number(v || 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(d?: string | null) {
  if (!d) return '-'
  const s = String(d).slice(0, 10).split('-')
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(d).slice(0, 10)
}
function vencido(d?: string | null) {
  if (!d) return false
  return String(d).slice(0, 10) < new Date().toISOString().slice(0, 10)
}
function fmtParcial(v: any, label: string) {
  const n = Number(v || 0)
  return n > 0 ? `${label}: ${fmtBRL(n)}` : ''
}
function exportarCSV(data: any) {
  const linhas: string[] = ['tipo,descricao,categoria,valor,vencimento,quitado_em']
  ;(['pagar', 'receber'] as const).forEach(tp => {
    ;(data?.[tp] || []).forEach((c: ContaF) => {
      linhas.push([tp, `"${(c.descricao || '').replace(/"/g, '""')}"`, c.categoria || '', String(c.valor || 0), String(c.vencimento || '').slice(0, 10), String((tp === 'pagar' ? c.pago_em : c.recebido_em) || '').slice(0, 10)].join(','))
    })
  })
  const blob = new Blob(['\ufeff' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'financeiro.csv'; a.click()
  URL.revokeObjectURL(a.href)
}