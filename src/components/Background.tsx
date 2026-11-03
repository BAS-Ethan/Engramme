import { useAppearance } from '../lib/appearance'
import { DotsBackground } from './DotsBackground'
import { NeuralBackground } from './NeuralBackground'
import { StarsBackground } from './StarsBackground'

export function Background() {
  const { background, image } = useAppearance()

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {background === 'network' && (
        <>
          <div className="absolute -left-24 -top-24 size-96 rounded-full bg-blob-a/65 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 size-96 rounded-full bg-blob-b/55 blur-3xl" />
          <NeuralBackground />
        </>
      )}

      {background === 'aurora' && (
        <>
          <div className="absolute -left-1/4 -top-1/4 size-[45rem] rounded-full bg-blob-a/70 blur-3xl motion-safe:animate-drift" />
          <div className="absolute -bottom-1/4 -right-1/4 size-[45rem] rounded-full bg-blob-b/60 blur-3xl [animation-delay:-8s] motion-safe:animate-drift" />
          <div className="absolute left-1/3 top-1/3 size-[35rem] rounded-full bg-blob-c/60 blur-3xl [animation-delay:-16s] motion-safe:animate-drift" />
        </>
      )}

      {background === 'dots' && (
        <>
          <div className="absolute -right-24 -top-24 size-96 rounded-full bg-blob-b/45 blur-3xl" />
          <DotsBackground />
        </>
      )}

      {background === 'stars' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-blob-c/50 via-blob-a/10 to-blob-b/35" />
          <StarsBackground />
        </>
      )}

      {background === 'image' && image && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${image})` }}
          />
          {/* Voile : garde le texte lisible sur n'importe quelle image */}
          <div className="absolute inset-0 bg-page/45" />
        </>
      )}
    </div>
  )
}
