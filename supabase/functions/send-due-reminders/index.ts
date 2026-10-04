import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const CRON_SECRET        = Deno.env.get('CRON_SECRET')!

webpush.setVapidDetails('mailto:danieeelr10@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// Disparado cada minuto por un pg_cron job (ver supabase/migrations) — no lo
// llama el frontend, así que se protege con un secreto compartido en vez de
// un JWT de usuario.
Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: due } = await admin
      .from('task_reminders')
      .select('id, user_id, label, remind_at')
      .eq('sent', false)
      .lte('remind_at', new Date().toISOString())
      .limit(100)

    if (!due?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

    let sent = 0
    for (const reminder of due) {
      const { data: subs } = await admin.from('push_subscriptions').select('subscription').eq('user_id', reminder.user_id)
      for (const row of subs || []) {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({
            title: 'Rumbo · Tarea de hoy',
            body: reminder.label,
            url: '/planificador',
          }))
          sent++
        } catch (e) {
          console.error('push failed:', e.message)
          if (e.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('user_id', reminder.user_id)
          }
        }
      }
      await admin.from('task_reminders').update({ sent: true }).eq('id', reminder.id)
    }

    return new Response(JSON.stringify({ ok: true, sent, reminders: due.length }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
