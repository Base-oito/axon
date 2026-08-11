import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useTracks } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { getToken } from '@/lib/api'
import { Mic, MicOff, PhoneOff } from 'lucide-react'

interface VoiceState {
  canalId: number | null
  canalNome: string
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error: string
  enterVoice: (canalId: number, canalNome: string) => Promise<void>
  leaveVoice: () => void
}

const VoiceContext = createContext<VoiceState>({
  canalId: null,
  canalNome: '',
  status: 'idle',
  error: '',
  enterVoice: async () => {},
  leaveVoice: () => {},
})

export function useVoice() {
  return useContext(VoiceContext)
}

export default function VoiceProvider({ children }: { children: ReactNode }) {
  const [canalId, setCanalId] = useState<number | null>(null)
  const [canalNome, setCanalNome] = useState('')
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [status, setStatus] = useState<VoiceState['status']>('idle')
  const [error, setError] = useState('')

  const enterVoice = useCallback(async (id: number, nome: string) => {
    const t = getToken()
    if (!t) return
    setStatus('connecting')
    setError('')
    try {
      const r = await fetch(`/api/voice/token?canal_id=${id}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.token) {
        setStatus('error')
        setError(d?.detail || 'Sem acesso ao canal de voz')
        return
      }
      setCanalId(id)
      setCanalNome(nome)
      setToken(d.token)
      setServerUrl(d.host?.replace('http', 'ws') || 'ws://72.60.11.156:7880')
      setStatus('connected')
    } catch {
      setStatus('error')
      setError('Erro ao conectar ao canal de voz')
    }
  }, [])

  const leaveVoice = useCallback(() => {
    setCanalId(null)
    setCanalNome('')
    setToken('')
    setStatus('idle')
    setError('')
  }, [])

  useEffect(() => {
    const onBeforeUnload = () => {
      if (token) {
        fetch(`/api/voice/token?canal_id=${canalId}`, { method: 'POST' }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [token, canalId])

  return (
    <VoiceContext.Provider value={{ canalId, canalNome, status, error, enterVoice, leaveVoice }}>
      {children}
      {token && serverUrl && (
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          audio={true}
          video={false}
          connect={true}
          onDisconnected={leaveVoice}
          onError={() => {
            setStatus('error')
            setError('Erro de conexão com o servidor de voz')
          }}
        >
          <RoomAudioRenderer />
          <VoiceBar canalNome={canalNome} onLeave={leaveVoice} />
        </LiveKitRoom>
      )}
      {status === 'error' && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <div>
            <p className="text-xs font-medium text-foreground">Canal de voz</p>
            <p className="text-[11px] text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={leaveVoice}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      )}
    </VoiceContext.Provider>
  )
}

function VoiceBar({ canalNome, onLeave }: { canalNome: string; onLeave: () => void }) {
  const local = useLocalParticipant()
  const trackRefs = useTracks([Track.Source.Microphone])
  const micMuted = local.isMicrophoneEnabled === false

  const toggleMic = () => {
    try {
      local.localParticipant.setMicrophoneEnabled(local.isMicrophoneEnabled === false)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 shadow-lg">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{canalNome}</span>
      </div>
      <div className="mx-1 hidden h-4 w-px bg-border sm:block" />
      <div className="hidden items-center gap-2 sm:flex">
        {trackRefs.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">Só você está aqui…</span>
        ) : (
          trackRefs.map(tr => (
            <span key={tr.participant.identity} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${tr.participant.isSpeaking ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              <span className="max-w-[80px] truncate">{tr.participant.name || tr.participant.identity}</span>
            </span>
          ))
        )}
      </div>
      <button
        onClick={toggleMic}
        title={micMuted ? 'Ativar microfone' : 'Silenciar microfone'}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          micMuted ? 'bg-muted text-muted-foreground hover:text-foreground' : 'bg-[#0078d4] text-white hover:bg-[#0078d4]/90'
        }`}
      >
        {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <button
        onClick={onLeave}
        title="Sair do canal de voz"
        className="flex h-8 items-center gap-1.5 rounded-full bg-rose-600 px-3 text-xs font-medium text-white transition-colors hover:bg-rose-700"
      >
        <PhoneOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </div>
  )
}
