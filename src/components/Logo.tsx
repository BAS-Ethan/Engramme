// Symbole d'Engramme : un fil unique en trois boucles dessine l'extérieur d'un E, et part d'un point.
// Le fil suit la couleur du texte, le point l'accent. `small` = tracé épaissi pour les petites tailles.
const paths = {
  full: {
    d: 'M94 213H188A17 17 0 0 0 188 179H68A17 17 0 0 1 68 145H164A17 17 0 0 0 164 111H68A17 17 0 0 1 68 77H188A17 17 0 0 0 188 43H94',
    width: 14,
    dot: { cx: 56, cy: 213, r: 12 },
  },
  small: {
    d: 'M104 228H186A20 20 0 0 0 186 188H76A20 20 0 0 1 76 148H160A20 20 0 0 0 160 108H76A20 20 0 0 1 76 68H186A20 20 0 0 0 186 28H104',
    width: 20,
    dot: { cx: 60, cy: 228, r: 15 },
  },
}

export function Logo({ small = false, className }: { small?: boolean; className?: string }) {
  const p = small ? paths.small : paths.full
  return (
    <svg viewBox="0 0 256 256" className={className} role="img" aria-label="Engramme">
      <path d={p.d} fill="none" stroke="currentColor" strokeWidth={p.width} strokeLinecap="round" strokeLinejoin="round" />
      <circle {...p.dot} fill="var(--accent)" />
    </svg>
  )
}
