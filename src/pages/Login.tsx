import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const inputClass =
  'min-h-11 w-full rounded-2xl border border-white/40 bg-white/70 px-4 text-base text-slate-900 outline-none focus:border-accent dark:border-white/20 dark:bg-white/10 dark:text-slate-100'
const buttonClass =
  'min-h-11 w-full rounded-2xl bg-accent-strong px-4 font-medium text-white transition active:scale-[0.98] disabled:opacity-50'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center p-4">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Engramme</h1>

        {!sent ? (
          <form onSubmit={sendLink} className="mt-4 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Entre ton email : tu recevras un lien de connexion et un code à 6 chiffres.
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="toi@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? 'Envoi…' : 'Recevoir le lien'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-4 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Email envoyé à {email}. Clique sur le lien, ou saisis ici le code à 6 chiffres
              (utile dans l'appli installée sur l'écran d'accueil).
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${inputClass} text-center tracking-[0.5em]`}
            />
            <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>
              {busy ? 'Vérification…' : 'Valider le code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false)
                setCode('')
                setError(null)
              }}
              className="min-h-11 w-full text-sm text-slate-600 dark:text-slate-300"
            >
              Changer d'email
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </Card>
    </main>
  )
}
