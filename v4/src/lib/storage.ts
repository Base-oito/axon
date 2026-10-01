import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Armazenamento híbrido: usa localStorage (síncrono, compatível com o build web atual)
 * e espelha em @capacitor/preferences quando rodando no app nativo (Capacitor).
 * A leitura continua síncrona via localStorage — nada muda para o fluxo web atual.
 */
const isNative = Capacitor.isNativePlatform()

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* localStorage indisponível — depende do Preferences */
  }
  if (isNative) {
    Preferences.set({ key, value }).catch(() => {})
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  if (isNative) {
    Preferences.remove({ key }).catch(() => {})
  }
}

/** Restaura tokens gravados nativamente para o localStorage (após app nativo reabrir). */
export async function storageHydrateFromNative(): Promise<void> {
  if (!isNative) return
  try {
    for (const key of ['nfse_token', 'nfse_client_token']) {
      if (storageGet(key)) continue
      const { value } = await Preferences.get({ key })
      if (value) {
        try {
          localStorage.setItem(key, value)
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}