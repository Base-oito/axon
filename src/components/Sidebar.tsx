import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserRole, isAdmin, getSidebarVisibility } from '../lib/permissions'

function getUserName(): string {
  try {
    const t = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
    if (!t) return 'Usuário'
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.display_name || p.username || 'Usuário'
  } catch { return 'Usuário' }
}


function getPermissoes(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem('axon_permissoes')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // Convert array format ["dashboard","clientes"] → {"dashboard":true}
        const obj: Record<string, boolean> = {}
        parsed.forEach((m: string) => { obj[m] = true })
        return obj
      }
      if (typeof parsed === 'object' && parsed !== null) return parsed
    }
  } catch {}
  return {}
}

async function fetchPermissoes(): Promise<Record<string, boolean>> {
  try {
    const t = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
    if (!t) return {}
    const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } })
    if (r.status === 401) { localStorage.removeItem('nfse_token'); window.location.href = '/login'; return {} }
    if (!r.ok) return {}
    const data = await r.json()
    let perms = data.permissoes || {}
    if (Array.isArray(perms)) {
      const obj: Record<string, boolean> = {}
      perms.forEach((m: string) => { obj[m] = true })
      perms = obj
    }
    localStorage.setItem('axon_permissoes', JSON.stringify(perms))
    return perms
  } catch { return {} }
}

const svgIcons: Record<string, (active: boolean) => JSX.Element> = {
  dashboard: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  inteligencia: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  clientes: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  obrigacoes: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />
    </svg>
  ),
  processos: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 10H3" /><path d="M21 6H3" /><path d="M21 14H3" /><path d="M17 18H3" />
    </svg>
  ),
  tarefas: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  calendario: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
    </svg>
  ),
  automacao: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2" /><path d="M12 21v2" />
      <path d="M4.22 4.22l1.42 1.42" /><path d="M18.36 18.36l1.42 1.42" />
      <path d="M1 12h2" /><path d="M21 12h2" />
      <path d="M4.22 19.78l1.42-1.42" /><path d="M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  comunicados: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  configuracoes: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" />
      <circle cx="4" cy="12" r="1" fill={a ? '#F97316' : '#A8A8A8'} /><circle cx="12" cy="10" r="1" fill={a ? '#F97316' : '#A8A8A8'} /><circle cx="20" cy="14" r="1" fill={a ? '#F97316' : '#A8A8A8'} />
    </svg>
  ),
  auditoria: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 15h6" />
    </svg>
  ),
  solicitacoes: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  suporte: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
    </svg>
  ),
  chat: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  ),
  reunioes: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
      <circle cx="12" cy="16" r="2" fill={a ? '#F97316' : 'none'} />
      <path d="M12 14v.01" /><path d="M12 18v.01" />
      <circle cx="9" cy="16" r="1" fill={a ? '#F97316' : 'none'} />
      <circle cx="15" cy="16" r="1" fill={a ? '#F97316' : 'none'} />
    </svg>
  ),
  whatsapp: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  contabil: (a) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a ? '#F97316' : '#A8A8A8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="9" x2="9" y2="21" />
      <line x1="15" y1="9" x2="15" y2="21" />
    </svg>
  ),
}

type NavItem = { path: string; label: string; icon: string; modulo?: string }
type NavSection = { title: string; items: NavItem[] }

const sections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', modulo: 'dashboard' },
      { path: '/inteligencia', label: 'Inteligência', icon: 'inteligencia' },
{ path: '/monitor-clientes', label: 'Monitor', icon: 'inteligencia', modulo: 'monitor-clientes' },
    ],
  },
  {
    title: 'Operações',
    items: [
      { path: '/clientes', label: 'Clientes', icon: 'clientes', modulo: 'clientes' },
      { path: '/obrigacoes', label: 'Obrigações', icon: 'obrigacoes', modulo: 'obrigacoes' },
      { path: '/processos', label: 'Processos', icon: 'processos', modulo: 'processos' },
      { path: '/tarefas', label: 'Tarefas', icon: 'tarefas' },
      { path: '/calendario', label: 'Calendário', icon: 'calendario', modulo: 'calendario' },
      { path: '/reunioes', label: 'Reuniões', icon: 'reunioes' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
{ path: '/automacao', label: 'Automação', icon: 'automacao', modulo: 'automacao' },
{ path: '/importacao-contabil', label: 'Import. Contábil', icon: 'contabil', modulo: 'importacao-contabil' },
{ path: '/comunicados', label: 'Comunicados', icon: 'comunicados' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { path: '/configuracoes', label: 'Configurações', icon: 'configuracoes', modulo: 'configuracoes' },
      { path: '/auditoria', label: 'Auditoria', icon: 'auditoria', modulo: 'auditoria' },
      { path: '/solicitacoes', label: 'Solicitações', icon: 'solicitacoes' },
      { path: '/suporte', label: 'Suporte', icon: 'suporte' },
{ path: '/quartel', label: 'Quartel General', icon: 'contabil' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { path: '/chat', label: 'Chat', icon: 'chat', modulo: 'chat' },
      { path: '/whatsapp', label: 'WhatsApp', icon: 'whatsapp', modulo: 'whatsapp' },
    ],
  },
]

export default function Sidebar({ currentPage }: { currentPage: string }) {
  const navigate = useNavigate()
  const userName = getUserName()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('axon_sidebar_collapsed') === 'true' } catch { return false }
  })

  const [isLight, setIsLight] = useState(() => {
    try { return localStorage.getItem('axon_theme') === 'light' } catch { return false }
  })

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({})

  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('axon_favorites') || '[]') } catch { return [] }
  })

  const toggleFavorite = (path: string) => {
    setFavorites(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
      localStorage.setItem('axon_favorites', JSON.stringify(next))
      return next
    })
  }

  const role = getUserRole()

  const toggleSection = (title: string) => setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }))


  useEffect(() => {
    localStorage.setItem('axon_sidebar_collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    localStorage.setItem('axon_theme', isLight ? 'light' : 'dark')
    if (isLight) {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [isLight])

  const toggleTheme = () => setIsLight(!isLight)

  const logout = () => {
    localStorage.removeItem('nfse_token')
    navigate('/login')
  }

  const isActive = (path: string) => {
    if (currentPage === path) return true
    if (path === '/dashboard' && currentPage === '/') return true
    return false
  }

  // Filter sections by role permissions
  const sidebarVisibility = getSidebarVisibility(role)
  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (!item.modulo) return true
      return sidebarVisibility[item.modulo] !== false
    }),
  })).filter(s => s.items.length > 0)

  return (
    <aside
      className={`shrink-0 bg-rich-carbon border-r border-urban-smoke flex flex-col transition-all duration-300 ${
        collapsed ? 'w-14' : 'w-64'
      }`}
    >
      <div className={`flex items-center border-b border-urban-smoke transition-all duration-300 ${
        collapsed ? 'px-3 py-4 justify-center' : 'px-6 py-5 justify-between'
      }`}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img src={`/logo${isLight ? '-light' : ''}.png?v=3`} alt="Axon" className="h-8 w-auto" />
          </div>
        ) : (
          <img src={`/logo-collapsed.png?v=3`} alt="Axon" className="h-5 w-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-pulse-ash hover:text-electric-teal transition-colors shrink-0"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8A8A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8A8A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${collapsed ? 'px-1 py-2' : 'p-4'}`}>
        {!collapsed && favorites.length > 0 && (
          <div>
            <div className="text-xs tracking-wider text-infrared px-3 py-2 mt-2 first:mt-0">
              Favoritos
            </div>
            {favorites.map(path => {
              const flatItems = filteredSections.flatMap(s => s.items)
              const item = flatItems.find(i => i.path === path)
              if (!item) return null
              const active = isActive(item.path)
              const iconFn = svgIcons[item.icon]
              return (
                <button key={path} onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs tracking-wider transition-all duration-200 ${
                    active ? 'bg-electric-teal/10 text-electric-teal border border-electric-teal/20' : 'text-pulse-ash hover:text-off-white hover:bg-urban-smoke border border-transparent'
                  }`}>
                  <span className="shrink-0">{iconFn && iconFn(active)}</span>
                  {item.label}
                </button>
              )
            })}
          </div>
        )}
        {filteredSections.map((section, si) => (
          <div key={si}>
            {!collapsed && (
              <button onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between text-xs tracking-wider text-pulse-ash hover:text-off-white px-3 py-2 mt-2 first:mt-0 transition-colors">
                <span>{section.title}</span>
                <svg className={`w-3 h-3 transition-transform duration-200 ${collapsedSections[section.title] ? '' : 'rotate-90'}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
            {collapsed && si > 0 && <div className="my-2 border-t border-urban-smoke/30 mx-2" />}
            {(!collapsedSections[section.title] || collapsed) && section.items.map((item) => {
              const active = isActive(item.path)
              const iconFn = svgIcons[item.icon]
              return collapsed ? (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={item.label}
                  className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all duration-200 mb-0.5 ${
                    active
                      ? 'bg-electric-teal/10'
                      : 'text-pulse-ash hover:bg-urban-smoke'
                  }`}
                >
                  {iconFn && iconFn(active)}
                </button>
              ) : (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs tracking-wider transition-all duration-200 ${
                    active
                      ? 'bg-electric-teal/10 text-electric-teal border border-electric-teal/20'
                      : 'text-pulse-ash hover:text-off-white hover:bg-urban-smoke border border-transparent group'
                  }`}
                >
                  <span className="shrink-0">{iconFn && iconFn(active)}</span>
                  <span className="flex-1">{item.label}</span>
                  {!collapsed && (
                    <span onClick={e => { e.stopPropagation(); toggleFavorite(item.path) }}
                      className={`${favorites.includes(item.path) ? 'text-infrared' : 'text-pulse-ash opacity-0 group-hover:opacity-100'} hover:text-infrared transition-all shrink-0`}
                      title={favorites.includes(item.path) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>★</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 py-2 flex items-center justify-center gap-1">
          <button onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:bg-urban-smoke/40 transition-all"
            title={isLight ? 'Modo escuro' : 'Modo claro'}>
            {isLight ? '🌙' : '☀️'}
          </button>
          <button onClick={async () => {
            if (!('Notification' in window)) return
            if (Notification.permission === 'granted') return
            if (Notification.permission === 'denied') {
              alert('Notificações bloqueadas pelo navegador.\n\nPara liberar: clique no 🔒 cadeado ao lado da URL > Notificações > Permitir.')
              return
            }
            const p = await Notification.requestPermission()
            if (p === 'granted') new Notification('Base 8', { body: 'Notificações ativadas! ✅', icon: '/logo.png' })
          }} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:bg-urban-smoke/40 transition-all" title={
            !('Notification' in window) ? 'Navegador não suporta' :
            Notification.permission === 'granted' ? 'Notificações ativas' :
            Notification.permission === 'denied' ? 'Notificações bloqueadas' : 'Ativar notificações'
          }>
            {!('Notification' in window) ? '🚫' :
             Notification.permission === 'granted' ? '✅' :
             Notification.permission === 'denied' ? '🔕' : '🔔'}
          </button>
        </div>
      )}

      <div className={`border-t border-urban-smoke transition-all duration-300 ${
        collapsed ? 'p-2' : 'p-4'
      }`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button onClick={toggleTheme} title={isLight ? 'Modo escuro' : 'Modo claro'} className="text-xs text-pulse-ash hover:text-electric-teal transition-colors">
              {isLight ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><path d="M12 1v2" /><path d="M12 21v2" /><path d="M4.22 4.22l1.42 1.42" /><path d="M18.36 18.36l1.42 1.42" /><path d="M1 12h2" /><path d="M21 12h2" /><path d="M4.22 19.78l1.42-1.42" /><path d="M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </button>
            <span className="text-xs text-pulse-ash truncate w-full text-center" title={userName}>
              {userName.charAt(0).toUpperCase()}
            </span>
            <button onClick={logout} title="Sair" className="text-xs text-pulse-ash hover:text-infrared transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-pulse-ash truncate">{userName}</span>
            <button
              onClick={logout}
              className="text-xs text-pulse-ash hover:text-infrared transition-colors tracking-wider"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
