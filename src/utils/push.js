import { supabase } from 'src/lib/supabase'

const VAPID_PUBLIC_KEY = 'BPYn0ZTDMhz9kgioP8Rx12phi4-NX8fPbzr7ZkpmPCxJbSnANZWXRBCkjDPhei2J4xp2jhKjohWIgOUMRlBdCkg'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function isPushSubscribed() {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

// Pide permiso, se suscribe a push en este dispositivo y guarda la
// suscripción en Supabase para que send-due-reminders pueda encontrarla.
export async function registerPush() {
  if (!isPushSupported()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'subscribe', subscription: sub.toJSON() } })
  return !error && data?.ok
}

export async function unregisterPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) {
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  }
  await supabase.functions.invoke('push', { body: { action: 'unsubscribe' } })
}

// Programa (o cancela, con remindAt = null) el recordatorio push de una tarea.
export async function setTaskReminder(taskId, label, remindAtIso) {
  if (!remindAtIso) {
    await supabase.functions.invoke('push', { body: { action: 'remove-reminder', task_id: taskId } })
    return true
  }
  const { data, error } = await supabase.functions.invoke('push', {
    body: { action: 'set-reminder', task_id: taskId, label, remind_at: remindAtIso },
  })
  return !error && data?.ok
}

export async function removeTaskReminder(taskId) {
  await supabase.functions.invoke('push', { body: { action: 'remove-reminder', task_id: taskId } })
}
