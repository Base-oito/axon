import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Converte horas decimais (ex: 230.8) para o formato HH:MM (ex: "230:48"), 60 min/hora. */
export function fmtHorasHM(horasDecimal: number): string {
  const h = Math.floor(horasDecimal)
  const min = Math.round((horasDecimal - h) * 60)
  return min === 60 ? `${h + 1}:00` : `${h}:${String(min).padStart(2, '0')}`
}
