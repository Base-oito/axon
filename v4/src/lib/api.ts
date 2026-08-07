const BASE = '/api/v2'

function getToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
  } catch {
    return null
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const url = path.startsWith('/api') ? path : `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('nfse_token')
      window.location.href = '/login'
    }
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function apiUrl(path: string): string {
  return `${BASE}${path}`
}
