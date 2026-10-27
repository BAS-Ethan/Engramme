import { Card } from '../components/Card'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Home() {
  const { session } = useAuth()

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-accent-strong/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 size-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>

      <main className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h1 className="text-2xl font-semibold">Engramme</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Connecté en tant que {session?.user.email}
          </p>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="mt-4 min-h-11 rounded-2xl border border-white/40 px-4 text-sm dark:border-white/20"
          >
            Se déconnecter
          </button>
        </Card>
        <Card>
          <h2 className="font-semibold">Notes récentes</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Bientôt.</p>
        </Card>
      </main>
    </div>
  )
}
