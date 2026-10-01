import { Capacitor } from '@capacitor/core'
import { storageGet, storageRemove } from './storage'

const BASE = '/api/v2'

/** No app nativo (Capacitor), o SPA roda em https://localhost e precisa apontar para o servidor real. */
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)
  || (Capacitor.isNativePlatform() ? 'https://contador.app.baseoito.org' : '')

export function getToken(): string | null {
  try {
    return JSON.parse(storageGet('nfse_token') || '{}').access_token
  } catch {
    return null
  }
}

export function resolveUrl(path: string): string {
  const p = path.startsWith('/api') ? path : `${BASE}${path}`
  return API_ORIGIN ? `${API_ORIGIN}${p}` : p
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const url = resolveUrl(path)
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
      storageRemove('nfse_token')
      window.location.href = '/login'
    }
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function apiUrl(path: string): string {
  return resolveUrl(path)
}

/** Abre um arquivo autenticado (anexo/upload) em nova aba, enviando o token Bearer.
 *  Resolve o problema de links <a href> que não enviam o header Authorization (401). */
export async function openAuthedFile(path: string): Promise<void> {
  const token = getToken()
  const url = resolveUrl(path)
  try {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) {
      alert('Não foi possível abrir o arquivo.')
      return
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    window.open(objectUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
  } catch {
    alert('Não foi possível abrir o arquivo.')
  }
}