// Respaldo versionado del lado del servidor — independiente de que el
// almacenamiento del navegador sobreviva o no. Cada vez que el cliente se
// sincroniza, llama a esta función (con su propio JWT); ella lee la fila
// ACTUAL de user_data en el servidor (no confía en lo que mande el cliente)
// y guarda una copia fechada en Storage. Mantiene solo las últimas N por
// usuario para no crecer sin límite.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'data-backups'
const MAX_SNAPSHOTS = 20

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const auth = req.headers.get('Authorization') || ''
    const jwt = auth.replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)
    const userId = userData.user.id

    const { data: row, error: rowErr } = await admin
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .single()
    if (rowErr || !row?.data) return json({ ok: false, skipped: 'sin datos' })

    // No vale la pena respaldar una fila ya vacía.
    const txCount = Array.isArray(row.data?.transacciones) ? row.data.transacciones.length : 0
    if (txCount === 0) return json({ ok: false, skipped: 'sin transacciones' })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const path = `${userId}/${stamp}.json`
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, JSON.stringify(row.data), { contentType: 'application/json', upsert: false })
    if (upErr) return json({ ok: false, error: upErr.message })

    // Podar: dejar solo las últimas MAX_SNAPSHOTS para este usuario.
    const { data: list } = await admin.storage.from(BUCKET).list(userId, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    if (list && list.length > MAX_SNAPSHOTS) {
      const toDelete = list.slice(0, list.length - MAX_SNAPSHOTS).map(f => `${userId}/${f.name}`)
      if (toDelete.length > 0) await admin.storage.from(BUCKET).remove(toDelete)
    }

    return json({ ok: true, path, transacciones: txCount })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
