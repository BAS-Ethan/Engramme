import { useEffect, useRef } from 'react'
import type { BufferAttribute, BufferGeometry, NormalBufferAttributes, Vector3, WebGLRenderer } from 'three'

type Three = typeof import('three')
type Geometry = BufferGeometry<NormalBufferAttributes>

const DISTANCE = 20
const NEIGHBORS = 3

/** Lit une couleur de theme.css ("#rrggbbaa" -> "#rrggbb", format compris par three). */
const themeColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(0, 7)

interface Pulse {
  from: number
  to: number
  t: number
}

/**
 * Un réseau de neurones : des nœuds (souvenirs) reliés entre eux, et des impulsions
 * qui voyagent de nœud en nœud (la trace d'un souvenir qui se réactive).
 */
function start(THREE: Three, canvas: HTMLCanvasElement): () => void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let renderer: WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  } catch {
    return () => {} // WebGL indisponible : le fond reste simplement uni
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.z = DISTANCE
  const group = new THREE.Group()
  scene.add(group)

  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 64
  const ctx = sprite.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  }
  const texture = new THREE.CanvasTexture(sprite)

  const nodeMaterial = new THREE.PointsMaterial({
    map: texture,
    size: 0.28,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
  const lineMaterial = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  })
  const pulseMaterial = new THREE.PointsMaterial({
    map: texture,
    size: 0.8,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  })

  let nodes: Vector3[] = []
  let adjacency: number[][] = []
  let pulses: Pulse[] = []
  let nodeGeometry: Geometry | null = null
  let lineGeometry: Geometry | null = null
  let pulseGeometry: Geometry | null = null
  let pulsePositions: BufferAttribute | null = null
  let pulseColors: BufferAttribute | null = null
  let builtAspect = 0

  function applyColors() {
    nodeMaterial.color.set(themeColor('--fg-muted'))
    lineMaterial.color.set(themeColor('--fg-muted'))
    const colors = pulseColors
    if (colors) {
      const accent = new THREE.Color(themeColor('--accent-text'))
      const flame = new THREE.Color(themeColor('--brand-2'))
      for (let i = 0; i < colors.count; i++) {
        const c = i % 2 === 0 ? accent : flame
        colors.setXYZ(i, c.r, c.g, c.b)
      }
      colors.needsUpdate = true
    }
  }

  function build() {
    group.clear()
    nodeGeometry?.dispose()
    lineGeometry?.dispose()
    pulseGeometry?.dispose()

    builtAspect = camera.aspect
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * DISTANCE
    const width = height * camera.aspect
    const count = THREE.MathUtils.clamp(Math.round((width * height) / 5), 35, 110)

    nodes = Array.from(
      { length: count },
      () =>
        new THREE.Vector3(
          (Math.random() - 0.5) * width * 1.2,
          (Math.random() - 0.5) * height * 1.2,
          -6 + Math.random() * 10,
        ),
    )

    // Chaque nœud est relié à ses plus proches voisins.
    const edges = new Set<string>()
    adjacency = nodes.map(() => [])
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter(({ j }) => j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, NEIGHBORS)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`
          if (edges.has(key)) return
          edges.add(key)
          adjacency[i].push(j)
          adjacency[j].push(i)
        })
    })

    const nodePositions = new Float32Array(count * 3)
    nodes.forEach((n, i) => n.toArray(nodePositions, i * 3))
    nodeGeometry = new THREE.BufferGeometry()
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3))

    const linePoints: number[] = []
    edges.forEach((key) => {
      const [i, j] = key.split('-').map(Number)
      linePoints.push(...nodes[i].toArray(), ...nodes[j].toArray())
    })
    lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3))

    const pulseCount = THREE.MathUtils.clamp(Math.round(count / 8), 5, 14)
    pulses = Array.from({ length: pulseCount }, () => {
      const from = Math.floor(Math.random() * count)
      const neighbors = adjacency[from]
      return { from, to: neighbors[Math.floor(Math.random() * neighbors.length)] ?? from, t: Math.random() }
    })
    pulseGeometry = new THREE.BufferGeometry()
    pulsePositions = new THREE.BufferAttribute(new Float32Array(pulseCount * 3), 3)
    pulseColors = new THREE.BufferAttribute(new Float32Array(pulseCount * 3), 3)
    pulseGeometry.setAttribute('position', pulsePositions)
    pulseGeometry.setAttribute('color', pulseColors)
    // Les impulsions bougent en permanence : pas de bounding sphere à maintenir.
    pulseGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity)

    group.add(
      new THREE.LineSegments(lineGeometry, lineMaterial),
      new THREE.Points(nodeGeometry, nodeMaterial),
      new THREE.Points(pulseGeometry, pulseMaterial),
    )
    applyColors()
    updatePulses(0)
  }

  function updatePulses(dt: number) {
    const positions = pulsePositions
    if (!positions) return
    pulses.forEach((p, i) => {
      const length = nodes[p.from].distanceTo(nodes[p.to]) || 1
      p.t += (2.5 * dt) / length
      if (p.t >= 1) {
        // L'impulsion arrive sur un nœud et repart vers l'un de ses voisins.
        const previous = p.from
        p.from = p.to
        const options = adjacency[p.from].filter((n) => n !== previous)
        const pool = options.length > 0 ? options : adjacency[p.from]
        p.to = pool[Math.floor(Math.random() * pool.length)] ?? p.from
        p.t = 0
      }
      const point = nodes[p.from].clone().lerp(nodes[p.to], p.t)
      positions.setXYZ(i, point.x, point.y, point.z)
    })
    positions.needsUpdate = true
  }

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    // Pas de reconstruction pour de petits changements (barre d'URL iOS qui se replie).
    if (builtAspect === 0 || Math.abs(camera.aspect - builtAspect) / builtAspect > 0.15) build()
    if (reduceMotion) renderer.render(scene, camera)
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  function onPointerMove(e: PointerEvent) {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
  }
  function onThemeChange() {
    applyColors()
    if (reduceMotion) renderer.render(scene, camera)
  }

  let frame = 0
  let last = performance.now()
  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    group.rotation.y = Math.sin(now / 12000) * 0.15 + pointer.x * 0.08
    group.rotation.x = Math.sin(now / 15000) * 0.08 + pointer.y * 0.05
    updatePulses(dt)
    renderer.render(scene, camera)
  }

  resize()
  window.addEventListener('resize', resize)
  const themeObserver = new MutationObserver(onThemeChange)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
  if (!reduceMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    frame = requestAnimationFrame(tick)
  }

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointerMove)
    themeObserver.disconnect()
    nodeGeometry?.dispose()
    lineGeometry?.dispose()
    pulseGeometry?.dispose()
    nodeMaterial.dispose()
    lineMaterial.dispose()
    pulseMaterial.dispose()
    texture.dispose()
    renderer.dispose()
  }
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let stop = () => {}
    // three est chargé à part pour ne pas retarder l'affichage de l'interface.
    void import('three').then((THREE) => {
      if (!cancelled) stop = start(THREE, canvas)
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10 size-full" />
}
