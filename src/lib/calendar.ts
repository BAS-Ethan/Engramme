import ICAL from 'ical.js'
import { supabase } from './supabase'

export type CalendarEvent = {
  key: string
  sourceId: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  location: string
  description: string
}

const MAX_OCCURRENCES = 20000

// Événements d'un flux ICS qui touchent [from, to[, avec les récurrences et exceptions développées.
export function parseIcs(sourceId: string, text: string, from: Date, to: Date): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(tz)
  }

  const all = root.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v))
  const masters = all.filter((e) => !e.isRecurrenceException())
  for (const exception of all.filter((e) => e.isRecurrenceException())) {
    masters.find((m) => m.uid === exception.uid)?.relateException(exception)
  }

  const events: CalendarEvent[] = []
  const push = (e: ICAL.Event, start: ICAL.Time, end: ICAL.Time, id: string) => {
    if (e.component.getFirstPropertyValue('status') === 'CANCELLED') return
    const s = start.toJSDate()
    const en = end.toJSDate()
    if (en <= from || s >= to) return
    events.push({
      key: `${sourceId}:${e.uid}:${id}`,
      sourceId,
      title: e.summary || '(Sans titre)',
      start: s,
      end: en,
      allDay: start.isDate,
      location: e.location ?? '',
      description: e.description ?? '',
    })
  }

  for (const master of masters) {
    if (!master.isRecurring()) {
      push(master, master.startDate, master.endDate, '')
      continue
    }
    const it = master.iterator()
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const next = it.next()
      if (!next || next.toJSDate() >= to) break
      const occ = master.getOccurrenceDetails(next)
      push(occ.item, occ.startDate, occ.endDate, next.toString())
    }
  }
  return events
}

// Télécharge le flux ICS d'une source via l'Edge Function (le navigateur ne peut pas le faire à cause de CORS).
export async function fetchFeed(sourceId: string): Promise<{ text: string } | { error: string }> {
  const { data, error } = await supabase.functions.invoke<string>('fetch-calendar', {
    body: { source_id: sourceId },
  })
  if (!error) return { text: data ?? '' }
  const detail = 'context' in error && error.context instanceof Response ? await error.context.text() : error.message
  return { error: detail }
}
