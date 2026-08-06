import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

type Modelo = {
  id: number; titulo: string; recorrencia: string; prioridade: string
  departamento_nome: string; total_clientes: number
  clientes: Array<{ id: number; nome: string; cnpj: string }>
  dia_vencimento: number | null; dia_meta_interna: number | null
  departamento_id?: number; documento_requerido?: boolean
}
type Cliente = { id: number; name: string; cnpj?: string; razao_social?: string; certificate_expires_at?: string }
type Departamento = { id: number; nome: string }
type Agente = {
  id: number; machine_name: string; machine_id: string
  last_heartbeat: string | null; active: boolean; operator_name: string
  cliente_id: number | null; client_name: string | null
  heartbeat_interval: number; agent_version: string; online?: boolean
}
type TarefaAgente = {
  id: number; client_name: string; task_type: string; status: string
  created_at: string; completed_at: string | null; error_message: string | null
}
type OcrTreino = { id: number; modelo_id: number; nome: string; campos: any[]; uid: string }

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

export default function Automacao() {
  const [tab, setTab] = useState('parsers')

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/automacao" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Automação</h1>
              <p className="text-pulse-ash text-sm">Parsers JS, OCR, agentes Windows e processamento</p>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-urban-smoke flex-wrap">
            {[
              { key: 'parsers', label: 'Parsers JS', can: can.automacao.parsers() },
              { key: 'lote', label: 'Envio em Lote', can: can.automacao.lote() },
              { key: 'treinar', label: 'Treinar Robô', can: can.automacao.treinar() },
              { key: 'treinos', label: 'Treinamentos', can: can.automacao.treinamentos() },
              { key: 'agentes', label: 'Agentes', can: can.automacao.agentes() },
              { key: 'gateway', label: 'Gateway', can: can.automacao.gateway() },
              { key: 'certificados', label: 'Certificados', can: can.automacao.certificados() },
            ].filter(t => t.can).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-xs tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  tab === t.key ? 'text-electric-teal border-electric-teal' : 'text-pulse-ash border-transparent hover:text-off-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'parsers' && <ModelosList />}
          {tab === 'lote' && <ProcessarLote />}
          {tab === 'treinar' && <OcrMapper />}
          {tab === 'treinos' && <OcrTreinamentoList />}
          {tab === 'agentes' && <AgentesList />}
          {tab === 'gateway' && <GatewayPanel />}
          {tab === 'certificados' && <CertificadosTab />}
        </div>
      </main>
    </div>
  )
}

/* ────────────────────────────────────────────
   PARSERS JS (Modelos + Editor Parser)
   ──────────────────────────────────────────── */
function ModelosList() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [parserModeloId, setParserModeloId] = useState<number | null>(null)

  const load = async () => {
    const t = getToken(); if (!t) return
    try { const r = await fetch('/api/modelos', { headers: { Authorization: 'Bearer ' + t } }); setModelos(await r.json()) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleGerar = async (id: number) => {
    if (!confirm('Gerar obrigações futuras para este modelo?')) return
    const t = getToken(); if (!t) return
    try {
      const r = await fetch(`/api/modelos/${id}/gerar`, { method: 'POST', headers: { Authorization: 'Bearer ' + t } })
      const d = await r.json(); alert(`Geradas ${d.geradas} obrigações`)
    } catch { alert('Erro') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir modelo?')) return
    const t = getToken(); if (!t) return
    try { await fetch(`/api/modelos/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } }); load() } catch {}
  }

  if (loading) return <div className="text-center py-20 text-pulse-ash text-sm">Carregando parsers...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs tracking-wider text-pulse-ash">
          {modelos.length} modelo{modelos.length !== 1 ? 's' : ''} · parsers JavaScript
        </h3>
      </div>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
              <th className="text-left py-3 px-4">Modelo</th>
              <th className="text-center py-3 px-4">Parser</th>
              <th className="text-center py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {modelos.map(m => (
              <tr key={m.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium">{m.titulo}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => setParserModeloId(m.id)}
                    className="px-3 py-1 rounded text-xs tracking-wider bg-purple-900/30 text-purple-400 border border-purple-400/30 hover:bg-purple-900/50 transition-colors">
                    Editor JS
                  </button>
                </td>
                <td className="py-3 px-4 text-center">
                  <Btn title="Testar Parser" onClick={async () => {
                    const t = getToken(); if (!t) return
                    try {
                      const r = await fetch(`/api/modelos/${m.id}/parser`, { headers: { Authorization: 'Bearer ' + t } })
                      const d = await r.json()
                      if (!d.codigo_js) { alert('Este modelo não tem parser definido. Clique em Editor JS para criar.'); return }
                      setParserModeloId(m.id)
                    } catch { alert('Erro ao carregar parser') }
                  }}>
                    <PlayIcon />
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {modelos.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhum modelo cadastrado.</div>}
      </div>

      {showModal && <ModeloModal modeloId={editId} onClose={() => setShowModal(false)} onSaved={load} />}
      {parserModeloId !== null && <ParserModal modeloId={parserModeloId} onClose={() => setParserModeloId(null)} />}
    </div>
  )
}

/* Modelo Form Modal */
function ModeloModal({ modeloId, onClose, onSaved }: { modeloId: number | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ titulo: '', recorrencia: 'Mensal', prioridade: 'Média', dia_vencimento: '', dia_meta_interna: '', departamento_id: '', documento_requerido: false, client_ids: [] as number[] })
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/departamentos', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(setDepartamentos).catch(() => {})
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(setClientes).catch(() => {})
    if (modeloId) {
      setLoading(true)
      fetch(`/api/modelos/${modeloId}`, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(m => {
        setForm({ titulo: m.titulo || '', recorrencia: m.recorrencia || 'Mensal', prioridade: m.prioridade || 'Média', dia_vencimento: m.dia_vencimento != null ? String(m.dia_vencimento) : '', dia_meta_interna: m.dia_meta_interna != null ? String(m.dia_meta_interna) : '', departamento_id: m.departamento_id ? String(m.departamento_id) : '', documento_requerido: !!m.documento_requerido, client_ids: (m.clientes || []).map((c: any) => c.id) })
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [modeloId])

  const toggleClient = (id: number) => setForm(prev => ({ ...prev, client_ids: prev.client_ids.includes(id) ? prev.client_ids.filter(x => x !== id) : [...prev.client_ids, id] }))
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.titulo.trim()) { alert('Título obrigatório'); return }
    const t = getToken(); if (!t) return; setSaving(true)
    const body: any = { titulo: form.titulo, recorrencia: form.recorrencia, prioridade: form.prioridade, departamento_id: form.departamento_id ? parseInt(form.departamento_id) : null, documento_requerido: form.documento_requerido, client_ids: form.client_ids }
    if (form.dia_vencimento) body.dia_vencimento = parseInt(form.dia_vencimento)
    if (form.dia_meta_interna) body.dia_meta_interna = parseInt(form.dia_meta_interna)
    try {
      await fetch(modeloId ? `/api/modelos/${modeloId}` : '/api/modelos', { method: modeloId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      onSaved(); onClose()
    } catch { alert('Erro') }
    setSaving(false)
  }

  return (
    <Modal onClose={onClose} title={modeloId ? 'Editar Modelo' : 'Novo Modelo'} width="max-w-[650px]">
      {loading ? <div className="text-center py-10 text-pulse-ash text-sm">Carregando...</div> : (
        <div className="space-y-4">
          <Field label="Título"><input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nome do modelo" className="input" /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Recorrência"><select value={form.recorrencia} onChange={e => set('recorrencia', e.target.value)} className="input"><option>Mensal</option><option>Trimestral</option><option>Anual</option><option>Única</option></select></Field>
            <Field label="Prioridade"><select value={form.prioridade} onChange={e => set('prioridade', e.target.value)} className="input"><option>Alta</option><option>Média</option><option>Baixa</option></select></Field>
            <Field label="Departamento"><select value={form.departamento_id} onChange={e => set('departamento_id', e.target.value)} className="input"><option value="">Selecionar...</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dia Vencimento"><input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => set('dia_vencimento', e.target.value)} className="input" /></Field>
            <Field label="Dia Meta Interna"><input type="number" min="1" max="31" value={form.dia_meta_interna} onChange={e => set('dia_meta_interna', e.target.value)} className="input" /></Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.documento_requerido} onChange={e => set('documento_requerido', e.target.checked)} className="rounded" /><span className="text-xs text-pulse-ash tracking-wider">Documento Requerido</span></label>
          <Field label={`Clientes (${form.client_ids.length})`}>
            <div className="border border-urban-smoke rounded-lg max-h-48 overflow-y-auto bg-core-black p-2">
              {clientes.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-urban-smoke/30 cursor-pointer text-xs">
                  <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={() => toggleClient(c.id)} className="rounded" />
                  <span className="text-off-white">{c.name}</span>
                  {c.cnpj && <span className="text-pulse-ash text-xs font-mono ml-auto">{c.cnpj}</span>}
                </label>
              ))}
            </div>
          </Field>
          <div className="flex gap-3 justify-end pt-4 border-t border-urban-smoke">
            <button onClick={onClose} className="btn-cancel">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : modeloId ? 'Atualizar' : 'Criar'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* Parser Editor */
function ParserModal({ modeloId, onClose }: { modeloId: number; onClose: () => void }) {
  const [codigoJs, setCodigoJs] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testText, setTestText] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch(`/api/modelos/${modeloId}/parser`, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(d => { setCodigoJs(d.codigo_js || ''); setLoading(false) }).catch(() => setLoading(false))
  }, [modeloId])

  const save = async () => {
    const t = getToken(); if (!t) return; setSaving(true)
    try { await fetch(`/api/modelos/${modeloId}/parser`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ codigo_js: codigoJs }) }); onClose() } catch {}
    setSaving(false)
  }

  const test = async () => {
    if (!testText.trim()) { alert('Informe um texto de teste'); return }
    const t = getToken(); if (!t) return; setTesting(true); setTestResult(null)
    try {
      const r = await fetch('/api/parsers/testar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ codigo_js: codigoJs, texto: testText, blocos: [] }) })
      setTestResult(await r.json())
    } catch { alert('Erro') }
    setTesting(false)
  }

  return (
    <Modal onClose={onClose} title={`Editor de Parser JS — Modelo #${modeloId}`} width="max-w-[850px]">
      {loading ? <div className="text-center py-10 text-pulse-ash text-sm">Carregando...</div> : (
        <div className="space-y-5">
          <Field label="Código JavaScript">
            <textarea value={codigoJs} onChange={e => setCodigoJs(e.target.value)} placeholder="function extrair(texto, blocos) { ... }" className="input font-mono" rows={16} style={{ resize: 'vertical' }} />
          </Field>
          <div className="border-t border-urban-smoke pt-4">
            <h4 className="text-xs tracking-wider text-electric-teal mb-3">Testar Parser</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Field label="Texto de entrada">
                  <textarea value={testText} onChange={e => setTestText(e.target.value)} placeholder="Cole o texto do PDF..." className="input font-mono" rows={8} style={{ resize: 'vertical' }} />
                </Field>
                <button onClick={test} disabled={testing || !testText.trim()} className="mt-2 px-4 py-2 rounded-lg text-xs tracking-wider bg-purple-900/30 text-purple-400 border border-purple-400/30 hover:bg-purple-900/50 transition-colors disabled:opacity-30">{testing ? 'Executando...' : 'Executar Teste'}</button>
              </div>
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1">Resultado</label>
                <div className="bg-core-black border border-urban-smoke rounded-lg p-3 min-h-[8rem] max-h-60 overflow-y-auto">
                  {testResult ? <pre className="text-xs text-off-white font-mono whitespace-pre-wrap">{JSON.stringify(testResult.resultado || testResult, null, 2)}</pre> : <div className="text-xs text-pulse-ash italic py-4 text-center">{testing ? 'Executando...' : 'Resultado aparecerá aqui'}</div>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-urban-smoke">
            <button onClick={onClose} className="btn-cancel">Fechar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar Parser'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ────────────────────────────────────────────
   OCR TRAINING (List + PDF Mapper)
   ──────────────────────────────────────────── */

type OcrRegion = {
  id: string
  fieldName: string
  x: number
  y: number
  w: number
  h: number
  pageNum: number
  detectedValue?: string
}

const FIELD_COLORS: Record<string, string> = {
  'CNPJ': 'rgba(0,230,200,0.3)',
  'Razão Social': 'rgba(100,149,237,0.3)',
  'Valor Total': 'rgba(255,165,0,0.3)',
  'Data Emissão': 'rgba(255,99,132,0.3)',
  'Data Vencimento': 'rgba(255,193,7,0.3)',
  'Código de Barras': 'rgba(150,220,100,0.3)',
  'Competência': 'rgba(200,130,255,0.3)',
  'Número Documento': 'rgba(0,188,212,0.3)',
}
const FIELD_BORDERS: Record<string, string> = {
  'CNPJ': '#00e6c8', 'Razão Social': '#6495ed', 'Valor Total': '#ffa500',
  'Data Emissão': '#ff6384', 'Data Vencimento': '#ffc107', 'Código de Barras': '#96dc64',
  'Competência': '#c882ff', 'Número Documento': '#00bcd4',
}
const PREDEFINED_FIELDS = ['CNPJ', 'Razão Social', 'Valor Total', 'Data Emissão', 'Data Vencimento', 'Código de Barras', 'Competência', 'Número Documento', 'Outro']

function fieldColor(name: string) { return FIELD_COLORS[name] || 'rgba(255,255,255,0.2)' }
function fieldBorder(name: string) { return FIELD_BORDERS[name] || '#ffffff' }

function OcrTreinamentoList() {
  const [treinos, setTreinos] = useState<OcrTreino[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const t = getToken(); if (!t) return
    try {
      const [tr, mo] = await Promise.all([
        fetch('/api/ocr-treinos', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('/api/modelos', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ])
      setTreinos(tr); setModelos(mo)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const del = async (id: number) => {
    if (!confirm('Excluir treino?')) return
    const t = getToken(); if (!t) return
    try { await fetch(`/api/ocr-treinos/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } }); load() } catch {}
  }

  if (loading) return <div className="text-center py-20 text-pulse-ash text-sm">Carregando treinamentos...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs tracking-wider text-pulse-ash">{treinos.length} treino{treinos.length !== 1 ? 's' : ''} OCR</h3>
          <p className="text-xs text-pulse-ash mt-1">Treinamentos de OCR para reconhecimento de campos em PDFs</p>
        </div>
      </div>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-urban-smoke text-pulse-ash tracking-wider"><th className="text-left py-3 px-4">Nome</th><th className="text-left py-3 px-4">Modelo</th><th className="text-center py-3 px-4">Campos</th><th className="text-center py-3 px-4">Ações</th></tr></thead>
          <tbody>
            {treinos.map(t => {
              const m = modelos.find(x => x.id === t.modelo_id)
              return (
                <tr key={t.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30">
                  <td className="py-3 px-4">{t.nome}</td>
                  <td className="py-3 px-4 text-pulse-ash">{m?.titulo || '-'}</td>
                  <td className="py-3 px-4 text-center"><span className="px-2 py-0.5 rounded bg-electric-teal/10 text-electric-teal text-xs">{(t.campos || []).length}</span></td>
                  <td className="py-3 px-4 text-center"><button onClick={() => del(t.id)} className="text-pulse-ash hover:text-danger transition-colors p-1"><TrashIcon /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {treinos.length === 0 && <div className="text-center py-10 text-pulse-ash text-sm">Nenhum treino OCR criado. Use a aba "Treinar Robô" para criar.</div>}
      </div>
    </div>
  )
}

/* ── OCR PDF Mapper (standalone tab) ── */
function OcrMapper() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  type PageData = { dataUrl: string; width: number; height: number }
  const [pdfjsReady, setPdfjsReady] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfName, setPdfName] = useState('')
  const [pages, setPages] = useState<PageData[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [mode, setMode] = useState<'draw' | 'pan'>('draw')
  const [selectedField, setSelectedField] = useState('CNPJ')
  const [customField, setCustomField] = useState('')
  const [regions, setRegions] = useState<OcrRegion[]>([])
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number; pageNum: number } | null>(null)
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modeloId, setModeloId] = useState('')
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ sx: number; sy: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const PDF_SCALE = 1.5

  // Load modelos for training association
  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/modelos', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(setModelos).catch(() => {})
  }, [])

  useEffect(() => {
    const win = window as any
    if (win.pdfjsLib) { setPdfjsReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs'
    s.type = 'module'
    s.onload = () => setPdfjsReady(true)
    s.onerror = () => alert('Falha ao carregar PDF.js')
    document.head.appendChild(s)
    return () => { try { document.head.removeChild(s) } catch {} }
  }, [])

  useEffect(() => {
    if (!pdfjsReady || !pdfFile) return
    const lib = (window as any).pdfjsLib
    if (!lib) return
    lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
    ;(async () => {
      try {
        const buf = await pdfFile.arrayBuffer()
        const doc = await lib.getDocument({ data: buf }).promise
        setTotalPages(doc.numPages)
        const loaded: PageData[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const vp = page.getViewport({ scale: PDF_SCALE })
          const c = document.createElement('canvas')
          c.width = vp.width; c.height = vp.height
          await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
          loaded.push({ dataUrl: c.toDataURL('image/png'), width: vp.width, height: vp.height })
        }
        setPages(loaded)
      } catch { alert('Erro ao renderizar PDF') }
    })()
  }, [pdfjsReady, pdfFile])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPdfFile(f)
    setPdfName(f.name.replace(/\.pdf$/i, ''))
    setRegions([])
    setPages([])
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  const fieldValue = () => selectedField === 'Outro' ? (customField.trim() || 'Outro') : selectedField

  const screenToPdf = (cx: number, cy: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return { x: (cx - r.left) / zoom / PDF_SCALE, y: (cy - r.top) / zoom / PDF_SCALE }
  }

  const overlayDown = (e: React.MouseEvent, pn: number) => {
    if (mode === 'pan') { setPanning(true); setPanStart({ sx: e.clientX - panX, sy: e.clientY - panY }); return }
    const pdf = screenToPdf(e.clientX, e.clientY, e.currentTarget as HTMLElement)
    setDrawing(true); setDrawStart({ ...pdf, pageNum: pn }); setDrawEnd(pdf)
  }

  const overlayMove = (e: React.MouseEvent) => {
    if (panning && panStart) { setPanX(e.clientX - panStart.sx); setPanY(e.clientY - panStart.sy); return }
    if (!drawing || !drawStart) return
    setDrawEnd(screenToPdf(e.clientX, e.clientY, e.currentTarget as HTMLElement))
  }

  const overlayUp = (e: React.MouseEvent) => {
    if (panning) { setPanning(false); setPanStart(null); return }
    if (!drawing || !drawStart) return
    setDrawing(false)
    const end = screenToPdf(e.clientX, e.clientY, e.currentTarget as HTMLElement)
    const x = Math.min(drawStart.x, end.x)
    const y = Math.min(drawStart.y, end.y)
    const w = Math.abs(end.x - drawStart.x)
    const h = Math.abs(end.y - drawStart.y)
    setDrawStart(null); setDrawEnd(null)
    if (w < 5 || h < 5) return
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
    setRegions(prev => [...prev, { id, fieldName: fieldValue(), x, y, w, h, pageNum: drawStart.pageNum }])
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    setZoom(z => Math.min(5, Math.max(0.2, z - e.deltaY * 0.005)))
  }

  const handleDetect = async () => {
    if (!pdfFile) return
    const t = getToken(); if (!t) return
    setDetecting(true)
    try {
      const fd = new FormData()
      fd.append('file', pdfFile)
      fd.append('modelo_id', modeloId)
      fd.append('areas', JSON.stringify(regions.map(r => ({ fieldName: r.fieldName, x: r.x, y: r.y, w: r.w, h: r.h, pageNum: r.pageNum }))))
      const r = await fetch('/api/ocr-detect-areas', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      const d = await r.json()
      if (d.results) {
        const detected = d.results as Array<{ fieldName: string; value: string }>
        setRegions(prev => prev.map(reg => {
          const match = detected.find(dr => dr.fieldName === reg.fieldName || (reg.fieldName === 'Outro' && customField && dr.fieldName === customField))
          return match ? { ...reg, detectedValue: match.value } : reg
        }))
        alert(`${detected.length} campo(s) detectado(s)`)
      }
    } catch { alert('Erro ao detectar áreas') }
    setDetecting(false)
  }

  const handleSave = async () => {
    if (!pdfFile) return
    if (!modeloId) { alert('Selecione um modelo vinculado'); return }
    const t = getToken(); if (!t) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', pdfFile)
      fd.append('modelo_id', modeloId)
      fd.append('nome', pdfName)
      fd.append('areas', JSON.stringify(regions.map(r => ({ fieldName: r.fieldName, x: r.x, y: r.y, w: r.w, h: r.h, pageNum: r.pageNum, detectedValue: r.detectedValue }))))
      fd.append('rules', JSON.stringify([]))
      await fetch('/api/upload/ocr-training', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      alert('Treino salvo com sucesso!')
      // Reset to load a new training
      setPdfFile(null); setPdfName(''); setPages([]); setRegions([]); setTotalPages(0)
    } catch { alert('Erro ao salvar treino') }
    setSaving(false)
  }

  const getRegionColor = (name: string) => FIELD_COLORS[name] || 'rgba(255,255,255,0.25)'
  const getRegionBorder = (name: string) => FIELD_BORDERS[name] || '#fff'

  // build drawing preview rect (in overlay-local pixels)
  let previewRect = null
  if (drawing && drawStart && drawEnd) {
    const x = Math.min(drawStart.x, drawEnd.x) * PDF_SCALE
    const y = Math.min(drawStart.y, drawEnd.y) * PDF_SCALE
    const w = Math.abs(drawEnd.x - drawStart.x) * PDF_SCALE
    const h = Math.abs(drawEnd.y - drawStart.y) * PDF_SCALE
    const c = fieldColor(fieldValue())
    const b = fieldBorder(fieldValue())
    previewRect = { x, y, w, h, c, b, pn: drawStart.pageNum }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-xs tracking-wider text-pulse-ash">{pdfFile ? `Treino: ${pdfName}` : 'Novo Treino OCR'}</h3>
        {pdfFile && <span className="text-xs text-pulse-ash">Página 1 de {totalPages}</span>}
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 260px)' }}>
        {/* LEFT — PDF viewer */}
        <div className="flex-1 bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden flex flex-col min-w-0">
          {!pdfFile ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <div className="text-center">
                <div className="text-4xl mb-4 text-pulse-ash">📄</div>
                <p className="text-sm text-pulse-ash mb-6">Selecione um arquivo PDF para mapear as regiões</p>
                <button onClick={() => fileRef.current?.click()} className="px-5 py-3 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                  Selecionar PDF
                </button>
                <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} className="hidden" />
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-urban-smoke bg-core-black/50 shrink-0 flex-wrap">
                <div className="flex gap-0.5 bg-urban-smoke/30 rounded-lg p-0.5">
                  {(['draw', 'pan'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded text-xs tracking-wider transition-colors ${mode === m ? 'bg-electric-teal text-white' : 'text-pulse-ash hover:text-off-white'}`}>
                      {m === 'draw' ? 'Marcar' : 'Mover'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-pulse-ash select-none">|</span>
                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="text-pulse-ash hover:text-off-white px-1 text-xs font-bold">−</button>
                <span className="text-xs text-pulse-ash min-w-[36px] text-center select-none">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="text-pulse-ash hover:text-off-white px-1 text-xs font-bold">+</button>
                <button onClick={() => { setZoom(1); setPanX(0); setPanY(0) }} className="text-xs text-pulse-ash hover:text-off-white uppercase px-2">Reset</button>
                <button onClick={() => fileRef.current?.click()} className="ml-auto px-3 py-1.5 rounded text-xs tracking-wider bg-urban-smoke/30 text-pulse-ash hover:text-off-white hover:bg-urban-smoke transition-colors">Trocar PDF</button>
                <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} className="hidden" />
              </div>

              {/* Scrollable pages */}
              <div className="flex-1 overflow-auto bg-core-black/50" onWheel={handleWheel}>
                <div style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`, transformOrigin: '0 0', display: 'inline-block', minWidth: '100%' }}>
                  {pages.map((p, i) => {
                    const pn = i + 1
                    return (
                      <div key={pn} className="mb-1" style={{ position: 'relative', width: p.width, height: p.height }}>
                        <img src={p.dataUrl} alt={`Página ${pn}`} style={{ display: 'block', width: p.width, height: p.height }} draggable={false} />
                        <div
                          className="overlay-layer"
                          style={{
                            position: 'absolute', top: 0, left: 0, width: p.width, height: p.height,
                            cursor: mode === 'draw' ? 'crosshair' : panning ? 'grabbing' : 'grab',
                          }}
                          onMouseDown={e => overlayDown(e, pn)}
                          onMouseMove={overlayMove}
                          onMouseUp={overlayUp}
                          onMouseLeave={() => { setPanning(false); setPanStart(null); if (drawing) setDrawing(false) }}
                        >
                          {/* Saved regions */}
                          {regions.filter(r => r.pageNum === pn).map(reg => (
                            <div key={reg.id} style={{
                              position: 'absolute',
                              left: reg.x * PDF_SCALE, top: reg.y * PDF_SCALE,
                              width: reg.w * PDF_SCALE, height: reg.h * PDF_SCALE,
                              background: getRegionColor(reg.fieldName),
                              border: `2px solid ${getRegionBorder(reg.fieldName)}`,
                              pointerEvents: 'none',
                            }}>
                              <span style={{
                                position: 'absolute', top: -16, left: 0,
                                background: getRegionBorder(reg.fieldName), color: '#000',
                                fontSize: 9, padding: '1px 4px', whiteSpace: 'nowrap', fontWeight: 600,
                              }}>
                                {reg.fieldName}{reg.detectedValue ? `: ${reg.detectedValue.substring(0, 18)}` : ''}
                              </span>
                            </div>
                          ))}
                          {/* Preview rect while drawing */}
                          {previewRect && previewRect.pn === pn && (
                            <div style={{
                              position: 'absolute',
                              left: previewRect.x, top: previewRect.y,
                              width: previewRect.w, height: previewRect.h,
                              background: previewRect.c, border: `2px solid ${previewRect.b}`,
                              pointerEvents: 'none',
                            }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {pages.length === 0 && <div className="flex items-center justify-center h-full text-pulse-ash text-xs">Renderizando páginas...</div>}
              </div>
            </>
          )}
        </div>

        {/* RIGHT — Controls panel */}
        <div className="w-[310px] shrink-0 bg-rich-carbon border border-urban-smoke rounded-xl p-4 flex flex-col gap-3 overflow-y-auto">
          <Field label="Modelo Vinculado">
            <select value={modeloId} onChange={e => setModeloId(e.target.value)} className="input">
              <option value="">Selecionar modelo...</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </Field>

          <Field label="Campo para Marcar">
            <select value={selectedField} onChange={e => setSelectedField(e.target.value)} className="input">
              {PREDEFINED_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          {selectedField === 'Outro' && (
            <Field label="Nome do Campo">
              <input value={customField} onChange={e => setCustomField(e.target.value)} placeholder="Ex: Inscrição Municipal" className="input" />
            </Field>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={handleDetect} disabled={detecting || !pdfFile || regions.length === 0}
              className="w-full px-4 py-2 rounded-lg text-xs tracking-wider bg-purple-900/30 text-purple-400 border border-purple-400/30 hover:bg-purple-900/50 transition-colors disabled:opacity-30">
              {detecting ? 'Detectando...' : 'Auto-Detectar'}
            </button>
            <button onClick={handleSave} disabled={saving || !pdfFile || regions.length === 0}
              className="w-full px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">
              {saving ? 'Salvando...' : 'Salvar Treino'}
            </button>
          </div>

          <div className="border-t border-urban-smoke pt-3">
            <h4 className="text-xs tracking-wider text-pulse-ash mb-2">Regiões ({regions.length})</h4>
            <div className="space-y-1.5">
              {regions.length === 0 && (
                <div className="text-xs text-pulse-ash text-center py-4 italic">Use o modo "Marcar" para desenhar retângulos sobre o PDF.</div>
              )}
              {regions.map(reg => (
                <div key={reg.id} className="bg-core-black border border-urban-smoke rounded-lg p-2 group">
                  <div className="flex items-center justify-between mb-1">
                    <select value={reg.fieldName} onChange={e => setRegions(prev => prev.map(r => r.id === reg.id ? { ...r, fieldName: e.target.value } : r))}
                      className="text-xs bg-transparent text-off-white border-b border-urban-smoke/50 focus:outline-none focus:border-electric-teal py-0.5" style={{ maxWidth: 140 }}>
                      {PREDEFINED_FIELDS.map(f => <option key={f} value={f} className="bg-core-black">{f}</option>)}
                      {!PREDEFINED_FIELDS.includes(reg.fieldName) && <option value={reg.fieldName} className="bg-core-black">{reg.fieldName}</option>}
                    </select>
                    <button onClick={() => setRegions(prev => prev.filter(r => r.id !== reg.id))} className="text-pulse-ash hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon /></button>
                  </div>
                  <div className="text-[9px] text-pulse-ash font-mono">
                    Pg.{reg.pageNum} ({reg.x.toFixed(0)},{reg.y.toFixed(0)}) {reg.w.toFixed(0)}×{reg.h.toFixed(0)}
                  </div>
                  {reg.detectedValue && (
                    <div className="text-xs text-success mt-1 truncate" title={reg.detectedValue}>{reg.detectedValue}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Processar Lote */
function ProcessarLote() {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }

  const process = async () => {
    if (files.length === 0) { alert('Selecione arquivos PDF'); return }
    const t = getToken(); if (!t) return; setProcessing(true); setResults([])
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    try {
      const r = await fetch('/api/processar-lote', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: formData })
      const d = await r.json()
      setResults(d.resultados || [])
    } catch { alert('Erro') }
    setProcessing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs tracking-wider text-pulse-ash">Upload em Lote de PDFs</h3>
        <span className="text-xs text-pulse-ash">{files.length} arquivo{files.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="bg-rich-carbon border-2 border-dashed border-urban-smoke rounded-xl p-10 text-center">
        <div className="text-4xl mb-4 text-pulse-ash">📄</div>
        <p className="text-sm text-pulse-ash mb-6">Arraste PDFs ou clique para selecionar</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="px-5 py-3 rounded-lg text-xs tracking-wider bg-urban-smoke text-off-white hover:bg-pulse-ash transition-colors border border-urban-smoke">Selecionar PDFs</button>
          <button onClick={process} disabled={files.length === 0 || processing} className="px-5 py-3 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-30">{processing ? 'Processando...' : 'Processar Lote'}</button>
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf" onChange={handleFiles} className="hidden" />
        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {files.map((f, i) => <span key={i} className="text-xs bg-core-black px-3 py-1 rounded-full text-pulse-ash border border-urban-smoke">{f.name}</span>)}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-urban-smoke text-pulse-ash tracking-wider"><th className="text-left py-3 px-4">Arquivo</th><th className="text-center py-3 px-4">Tamanho</th><th className="text-center py-3 px-4">Modelo</th><th className="text-center py-3 px-4">Match</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-urban-smoke/20">
                  <td className="py-3 px-4">{r.filename}</td>
                  <td className="py-3 px-4 text-center text-pulse-ash">{(r.size / 1024).toFixed(1)} KB</td>
                  <td className="py-3 px-4 text-center text-pulse-ash">{r.modelo_nome || '-'}</td>
                  <td className="py-3 px-4 text-center">{r.matched ? <span className="px-2 py-0.5 rounded bg-success/10 text-success text-xs">Match</span> : <span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-xs">Sem match</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
   AGENTES WINDOWS
   ──────────────────────────────────────────── */
function AgentesList() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [tarefas, setTarefas] = useState<TarefaAgente[]>([])
  const [tarefasLoading, setTarefasLoading] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [installAgenteId, setInstallAgenteId] = useState<number | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [editAgenteId, setEditAgenteId] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const load = async () => {
    const t = getToken(); if (!t) return
    try { setAgentes(await (await fetch('/api/agentes', { headers: { Authorization: 'Bearer ' + t } })).json()) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const loadTarefas = async (id: number) => {
    const t = getToken(); if (!t) return; setTarefasLoading(true)
    try { setTarefas(await (await fetch(`/api/agentes/${id}/tarefas`, { headers: { Authorization: 'Bearer ' + t } })).json()) } catch {}
    setTarefasLoading(false)
  }

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); setTarefas([]) }
    else { setExpandedId(id); loadTarefas(id) }
  }

  const openInstall = async (id: number) => {
    const agent = agentes.find(a => a.id === id)
    if (agent && !agent.active) { alert('Este agente está inativo. Ative-o primeiro.'); return }
    setInstallAgenteId(id); setShowInstall(true)
    const t = getToken(); if (!t) return
    try { setClientes(await (await fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } })).json()) } catch {}
  }

  const install = async (clienteId: number) => {
    if (!installAgenteId) return
    const t = getToken(); if (!t) return
    try {
      const r = await fetch(`/api/agentes/${installAgenteId}/instalar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ client_id: clienteId }),
      })
      const data = await r.json()
      if (!r.ok) { alert(data.detail || 'Erro ao criar tarefa de instalação'); return }
      alert(`Tarefa de instalação criada (#${data.task_id}). O agente irá baixar e instalar o certificado automaticamente.`)
      setShowInstall(false)
      setInstallAgenteId(null)
      load()
    } catch { alert('Erro de conexão ao criar tarefa') }
  }

  const fmtHeartbeat = (d: string | null) => {
    if (!d) return 'Nunca'
    try {
      const dt = new Date(d); if (isNaN(dt.getTime())) return 'Nunca'
      const m = Math.floor((Date.now() - dt.getTime()) / 60000)
      if (m < 1) return 'Agora'
      if (m < 60) return `${m}min`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h}h`
      return `${Math.floor(h / 24)}d`
    } catch { return 'Nunca' }
  }

  const isOnline = (a: Agente) => a.online !== undefined ? a.online : (a.active ? true : false)

  const statusColor = (s: string) => {
    const map: Record<string, string> = { completed: 'bg-success/10 text-success', concluida: 'bg-success/10 text-success', pending: 'bg-infrared/10 text-infrared', pendente: 'bg-infrared/10 text-infrared', downloading: 'bg-electric-teal/10 text-electric-teal', running: 'bg-electric-teal/10 text-electric-teal', failed: 'bg-danger/10 text-danger', erro: 'bg-danger/10 text-danger', cancelled: 'bg-pulse-ash/10 text-pulse-ash' }
    return map[s] || 'bg-pulse-ash/10 text-pulse-ash'
  }

  if (loading) return <div className="text-center py-20 text-pulse-ash text-sm">Carregando agentes...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs tracking-wider text-pulse-ash">Máquinas Windows</h3>
          <p className="text-xs text-pulse-ash mt-1">
            {agentes.filter(a => a.active).length} ativos de {agentes.length}
          </p>
        </div>
        <button onClick={() => setShowGuide(!showGuide)}
          className={`px-3 py-1.5 rounded text-xs tracking-wider border transition-colors ${
            showGuide ? 'border-electric-teal text-electric-teal' : 'border-urban-smoke text-pulse-ash hover:text-off-white'
          }`}>
          {showGuide ? 'Ocultar Guia' : 'Guia PowerShell'}
        </button>
      </div>

      {showGuide && <GuiaPowerShell />}

      {agentes.length === 0 && (
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-10 text-center">
          <div className="text-4xl mb-4">🖥</div>
          <h3 className="text-sm mb-2">Nenhum agente registrado</h3>
          <p className="text-xs text-pulse-ash mb-4">Instale o agente Windows em uma máquina para gerenciar certificados remotamente.</p>
          <div className="bg-core-black border border-urban-smoke rounded-lg p-4 text-left font-mono text-xs text-pulse-ash max-w-md mx-auto">
            <div className="text-success mb-1"># Comando de instalação do agente:</div>
            <div>curl -sSL https://axon.baseoito.org/agent/install.sh | bash</div>
          </div>
        </div>
      )}

      {agentes.map(a => (
        <div key={a.id} className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
          <div onClick={() => toggleExpand(a.id)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-urban-smoke/20 transition-colors">
            <div className="flex items-center gap-4">
              <span className={`w-3 h-3 rounded-full shrink-0 ${isOnline(a) ? 'bg-success animate-pulse' : 'bg-danger'}`} />
              <div>
                <div className="text-sm font-medium">{a.machine_name}</div>
                <div className="text-xs text-pulse-ash font-mono">{a.machine_id}</div>
              </div>
              {a.client_name && <span className="px-2 py-0.5 rounded text-xs bg-electric-teal/10 text-electric-teal">{a.client_name}</span>}
              {a.operator_name && <span className="text-xs text-pulse-ash">por {a.operator_name}</span>}
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right"><div className="text-xs text-pulse-ash uppercase">Versão</div><div className="text-xs font-mono">{a.agent_version || '-'}</div></div>
              <div className="text-right">
                <div className="text-xs text-pulse-ash uppercase">Heartbeat</div>
                <div
                  className="text-xs text-pulse-ash"
                  title={a.last_heartbeat ? `Último: ${new Date(a.last_heartbeat).toLocaleString('pt-BR')}` : 'Nunca'}
                >
                  {fmtHeartbeat(a.last_heartbeat)}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${isOnline(a) ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{isOnline(a) ? 'Online' : 'Offline'}</span>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => openInstall(a.id)} className="px-3 py-1.5 rounded text-xs tracking-wider bg-electric-teal/10 text-electric-teal border border-electric-teal/20 hover:bg-electric-teal/20 transition-colors">Instalar</button>
                <button onClick={() => { setEditAgenteId(a.id); setShowEdit(true) }} className="px-3 py-1.5 rounded text-xs tracking-wider bg-urban-smoke/30 text-pulse-ash hover:text-off-white hover:bg-urban-smoke transition-colors">Editar</button>
                <button onClick={async () => { if (!confirm(`Excluir computador "${a.machine_name}"?\nIsso removerá o agente e todas as suas tarefas.`)) return; const t = getToken(); if (!t) return; try { const r = await fetch(`/api/agentes/${a.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } }); if (!r.ok) { const d = await r.json(); alert(d.detail || 'Erro'); return } load() } catch { alert('Erro ao excluir') } }} className="px-3 py-1.5 rounded text-xs tracking-wider bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors">Excluir</button>
              </div>
              <svg className={`w-4 h-4 text-pulse-ash transition-transform duration-200 ${expandedId === a.id ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>

          {expandedId === a.id && (
            <div className="border-t border-urban-smoke p-4 bg-core-black/30">
              <div className="flex justify-between mb-3">
                <h4 className="text-xs tracking-wider text-electric-teal">Histórico de Tarefas</h4>
                <span className="text-xs text-pulse-ash">{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</span>
              </div>
              {tarefasLoading ? <div className="text-center py-6 text-pulse-ash text-xs">Carregando...</div> : tarefas.length === 0 ? <div className="text-center py-6 text-pulse-ash text-xs">Nenhuma tarefa registrada.</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-urban-smoke/50 text-pulse-ash tracking-wider"><th className="text-left py-2 pr-3">Cliente</th><th className="text-left py-2 pr-3">Tipo</th><th className="text-center py-2 pr-3">Status</th><th className="text-right py-2 pr-3">Criada</th><th className="text-right py-2">Concluída</th></tr></thead>
                    <tbody>
                      {tarefas.map(t => (
                        <tr key={t.id} className="border-b border-urban-smoke/20">
                          <td className="py-2 pr-3">{t.client_name || '-'}</td>
                          <td className="py-2 pr-3 text-pulse-ash">{t.task_type === 'install' ? 'Instalação' : t.task_type}</td>
                          <td className="py-2 pr-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs tracking-wider ${statusColor(t.status)}`}>{t.status === 'install' || t.status === 'completed' ? 'Concluída' : t.status === 'pending' ? 'Pendente' : t.status}</span>
                            {t.error_message && <div className="text-xs text-danger mt-1 max-w-[200px] truncate" title={t.error_message}>{t.error_message}</div>}
                          </td>
                          <td className="py-2 pr-3 text-right text-pulse-ash">{t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '-'}</td>
                          <td className="py-2 text-right text-pulse-ash">{t.completed_at ? new Date(t.completed_at).toLocaleString('pt-BR') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {showInstall && (
        <Modal title="Instalar Certificado" onClose={() => setShowInstall(false)} width="max-w-[500px]">
          <p className="text-xs text-pulse-ash mb-4">Selecione o cliente cujo certificado será instalado no agente.</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {clientes.map(c => (
              <button key={c.id} onClick={() => install(c.id)} className="w-full text-left px-4 py-3 rounded-lg bg-core-black border border-urban-smoke hover:border-electric-teal transition-colors flex justify-between items-center">
                <div><div className="text-sm text-off-white">{c.name}</div>{c.cnpj && <div className="text-xs text-pulse-ash font-mono">{c.cnpj}</div>}</div>
                <span className="text-xs text-electric-teal tracking-wider">Instalar →</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showEdit && editAgenteId !== null && <EditAgenteModal agenteId={editAgenteId} onClose={() => setShowEdit(false)} onSaved={load} />}
    </div>
  )
}

/* Edit Agent Modal */
function EditAgenteModal({ agenteId, onClose, onSaved }: { agenteId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ machine_name: '', operator_name: '', cliente_id: '', active: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])

  useEffect(() => {
    const t = getToken(); if (!t) return
    Promise.all([
      fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/agentes', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ]).then(([c, ags]) => {
      setClientes(c)
      const a = ags.find((x: Agente) => x.id === agenteId)
      if (a) setForm({ machine_name: a.machine_name, operator_name: a.operator_name || '', cliente_id: a.cliente_id ? String(a.cliente_id) : '', active: a.active })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [agenteId])

  const save = async () => {
    if (!form.machine_name.trim()) { alert('Nome obrigatório'); return }
    const t = getToken(); if (!t) return; setSaving(true)
    try {
      await fetch(`/api/agentes/${agenteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ machine_name: form.machine_name, operator_name: form.operator_name, cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null, active: form.active }) })
      onSaved(); onClose()
    } catch { alert('Erro') }
    setSaving(false)
  }

  return (
    <Modal title="Editar Agente" onClose={onClose} width="max-w-[500px]">
      {loading ? <div className="text-center py-10 text-pulse-ash text-sm">Carregando...</div> : (
        <div className="space-y-4">
          <Field label="Nome da Máquina"><input value={form.machine_name} onChange={e => setForm(p => ({ ...p, machine_name: e.target.value }))} placeholder="PC-Escritorio-01" className="input" /></Field>
          <Field label="Operador"><input value={form.operator_name} onChange={e => setForm(p => ({ ...p, operator_name: e.target.value }))} placeholder="Nome do operador" className="input" /></Field>
          <Field label="Cliente"><select value={form.cliente_id} onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))} className="input"><option value="">Nenhum</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="rounded" /><span className="text-xs text-pulse-ash tracking-wider">Ativo</span></label>
          <div className="flex gap-3 justify-end pt-4 border-t border-urban-smoke">
            <button onClick={onClose} className="btn-cancel">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Atualizar'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function GuiaPowerShell() {
  const [copy, setCopy] = useState('')
  const cmd = `powershell -Command "& { Invoke-Expression (Invoke-WebRequest -UseBasicParsing -Uri 'http://72.60.11.156:3003/downloads/agent/install').Content }"`

  return (
    <div className="bg-rich-carbon border border-electric-teal/30 rounded-xl p-5 space-y-4">
      <h4 className="text-xs tracking-wider text-electric-teal">Instalação do Agente</h4>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-pulse-ash font-medium">Único comando (instalação e reparo)</span>
          <button onClick={() => { navigator.clipboard.writeText(cmd).then(() => setCopy('Copiado!')).catch(() => {}); setTimeout(() => setCopy(''), 2000) }}
            className="px-2 py-1 rounded text-xs border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">{copy || 'Copiar'}</button>
        </div>
        <div className="bg-core-black border border-urban-smoke rounded-lg p-3 font-mono text-xs text-off-white break-all">{cmd}</div>
      </div>

      <p className="text-xs text-pulse-ash">
        Execute o PowerShell como <strong>Administrador</strong> (botão direito → Executar como administrador).
      </p>
    </div>
  )
}

/* Gateway Panel */
function GatewayPanel() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/agentes', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(setAgentes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-pulse-ash text-sm">Carregando...</div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs tracking-wider text-pulse-ash">Gateway WhatsApp (Proxy SOCKS5)</h3>
        <p className="text-xs text-pulse-ash mt-1">Configure um agente como proxy para conexão WhatsApp via Tailscale</p>
      </div>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6">
        <div className="grid grid-cols-1 gap-4">
          {agentes.filter(a => a.active).map(a => (
            <div key={a.id} className="bg-core-black border border-urban-smoke rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="w-3 h-3 rounded-full bg-success" />
                <div>
                  <div className="text-sm font-medium">{a.machine_name}</div>
                  <div className="text-xs text-pulse-ash font-mono">{a.machine_id}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-pulse-ash uppercase">Versão</div>
                  <div className="text-xs font-mono">{a.agent_version || '-'}</div>
                </div>
                <span className="px-3 py-1.5 rounded text-xs tracking-wider bg-urban-smoke/30 text-pulse-ash border border-urban-smoke/50">
                  {a.active ? 'Disponível para gateway' : 'Offline'}
                </span>
              </div>
            </div>
          ))}
          {agentes.filter(a => a.active).length === 0 && (
            <div className="text-center py-10 text-pulse-ash text-sm">Nenhum agente ativo disponível para gateway.</div>
          )}
        </div>
      </div>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-5">
        <h4 className="text-xs tracking-wider text-pulse-ash mb-3">Instruções de Configuração</h4>
        <div className="bg-core-black border border-urban-smoke rounded-lg p-4 font-mono text-xs text-pulse-ash space-y-1">
          <div className="text-success"># O agente se registra como gateway automaticamente</div>
          <div># via POST /api/agentes/&#123;machine_id&#125;/gateway/register</div>
          <div className="text-pulse-ash mt-2"># Envia: &#123; proxy_port: 1080, tailscale_ip: "100.x.x.x" &#125;</div>
          <div className="text-pulse-ash"># O servidor cria sessão WhatsApp automaticamente</div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   CERTIFICADOS TAB
   ──────────────────────────────────────────── */
function CertificadosTab() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPass, setCertPass] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sortField, setSortField] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = getToken(); if (!t) return
    fetch('/api/clientes?limit=5000', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(setClientes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const certStatus = (c: Cliente) => {
    if (!c.certificate_expires_at) return null
    try {
      const exp = new Date(c.certificate_expires_at)
      const dias = (exp.getTime() - Date.now()) / 86400000
      if (dias > 30) return { label: 'Válido', color: 'bg-success/10 text-success' }
      if (dias > 0) return { label: 'Vencendo', color: 'bg-infrared/10 text-infrared' }
      return { label: 'Vencido', color: 'bg-danger/10 text-danger' }
    } catch { return null }
  }

  const sorted = [...clientes].sort((a, b) => {
    let va: any, vb: any
    if (sortField === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase() }
    else if (sortField === 'cnpj') { va = a.cnpj || ''; vb = b.cnpj || '' }
    else if (sortField === 'vencimento') {
      va = a.certificate_expires_at || '9999-12-31'
      vb = b.certificate_expires_at || '9999-12-31'
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: string }) => (
    <span className="inline-block ml-1 opacity-50">{sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  )

  const uploadCert = async () => {
    if (!certFile || !certPass || !selectedCliente) { alert('Selecione arquivo, senha e cliente'); return }
    const t = getToken(); if (!t) return; setUploading(true)
    const fd = new FormData()
    fd.append('certificate_file', certFile)
    fd.append('certificate_password', certPass)
    fd.append('client_id', String(selectedCliente.id))
    try {
      const r = await fetch('/api/upload/certificate', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd })
      if (!r.ok) { const e = await r.json(); alert(e.detail || 'Erro ao enviar certificado') }
      else { alert('Certificado enviado com sucesso!'); setShowUpload(false); setCertFile(null); setCertPass('') }
    } catch { alert('Erro de conexão') }
    setUploading(false)
  }

  if (loading) return <div className="text-center py-20 text-pulse-ash text-sm">Carregando clientes...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs tracking-wider text-pulse-ash">{clientes.length} clientes</h3>
        <button onClick={() => setShowUpload(true)} className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">+ Upload Certificado</button>
      </div>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
              <th className="text-left py-3 px-4 cursor-pointer select-none hover:text-off-white transition-colors" onClick={() => toggleSort('name')}>Cliente<SortIcon field="name" /></th>
              <th className="text-left py-3 px-4 cursor-pointer select-none hover:text-off-white transition-colors" onClick={() => toggleSort('cnpj')}>CNPJ<SortIcon field="cnpj" /></th>
              <th className="text-left py-3 px-4 cursor-pointer select-none hover:text-off-white transition-colors" onClick={() => toggleSort('vencimento')}>Vencimento<SortIcon field="vencimento" /></th>
              <th className="text-center py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const s = certStatus(c)
              return (
                <tr key={c.id} className="border-b border-urban-smoke/20 hover:bg-urban-smoke/30">
                  <td className="py-3 px-4">{c.name}</td>
                  <td className="py-3 px-4 text-pulse-ash font-mono text-xs">{c.cnpj || '-'}</td>
                  <td className="py-3 px-4">
                    {c.certificate_expires_at ? (
                      <span className="flex items-center gap-2">
                        <span className="text-pulse-ash">{new Date(c.certificate_expires_at).toLocaleDateString('pt-BR')}</span>
                        {s && <span className={`px-1.5 py-0.5 rounded text-[10px] tracking-wider ${s.color}`}>{s.label}</span>}
                      </span>
                    ) : <span className="text-pulse-ash/50">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => { setSelectedCliente(c); setShowUpload(true) }} className="px-3 py-1.5 rounded text-xs tracking-wider bg-electric-teal/10 text-electric-teal border border-electric-teal/20 hover:bg-electric-teal/20 transition-colors">Upload .pfx</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <Modal title="Upload de Certificado Digital" onClose={() => { setShowUpload(false); setCertFile(null); setCertPass('') }} width="max-w-[500px]">
          <div className="space-y-4">
            <Field label="Cliente">
              <select value={selectedCliente?.id || ''} onChange={e => { const c = clientes.find(x => x.id === parseInt(e.target.value)); if (c) setSelectedCliente(c) }} className="input">
                <option value="">Selecionar cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Arquivo do Certificado (.pfx/.p12)">
              <div className="flex items-center gap-3">
                <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg text-xs bg-urban-smoke text-off-white hover:bg-pulse-ash transition-colors border border-urban-smoke">Selecionar</button>
                <span className="text-xs text-pulse-ash">{certFile?.name || 'Nenhum arquivo'}</span>
                <input ref={fileRef} type="file" accept=".pfx,.p12" onChange={e => setCertFile(e.target.files?.[0] || null)} className="hidden" />
              </div>
            </Field>
            <Field label="Senha do Certificado">
              <input type="password" value={certPass} onChange={e => setCertPass(e.target.value)} placeholder="Senha do arquivo .pfx" className="input" />
            </Field>
            <div className="flex gap-3 justify-end pt-4 border-t border-urban-smoke">
              <button onClick={() => { setShowUpload(false); setCertFile(null); setCertPass('') }} className="btn-cancel">Cancelar</button>
              <button onClick={uploadCert} disabled={uploading || !certFile || !certPass} className="btn-primary">{uploading ? 'Enviando...' : 'Fazer Upload'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
   REUSABLE COMPONENTS
   ──────────────────────────────────────────── */
function Modal({ children, onClose, title, width = 'max-w-[700px]' }: { children: React.ReactNode; onClose: () => void; title: string; width?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80" onClick={onClose}>
      <div className={`bg-rich-carbon border border-urban-smoke rounded-xl p-6 ${width} w-full mx-4 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-pulse-ash hover:text-off-white transition-colors p-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-wider text-pulse-ash mb-1">{label}</label>
      {children}
    </div>
  )
}

function Btn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="text-pulse-ash hover:text-electric-teal transition-colors p-1" title={title}>{children}</button>
}

function PencilIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function CodeIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
}
function PlayIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
}
function TrashIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
}
