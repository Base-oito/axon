import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FileCode2, Play, Save, X } from 'lucide-react'
import type { Modelo } from '../types'
import { getParser, listModelos, saveParser, testarParser } from '../api'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

export default function ParsersTab() {
  const qc = useQueryClient()
  const [parserModeloId, setParserModeloId] = useState<number | null>(null)
  const { data: modelos = [] } = useQuery({ queryKey: ['modelos'], queryFn: listModelos, staleTime: 2 * 60_000 })

  const s = useSortable('titulo')
  const sorted = sortItems(modelos, s.sortKey, s.sortDir, m => m.titulo || '')

  return (
    <div className="space-y-5">
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{modelos.length}</span> modelos · parsers JavaScript para extração de campos
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border/60 bg-card shadow-sm">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SortableTh k="titulo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Modelo</SortableTh>
                <SortableTh k="recorrencia" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Recorrência</SortableTh>
                <SortableTh k="depto" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Departamento</SortableTh>
                <SortableTh k="clientes" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Clientes</SortableTh>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr key={m.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{m.titulo}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.recorrencia || '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.departamento_nome || '-'}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{m.total_clientes ?? 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setParserModeloId(m.id)}
                      className="inline-flex items-center gap-1.5 rounded border border-violet-400/30 px-3 py-1 text-xs tracking-wider text-violet-500 transition-colors hover:bg-violet-500/10"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      Editor JS
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {modelos.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum modelo cadastrado.</div>
        )}
      </div>

      {parserModeloId !== null && (
        <ParserModal
          modelo={modelos.find(m => m.id === parserModeloId) || null}
          onClose={() => setParserModeloId(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['modelos'] })}
        />
      )}
    </div>
  )
}

function ParserModal({ modelo, onClose, onSaved }: { modelo: Modelo | null; onClose: () => void; onSaved: () => void }) {
  const [codigoJs, setCodigoJs] = useState('')
  const [loading, setLoading] = useState(!!modelo)
  const [saving, setSaving] = useState(false)
  const [testText, setTestText] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<unknown>(null)
  const [error, setError] = useState('')

  if (modelo && loading) {
    getParser(modelo.id).then(d => {
      setCodigoJs(d.codigo_js || '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const handleSave = async () => {
    if (!modelo) return
    setSaving(true)
    setError('')
    try {
      await saveParser(modelo.id, codigoJs)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
    setSaving(false)
  }

  const handleTest = async () => {
    if (!testText.trim()) {
      alert('Informe um texto de teste')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const d = await testarParser(codigoJs, testText)
      setTestResult(d.resultado ?? d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no teste')
    }
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-[850px] max-w-full flex-col rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Editor de Parser JS — {modelo?.titulo || 'Modelo #'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Código JavaScript</label>
              <textarea
                value={codigoJs}
                onChange={e => setCodigoJs(e.target.value)}
                placeholder="function extrair(texto, blocos) { ... }"
                rows={14}
                className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="border-t border-border/60 pt-4">
              <h4 className="mb-3 text-xs font-semibold tracking-wider text-[#0078d4]">Testar Parser</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Texto de entrada</label>
                  <textarea
                    value={testText}
                    onChange={e => setTestText(e.target.value)}
                    placeholder="Cole o texto do PDF..."
                    rows={8}
                    className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !testText.trim()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-xs tracking-wider text-violet-500 transition-colors hover:bg-violet-500/20 disabled:opacity-30"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {testing ? 'Executando...' : 'Executar Teste'}
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Resultado</label>
                  <div className="max-h-60 min-h-[8rem] overflow-y-auto rounded-lg border border-border bg-muted p-3">
                    {testResult !== null ? (
                      <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{JSON.stringify(testResult, null, 2)}</pre>
                    ) : (
                      <div className="py-4 text-center text-xs italic text-muted-foreground">
                        {testing ? 'Executando...' : 'Resultado aparecerá aqui'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : 'Salvar Parser'}
          </button>
        </div>
      </div>
    </div>
  )
}
