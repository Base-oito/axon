import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function useIsMobile(): boolean {
  // No app nativo (Capacitor) o layout é sempre mobile-first.
  if (Capacitor.isNativePlatform()) return true
  return useMediaQuery('(max-width: 768px)')
}