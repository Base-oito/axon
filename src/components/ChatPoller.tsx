import { useEffect, useRef } from 'react'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

// Known notification IDs to avoid duplicate pushes
const sentIds = new Set<number>()

async function pushNotify(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return
  try { new Notification(title, { body: body.substring(0, 120), icon: '/logo.png', tag, requireInteraction: true }) } catch {}
}

export default function ChatPoller() {
  const lastUnreadTotal = useRef(0)

  useEffect(() => {
    const interval = setInterval(async () => {
      const t = getToken()
      if (!t) return
      try {
        // Chat push
        const r = await fetch('/api/chat/unread', { headers: { Authorization: 'Bearer ' + t } })
        const data = await r.json()
        const total = Object.values(data as Record<string, any>).reduce((sum: number, v: any) => sum + (v?.count || 0), 0)
        if (lastUnreadTotal.current > 0 && total > lastUnreadTotal.current && Notification.permission === 'granted') {
          for (const [, val] of Object.entries(data as Record<string, any>)) {
            if (val?.count > 0 && val?.sender && val?.message) {
              await pushNotify(val.sender, val.message, 'chat-msg')
              break
            }
          }
        }
        lastUnreadTotal.current = total
      } catch {}

      try {
        // General notifications push
        const r = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + t } })
        const d = await r.json()
        const notifs = d.notificacoes || []
        for (const n of notifs) {
          if (!sentIds.has(n.id)) {
            sentIds.add(n.id)
            await pushNotify(n.titulo, n.texto, `notif-${n.id}`)
            // Keep set small
            if (sentIds.size > 200) {
              const arr = Array.from(sentIds).slice(-100)
              sentIds.clear()
              arr.forEach(id => sentIds.add(id))
            }
          }
        }
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return null
}
