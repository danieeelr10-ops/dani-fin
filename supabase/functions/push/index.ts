import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

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

    // ── Guardar/actualizar la suscripción push del navegador ───────────
    if (action === 'subscribe') {
      const { subscription } = body
      if (!subscription) return json({ ok: false, error: 'Falta subscription' }, 200)
      await admin.from('push_subscriptions').upsert({ user_id: user.id, subscription })
      return json({ ok: true })
    }

    // ── Borrar la suscripción de este dispositivo ───────────────────────
    if (action === 'unsubscribe') {
      await admin.from('push_subscriptions').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    // ── Programar un recordatorio para una tarea del planificador ──────
    if (action === 'set-reminder') {
      const { task_id, label, remind_at } = body
      if (!task_id || !remind_at) return json({ ok: false, error: 'Faltan datos' }, 200)
      const { data, error } = await admin.from('task_reminders')
        .upsert({ user_id: user.id, task_id, label: label || '', remind_at, sent: false }, { onConflict: 'user_id,task_id' })
        .select('id')
        .single()
      if (error) return json({ ok: false, error: error.message }, 200)
      return json({ ok: true, reminder_id: data.id })
    }

    // ── Cancelar el recordatorio de una tarea ───────────────────────────
    if (action === 'remove-reminder') {
      const { task_id } = body
      if (!task_id) return json({ ok: true })
      await admin.from('task_reminders').delete().eq('user_id', user.id).eq('task_id', task_id)
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
