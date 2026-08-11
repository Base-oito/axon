import { useState } from 'react'
import { ClipboardCheck, Layers, ScrollText } from 'lucide-react'
import ObrigacoesTab from './components/ObrigacoesTab'
import ModelosTab from './components/ModelosTab'
import AuditoriaTab from './components/AuditoriaTab'

type SubTab = 'obrigacoes' | 'modelos' | 'auditoria'

export default function ObrigacoesPage() {
  const [subTab, setSubTab] = useState<SubTab>('obrigacoes')

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'obrigacoes', label: 'Obrigações', icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: 'modelos', label: 'Modelos', icon: <Layers className="h-4 w-4" /> },
    { key: 'auditoria', label: 'Auditoria', icon: <ScrollText className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Obrigações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerenciamento de obrigações acessórias e modelos recorrentes</p>
      </div>

      <div className="flex gap-1 border-b border-border/60">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-3 text-xs tracking-wider transition-all duration-200 ${
              subTab === t.key ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'obrigacoes' && <ObrigacoesTab />}
      {subTab === 'modelos' && <ModelosTab />}
      {subTab === 'auditoria' && <AuditoriaTab />}
    </div>
  )
}
