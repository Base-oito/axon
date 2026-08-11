import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import type { OcrTreino } from '../types'
import { deleteTreino, listModelos, listTreinos } from '../api'
import { SortableTh, sortItems, useSortable } from '@/components/ui/sortable'

function parseCampos(t: OcrTreino): number {
  if (Array.isArray(t.campos)) return t.campos.length
  try {
    const p = JSON.parse(t.campos)
    return Array.isArray(p) ? p.length : 0
  } catch {
    return 0
  }
}

export default function TreinosTab() {
  const qc = useQueryClient()
  const { data: treinos = [] } = useQuery({ queryKey: ['ocr-treinos'], queryFn: listTreinos })
  const { data: modelos = [] } = useQuery({ queryKey: ['modelos'], queryFn: listModelos, staleTime: 2 * 60_000 })

  const s = useSortable('nome')
  const sorted = sortItems(treinos, s.sortKey, s.sortDir, t => {
    if (s.sortKey === 'modelo') return modelos.find(m => m.id === t.modelo_id)?.titulo || ''
    if (s.sortKey === 'campos') return parseCampos(t)
    if (s.sortKey === 'created') return t.created_at || ''
    return t.nome || ''
  })

  const del = async (id: number) => {
    if (!confirm('Excluir treino?')) return
    try {
      await deleteTreino(id)
      qc.invalidateQueries({ queryKey: ['ocr-treinos'] })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir treino')
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{treinos.length}</span> treino(s) OCR — reconhecimento de campos em PDFs
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card">
        {sorted.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">
            Nenhum treino OCR criado. Use a aba "Treinar Robô" para criar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <SortableTh k="nome" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Nome</SortableTh>
                  <SortableTh k="modelo" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle}>Modelo</SortableTh>
                  <SortableTh k="campos" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Campos</SortableTh>
                  <SortableTh k="created" sortKey={s.sortKey} sortDir={s.sortDir} onToggle={s.toggle} align="center">Criado</SortableTh>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => {
                  const m = modelos.find(x => x.id === t.modelo_id)
                  return (
                    <tr key={t.id} className="border-t border-border/40 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium text-foreground">{t.nome}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m?.titulo || '-'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="rounded bg-[#0078d4]/10 px-2 py-0.5 text-xs font-medium text-[#0078d4]">{parseCampos(t)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => del(t.id)} className="p-1 text-muted-foreground transition-colors hover:text-red-500" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
