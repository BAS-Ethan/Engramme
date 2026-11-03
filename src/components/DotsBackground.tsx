import { useEffect, useRef } from 'react'

const SPACING = 26
const SHADES = 8

/** Lit une couleur de theme.css ("#rrggbbaa" -> [r, g, b]). */
function themeRgb(name: string): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/** Une grille de points traversée par des vagues : la crête grossit, s'éclaircit et vire d'une couleur d'accent à l'autre. */
export function DotsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio, 2)
    let width = 0
    let height = 0
    let frame = 0
    let last = performance.now()
    let clock = 0
    let shades: string[] = []

    // Dégradé précalculé entre les deux couleurs d'accent (évite de fabriquer des chaînes à chaque point).
    function applyColors() {
      const a = themeRgb('--accent-text')
      const b = themeRgb('--brand-2')
      shades = Array.from({ length: SHADES }, (_, i) => {
        const t = i / (SHADES - 1)
        return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * t)).join(',')})`
      })
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      const k1 = (Math.PI * 2) / 360
      const k2 = (Math.PI * 2) / 220
      for (let y = SPACING / 2; y < height; y += SPACING) {
        for (let x = SPACING / 2; x < width; x += SPACING) {
          // Deux vagues qui se croisent : l'une diagonale et rapide, l'autre lente et inverse.
          const wave =
            0.65 * Math.sin((x * 0.8 + y * 0.6) * k1 - clock * 1.1) +
            0.35 * Math.sin((x * 0.3 - y) * k2 + clock * 0.6)
          const v = 0.5 + 0.5 * wave
          ctx.globalAlpha = 0.14 + v * v * 0.6
          ctx.fillStyle = shades[Math.min(SHADES - 1, Math.floor(v * SHADES))]
          ctx.beginPath()
          ctx.arc(x, y, 0.9 + v * 2.3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick)
      clock += Math.min((now - last) / 1000, 0.05)
      last = now
      draw()
    }

    function resize() {
      if (!canvas || !ctx) return
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduceMotion) draw()
    }

    function onThemeChange() {
      applyColors()
      if (reduceMotion) draw()
    }

    applyColors()
    resize()
    const themeObserver = new MutationObserver(onThemeChange)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    window.addEventListener('resize', resize)
    if (!reduceMotion) frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      themeObserver.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
      style={{
        maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 90%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 90%)',
      }}
    />
  )
}
