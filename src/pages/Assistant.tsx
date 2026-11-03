import { Card } from '../components/Card'

export default function Assistant() {
  return (
    <main className="p-4">
      <Card>
        <h1 className="text-2xl font-semibold">Assistant</h1>
        <p className="mt-2 text-sm text-muted">
          Bientôt : pose une question en langage naturel et obtiens une réponse basée sur tes notes,
          avec les sources citées.
        </p>
        <form onSubmit={(e) => e.preventDefault()} className="mt-4 flex gap-3">
          <input
            disabled
            aria-label="Question"
            placeholder="Disponible après l'indexation des notes…"
            className="min-h-11 w-full rounded-2xl border border-glass-border bg-field px-4 text-base opacity-60"
          />
          <button
            disabled
            className="min-h-11 rounded-2xl bg-accent px-4 font-medium text-on-accent opacity-50"
          >
            Envoyer
          </button>
        </form>
      </Card>
    </main>
  )
}
