// Date locale au format YYYY-MM-DD (celui des colonnes `date` et de <input type="date">).
export function localDateString(d: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

// Affiche une date YYYY-MM-DD sans décalage de fuseau.
export function formatDueDate(due: string) {
  const [y, m, d] = due.split('-').map(Number)
  return dateFormat.format(new Date(y, m - 1, d))
}
