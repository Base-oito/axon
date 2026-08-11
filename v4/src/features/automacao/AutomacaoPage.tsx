import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MonitorSmartphone, ShieldCheck, Globe, FileCode2, FileUp, ScanSearch, Database, HeartPulse } from 'lucide-react'
import SaudeTab from './components/SaudeTab'
import AgentesTab from './components/AgentesTab'
import CertificadosTab from './components/CertificadosTab'
import ParsersTab from './components/ParsersTab'
import LoteTab from './components/LoteTab'
import TreinarRoboTab from './components/TreinarRoboTab'
import TreinosTab from './components/TreinosTab'
import { listAgentes } from './api'

type SubTab = 'saude' | 'parsers' | 'lote' | 'treinar' | 'treinos' | 'agentes' | 'gateway' | 'certificados'

export default function AutomacaoPage() {
  const [subTab, setSubTab] = useState<SubTab>('saude')

  const { data: agentes = [] } = useQuery({
    queryKey: ['agentes'],
    queryFn: listAgentes,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'saude', label: 'Saúde', icon: <HeartPulse className="h-4 w-4" /> },
    { key: 'agentes', label: 'Agentes', icon: <MonitorSmartphone className="h-4 w-4" /> },
    { key: 'certificados', label: 'Certificados', icon: <ShieldCheck className="h-4 w-4" /> },
    { key: 'parsers', label: 'Parsers JS', icon: <FileCode2 className="h-4 w-4" /> },
    { key: 'lote', label: 'Envio em Lote', icon: <FileUp className="h-4 w-4" /> },
    { key: 'treinar', label: 'Treinar Robô', icon: <ScanSearch className="h-4 w-4" /> },
    { key: 'treinos', label: 'Treinamentos', icon: <Database className="h-4 w-4" /> },
    { key: 'gateway', label: 'Gateway', icon: <Globe className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Automação</h1>
        <p className="mt-1 text-sm text-muted-foreground">Agentes Windows, certificados digitais e processamento</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border/60">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-xs tracking-wider transition-all duration-200 ${
              subTab === t.key ? 'border-[#0078d4] text-[#0078d4]' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'saude' && <SaudeTab />}
      {subTab === 'agentes' && <AgentesTab />}
      {subTab === 'certificados' && <CertificadosTab />}
      {subTab === 'parsers' && <ParsersTab />}
      {subTab === 'lote' && <LoteTab />}
      {subTab === 'treinar' && <TreinarRoboTab />}
      {subTab === 'treinos' && <TreinosTab />}
      {subTab === 'gateway' && <GatewayTab agentes={agentes} />}
    </div>
  )
}

function GatewayTab({ agentes }: { agentes: { id: number; machine_name: string; active: number | boolean; online: boolean }[] }) {
  const disponiveis = agentes.filter(a => a.active && a.online)

  return (
    <div className="space-y-5">
      <div className="card-soft rounded-lg bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Gateway WhatsApp (Proxy SOCKS5)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure um agente como proxy para a conexão WhatsApp via Tailscale. O agente se registra como gateway e o
          servidor cria a sessão automaticamente.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-[11px] text-foreground">{`POST /api/agentes/{machine_id}/gateway/register
{
  "proxy_port": 1080,
  "tailscale_ip": "100.x.x.x"
}`}</pre>
      </div>

      <div className="card-soft overflow-hidden rounded-lg bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h4 className="text-sm font-semibold text-foreground">Agentes disponíveis para gateway</h4>
        </div>
        {disponiveis.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum agente online disponível. Instale um agente Windows e aguarde o heartbeat.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {disponiveis.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-foreground">{a.machine_name}</span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Disponível para gateway</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
