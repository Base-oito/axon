import { useEffect, useRef } from 'react'
import { getToken } from '@/lib/api'

const sentIds = new Set<number>()

async function pushNotify(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body: body.substring(0, 120), icon: '/logo.png', tag, requireInteraction: true })
  } catch {
    /* ignora falha de push */
  }
}

export default function ChatPoller() {
  const lastUnreadTotal = useRef(0)

  useEffect(() => {
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
        const notifs = (d?.notificacoes || []) as { id: number; titulo: string; texto: string }[]
        for (const n of notifs) {
          if (!sentIds.has(n.id)) {
            sentIds.add(n.id)
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

    return () => clearInterval(interval)
  }, [])

  return null
}
