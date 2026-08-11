import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { OcrRegion } from '../types'
import { detectarAreas, listModelos, salvarTreino } from '../api'

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string }
      getDocument: (args: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (v: { scale: number }) => { width: number; height: number }; render: (args: { canvasContext: CanvasRenderingContext2D | null; viewport: unknown }) => { promise: Promise<void> } }> }> }
    }
  }
}

type PageData = { dataUrl: string; width: number; height: number }

const PDF_SCALE = 1.5

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

export default function TreinarRoboTab() {
  const { data: modelos = [] } = useQuery({ queryKey: ['modelos'], queryFn: listModelos, staleTime: 2 * 60_000 })

  const [pdfjsReady, setPdfjsReady] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfName, setPdfName] = useState('')
  const [pages, setPages] = useState<PageData[]>([])
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
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const win = window as unknown as { pdfjsLib?: typeof window.pdfjsLib }
    if (win.pdfjsLib) { setPdfjsReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs'
    s.type = 'module'
    s.onload = () => setPdfjsReady(true)
    s.onerror = () => alert('Falha ao carregar PDF.js')
    document.head.appendChild(s)
    return () => { try { document.head.removeChild(s) } catch { /* ignore */ } }
  }, [])

  useEffect(() => {
    if (!pdfjsReady || !pdfFile) return
    const lib = window.pdfjsLib
    if (!lib) return
    lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
    ;(async () => {
      try {
        const buf = await pdfFile.arrayBuffer()
        const doc = await lib.getDocument({ data: buf }).promise
        const loaded: PageData[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const vp = page.getViewport({ scale: PDF_SCALE })
          const c = document.createElement('canvas')
          c.width = vp.width
          c.height = vp.height
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
          loaded.push({ dataUrl: c.toDataURL('image/png'), width: vp.width, height: vp.height })
        }
        setPages(loaded)
      } catch {
        alert('Erro ao renderizar PDF')
      }
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
    setError('')
  }

  const fieldValue = () => (selectedField === 'Outro' ? (customField.trim() || 'Outro') : selectedField)

  const screenToPdf = (cx: number, cy: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return { x: (cx - r.left) / zoom / PDF_SCALE, y: (cy - r.top) / zoom / PDF_SCALE }
  }

  const overlayDown = (e: React.MouseEvent, pn: number) => {
    const pdf = screenToPdf(e.clientX, e.clientY, e.currentTarget as HTMLElement)
    setDrawing(true)
    setDrawStart({ ...pdf, pageNum: pn })
    setDrawEnd(pdf)
  }

  const overlayMove = (e: React.MouseEvent) => {
    if (!drawing || !drawStart) return
    setDrawEnd(screenToPdf(e.clientX, e.clientY, e.currentTarget as HTMLElement))
  }

  const overlayUp = (e: React.MouseEvent) => {
    if (!drawing || !drawStart) return
    setDrawing(false)
    const end = screenToPdf(e.clientX, e.clientY, e.currentTarget as HTMLElement)
    const x = Math.min(drawStart.x, end.x)
    const y = Math.min(drawStart.y, end.y)
    const w = Math.abs(end.x - drawStart.x)
    const h = Math.abs(end.y - drawStart.y)
    setDrawStart(null)
    setDrawEnd(null)
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
    setDetecting(true)
    setError('')
    try {
      const d = await detectarAreas(
        pdfFile,
        modeloId,
        regions.map(r => ({ fieldName: r.fieldName, x: r.x, y: r.y, w: r.w, h: r.h, pageNum: r.pageNum })),
      )
      if (d.results) {
        const detected = d.results as Array<{ fieldName: string; value: string }>
        setRegions(prev => prev.map(reg => {
          const match = detected.find(dr => dr.fieldName === reg.fieldName)
          return match ? { ...reg, detectedValue: match.value } : reg
        }))
        alert(`${detected.length} campo(s) detectado(s)`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao detectar áreas')
    }
    setDetecting(false)
  }

  const handleSave = async () => {
    if (!pdfFile) return
    if (!modeloId) { alert('Selecione um modelo vinculado'); return }
    setSaving(true)
    setError('')
    try {
      await salvarTreino(
        pdfFile,
        modeloId,
        pdfName,
        regions.map(r => ({ fieldName: r.fieldName, x: r.x, y: r.y, w: r.w, h: r.h, pageNum: r.pageNum, detectedValue: r.detectedValue || '' })),
      )
      alert('Treino salvo com sucesso!')
      setPdfFile(null)
      setPdfName('')
      setPages([])
      setRegions([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar treino')
    }
    setSaving(false)
  }

  let previewRect: { x: number; y: number; w: number; h: number; c: string; b: string; pn: number } | null = null
  if (drawing && drawStart && drawEnd) {
    previewRect = {
      x: Math.min(drawStart.x, drawEnd.x) * PDF_SCALE,
      y: Math.min(drawStart.y, drawEnd.y) * PDF_SCALE,
      w: Math.abs(drawEnd.x - drawStart.x) * PDF_SCALE,
      h: Math.abs(drawEnd.y - drawStart.y) * PDF_SCALE,
      c: fieldColor(fieldValue()),
      b: fieldBorder(fieldValue()),
      pn: drawStart.pageNum,
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#0078d4] focus:outline-none'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">{pdfFile ? `Treino: ${pdfName}` : 'Novo Treino OCR'}</h3>
        {pdfFile && <span className="text-xs text-muted-foreground">{pages.length} página(s)</span>}
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 300px)' }}>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {!pdfFile ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="text-center">
                <div className="mb-4 text-4xl">📄</div>
                <p className="mb-6 text-sm text-muted-foreground">Selecione um arquivo PDF para mapear as regiões</p>
                <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-primary px-5 py-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  Selecionar PDF
                </button>
                <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} className="hidden" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-background/50 px-4 py-2">
                <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                  {(['draw', 'pan'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`rounded px-3 py-1.5 text-xs tracking-wider transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {m === 'draw' ? 'Marcar' : 'Mover'}
                    </button>
                  ))}
                </div>
                <span className="select-none text-xs text-muted-foreground">|</span>
                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="px-1 text-xs font-bold text-muted-foreground hover:text-foreground">−</button>
                <span className="min-w-[36px] select-none text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="px-1 text-xs font-bold text-muted-foreground hover:text-foreground">+</button>
                <button onClick={() => { setZoom(1); setPanX(0); setPanY(0) }} className="px-2 text-xs uppercase text-muted-foreground hover:text-foreground">Reset</button>
                <button onClick={() => fileRef.current?.click()} className="ml-auto rounded border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Trocar PDF
                </button>
                <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} className="hidden" />
              </div>

              <div className="flex-1 overflow-auto bg-muted/30" onWheel={handleWheel}>
                <div style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`, transformOrigin: '0 0', display: 'inline-block', minWidth: '100%' }}>
                  {pages.map((p, i) => {
                    const pn = i + 1
                    return (
                      <div key={pn} className="mb-1" style={{ position: 'relative', width: p.width, height: p.height }}>
                        <img src={p.dataUrl} alt={`Página ${pn}`} style={{ display: 'block', width: p.width, height: p.height }} draggable={false} />
                        <div
                          style={{
                            position: 'absolute', top: 0, left: 0, width: p.width, height: p.height,
                            cursor: mode === 'draw' ? 'crosshair' : 'grab',
                          }}
                          onMouseDown={e => overlayDown(e, pn)}
                          onMouseMove={overlayMove}
                          onMouseUp={overlayUp}
                          onMouseLeave={() => { if (drawing) setDrawing(false) }}
                        >
                          {regions.filter(r => r.pageNum === pn).map(reg => (
                            <div key={reg.id} style={{
                              position: 'absolute',
                              left: reg.x * PDF_SCALE, top: reg.y * PDF_SCALE,
                              width: reg.w * PDF_SCALE, height: reg.h * PDF_SCALE,
                              background: fieldColor(reg.fieldName),
                              border: `2px solid ${fieldBorder(reg.fieldName)}`,
                              pointerEvents: 'none',
                            }}>
                              <span style={{
                                position: 'absolute', top: -16, left: 0,
                                background: fieldBorder(reg.fieldName), color: '#000',
                                fontSize: 9, padding: '1px 4px', whiteSpace: 'nowrap', fontWeight: 600,
                              }}>
                                {reg.fieldName}{reg.detectedValue ? `: ${reg.detectedValue.substring(0, 18)}` : ''}
                              </span>
                            </div>
                          ))}
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
                {pages.length === 0 && <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Renderizando páginas...</div>}
              </div>
            </>
          )}
        </div>

        <div className="flex w-[310px] shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Modelo Vinculado</label>
            <select value={modeloId} onChange={e => setModeloId(e.target.value)} className={inputCls}>
              <option value="">Selecionar modelo...</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Campo para Marcar</label>
            <select value={selectedField} onChange={e => setSelectedField(e.target.value)} className={inputCls}>
              {PREDEFINED_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {selectedField === 'Outro' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do Campo</label>
              <input value={customField} onChange={e => setCustomField(e.target.value)} placeholder="Ex: Inscrição Municipal" className={inputCls} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleDetect}
              disabled={detecting || !pdfFile || regions.length === 0}
              className="w-full rounded-lg border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-xs tracking-wider text-violet-500 transition-colors hover:bg-violet-500/20 disabled:opacity-30"
            >
              {detecting ? 'Detectando...' : 'Auto-Detectar'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !pdfFile || regions.length === 0}
              className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
            >
              {saving ? 'Salvando...' : 'Salvar Treino'}
            </button>
          </div>

          <div className="border-t border-border/60 pt-3">
            <h4 className="mb-2 text-xs font-medium tracking-wider text-muted-foreground">Regiões ({regions.length})</h4>
            <div className="space-y-1.5">
              {regions.length === 0 && (
                <div className="py-4 text-center text-xs italic text-muted-foreground">Use o modo "Marcar" para desenhar retângulos sobre o PDF.</div>
              )}
              {regions.map(reg => (
                <div key={reg.id} className="group rounded-lg border border-border bg-background p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <select
                      value={reg.fieldName}
                      onChange={e => setRegions(prev => prev.map(r => r.id === reg.id ? { ...r, fieldName: e.target.value } : r))}
                      className="max-w-[140px] border-b border-border/50 bg-transparent py-0.5 text-xs text-foreground focus:outline-none"
                    >
                      {PREDEFINED_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                      {!PREDEFINED_FIELDS.includes(reg.fieldName) && <option value={reg.fieldName}>{reg.fieldName}</option>}
                    </select>
                    <button onClick={() => setRegions(prev => prev.filter(r => r.id !== reg.id))} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      ✕
                    </button>
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground">
                    Pg.{reg.pageNum} ({reg.x.toFixed(0)},{reg.y.toFixed(0)}) {reg.w.toFixed(0)}×{reg.h.toFixed(0)}
                  </div>
                  {reg.detectedValue && (
                    <div className="mt-1 truncate text-xs text-emerald-600" title={reg.detectedValue}>{reg.detectedValue}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
      </div>
    </div>
  )
}
