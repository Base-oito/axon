import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserRound, Building2 } from 'lucide-react'
import { storageSet } from '@/lib/storage'
import { resolveUrl } from '@/lib/api'

type Modo = 'auto' | 'escritorio' | 'cliente'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState<Modo>('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1) Tenta login do ESCRITÓRIO
    const tentarEscritorio = async () => {
      const r = await fetch(resolveUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.access_token) {
        storageSet('nfse_token', JSON.stringify(data))
        return true
      }
      return false
    }

    // 2) Tenta login do CLIENTE (portal)
    const tentarCliente = async () => {
      const r = await fetch(resolveUrl('/api/client-portal/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && (data.access_token || data.token)) {
        storageSet('nfse_client_token', JSON.stringify(data))
        return true
      }
      return false
    }

    try {
      let ok = false
      let destino = ''

      if (modo === 'cliente') {
        ok = await tentarCliente()
        destino = ok ? '/portal' : ''
      } else if (modo === 'escritorio') {
        ok = await tentarEscritorio()
        destino = ok ? '/' : ''
      } else {
        // Automático: tenta escritório primeiro, depois cliente
        ok = await tentarEscritorio()
        if (ok) {
          destino = '/'
        } else {
          ok = await tentarCliente()
          destino = ok ? '/portal' : ''
        }
      }

      if (!ok) {
        setError('Credenciais inválidas. Verifique e-mail e senha.')
        return
      }
      navigate(destino)
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const modoLabel = modo === 'auto' ? 'Detectar automaticamente' : modo === 'escritorio' ? 'Equipe (escritório)' : 'Cliente (portal)'

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4 dark:bg-background dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950">
      {/* Fundo decorativo — bolhas suaves */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-600/20" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl dark:bg-cyan-500/20" />
      </div>

      <div className="relative w-full max-w-md rounded-xl border border-border/60 bg-white p-8 shadow-lg shadow-black/5 dark:bg-card dark:bg-zinc-900 dark:text-foreground dark:shadow-black/40">
        <div className="mb-6 text-center">
          <img
            src="/axon-logo-light.png"
            alt="Axon"
            className="mx-auto mb-4 h-10 w-auto dark:hidden"
            draggable={false}
          />
          <img
            src="/axon-logo-dark.png"
            alt="Axon"
            className="mx-auto mb-4 hidden h-10 w-auto dark:block"
            draggable={false}
          />
          <p className="text-sm text-muted-foreground">
            Acesso para equipe e clientes
          </p>
        </div>

        {/* Seletor de tipo */}
        <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setModo('auto')}
            className={`rounded-md px-2 py-1.5 transition-colors ${modo === 'auto' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Automático
          </button>
          <button
            type="button"
            onClick={() => setModo('escritorio')}
            className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 transition-colors ${modo === 'escritorio' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            <Building2 className="h-3 w-3" /> Equipe
          </button>
          <button
            type="button"
            onClick={() => setModo('cliente')}
            className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 transition-colors ${modo === 'cliente' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            <UserRound className="h-3 w-3" /> Cliente
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Modo: <span className="font-medium text-foreground">{modoLabel}</span>
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Axon — uma solução Base Oito
        </p>
      </div>
    </div>
  )
}