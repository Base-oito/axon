import { useCallback, useEffect, useState } from 'react'

export function getInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('axon_theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

export function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  try {
    localStorage.setItem('axon_theme', theme)
  } catch {
    /* ignore */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggle = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), [])
  return { theme, toggle, setTheme }
}
