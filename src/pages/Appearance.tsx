import { useRef, useState, type ReactNode } from 'react'
import { Card } from '../components/Card'
import { useAppearance, type BackgroundId, type Colors, type Theme } from '../lib/appearance'

const themes: { id: Theme; label: string; hint: string }[] = [
  { id: 'system', label: 'Système', hint: "Suit le réglage de l'appareil" },
  { id: 'light', label: 'Clair', hint: 'Fond ghost-white, texte charcoal' },
  { id: 'dark', label: 'Sombre', hint: 'Fond charcoal profond' },
]

const dots = 'radial-gradient(currentColor 1px, transparent 1px)'
const stars = [
  'radial-gradient(circle at 20% 30%, currentColor 1.2px, transparent 2px)',
  'radial-gradient(circle at 70% 20%, currentColor 1px, transparent 2px)',
  'radial-gradient(circle at 45% 70%, currentColor 1.6px, transparent 2.5px)',
  'radial-gradient(circle at 85% 65%, currentColor 1px, transparent 2px)',
  'radial-gradient(circle at 10% 80%, currentColor 1px, transparent 2px)',
].join(',')

const presets: { label: string; colors: Colors }[] = [
  { label: 'Océan', colors: { primary: '#5ec8e5', secondary: '#6b5bff' } },
  { label: 'Forêt', colors: { primary: '#a8e063', secondary: '#1fa88e' } },
  { label: 'Rose', colors: { primary: '#ff9ec7', secondary: '#8f5bff' } },
]

const previews: { id: BackgroundId; label: string; preview: ReactNode }[] = [
  {
    id: 'network',
    label: 'Réseau',
    preview: (
      <svg viewBox="0 0 120 80" className="size-full text-muted" fill="currentColor" stroke="currentColor">
        <path d="M20 55 45 25 80 45 100 15M45 25 60 65 80 45" fill="none" strokeWidth="0.8" opacity="0.5" />
        {[[20, 55], [45, 25], [80, 45], [100, 15], [60, 65]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" stroke="none" />
        ))}
        <circle cx="62" cy="38" r="3" className="text-accent-text" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'aurora',
    label: 'Aurore',
    preview: (
      <>
        <div className="absolute -left-4 -top-4 size-16 rounded-full bg-blob-a/60 blur-xl" />
        <div className="absolute -bottom-4 -right-2 size-16 rounded-full bg-blob-b/50 blur-xl" />
        <div className="absolute left-1/3 top-1/3 size-12 rounded-full bg-blob-c/60 blur-xl" />
      </>
    ),
  },
  {
    id: 'dots',
    label: 'Points',
    preview: (
      <div
        className="absolute inset-0 text-muted opacity-60"
        style={{ backgroundImage: dots, backgroundSize: '12px 12px' }}
      />
    ),
  },
  {
    id: 'stars',
    label: 'Étoiles',
    preview: (
      <div
        className="absolute inset-0 text-fg"
        style={{ backgroundImage: stars }}
      />
    ),
  },
  { id: 'plain', label: 'Uni', preview: null },
]

const tileClass = (active: boolean) =>
  `block w-full overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] ${
    active ? 'border-accent-text ring-2 ring-accent' : 'border-glass-border'
  }`

export default function Appearance() {
  const { theme, setTheme, background, setBackground, image, setImageFile, colors, isCustomColors, setColors, resetColors } =
    useAppearance()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(await setImageFile(file))
  }

  return (
    <main className="grid gap-4 p-4 md:grid-cols-3">
      <Card className="md:col-span-3">
        <h1 className="text-2xl font-semibold">Apparence</h1>
        <p className="mt-1 text-sm text-muted">
          Ces réglages sont enregistrés sur cet appareil.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">Thème</h2>
        <div className="mt-3 space-y-2">
          {themes.map(({ id, label, hint }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`min-h-11 w-full rounded-2xl border px-4 py-2 text-left transition active:scale-[0.98] ${
                theme === id ? 'border-transparent bg-accent text-on-accent' : 'border-glass-border bg-field'
              }`}
            >
              <span className="block font-medium">{label}</span>
              <span className={`block text-xs ${theme === id ? 'opacity-80' : 'text-muted'}`}>{hint}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="md:col-span-2">
        <h2 className="font-semibold">Couleurs</h2>
        <p className="mt-1 text-sm text-muted">
          Les deux couleurs d'accent : boutons, taches de fond, impulsions et vagues.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['primary', 'Principale'],
              ['secondary', 'Secondaire'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 rounded-2xl border border-glass-border bg-field px-3 py-2">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                className="size-9 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
              />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <span className="font-mono text-xs text-muted">{colors[key]}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map(({ label, colors: preset }) => (
            <button
              key={label}
              onClick={() => setColors(preset)}
              className="flex min-h-11 items-center gap-2 rounded-2xl border border-glass-border bg-field px-3 text-sm"
            >
              <span className="size-4 rounded-full" style={{ background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 50%)` }} />
              {label}
            </button>
          ))}
          {isCustomColors && (
            <button onClick={resetColors} className="min-h-11 rounded-2xl px-3 text-sm text-accent-text">
              Réinitialiser
            </button>
          )}
        </div>
      </Card>

      <Card className="md:col-span-3">
        <h2 className="font-semibold">Arrière-plan</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {previews.map(({ id, label, preview }) => (
            <button key={id} onClick={() => setBackground(id)} aria-pressed={background === id} className={tileClass(background === id)}>
              <span className="relative block h-24 overflow-hidden bg-page">{preview}</span>
              <span className="block px-3 py-2 text-sm font-medium">{label}</span>
            </button>
          ))}
          <button
            onClick={() => (image ? setBackground('image') : fileInput.current?.click())}
            aria-pressed={background === 'image'}
            className={tileClass(background === 'image')}
          >
            <span
              className="relative flex h-24 items-center justify-center overflow-hidden bg-page bg-cover bg-center text-2xl text-muted"
              style={image ? { backgroundImage: `url(${image})` } : undefined}
            >
              {!image && '+'}
            </span>
            <span className="block px-3 py-2 text-sm font-medium">Image</span>
          </button>
        </div>

        <button
          onClick={() => fileInput.current?.click()}
          className="mt-3 min-h-11 rounded-2xl border border-glass-border bg-field px-4 text-sm"
        >
          {image ? "Changer l'image" : 'Choisir une image'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </Card>
    </main>
  )
}
