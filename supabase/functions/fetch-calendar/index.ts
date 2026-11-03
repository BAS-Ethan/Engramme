// Télécharge le flux ICS d'une source de calendrier de l'utilisateur.
// Le navigateur ne peut pas le faire lui-même (CORS), et l'URL reste ainsi protégée par le RLS.
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 10_000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function reply(body: string, status = 200) {
  return new Response(body, { status, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } })
}

function isPrivateIp(ip: string) {
  if (ip.includes(':')) return ip === '::1' || /^(fc|fd|fe80)/i.test(ip)
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  )
}

// Empêche d'utiliser la fonction pour atteindre le réseau interne (SSRF).
async function assertPublicHttps(url: URL) {
  if (url.protocol !== 'https:') throw new Error('Le lien doit être en https.')
  const addresses = [
    ...(await Deno.resolveDns(url.hostname, 'A').catch(() => [])),
    ...(await Deno.resolveDns(url.hostname, 'AAAA').catch(() => [])),
  ]
  if (addresses.length === 0 || addresses.some(isPrivateIp)) throw new Error('Adresse non autorisée.')
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES) throw new Error('Calendrier trop volumineux.')
    chunks.push(value)
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { source_id } = await req.json()
    if (typeof source_id !== 'string') return reply('source_id manquant.', 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: source, error } = await supabase
      .from('calendar_sources')
      .select('url')
      .eq('id', source_id)
      .maybeSingle()
    if (error || !source) return reply('Calendrier introuvable.', 404)

    let url = new URL(source.url.replace(/^webcal:/i, 'https:'))
    for (let hop = 0; ; hop++) {
      await assertPublicHttps(url)
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        if (hop >= MAX_REDIRECTS) return reply('Trop de redirections.', 502)
        url = new URL(location.replace(/^webcal:/i, 'https:'), url)
        continue
      }
      if (!res.ok) return reply(`Le calendrier a répondu ${res.status}.`, 502)
      return reply(await readLimited(res))
    }
  } catch (e) {
    return reply(e instanceof Error ? e.message : 'Erreur inconnue.', 502)
  }
})
