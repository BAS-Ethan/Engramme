import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'system' | 'light' | 'dark'
export interface Colors {
  primary: string
  secondary: string
}

export type BackgroundId = 'network' | 'aurora' | 'dots' | 'stars' | 'plain' | 'image'

interface AppearanceValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  background: BackgroundId
  setBackground: (background: BackgroundId) => void
  image: string | null
  /** Les deux couleurs d'accent (celles de la palette tant qu'elles ne sont pas personnalisées). */
  colors: Colors
  isCustomColors: boolean
  setColors: (colors: Colors) => void
  resetColors: () => void
  /** Redimensionne et enregistre l'image ; renvoie un message d'erreur ou null. */
  setImageFile: (file: File) => Promise<string | null>
}

const THEME_KEY = 'engramme.theme'
const BACKGROUND_KEY = 'engramme.background'
const IMAGE_KEY = 'engramme.backgroundImage'
const COLORS_KEY = 'engramme.colors'

const THEMES: Theme[] = ['system', 'light', 'dark']
const BACKGROUNDS: BackgroundId[] = ['network', 'aurora', 'dots', 'stars', 'plain', 'image']

// Le stockage local peut être indisponible ou purgé : l'apparence est un simple confort.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignoré : le réglage ne sera pas conservé
  }
}

/** Texte lisible sur un bouton de cette couleur : charcoal-ink ou ghost-white. */
function onColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#2b2b2e' : '#f4f4f8'
}

function paletteColors(): Colors {
  const style = getComputedStyle(document.documentElement)
  return {
    primary: style.getPropertyValue('--mustard').trim().slice(0, 7),
    secondary: style.getPropertyValue('--blazing-flame').trim().slice(0, 7),
  }
}

function readColors(): Colors | null {
  try {
    const stored = JSON.parse(read(COLORS_KEY) ?? 'null') as Partial<Colors> | null
    return stored?.primary && stored.secondary ? { primary: stored.primary, secondary: stored.secondary } : null
  } catch {
    return null
  }
}

async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponible')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

const AppearanceContext = createContext<AppearanceValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = read(THEME_KEY)
    return THEMES.find((t) => t === stored) ?? 'system'
  })
  const [background, setBackgroundState] = useState<BackgroundId>(() => {
    const stored = read(BACKGROUND_KEY)
    return BACKGROUNDS.find((b) => b === stored) ?? 'network'
  })
  const [image, setImage] = useState<string | null>(() => read(IMAGE_KEY))
  const [custom, setCustom] = useState<Colors | null>(readColors)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function apply() {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      const page = getComputedStyle(document.documentElement).getPropertyValue('--page').trim()
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page.slice(0, 7))
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    const style = document.documentElement.style
    if (custom) {
      style.setProperty('--brand-1', custom.primary)
      style.setProperty('--brand-2', custom.secondary)
      style.setProperty('--on-accent', onColor(custom.primary))
    } else {
      style.removeProperty('--brand-1')
      style.removeProperty('--brand-2')
      style.removeProperty('--on-accent')
    }
  }, [custom])

  function setColors(next: Colors) {
    write(COLORS_KEY, JSON.stringify({ ...next, onPrimary: onColor(next.primary) }))
    setCustom(next)
  }

  function resetColors() {
    try {
      localStorage.removeItem(COLORS_KEY)
    } catch {
      // ignoré
    }
    setCustom(null)
  }

  function setTheme(next: Theme) {
    write(THEME_KEY, next)
    setThemeState(next)
  }

  function setBackground(next: BackgroundId) {
    write(BACKGROUND_KEY, next)
    setBackgroundState(next)
  }

  async function setImageFile(file: File) {
    try {
      const dataUrl = await toDataUrl(file)
      localStorage.setItem(IMAGE_KEY, dataUrl)
      setImage(dataUrl)
      setBackground('image')
      return null
    } catch {
      return "Impossible d'utiliser cette image (format ou taille non supporté)."
    }
  }

  return (
    <AppearanceContext.Provider value={{
        theme,
        setTheme,
        background,
        setBackground,
        image,
        setImageFile,
        colors: custom ?? paletteColors(),
        isCustomColors: custom !== null,
        setColors,
        resetColors,
      }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider')
  return value
}
