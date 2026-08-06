import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'

function TunnelEffect({ active }: { active: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    // Particles
    const count = 2000
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 0.5 + Math.random() * 4
      const z = -10 + Math.random() * 20
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
      positions[i * 3 + 2] = z
      colors[i * 3] = 0.85 + Math.random() * 0.15
      colors[i * 3 + 1] = 0.35 + Math.random() * 0.25
      colors[i * 3 + 2] = 0.05 + Math.random() * 0.15
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.8,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      points.rotation.z += 0.001
      points.rotation.y += 0.002

      // Tunnel movement
      const pos = geometry.attributes.position.array as Float32Array
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 2] += 0.04
        if (pos[i * 3 + 2] > 15) {
          pos[i * 3 + 2] = -10
          const angle = Math.random() * Math.PI * 2
          const radius = 0.5 + Math.random() * 4
          pos[i * 3] = Math.cos(angle) * radius
          pos[i * 3 + 1] = Math.sin(angle) * radius
        }
      }
      geometry.attributes.position.needsUpdate = true
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [active])

  if (!active) return null
  return (
    <div ref={mountRef} className="fixed inset-0 z-50" />
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tunnel, setTunnel] = useState(false)
  const [fadeForm, setFadeForm] = useState(false)
  const [fadeTunnel, setFadeTunnel] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Step 1: fade out form smoothly
    setFadeForm(true)
    await new Promise(r => setTimeout(r, 500))

    // Step 2: show tunnel for 3s
    setTunnel(true)
    await new Promise(r => setTimeout(r, 3000))

    // Step 3: fade out tunnel
    setFadeTunnel(true)
    await new Promise(r => setTimeout(r, 600))

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setTunnel(false)
        setFadeTunnel(false)
        setFadeForm(false)
        setError(errData.detail || 'Credenciais inválidas')
        setLoading(false)
        return
      }

      const data = await res.json()
      localStorage.setItem('nfse_token', JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
      }))

      window.location.href = '/dashboard'

    } catch (e) {
      setTunnel(false)
      setFadeTunnel(false)
      setFadeForm(false)
      setError('Erro de conexão')
      setLoading(false)
    }
  }

  // Check if already authenticated
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nfse_token')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.access_token) {
          navigate('/dashboard')
        }
      }
    } catch {}
  }, [navigate])

  return (
    <div className="min-h-screen bg-core-black text-off-white relative overflow-hidden flex items-center justify-center">
      {tunnel && (
        <div className={`fixed inset-0 z-50 transition-opacity duration-600 pointer-events-none ${fadeTunnel ? 'opacity-0' : 'opacity-100'}`}>
          <TunnelEffect active={tunnel} />
        </div>
      )}

      <div className={`relative z-10 w-full max-w-md px-8 transition-all duration-500 ${
        fadeForm ? 'opacity-0 scale-105 translate-y-4' : 'opacity-100 scale-100'
      }`}>
        {/* Logo / Brand */}
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <img src={`/logo.png?v=2`} alt="Axon" className="h-16 w-auto mx-auto" />
          </div>
          <p className="text-pulse-ash text-base tracking-wider" style={{ fontWeight: 500 }}>
            Inteligência Contábil
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-2">
              Email
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-rich-carbon border border-urban-smoke rounded-lg px-4 py-3 text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal transition-colors text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wider text-pulse-ash mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-rich-carbon border border-urban-smoke rounded-lg px-4 py-3 text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal transition-colors text-sm"
              required
            />
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-danger text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full py-4 rounded-lg font-medium text-sm tracking-wider transition-all duration-300 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #23D1FC, #0ea5d8)',
              color: '#fff',
            }}
          >
            <span className="relative z-10">
              {loading ? 'Entrando...' : 'Acessar Sistema'}
            </span>
            <div className="absolute inset-0 bg-infrared opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        </form>

        <p className="text-center text-pulse-ash text-xs mt-8">
          axon.baseoito.org
        </p>
      </div>
    </div>
  )
}
