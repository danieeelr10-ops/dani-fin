import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const CRON_SECRET       = Deno.env.get('CRON_SECRET_DAILY')!

webpush.setVapidDetails('mailto:danieeelr10@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// Fecha de "hoy" en Bogotá (UTC-5 fijo, sin horario de verano) — el cron
// corre en UTC, así que hay que correr el reloj antes de cortar la fecha.
function todayKeyBogota() {
  const bogota = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return bogota.toISOString().split('T')[0]
}

// Disparado una vez al día (5:30am Bogotá) por un pg_cron job — protegido
// con un secreto compartido en vez de un JWT de usuario, igual que
// send-due-reminders.
Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const todayKey = todayKeyBogota()

    const { data: subsRows } = await admin.from('push_subscriptions').select('user_id, subscription')
    if (!subsRows?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const userIds = [...new Set(subsRows.map(r => r.user_id))]
    const { data: kvRows } = await admin.from('user_kv').select('user_id, value').eq('key', 'rumbo_planificador_v1').in('user_id', userIds)
    const planifByUser: Record<string, any> = Object.fromEntries((kvRows || []).map(r => [r.user_id, r.value]))

    let sent = 0
    for (const userId of userIds) {
      const planif = planifByUser[userId] || {}
      const pendientes = (planif[todayKey] || []).filter((t: any) => !t.done)
      if (pendientes.length === 0) continue

      const body = pendientes.length <= 3
        ? pendientes.map((t: any) => t.text).join(', ')
        : `${pendientes.slice(0, 3).map((t: any) => t.text).join(', ')} y ${pendientes.length - 3} más`

      const subs = subsRows.filter(r => r.user_id === userId)
      for (const row of subs) {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({
            title: `🌅 ${pendientes.length} tarea${pendientes.length !== 1 ? 's' : ''} pendiente${pendientes.length !== 1 ? 's' : ''} hoy`,
            body,
            url: '/planificador',
          }))
          sent++
        } catch (e) {
          console.error('push failed:', e.message)
          if (e.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('user_id', userId)
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, users: userIds.length }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
