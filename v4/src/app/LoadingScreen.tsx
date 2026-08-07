import { useEffect, useState } from 'react'

const LOADING_STEPS = [
  'Carregando módulos',
  'Carregando banco de dados',
  'Carregando componentes de IA',
]

export default function LoadingScreen() {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % LOADING_STEPS.length)
      setProgress(p => (p >= 100 ? 0 : p + 10))
    }, 900)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">Axon</div>
        <div className="loading-step">
          {LOADING_STEPS[step]}…
        </div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
