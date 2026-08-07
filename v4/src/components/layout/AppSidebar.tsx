import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NAV_SECTIONS } from '@/lib/navigation'

export default function AppSidebar() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [hoverSection, setHoverSection] = useState<string | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setExpanded(true)
  }

  const handleMouseLeave = () => {
    hoverTimer.current = setTimeout(() => {
      setExpanded(false)
      setHoverSection(null)
    }, 150)
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative z-30 flex h-full flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out ${
        expanded ? 'w-60' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          A
        </div>
        {expanded && <span className="text-lg font-bold text-foreground">Axon</span>}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto overflow-x-visible py-3">
        <ul className="space-y-1 px-2">
          {NAV_SECTIONS.map(section => {
            const Icon = section.icon
            const isActive = hoverSection === section.label
            return (
              <li
                key={section.label}
                className="relative"
                onMouseEnter={() => setHoverSection(section.label)}
                onMouseLeave={() => setHoverSection(null)}
              >
                <button
                  onClick={() => navigate(section.items[0].path)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {expanded && <span className="truncate">{section.label}</span>}
                </button>

                {/* Submenu flutuante — quando recolhido e com hover */}
                {!expanded && isActive && (
                  <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    {section.items.map(item => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
