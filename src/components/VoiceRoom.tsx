import { useState, useEffect } from 'react'
import {
  LiveKitRoom, RoomAudioRenderer, ControlBar,
  useTracks, GridLayout, TrackReference,
} from '@livekit/components-react'
import { Track } from 'livekit-client'

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

function AudioTrackRenderer({ trackRef }: { trackRef: TrackReference }) {
  return null // Audio tracks are rendered automatically by RoomAudioRenderer
}

export default function VoiceRoom({ canalId, canalNome, onClose }: { canalId: number; canalNome: string; onClose: () => void }) {
  const [token, setToken] = useState('')
  const [livekitUrl, setLivekitUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const t = getToken()
    if (!t) return
    fetch(`/api/voice/token?canal_id=${canalId}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t },
    })
      .then(r => r.json())
      .then(d => {
        if (d.token) {
          setToken(d.token)
          // Convert http to ws for LiveKit
          setLivekitUrl(d.host?.replace('http', 'ws') || 'ws://72.60.11.156:7880')
        } else {
          setError(d.detail || 'Sem acesso ao canal')
        }
      })
      .catch(() => setError('Erro ao conectar ao canal de voz'))
  }, [canalId])

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/90">
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-8 text-center max-w-sm mx-4">
          <div className="text-2xl mb-4 text-pulse-ash">🎙️</div>
          <p className="text-sm text-pulse-ash mb-6">{error}</p>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80">Fechar</button>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/90">
        <div className="bg-rich-carbon border border-urban-smoke rounded-xl p-8 text-center max-w-sm mx-4">
          <div className="animate-pulse text-2xl mb-4 text-pulse-ash">🎙️</div>
          <p className="text-sm text-pulse-ash">Conectando ao canal de voz...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/95">
      <div className="bg-rich-carbon border border-urban-smoke rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-urban-smoke shrink-0">
          <div>
            <h2 className="text-sm tracking-wider">{canalNome}</h2>
            <span className="text-[10px] text-success flex items-center gap-1">🎙 Canal de voz ativo</span>
          </div>
          <button onClick={onClose} className="text-pulse-ash hover:text-danger text-sm leading-none">✕</button>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[300px]">
          <LiveKitRoom
            token={token}
            serverUrl={livekitUrl}
            audio={true}
            video={false}
            connect={true}
            onDisconnected={onClose}
            className="flex flex-col items-center gap-4 w-full"
          >
            <RoomAudioRenderer />
            <div className="text-sm text-off-white mb-4">Participantes na sala</div>
            <ParticipantList />
            <div className="mt-4 w-full">
              <ControlBar variation="minimal" />
            </div>
          </LiveKitRoom>
        </div>
      </div>
    </div>
  )
}

function ParticipantList() {
  const trackRefs = useTracks([Track.Source.Microphone])

  if (trackRefs.length === 0) {
    return <div className="text-xs text-pulse-ash">Aguardando participantes...</div>
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {trackRefs.map(track => (
        <div key={track.participant.identity}
          className="bg-core-black border border-urban-smoke rounded-xl px-4 py-3 text-center min-w-[80px]">
          <div className="w-10 h-10 rounded-full bg-electric-teal/20 flex items-center justify-center text-sm text-electric-teal mx-auto mb-1">
            {(track.participant.name || '#' + track.participant.identity).charAt(0).toUpperCase()}
          </div>
          <div className="text-xs text-off-white truncate max-w-[100px]">{track.participant.name || 'Usuário'}</div>
          {track.participant.isSpeaking && <div className="text-[10px] text-success mt-1">🎙 Falando</div>}
        </div>
      ))}
    </div>
  )
}
