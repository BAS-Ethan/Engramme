import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  depth: number
  warm: boolean
}

interface ShootingStar {
  x: number
  y: number
  age: number
}

const SHOOTING_DURATION = 0.9

/** Lit une couleur de theme.css ("#rrggbbaa" -> "#rrggbb"). */
const themeColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(0, 7)

/** Un ciel étoilé : scintillement, dérive lente, parallaxe au pointeur, étoile filante rare. */
export function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio, 2)
    let stars: Star[] = []
    let shooting: ShootingStar | null = null
    let nextShooting = 4 + Math.random() * 6
    let width = 0
    let height = 0
    let frame = 0
    let last = performance.now()
    let clock = 0
    let starColor = '#ffffff'
    let warmColor = '#fed766'
    const pointer = { x: 0, tx: 0 }

    function applyColors() {
      starColor = themeColor('--fg')
      warmColor = themeColor('--accent-text')
    }

    function build() {
      const count = Math.min(Math.max(Math.round((width * height) / 6000), 60), 260)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() ** 3 * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        depth: 0.2 + Math.random() * 0.8,
        warm: Math.random() < 0.2,
      }))
    }

    function draw(dt: number) {
      if (!ctx) return
      clock += dt
      ctx.clearRect(0, 0, width, height)

      for (const s of stars) {
        s.y -= s.depth * 1.5 * dt
        if (s.y < -2) s.y = height + 2
        const twinkle = reduceMotion ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock * s.speed + s.phase))
        const x = s.x + pointer.x * s.depth * 14
        ctx.fillStyle = s.warm ? warmColor : starColor
        ctx.globalAlpha = twinkle
        ctx.beginPath()
        ctx.arc(x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        if (s.r > 1.1) {
          ctx.globalAlpha = twinkle * 0.15
          ctx.beginPath()
          ctx.arc(x, s.y, s.r * 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (!reduceMotion) {
        nextShooting -= dt
        if (!shooting && nextShooting <= 0) {
          shooting = { x: Math.random() * width * 0.8, y: Math.random() * height * 0.4, age: 0 }
          nextShooting = 7 + Math.random() * 8
        }
        if (shooting) {
          shooting.age += dt
          const p = shooting.age / SHOOTING_DURATION
          if (p >= 1) shooting = null
          else {
            const head = { x: shooting.x + p * 320, y: shooting.y + p * 180 }
            const tail = { x: head.x - 90, y: head.y - 50 }
            const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
            gradient.addColorStop(0, 'transparent')
            gradient.addColorStop(1, warmColor)
            ctx.globalAlpha = 1 - p
            ctx.strokeStyle = gradient
            ctx.lineWidth = 1.5
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(tail.x, tail.y)
            ctx.lineTo(head.x, head.y)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      pointer.x += (pointer.tx - pointer.x) * 0.04
      draw(dt)
    }

    function resize() {
      if (!canvas || !ctx) return
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
      if (reduceMotion) draw(0)
    }

    function onPointerMove(e: PointerEvent) {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    }

    function onThemeChange() {
      applyColors()
      if (reduceMotion) draw(0)
    }

    applyColors()
    resize()
    const themeObserver = new MutationObserver(onThemeChange)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    window.addEventListener('resize', resize)
    if (!reduceMotion) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      themeObserver.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" />
}
