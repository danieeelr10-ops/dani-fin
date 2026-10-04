import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

// Identifica al usuario a partir del JWT que manda supabase.functions.invoke
// automáticamente — nunca confiamos en un user_id que venga en el body.
async function getUser(req: Request, admin: ReturnType<typeof createClient>) {
  const auth = req.headers.get('Authorization') || ''
  const jwt = auth.replace('Bearer ', '')
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data?.user) return null
  return data.user
}

async function refreshAccessToken(admin: ReturnType<typeof createClient>, userId: string, row: any) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tok = await res.json()
  if (!res.ok) throw new Error(tok.error_description || tok.error || 'No se pudo renovar el token de Google')
  const expires_at = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString()
  await admin.from('google_calendar_tokens').update({ access_token: tok.access_token, expires_at }).eq('user_id', userId)
  return tok.access_token as string
}

async function getAccessToken(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: row } = await admin.from('google_calendar_tokens').select('*').eq('user_id', userId).maybeSingle()
  if (!row) return null
  if (row.access_token && row.expires_at && new Date(row.expires_at) > new Date()) return row.access_token as string
  return await refreshAccessToken(admin, userId, row)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const user = await getUser(req, admin)
    if (!user) return json({ error: 'No autenticado' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = body.action

    // ── Conectar: intercambia el code por tokens y los guarda ──────────
    if (action === 'connect') {
      const { code, redirect_uri } = body
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri, grant_type: 'authorization_code',
        }),
      })
      const tok = await res.json()
      if (!res.ok) return json({ ok: false, error: tok.error_description || tok.error }, 200)
      if (!tok.refresh_token) {
        // Google solo manda refresh_token la primera vez que el usuario autoriza.
        // Si ya lo había autorizado antes sin desconectar, no viene de nuevo.
        const { data: existing } = await admin.from('google_calendar_tokens').select('refresh_token').eq('user_id', user.id).maybeSingle()
        if (!existing) {
          return json({ ok: false, error: 'Google no envió un refresh token. Desconectá el acceso de la app en https://myaccount.google.com/permissions e intentá de nuevo.' }, 200)
        }
      }
      const expires_at = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString()
      await admin.from('google_calendar_tokens').upsert({
        user_id: user.id,
        access_token: tok.access_token,
        expires_at,
        ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
        connected_at: new Date().toISOString(),
      })
      return json({ ok: true })
    }

    // ── Estado de conexión ───────────────────────────────────────────
    if (action === 'status') {
      const { data } = await admin.from('google_calendar_tokens').select('user_id').eq('user_id', user.id).maybeSingle()
      return json({ connected: !!data })
    }

    // ── Desconectar ──────────────────────────────────────────────────
    if (action === 'disconnect') {
      await admin.from('google_calendar_tokens').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    // El resto de acciones necesitan un access token vigente
    const accessToken = await getAccessToken(admin, user.id)
    if (!accessToken) return json({ ok: false, error: 'not_connected' }, 200)
    const calBase = `https://www.googleapis.com/calendar/v3/calendars/primary/events`

    // ── Listar eventos en un rango de fechas ────────────────────────
    if (action === 'list') {
      const { start, end } = body
      const params = new URLSearchParams({
        timeMin: new Date(start).toISOString(),
        timeMax: new Date(end).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
      })
      const res = await fetch(`${calBase}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const data = await res.json()
      if (!res.ok) return json({ ok: false, error: data.error?.message || 'Error al listar eventos' }, 200)
      const events = (data.items || []).map((e: any) => ({
        id: e.id,
        title: e.summary || '(sin título)',
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
        htmlLink: e.htmlLink,
        // 'vektor' si Vektor lo etiquetó al crearlo (ver notify-gcal); si no,
        // es un evento suelto puesto directo en Google Calendar.
        source: e.extendedProperties?.private?.source || 'google',
      }))
      return json({ ok: true, events })
    }

    // ── Crear/actualizar un evento a partir de una tarea del planificador ──
    if (action === 'upsert') {
      const { task, date, google_event_id } = body
      const event = {
        summary: task,
        start: { date },
        end: { date },
      }
      const res = await fetch(
        google_event_id ? `${calBase}/${google_event_id}` : calBase,
        {
          method: google_event_id ? 'PATCH' : 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      )
      const data = await res.json()
      if (!res.ok) return json({ ok: false, error: data.error?.message || 'Error al guardar evento' }, 200)
      return json({ ok: true, google_event_id: data.id })
    }

    // ── Borrar evento ────────────────────────────────────────────────
    if (action === 'delete') {
      const { google_event_id } = body
      if (!google_event_id) return json({ ok: true })
      const res = await fetch(`${calBase}/${google_event_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const ok = res.ok || res.status === 410 || res.status === 404
      return json({ ok })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
