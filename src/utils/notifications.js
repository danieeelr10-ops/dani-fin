// ── Badging API ───────────────────────────────────────────────────────────────

export function updateBadge(count) {
  if (!navigator.setAppBadge) return
  if (count > 0) navigator.setAppBadge(count).catch(() => {})
  else navigator.clearAppBadge().catch(() => {})
}

export function clearBadge() {
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {})
}

// Calcula cuántos hábitos quedan pendientes hoy y actualiza el badge
export function refreshBadge() {
  try {
    const habitos = JSON.parse(localStorage.getItem('habitos') || '[]')
    if (!habitos.length) { clearBadge(); return }
    const today = new Date().toISOString().split('T')[0]
    const completados = JSON.parse(localStorage.getItem(`habitos_done_${today}`) || '[]')
    const pendientes = habitos.filter(h => h.activo !== false && !completados.includes(h.id)).length
    updateBadge(pendientes)
  } catch { clearBadge() }
}

// ── Utilidades de notificaciones ──────────────────────────────────────────────

const REMINDERS_KEY = 'notif_reminders'

export function getReminders() {
  try { return JSON.parse(localStorage.getItem(REMINDERS_KEY)) || [] } catch { return [] }
}

export function saveReminders(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders))
}

export function addReminder({ id, label, hour, minute, days = [0,1,2,3,4,5,6], enabled = true }) {
  const reminders = getReminders().filter(r => r.id !== id)
  reminders.push({ id, label, hour, minute, days, enabled })
  saveReminders(reminders)
}

export function removeReminder(id) {
  saveReminders(getReminders().filter(r => r.id !== id))
}

export function toggleReminder(id) {
  const reminders = getReminders().map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
  saveReminders(reminders)
  return reminders.find(r => r.id === id)
}

// Mostrar una notificación inmediata
export function showNotification(title, body, options = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      ...options,
    })
  } else {
    new Notification(title, { body, icon: '/pwa-192x192.png', badge: '/pwa-64x64.png', ...options })
  }
}

// Revisar recordatorios pendientes (llamar al abrir la app)
export function checkDueReminders() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  const reminders = getReminders().filter(r => r.enabled)
  if (!reminders.length) return

  const now = new Date()
  const today = now.getDay() // 0=dom..6=sab
  const todayKey = now.toISOString().split('T')[0]
  const shownKey = `notif_shown_${todayKey}`
  const shown = new Set(JSON.parse(localStorage.getItem(shownKey) || '[]'))

  reminders.forEach(r => {
    if (!r.days.includes(today)) return
    if (shown.has(r.id)) return

    const dueTime = new Date(now)
    dueTime.setHours(r.hour, r.minute, 0, 0)

    if (now >= dueTime) {
      showNotification('Dani Fin · Recordatorio', r.label, { tag: r.id })
      shown.add(r.id)
    } else {
      // Programar para más tarde en esta sesión
      const delay = dueTime - now
      setTimeout(() => {
        showNotification('Dani Fin · Recordatorio', r.label, { tag: r.id })
        const s = new Set(JSON.parse(localStorage.getItem(shownKey) || '[]'))
        s.add(r.id)
        localStorage.setItem(shownKey, JSON.stringify([...s]))
      }, delay)
    }
  })

  localStorage.setItem(shownKey, JSON.stringify([...shown]))
}
