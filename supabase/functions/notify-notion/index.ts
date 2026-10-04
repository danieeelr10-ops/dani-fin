import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const NOTION_TOKEN       = Deno.env.get('NOTION_TOKEN')!
const NOTION_DATABASE_ID = Deno.env.get('NOTION_DATABASE_ID')!
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

// Igual que en google-calendar: nunca confiamos en un user_id del body, se
// valida el JWT que manda supabase.functions.invoke automáticamente.
async function getUser(req: Request, admin: ReturnType<typeof createClient>) {
  const auth = req.headers.get('Authorization') || ''
  const jwt = auth.replace('Bearer ', '')
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data?.user) return null
  return data.user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const user = await getUser(req, admin)
    if (!user) return json({ error: 'No autenticado' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = body.action

    // ── Borrar: archiva la página (Notion no tiene delete real) ────────
    if (action === 'delete') {
      const { notion_page_id } = body
      if (!notion_page_id) return json({ ok: true, skipped: 'no notion_page_id' })
      const res = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      })
      const data = await res.json()
      if (!res.ok) console.error('notion delete error:', data)
      return json({ ok: res.ok })
    }

    // ── Crear / actualizar una tarea del planificador ───────────────────
    const { task, date, done, notion_page_id } = body

    const properties: Record<string, unknown> = {
      'Nombre': { title: [{ text: { content: task || '(sin título)' } }] },
      'Fecha': { date: { start: date } },
      'Estado': { select: { name: done ? 'Hecho' : 'Pendiente' } },
    }

    const notionRes = await fetch(
      notion_page_id ? `https://api.notion.com/v1/pages/${notion_page_id}` : 'https://api.notion.com/v1/pages',
      {
        method: notion_page_id ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          notion_page_id
            ? { properties }
            : { parent: { database_id: NOTION_DATABASE_ID }, properties }
        ),
      }
    )

    const notionData = await notionRes.json()
    if (!notionRes.ok) {
      console.error('notion error:', notionData)
      return json({ ok: false, error: notionData })
    }

    return json({ ok: true, notion_page_id: notionData.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
