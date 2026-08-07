import { Outlet } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'

export default function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="text-sm text-muted-foreground">
            Bem-vindo ao Axon
          </div>
          <div className="flex items-center gap-3">
            {/* Placeholder: notificações, avatar do usuário */}
            <div className="h-8 w-8 rounded-full bg-muted" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
