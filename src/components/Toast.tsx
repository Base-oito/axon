import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; type: ToastType }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void; confirm: (msg: string) => Promise<boolean> }>({
  toast: () => {},
  confirm: async () => false,
})

export function useToast() { return useContext(ToastContext) }

const colors: Record<ToastType, string> = { success: 'bg-success/10 border-success/30 text-success', error: 'bg-danger/10 border-danger/30 text-danger', info: 'bg-electric-teal/10 border-electric-teal/30 text-electric-teal' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmCb, setConfirmCb] = useState<{ msg: string; resolve: (v: boolean) => void } | null>(null)
  let id = 0

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const tid = ++id * Date.now()
    setToasts(prev => [...prev, { id: tid, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4000)
  }, [])

  const confirm = useCallback((msg: string): Promise<boolean> => {
    return new Promise(resolve => setConfirmCb({ msg, resolve }))
  }, [])

  const dismiss = (tid: number) => setToasts(prev => prev.filter(t => t.id !== tid))

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}
      {confirmCb && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-core-black/80" onClick={() => { confirmCb.resolve(false); setConfirmCb(null) }}>
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-6 max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-off-white mb-6">{confirmCb.msg}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { confirmCb.resolve(false); setConfirmCb(null) }} className="px-4 py-2 rounded-lg text-xs tracking-wider border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">Cancelar</button>
              <button onClick={() => { confirmCb.resolve(true); setConfirmCb(null) }} className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-[70] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg border text-xs max-w-sm animate-[slideRight_0.2s_ease-out] flex items-center gap-2 ${colors[t.type]}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="hover:opacity-70 text-sm leading-none">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
