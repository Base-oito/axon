import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const routes = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', keywords: 'dashboard home inicio' },
  { path: '/clientes', label: 'Clientes', icon: '👥', keywords: 'clientes empresas' },
  { path: '/obrigacoes', label: 'Obrigações', icon: '📋', keywords: 'obrigacoes obrigações' },
  { path: '/processos', label: 'Processos', icon: '⚙️', keywords: 'processos' },
  { path: '/calendario', label: 'Calendário', icon: '📅', keywords: 'calendario calendário' },
  { path: '/chat', label: 'Chat', icon: '💬', keywords: 'chat conversa mensagem' },
  { path: '/automacao', label: 'Automação', icon: '🤖', keywords: 'automacao automação agentes parsers' },
  { path: '/inteligencia', label: 'Inteligência', icon: '🧠', keywords: 'inteligencia inteligência certificados' },
  { path: '/importacao-contabil', label: 'Importação Contábil', icon: '📑', keywords: 'contabil importação plano contas' },
  { path: '/configuracoes', label: 'Configurações', icon: '⚙️', keywords: 'configuracoes configurações perfil' },
  { path: '/suporte', label: 'Suporte', icon: '🎫', keywords: 'suporte ticket' },
  { path: '/quartel', label: 'Quartel General', icon: '🏰', keywords: 'quartel admin monitor' },
  { path: '/auditoria', label: 'Auditoria', icon: '🔍', keywords: 'auditoria auditoria' },
  { path: '/reunioes', label: 'Reuniões', icon: '🤝', keywords: 'reunioes reuniões reuniao' },
  { path: '/tarefas', label: 'Tarefas', icon: '✅', keywords: 'tarefas tarefa' },
]

export default function QuickSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); setQuery('') }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (!open) return null

  const q = query.toLowerCase()
  const results = routes.filter(r => r.keywords.includes(q) || r.label.toLowerCase().includes(q))

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[20vh] bg-core-black/60" onClick={() => setOpen(false)}>
      <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-urban-smoke">
          <span className="text-pulse-ash">🔍</span>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar páginas..." autoFocus
            className="flex-1 bg-transparent text-sm text-off-white placeholder-pulse-ash outline-none" />
          <span className="text-[10px] text-pulse-ash bg-urban-smoke/30 px-2 py-0.5 rounded">ESC</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {results.map(r => (
            <button key={r.path} onClick={() => { navigate(r.path); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-urban-smoke/20 transition-colors text-left">
              <span className="text-sm">{r.icon}</span>
              <span className="text-sm text-off-white">{r.label}</span>
              <span className="ml-auto text-[10px] text-pulse-ash">{r.path}</span>
            </button>
          ))}
          {results.length === 0 && <div className="text-center py-6 text-xs text-pulse-ash">Nenhum resultado</div>}
        </div>
      </div>
    </div>
  )
}
