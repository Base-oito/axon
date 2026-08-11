import { useState } from 'react'

interface SortableThProps {
  k: string
  sortKey: string
  sortDir: 'asc' | 'desc'
  onToggle: (k: string) => void
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function SortableTh({ k, sortKey, sortDir, onToggle, children, className, align = 'left' }: SortableThProps) {
  const active = sortKey === k
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      onClick={() => onToggle(k)}
      className={`cursor-pointer select-none px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${alignCls} ${
        active ? 'text-[#0078d4]' : 'text-muted-foreground'
      } ${className || ''}`}
    >
      {children} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )
}

export function useSortable(initialKey: string, initialDir: 'asc' | 'desc' = 'asc') {
  const [sortKey, setSortKey] = useState(initialKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialDir)

  const toggle = (k: string) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  return { sortKey, sortDir, toggle }
}

export function sortItems<T>(items: T[], _sortKey: string, sortDir: 'asc' | 'desc', getter: (item: T) => string | number) {
  const arr = [...items]
  arr.sort((a, b) => {
    const va = getter(a)
    const vb = getter(b)
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })
  return arr
}
