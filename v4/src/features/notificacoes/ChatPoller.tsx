import { useEffect, useRef } from 'react'
import { getToken } from '@/lib/api'

const sentIds = new Set<number>()
let notifPrefs: Set<string> | null = null

async function pushNotify(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body: body.substring(0, 120), icon: '/logo.png', tag, requireInteraction: true })
  } catch {
    /* ignora falha de push */
  }
}

/** Carrega (uma vez) os tipos de notificação ativos do usuário. */
async function loadPrefs(): Promise<Set<string> | null> {
  if (notifPrefs) return notifPrefs
  const t = getToken()
  if (!t) return null
  try {
    const r = await fetch('/api/notifications/prefs', { headers: { Authorization: 'Bearer ' + t } })
    const d = await r.json()
    notifPrefs = new Set(d?.ativos || [])
    return notifPrefs
  } catch {
    return null
  }
}

export default function ChatPoller() {
  const lastUnreadTotal = useRef(0)

  useEffect(() => {
    // Ping de presença (mantém last_active atualizado — status online no chat)
    const doPing = () => {
      const t = getToken()
      if (t) fetch('/api/chat/ping', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {})
    }
    doPing()
    const pingInterval = setInterval(doPing, 60_000)

    const interval = setInterval(async () => {
      const t = getToken()
      if (!t) return

      try {
        const r = await fetch('/api/chat/unread', { headers: { Authorization: 'Bearer ' + t } })
        const data = (await r.json()) as Record<string, { count?: number; sender?: string; message?: string }>
        const total = Object.values(data).reduce((sum, v) => sum + (v?.count || 0), 0)
        if (lastUnreadTotal.current > 0 && total > lastUnreadTotal.current && Notification.permission === 'granted') {
          for (const val of Object.values(data)) {
            if (val?.count && val?.sender && val?.message) {
              await pushNotify(val.sender, val.message, 'chat-msg')
              break
            }
          }
        }
        lastUnreadTotal.current = total
      } catch {
        /* rede indisponível */
      }

      try {
        const r = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + t } })
        const d = await r.json()
        const prefs = await loadPrefs()
        const notifs = (d?.notificacoes || []) as { id: number; titulo: string; texto: string; tipo?: string }[]
        for (const n of notifs) {
          if (!sentIds.has(n.id)) {
            sentIds.add(n.id)
            // Filtra pelo tipo ativo (se prefs carregaram e tipo não está ativo, pula)
            if (prefs && n.tipo && !prefs.has(n.tipo)) continue
            await pushNotify(n.titulo, n.texto, `notif-${n.id}`)
            if (sentIds.size > 200) {
              const arr = Array.from(sentIds).slice(-100)
              sentIds.clear()
              arr.forEach(id => sentIds.add(id))
            }
          }
        }
      } catch {
        /* rede indisponível */
      }
    }, 30_000)

    return () => {
      clearInterval(interval)
      clearInterval(pingInterval)
    }
  }, [])

  return null
}
