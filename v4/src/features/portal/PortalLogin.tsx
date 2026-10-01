import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react'
import { storageGet, storageSet, storageRemove } from '@/lib/storage'
import { resolveUrl } from '@/lib/api'

const CLIENT_TOKEN_KEY = 'nfse_client_token'

export function getClientToken(): string | null {
  try { return JSON.parse(storageGet(CLIENT_TOKEN_KEY) || '{}').access_token } catch { return null }
}
export function setClientToken(d: any) {
  storageSet(CLIENT_TOKEN_KEY, JSON.stringify(d))
}
export function clearClientToken() {
  storageRemove(CLIENT_TOKEN_KEY)
}

export async function clientFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getClientToken()
  const res = await fetch(resolveUrl(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  })
  if (res.status === 401) { clearClientToken(); window.location.href = '/portal/login' }
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export default function PortalLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async () => {
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      const r = await fetch(resolveUrl('/api/client-portal/auth/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Credenciais inválidas')
      setClientToken(d)
      navigate('/portal')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao entrar')
    }
    setLoading(false)
  }

  const inputCls = 'h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="card-soft rounded-2xl bg-card p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#0078d4]/10 text-[#0078d4]">
              <Briefcase className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground">Portal do Cliente</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escritório Central · Assessoria Contábil</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 transition-colors focus-within:border-[#0078d4]">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                type="email" placeholder="E-mail" className={inputCls} />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 transition-colors focus-within:border-[#0078d4]">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                type="password" placeholder="Senha" className={inputCls} />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button onClick={submit} disabled={loading || !email || !password}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-md shadow-primary/30 transition-colors hover:bg-primary/90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar (área do cliente)'}
            </button>
          </div>
        </div>
        <button onClick={() => navigate('/login')}
          className="mx-auto mt-4 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Acesso da equipe
        </button>
      </div>
    </div>
  )
}