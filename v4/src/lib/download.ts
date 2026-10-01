import { resolveUrl } from './api'

/**
 * Baixa um arquivo autenticado via fetch (com Bearer token no header) e:
 * - abre em nova aba se for PDF;
 * - dispara o download se for outro tipo de arquivo.
 */
export async function authedDownload(path: string, token: string | null, filename?: string): Promise<void> {
  const res = await fetch(resolveUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Não autorizado — faça login novamente')
    throw new Error(`Falha no download (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const m = cd.match(/filename="?([^"]+)"?/i)
  const name = filename || (m ? decodeURIComponent(m[1]) : '') || 'download'
  const isPdf = blob.type.includes('pdf') || name.toLowerCase().endsWith('.pdf')
  const finalBlob = isPdf ? new Blob([blob], { type: 'application/pdf' }) : blob
  const url = URL.createObjectURL(finalBlob)
  if (isPdf) {
    window.open(url, '_blank')
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}