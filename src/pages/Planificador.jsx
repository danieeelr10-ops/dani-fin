import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { supabase } from 'src/lib/supabase'
import { useSnackbar } from 'src/context/SnackbarContext'
import { registerPush, isPushSubscribed, setTaskReminder } from 'src/utils/push'
import { useSyncedState } from 'src/utils/cloudSync'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const HEADER  = '#F9FAFB'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BLUE    = '#3B82F6'
const AMBER   = '#D97706'
const BORDER  = '#E5E7EB'

const LS_KEY = 'rumbo_planificador_v1'
const FILTERS_LS_KEY = 'rumbo_planificador_filtros_v1'
const FIJAS_KEY = 'rumbo_planificador_fijas_v1'
const VIEW_LS_KEY = 'rumbo_planificador_vista_v1'
const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const DIA_LETRAS = ['L','M','X','J','V','S','D']
const DIA_GETDAY = [1, 2, 3, 4, 5, 6, 0] // DIAS/DIA_LETRAS son lunes-primero; Date.getDay() es domingo=0
const DEFAULT_FILTERS = { vektor: true, google: true, tareas: true }
const FILTER_CHIPS = [
  { key: 'tareas', label: '✅ Tareas',           color: GREEN },
  { key: 'vektor', label: '🏋️ Entrenos (Vektor)', color: '#F97316', requiresConnected: true },
  { key: 'google', label: '📅 Google Calendar',   color: BLUE,      requiresConnected: true },
]
const POMODORO_PRESETS = [25, 15, 5]
const SYNC_COOLDOWN_MS = 60000 // no reintentar sincronizar una tarea fija si ya se intentó hace menos de 1 minuto
const COL_WIDTH = 270

// No es secreto — el Client ID de OAuth está pensado para vivir en el frontend.
const GOOGLE_CLIENT_ID = '725468612753-t0olptlltfalnfo78nqgugshitoqtmgc.apps.googleusercontent.com'

function ls(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def } }
function ss(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
// OJO: NO usar d.toISOString() acá — convierte a UTC antes de cortar la fecha,
// así que después de las 7pm en Colombia (UTC-5) ya devolvía el día siguiente.
function toKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function startOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
// Grilla de mes lunes-primero: celdas del mes anterior/siguiente que caen en
// la misma semana quedan marcadas out=true (se muestran atenuadas, sin drop).
function buildMonthGrid(anchor) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = startOfWeek(firstOfMonth)
  const lastOfMonth = new Date(year, month + 1, 0)
  const gridEnd = startOfWeek(lastOfMonth)
  const totalWeeks = Math.round((gridEnd.getTime() - gridStart.getTime()) / (7 * 86400000)) + 1
  const cells = []
  for (let i = 0; i < totalWeeks * 7; i++) {
    const d = addDays(gridStart, i)
    cells.push({ date: d, out: d.getMonth() !== month })
  }
  return cells
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function redirectUri() { return `${window.location.origin}/planificador` }
function fmtClock(s) { const m = Math.floor(s / 60); const r = s % 60; return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

const DIA_SEMANA_MAP = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }

// Interpreta fechas en lenguaje natural dentro del texto de una tarea nueva
// (ej. "Pagar arriendo mañana", "Llamar al banco el viernes") — igual que el
// quick-add de Todoist, para no tener que elegir la fecha a mano casi nunca.
function parseQuickAdd(raw) {
  let text = (raw || '').trim()
  const hoy = new Date()
  function strip(re) { text = text.replace(re, ' ').replace(/\s{2,}/g, ' ').trim() }

  if (/\bpasado\s+ma(?:n|ñ)ana\b/i.test(text)) {
    strip(/\bpasado\s+ma(?:n|ñ)ana\b/i)
    return { text, dateKey: toKey(addDays(hoy, 2)) }
  }
  if (/\bma(?:n|ñ)ana\b/i.test(text)) {
    strip(/\bma(?:n|ñ)ana\b/i)
    return { text, dateKey: toKey(addDays(hoy, 1)) }
  }
  if (/\bhoy\b/i.test(text)) {
    strip(/\bhoy\b/i)
    return { text, dateKey: toKey(hoy) }
  }
  const enDias = text.match(/\ben\s+(\d{1,2})\s+d[ií]as?\b/i)
  if (enDias) {
    strip(/\ben\s+\d{1,2}\s+d[ií]as?\b/i)
    return { text, dateKey: toKey(addDays(hoy, parseInt(enDias[1], 10))) }
  }
  const fechaExplicita = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
  if (fechaExplicita) {
    strip(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/)
    const dia = parseInt(fechaExplicita[1], 10)
    const mes = parseInt(fechaExplicita[2], 10) - 1
    const anioStr = fechaExplicita[3]
    const anio = anioStr ? (anioStr.length === 2 ? 2000 + parseInt(anioStr, 10) : parseInt(anioStr, 10)) : hoy.getFullYear()
    const d = new Date(anio, mes, dia)
    if (!isNaN(d.getTime())) return { text, dateKey: toKey(d) }
  }
  const diaSemana = text.match(/\b(?:el\s+|este\s+|pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/i)
  if (diaSemana) {
    const esProximo = /pr[oó]ximo\s+/i.test(diaSemana[0])
    strip(new RegExp(diaSemana[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    const nombre = diaSemana[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const target = DIA_SEMANA_MAP[nombre]
    let diff = (target - hoy.getDay() + 7) % 7
    if (esProximo) diff += 7
    return { text, dateKey: toKey(addDays(hoy, diff)) }
  }

  return { text, dateKey: toKey(hoy) }
}

function buildGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export default function Planificador() {
  const { showToast } = useSnackbar()
  const [tasks, setTasks] = useSyncedState(LS_KEY, {})
  const [tareasFijas, setTareasFijas] = useSyncedState(FIJAS_KEY, [])
  const [fijasOpen, setFijasOpen] = useState(false)
  const [nuevaFijaTexto, setNuevaFijaTexto] = useState('')
  const [nuevaFijaDia, setNuevaFijaDia] = useState(1)
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [inputs, setInputs] = useState({})
  const [connected, setConnected] = useState(null) // null = cargando
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [googleEvents, setGoogleEvents] = useState({})
  const [filters, setFilters] = useState(() => ls(FILTERS_LS_KEY, DEFAULT_FILTERS))
  const [remindingId, setRemindingId] = useState(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [clearConfirmKey, setClearConfirmKey] = useState(null)
  const [pomodoroOpen, setPomodoroOpen] = useState(false)
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const pomodoroNotified = useRef(false)
  const nuevasFijasRef = useRef([])
  const [viewMode, setViewMode] = useState(() => ls(VIEW_LS_KEY, 'lista'))
  const [monthAnchor, setMonthAnchor] = useState(new Date())
  const [monthDayOpen, setMonthDayOpen] = useState(null) // dateKey del día abierto en el mes, o null
  const [draggedTask, setDraggedTask] = useState(null) // { fromKey, taskId }
  const [dragOverKey, setDragOverKey] = useState(null)
  const [quickAdd, setQuickAdd] = useState(null) // null cerrado, { fixedDate } abierto
  const [quickAddText, setQuickAddText] = useState('')
  const [quickAddDate, setQuickAddDate] = useState('')
  const [quickAddDateTouched, setQuickAddDateTouched] = useState(false)
  const [quickAddEsFija, setQuickAddEsFija] = useState(false)
  const [quickAddFijaDia, setQuickAddFijaDia] = useState(1) // lunes
  const quickAddInputRef = useRef(null)
  const [expandedMonths, setExpandedMonths] = useState({})
  const [overdueOpen, setOverdueOpen] = useState(false)

  function setView(v) { setViewMode(v); ss(VIEW_LS_KEY, v) }

  function toggleFilter(key) {
    setFilters(prev => {
      const next = { ...prev, [key]: !prev[key] }
      ss(FILTERS_LS_KEY, next)
      return next
    })
  }

  // OJO: memorizado por el valor real de weekAnchor (no por su referencia) —
  // startOfWeek() devuelve un Date nuevo cada vez, así que sin esto weekStart
  // (y todo lo que depende de él) se "veía" distinto en cada render y volvía
  // a disparar el efecto de tareas fijas en bucle.
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor.getTime()])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const today = toKey(new Date())
  const tomorrowKey = toKey(addDays(new Date(), 1))
  const onCurrentWeek = weekDays.some(d => toKey(d) === today)

  // Semana visible + mes actual y el siguiente completos — así las tareas
  // fijas de cualquier día del mes que viene ya existen aunque todavía no
  // hayas navegado hasta esa semana, no solo "cuando la mires".
  const diasARevisar = useMemo(() => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const finMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0)
    const rolling = []
    for (let d = new Date(inicio); d <= finMesSiguiente; d.setDate(d.getDate() + 1)) {
      rolling.push(new Date(d))
    }
    const vistas = new Set()
    const combinados = []
    for (const d of [...weekDays, ...rolling]) {
      const k = toKey(d)
      if (!vistas.has(k)) { vistas.add(k); combinados.push(d) }
    }
    return combinados
  }, [weekDays])

  function persist(next) { setTasks(next) }

  // ── Tareas fijas ─────────────────────────────────────────────────────
  // Plantillas semanales (ej. "Planificar sesión" todos los lunes) que se
  // instancian solas como tarea nueva para la semana actual + la próxima
  // (y para cualquier semana que navegues a futuro), sin duplicar si ya
  // existe la de esa semana.
  useEffect(() => {
    if (!tareasFijas.length) return
    const now = Date.now()
    // Forma funcional: siempre parte del `tasks` más reciente en ese instante,
    // sin importar si esta pasada corre antes de que termine de cargar desde
    // Supabase — evita que dos pasadas casi simultáneas dupliquen la misma tarea.
    setTasks(prevTasks => {
      let changed = false
      const next = { ...prevTasks }
      for (const d of diasARevisar) {
        const dateKey = toKey(d)
        const dow = d.getDay()
        const fijasDia = tareasFijas.filter(f => f.dia === dow)
        if (!fijasDia.length) continue
        const existentes = next[dateKey] || []
        const faltantes = fijasDia.filter(f => !existentes.some(t => t.fijaId === f.id))
        if (faltantes.length) {
          const nuevosTasks = faltantes.map(f => ({ id: uid(), text: f.texto, done: false, fijaId: f.id }))
          next[dateKey] = [...existentes, ...nuevosTasks]
          changed = true
        }
      }

      // Juntar instancias fijas que necesiten sincronizarse (recién creadas o
      // pendientes de antes) y marcarlas con la hora del intento EN EL MISMO
      // dato guardado (no en un ref en memoria) — así, si la página se
      // desmonta y se vuelve a montar mientras el pedido a Google/Notion
      // sigue en camino, la nueva pasada ve la marca reciente en los datos
      // reales y no dispara un segundo intento en paralelo.
      const pendientes = []
      for (const d of diasARevisar) {
        const dateKey = toKey(d)
        const dia = next[dateKey] || []
        let dayChanged = false
        const nuevoDia = dia.map(t => {
          if (!t.fijaId) return t
          const intentoReciente = t.syncPendingAt && (now - t.syncPendingAt) < SYNC_COOLDOWN_MS
          const necesitaGoogle = !!connected && !t.google_event_id && !intentoReciente
          const necesitaNotion = !t.notion_page_id && !intentoReciente
          if (necesitaGoogle || necesitaNotion) {
            pendientes.push({ dateKey, id: t.id, text: t.text, necesitaGoogle, necesitaNotion })
            dayChanged = true
            return { ...t, syncPendingAt: now }
          }
          return t
        })
        if (dayChanged) { next[dateKey] = nuevoDia; changed = true }
      }
      // Reasignar (no acumular) — en StrictMode React llama este updater dos
      // veces, y así la segunda pasada pisa la primera en vez de duplicarla.
      nuevasFijasRef.current = pendientes
      return changed ? next : prevTasks
    })

    // Sincroniza cada instancia pendiente con Google Calendar / Notion, igual
    // que una tarea manual (ver addTask).
    const pendientes = nuevasFijasRef.current
    if (pendientes.length) {
      (async () => {
        for (const { dateKey, id, text, necesitaGoogle, necesitaNotion } of pendientes) {
          if (necesitaGoogle) {
            const { data } = await supabase.functions.invoke('google-calendar', { body: { action: 'upsert', task: text, date: dateKey } })
            if (data?.ok && data.google_event_id) {
              setTasks(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).map(t => t.id === id ? { ...t, google_event_id: data.google_event_id } : t) }))
            }
          }
          if (necesitaNotion) {
            const { data: notionData } = await supabase.functions.invoke('notify-notion', { body: { action: 'upsert', task: text, date: dateKey, done: false } })
            if (notionData?.ok && notionData.notion_page_id) {
              setTasks(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).map(t => t.id === id ? { ...t, notion_page_id: notionData.notion_page_id } : t) }))
            }
          }
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasARevisar, tareasFijas])

  function crearFija() {
    const texto = nuevaFijaTexto.trim()
    if (!texto) return
    setTareasFijas(prev => [...prev, { id: uid(), texto, dia: nuevaFijaDia }])
    setNuevaFijaTexto('')
  }

  function borrarFija(id) {
    setTareasFijas(prev => prev.filter(f => f.id !== id))
  }

  // ── Pomodoro ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pomodoroRunning) return
    if (pomodoroSeconds <= 0) {
      setPomodoroRunning(false)
      if (!pomodoroNotified.current) { showToast('⏳ ¡Tiempo cumplido!'); pomodoroNotified.current = true }
      return
    }
    const t = setTimeout(() => setPomodoroSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoroRunning, pomodoroSeconds])

  function startPomodoro(minutes) {
    pomodoroNotified.current = false
    setPomodoroSeconds(minutes * 60)
    setPomodoroRunning(true)
  }

  // Al volver de Google con ?code=... en la URL, lo canjeamos por tokens.
  // Si no hay code, solo chequeamos si ya está conectado.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      (async () => {
        setConnecting(true)
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: { action: 'connect', code, redirect_uri: redirectUri() },
        })
        window.history.replaceState({}, '', window.location.pathname)
        if (error || !data?.ok) {
          showToast(data?.error || 'Error al conectar Google Calendar', 'error')
          setConnected(false)
        } else {
          showToast('✓ Google Calendar conectado')
          setConnected(true)
        }
        setConnecting(false)
      })()
    } else {
      checkStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkStatus() {
    const { data } = await supabase.functions.invoke('google-calendar', { body: { action: 'status' } })
    setConnected(!!data?.connected)
  }

  // Trae los eventos de Google de la semana visible
  useEffect(() => {
    if (!connected) { setGoogleEvents({}); return }
    (async () => {
      setSyncing(true)
      const { data } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'list', start: weekStart.toISOString(), end: addDays(weekStart, 7).toISOString() },
      })
      setSyncing(false)
      if (data?.ok) {
        const byDay = {}
        for (const ev of data.events) {
          const dk = (ev.start || '').split('T')[0]
          if (!dk) continue
          ;(byDay[dk] ||= []).push(ev)
        }
        setGoogleEvents(byDay)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, weekStart.getTime()])

  async function connectGoogle() {
    window.location.href = buildGoogleAuthUrl()
  }

  async function disconnectGoogle() {
    await supabase.functions.invoke('google-calendar', { body: { action: 'disconnect' } })
    setConnected(false)
    setGoogleEvents({})
    showToast('Google Calendar desconectado')
  }

  // textOverride permite agregar sin pasar por el input de cada día — lo usa
  // el quick-add flotante, que ya trae el texto limpio (sin la fecha en
  // lenguaje natural, que ya se usó para elegir dateKey).
  async function addTask(dateKey, textOverride) {
    const text = (textOverride ?? inputs[dateKey] ?? '').trim()
    if (!text) return
    const newTask = { id: uid(), text, done: false }
    const next = { ...tasks, [dateKey]: [...(tasks[dateKey] || []), newTask] }
    persist(next)
    if (textOverride == null) setInputs(prev => ({ ...prev, [dateKey]: '' }))

    if (connected) {
      const { data } = await supabase.functions.invoke('google-calendar', { body: { action: 'upsert', task: text, date: dateKey } })
      if (data?.ok && data.google_event_id) {
        setTasks(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).map(t => t.id === newTask.id ? { ...t, google_event_id: data.google_event_id } : t) }))
      }
    }

    const { data: notionData } = await supabase.functions.invoke('notify-notion', { body: { action: 'upsert', task: text, date: dateKey, done: false } })
    if (notionData?.ok && notionData.notion_page_id) {
      setTasks(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).map(t => t.id === newTask.id ? { ...t, notion_page_id: notionData.notion_page_id } : t) }))
    }
  }

  // ── Quick add flotante (estilo Todoist) ─────────────────────────────
  // El texto interpreta la fecha en lenguaje natural solo para auto-completar
  // el selector de fecha (quickAddDate) — ese selector es la fuente de verdad
  // real al agregar, y queda siempre visible/editable para poder elegir el
  // día a mano en vez de confiar a ciegas en el parseo. fixedDate != null:
  // viene de tocar el "+" de una sección puntual de la lista — el selector
  // arranca fijo en ese día y no se auto-actualiza con lo que se escriba.
  function openQuickAdd(fixedDate = null) {
    const initDate = fixedDate || today
    setQuickAdd({ fixedDate })
    setQuickAddText('')
    setQuickAddDate(initDate)
    setQuickAddDateTouched(!!fixedDate)
    setQuickAddEsFija(false)
    setQuickAddFijaDia(new Date(`${initDate}T12:00:00`).getDay())
    setTimeout(() => quickAddInputRef.current?.focus(), 50)
  }
  function closeQuickAdd() {
    setQuickAdd(null)
    setQuickAddText('')
  }
  function handleQuickAddTextChange(val) {
    setQuickAddText(val)
    if (!quickAddDateTouched && !quickAdd?.fixedDate) {
      setQuickAddDate(parseQuickAdd(val).dateKey)
    }
  }
  function submitQuickAdd() {
    const raw = quickAddText.trim()
    if (!raw) return
    const text = parseQuickAdd(raw).text || raw
    if (quickAddEsFija) {
      setTareasFijas(prev => [...prev, { id: uid(), texto: text, dia: quickAddFijaDia }])
      showToast(`📌 Tarea fija creada — se repite cada ${DIAS[DIA_GETDAY.indexOf(quickAddFijaDia)]}`)
    } else {
      addTask(quickAddDate, text)
    }
    setQuickAddText('')
    quickAddInputRef.current?.focus()
  }

  function toggleTask(dateKey, id) {
    let toggled = null
    const next = { ...tasks, [dateKey]: (tasks[dateKey] || []).map(t => {
      if (t.id !== id) return t
      toggled = { ...t, done: !t.done }
      return toggled
    }) }
    persist(next)
    if (toggled?.notion_page_id) {
      supabase.functions.invoke('notify-notion', { body: { action: 'upsert', task: toggled.text, date: dateKey, done: toggled.done, notion_page_id: toggled.notion_page_id } })
    }
  }

  function deleteTask(dateKey, id) {
    const task = (tasks[dateKey] || []).find(t => t.id === id)
    const next = { ...tasks, [dateKey]: (tasks[dateKey] || []).filter(t => t.id !== id) }
    persist(next)
    if (connected && task?.google_event_id) {
      supabase.functions.invoke('google-calendar', { body: { action: 'delete', google_event_id: task.google_event_id } })
    }
    if (task?.notion_page_id) {
      supabase.functions.invoke('notify-notion', { body: { action: 'delete', notion_page_id: task.notion_page_id } })
    }
    if (task?.remind_at) {
      setTaskReminder(task.id, task.text, null)
    }
  }

  // Reprograma una tarea a otro día (drag & drop). Reutiliza 'upsert' con el
  // google_event_id/notion_page_id existente — como en la función de Google
  // Calendar/Notion PATCHea en vez de crear, el evento se reprograma en vez
  // de duplicarse.
  function moveTask(fromKey, taskId, toKey) {
    if (fromKey === toKey) return
    let moved = null
    setTasks(prev => {
      const fromTasks = prev[fromKey] || []
      const task = fromTasks.find(t => t.id === taskId)
      if (!task) return prev
      moved = task
      return {
        ...prev,
        [fromKey]: fromTasks.filter(t => t.id !== taskId),
        [toKey]: [...(prev[toKey] || []), task],
      }
    })
    if (!moved) return
    if (connected && moved.google_event_id) {
      supabase.functions.invoke('google-calendar', { body: { action: 'upsert', task: moved.text, date: toKey, google_event_id: moved.google_event_id } })
    }
    if (moved.notion_page_id) {
      supabase.functions.invoke('notify-notion', { body: { action: 'upsert', task: moved.text, date: toKey, done: moved.done, notion_page_id: moved.notion_page_id } })
    }
    if (moved.remind_at) {
      // El recordatorio quedaba fijo a la fecha/hora vieja — se quita al mover;
      // si querés uno nuevo para el día de destino, lo agregás desde ahí.
      setTaskReminder(moved.id, moved.text, null)
      setTasks(prev => ({ ...prev, [toKey]: (prev[toKey] || []).map(t => t.id === taskId ? { ...t, remind_at: undefined } : t) }))
    }
  }

  // El origen del drag va en dataTransfer (fuente de verdad del propio evento
  // nativo), no solo en el estado de React — si dragover/drop llegan antes de
  // que React re-renderice con el draggedTask nuevo, un closure viejo (null)
  // haría que el drop no encontrara nada que mover. draggedTask en React solo
  // maneja el efecto visual (opacity de la tarea que se está arrastrando).
  function handleTaskDragStart(evt, fromKey, taskId) {
    evt.dataTransfer.effectAllowed = 'move'
    evt.dataTransfer.setData('text/plain', JSON.stringify({ fromKey, taskId }))
    setDraggedTask({ fromKey, taskId })
  }
  function handleDayDragOver(evt, dateKey) {
    evt.preventDefault()
    setDragOverKey(dateKey)
  }
  function handleDayDrop(evt, dateKey) {
    evt.preventDefault()
    setDragOverKey(null)
    let info = draggedTask
    try {
      const raw = evt.dataTransfer.getData('text/plain')
      if (raw) info = JSON.parse(raw)
    } catch {}
    if (!info) return
    moveTask(info.fromKey, info.taskId, dateKey)
    setDraggedTask(null)
  }

  function clearDay(dateKey) {
    const dayTasks = tasks[dateKey] || []
    for (const t of dayTasks) {
      if (connected && t.google_event_id) supabase.functions.invoke('google-calendar', { body: { action: 'delete', google_event_id: t.google_event_id } })
      if (t.notion_page_id) supabase.functions.invoke('notify-notion', { body: { action: 'delete', notion_page_id: t.notion_page_id } })
      if (t.remind_at) setTaskReminder(t.id, t.text, null)
    }
    persist({ ...tasks, [dateKey]: [] })
    setClearConfirmKey(null)
  }

  async function handleReminderTime(dateKey, task, timeStr) {
    if (!timeStr) {
      const next = { ...tasks, [dateKey]: (tasks[dateKey] || []).map(t => t.id === task.id ? { ...t, remind_at: undefined } : t) }
      persist(next)
      setTaskReminder(task.id, task.text, null)
      return
    }

    setPushBusy(true)
    const subscribed = (await isPushSubscribed()) || (await registerPush())
    setPushBusy(false)
    if (!subscribed) { showToast('Activá los permisos de notificación para poner recordatorios', 'error'); return }

    // Offset fijo de Bogotá (-05:00, sin horario de verano) — así el recordatorio
    // se dispara a la hora correcta sin importar la zona horaria del dispositivo
    // donde se creó (antes usaba la hora local del navegador, que podía diferir).
    const remindAtIso = new Date(`${dateKey}T${timeStr}:00-05:00`).toISOString()
    const next = { ...tasks, [dateKey]: (tasks[dateKey] || []).map(t => t.id === task.id ? { ...t, remind_at: remindAtIso } : t) }
    persist(next)
    setRemindingId(null)
    const ok = await setTaskReminder(task.id, task.text, remindAtIso)
    if (ok) showToast('⏰ Recordatorio programado')
    else showToast('No se pudo programar el recordatorio', 'error')
  }

  const weekEnd = weekDays[6]
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} - ${weekEnd.getDate()} ${weekStart.toLocaleDateString('es-CO', { month: 'short' })}`
    : `${weekStart.getDate()} ${weekStart.toLocaleDateString('es-CO', { month: 'short' })} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-CO', { month: 'short' })}`

  // Progreso agregado de la semana visible — se resetea solo al cambiar de
  // semana (no acumula histórico ni mezcla otras semanas).
  const weekTaskTotal = weekDays.reduce((acc, d) => acc + (tasks[toKey(d)] || []).length, 0)
  const weekTaskDone = weekDays.reduce((acc, d) => acc + (tasks[toKey(d)] || []).filter(t => t.done).length, 0)
  const weekTaskPct = weekTaskTotal ? Math.round(weekTaskDone / weekTaskTotal * 100) : 0

  const todayTasksList = tasks[today] || []
  const todayTaskTotal = todayTasksList.length
  const todayTaskDone  = todayTasksList.filter(t => t.done).length
  const todayTaskPct   = todayTaskTotal ? Math.round(todayTaskDone / todayTaskTotal * 100) : 0

  const monthLabel = monthAnchor.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const monthGrid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor.getFullYear(), monthAnchor.getMonth()])
  const monthDayData = monthDayOpen ? new Date(`${monthDayOpen}T12:00:00`) : null

  // ── Vista Lista (estilo Todoist) ─────────────────────────────────────
  // Agrupa por fecha en vez de por columnas: Vencidas, Hoy, Mañana y después
  // un encabezado por cada día siguiente que tenga tareas (los vacíos no se
  // muestran, salvo Hoy/Mañana que siempre aparecen para poder agregar ahí).
  const listaGroups = useMemo(() => {
    const conTareas = new Set(Object.keys(tasks).filter(k => (tasks[k] || []).length > 0))
    conTareas.add(today)
    conTareas.add(tomorrowKey)
    const ordenadas = Array.from(conTareas).sort()
    return {
      overdue: ordenadas.filter(k => k < today),
      rest: ordenadas.filter(k => k > tomorrowKey),
    }
  }, [tasks, today, tomorrowKey])

  // Lo que no es Hoy/Mañana se agrupa por mes y arranca colapsado — con
  // tareas fijas poblando muchos días por delante, una lista plana de
  // encabezados por día se volvía interminable. El mes actual arranca
  // abierto (lo más relevante); el resto colapsado hasta que lo tocás.
  const restByMonth = useMemo(() => {
    const map = {}
    for (const k of listaGroups.rest) {
      const mk = k.slice(0, 7)
      ;(map[mk] ||= []).push(k)
    }
    return map
  }, [listaGroups.rest])
  const todayMonthKey = today.slice(0, 7)
  function isMonthOpen(mk) { return expandedMonths[mk] !== undefined ? expandedMonths[mk] : mk === todayMonthKey }
  function toggleMonth(mk) { setExpandedMonths(prev => ({ ...prev, [mk]: !isMonthOpen(mk) })) }

  function monthLabelFor(mk) { return capitalize(new Date(`${mk}-01T12:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })) }

  // Vencidas también se agrupa por mes (igual que el resto) y arranca
  // colapsada como un solo bloque — las tareas fijas sin completar se
  // acumulan semana a semana, así que sin esto la lista de vencidas sola ya
  // se vuelve larguísima.
  const overdueByMonth = useMemo(() => {
    const map = {}
    for (const k of listaGroups.overdue) {
      const mk = k.slice(0, 7)
      ;(map[mk] ||= []).push(k)
    }
    return map
  }, [listaGroups.overdue])
  const overdueCount = listaGroups.overdue.reduce((s, k) => s + (tasks[k] || []).length, 0)

  function sectionLabelFor(dateKey) {
    if (dateKey === today) return 'Hoy'
    if (dateKey === tomorrowKey) return 'Mañana'
    const d = new Date(`${dateKey}T12:00:00`)
    const diffDays = Math.round((d - new Date(`${today}T12:00:00`)) / 86400000)
    const raw = diffDays >= 0 && diffDays <= 6
      ? d.toLocaleDateString('es-CO', { weekday: 'long' })
      : d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
    return capitalize(raw)
  }

  // Una sección por día — misma data y acciones que la vista semana (toggle,
  // borrar, recordatorio, drag&drop entre días), pero como lista plana sin
  // tarjetas, más parecida a Todoist.
  function renderDaySection(dateKey, { accent } = {}) {
    const dayTasks = filters.tareas
      ? [...(tasks[dateKey] || [])].sort((a, b) => (b.fijaId ? 1 : 0) - (a.fijaId ? 1 : 0))
      : []
    const dayGoogleEvents = (googleEvents[dateKey] || []).filter(ev => filters[ev.source] !== false)
    const total = dayTasks.length
    const doneCount = dayTasks.filter(t => t.done).length
    const isDragOver = dragOverKey === dateKey
    return (
      <Box key={dateKey}
        onDragOver={evt => handleDayDragOver(evt, dateKey)}
        onDragLeave={() => setDragOverKey(prev => (prev === dateKey ? null : prev))}
        onDrop={evt => handleDayDrop(evt, dateKey)}
        sx={{
          mb: 2.5, borderRadius: '12px', p: isDragOver ? 1 : 0,
          outline: isDragOver ? `2px dashed ${alpha(GREEN, 0.4)}` : 'none',
          bgcolor: isDragOver ? alpha(GREEN, 0.04) : 'transparent',
          transition: 'background-color .1s',
        }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: accent || T1 }}>{sectionLabelFor(dateKey)}</Typography>
          {total > 0 && <Typography sx={{ fontSize: 11.5, color: T2 }}>{doneCount}/{total}</Typography>}
          <Box onClick={() => openQuickAdd(dateKey)} sx={{
            ml: 'auto', cursor: 'pointer', color: T2, opacity: 0.55, fontSize: 17, lineHeight: 1,
            '&:hover': { opacity: 1, color: GREEN },
          }}>+</Box>
        </Box>

        {dayGoogleEvents.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
            {dayGoogleEvents.map(ev => {
              const c = ev.source === 'vektor' ? '#F97316' : BLUE
              return (
                <Box key={ev.id} component="a" href={ev.htmlLink} target="_blank" rel="noreferrer" sx={{
                  display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none',
                  bgcolor: alpha(c, 0.06), border: `1px solid ${alpha(c, 0.18)}`, borderRadius: '8px', px: 1, py: 0.625,
                }}>
                  <Typography sx={{ fontSize: 11 }}>{ev.source === 'vektor' ? '🏋️' : '🔗'}</Typography>
                  <Typography sx={{ flex: 1, fontSize: 12.5, color: c, fontWeight: 500 }}>{ev.title}</Typography>
                  {!ev.allDay && (
                    <Typography sx={{ fontSize: 10.5, color: c, opacity: 0.8 }}>
                      {new Date(ev.start).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Box>
        )}

        {dayTasks.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: T2, opacity: 0.6, py: 0.5 }}>Sin tareas</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {dayTasks.map(t => (
              <Box key={t.id}
                draggable
                onDragStart={evt => handleTaskDragStart(evt, dateKey, t.id)}
                onDragEnd={() => { setDraggedTask(null); setDragOverKey(null) }}
                sx={{
                  borderBottom: `1px solid ${BORDER}`, cursor: 'grab',
                  opacity: draggedTask?.taskId === t.id ? 0.4 : 1,
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.875 }}>
                  <Box onClick={() => toggleTask(dateKey, t.id)} sx={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${t.done ? GREEN : (t.fijaId ? AMBER : '#C7CBD1')}`,
                    bgcolor: t.done ? GREEN : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color .15s, background-color .15s',
                    '@keyframes popIn': { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.3)' }, '100%': { transform: 'scale(1)' } },
                    animation: t.done ? 'popIn 0.22s ease' : 'none',
                  }}>
                    {t.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </Box>
                  <Typography sx={{ flex: 1, fontSize: 14, color: t.done ? T2 : T1, textDecoration: t.done ? 'line-through' : 'none', transition: 'color .15s' }}>{t.text}</Typography>
                  {t.google_event_id && <Typography sx={{ fontSize: 10, color: BLUE, opacity: 0.55 }}>🔗</Typography>}
                  {t.notion_page_id && <Typography sx={{ fontSize: 10, opacity: 0.55 }}>📝</Typography>}
                  <Box onClick={() => setRemindingId(remindingId === t.id ? null : t.id)} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', flexShrink: 0,
                    color: t.remind_at ? AMBER : T2, opacity: t.remind_at ? 1 : 0.4,
                  }}>
                    <Typography sx={{ fontSize: 12 }}>⏰</Typography>
                    {t.remind_at && (
                      <Typography sx={{ fontSize: 10.5, fontWeight: 600 }}>
                        {new Date(t.remind_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })}
                      </Typography>
                    )}
                  </Box>
                  <Box onClick={() => deleteTask(dateKey, t.id)} sx={{
                    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T2, opacity: 0.4, fontSize: 15, flexShrink: 0,
                    '&:hover': { opacity: 1, color: '#DC2626' },
                  }}>×</Box>
                </Box>
                {remindingId === t.id && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0.875, pl: 3.75 }}>
                    <Box component="input" type="time"
                      defaultValue={t.remind_at ? new Date(t.remind_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }) : ''}
                      onChange={e => handleReminderTime(dateKey, t, e.target.value)}
                      disabled={pushBusy}
                      sx={{ border: `1px solid ${BORDER}`, borderRadius: '6px', px: 1, py: 0.375, fontSize: 12, fontFamily: 'inherit', color: T1, outline: 'none', bgcolor: '#fff' }} />
                    {t.remind_at && (
                      <Box component="button" onClick={() => handleReminderTime(dateKey, t, '')}
                        sx={{ fontSize: 11, color: T2, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Quitar
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ width: '100%' }}>

        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Planificador</Typography>
            <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Organiza tu semana, día a día</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25, bgcolor: '#F3F4F6', border: `1px solid ${BORDER}`, borderRadius: '10px', p: 0.375, flexShrink: 0 }}>
            {[['lista', 'Lista'], ['semana', 'Semana'], ['mes', 'Mes']].map(([id, label]) => (
              <Box key={id} component="button" onClick={() => setView(id)} sx={{
                px: 1.25, py: 0.625, borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                bgcolor: viewMode === id ? CARD : 'transparent', color: viewMode === id ? T1 : T2,
                boxShadow: viewMode === id ? CARD_SH : 'none',
              }}>{label}</Box>
            ))}
          </Box>
        </Box>

        {/* Barra de progreso — de hoy en la lista, de la semana visible en
            semana; en mes no se muestra (la grilla ya tiene su propio
            mini-progreso por día). */}
        {viewMode !== 'mes' && (
          <Box sx={{ px: 3, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {viewMode === 'lista' ? 'Progreso de hoy' : 'Progreso de la semana'}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: T2 }}>
                {viewMode === 'lista'
                  ? (todayTaskTotal ? `${todayTaskDone}/${todayTaskTotal} · ${todayTaskPct}%` : 'Sin tareas')
                  : (weekTaskTotal ? `${weekTaskDone}/${weekTaskTotal} · ${weekTaskPct}%` : 'Sin tareas')}
              </Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#EDEEF0', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${viewMode === 'lista' ? todayTaskPct : weekTaskPct}%`, bgcolor: GREEN, transition: 'width 0.2s' }} />
            </Box>
          </Box>
        )}

        {viewMode === 'semana' && (
          <>
            {/* Pills de días de la semana */}
            <Box sx={{ px: 3, mb: 2, display: 'flex', gap: 0.75 }}>
              {weekDays.map((d, i) => {
                const key = toKey(d)
                const dayTasks = tasks[key] || []
                const allDone = dayTasks.length > 0 && dayTasks.every(t => t.done)
                const isToday = key === today
                return (
                  <Box key={key} sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    bgcolor: isToday ? GREEN : allDone ? alpha(GREEN, 0.15) : '#F3F4F6',
                    color: isToday ? '#fff' : allDone ? GREEN : T2,
                    border: isToday ? 'none' : `1px solid ${BORDER}`,
                  }}>{DIA_LETRAS[i]}</Box>
                )
              })}
            </Box>

            <Box sx={{ px: 3, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box component="button" onClick={() => setWeekAnchor(addDays(weekStart, -7))}
                sx={{ width: 32, height: 32, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 14 }}>←</Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>{weekLabel}</Typography>
                {!onCurrentWeek && (
                  <Box component="button" onClick={() => setWeekAnchor(new Date())} sx={{
                    fontSize: 10.5, color: GREEN, background: 'none', border: 'none', textDecoration: 'underline',
                    cursor: 'pointer', fontFamily: 'inherit', mt: 0.125,
                  }}>Volver a hoy</Box>
                )}
              </Box>
              <Box component="button" onClick={() => setWeekAnchor(addDays(weekStart, 7))}
                sx={{ width: 32, height: 32, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 14 }}>→</Box>
            </Box>
          </>
        )}

        {viewMode === 'mes' && (
          <Box sx={{ px: 3, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box component="button" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
              sx={{ width: 32, height: 32, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 14 }}>←</Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, textTransform: 'capitalize' }}>{monthLabel}</Typography>
              <Box component="button" onClick={() => setMonthAnchor(new Date())} sx={{
                fontSize: 10.5, color: GREEN, background: 'none', border: 'none', textDecoration: 'underline',
                cursor: 'pointer', fontFamily: 'inherit', mt: 0.125,
              }}>Ir a hoy</Box>
            </Box>
            <Box component="button" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
              sx={{ width: 32, height: 32, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 14 }}>→</Box>
          </Box>
        )}

        <Box sx={{ px: 3, pb: 2 }}>
          {connected === null || connecting ? (
            <Box sx={{ bgcolor: alpha(BLUE, 0.06), border: `1px solid ${alpha(BLUE, 0.2)}`, borderRadius: '10px', px: 1.5, py: 1 }}>
              <Typography sx={{ fontSize: 11.5, color: BLUE }}>{connecting ? 'Conectando con Google...' : 'Cargando...'}</Typography>
            </Box>
          ) : connected ? (
            <Box sx={{ bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.2)}`, borderRadius: '10px', px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 14 }}>✓</Typography>
              <Typography sx={{ fontSize: 11.5, color: GREEN, flex: 1 }}>
                Conectado a Google Calendar{syncing ? ' · sincronizando...' : ''}
              </Typography>
              <Box component="button" onClick={disconnectGoogle} sx={{ fontSize: 11, color: T2, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
                Desconectar
              </Box>
            </Box>
          ) : (
            <Box onClick={connectGoogle} sx={{ bgcolor: alpha(BLUE, 0.06), border: `1px solid ${alpha(BLUE, 0.2)}`, borderRadius: '10px', px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
              <Typography sx={{ fontSize: 14 }}>🔗</Typography>
              <Typography sx={{ fontSize: 11.5, color: BLUE, fontWeight: 600 }}>Conectar Google Calendar</Typography>
            </Box>
          )}
        </Box>

        {/* Filtros — qué mostrar en la semana */}
        <Box sx={{ px: 3, mb: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {FILTER_CHIPS.filter(f => !f.requiresConnected || connected).map(f => {
            const active = filters[f.key]
            return (
              <Box key={f.key} onClick={() => toggleFilter(f.key)} sx={{
                px: 1.25, py: 0.5, borderRadius: '20px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: '1px solid', borderColor: active ? f.color : BORDER,
                bgcolor: active ? alpha(f.color, 0.1) : CARD, color: active ? f.color : T2,
                transition: 'all 0.12s',
              }}>{f.label}</Box>
            )
          })}
          <Box onClick={() => setFijasOpen(true)} sx={{
            px: 1.25, py: 0.5, borderRadius: '20px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1px solid ${alpha(AMBER, 0.35)}`, bgcolor: alpha(AMBER, 0.08), color: AMBER,
          }}>📌 Tareas fijas{tareasFijas.length > 0 ? ` (${tareasFijas.length})` : ''}</Box>
        </Box>
      </Box>

      {/* Vista Lista — estilo Todoist: una sola columna agrupada por fecha,
          sin el ruido visual de columnas/tarjetas por día. Vista principal. */}
      {viewMode === 'lista' && (
        <Box sx={{ px: 3, pb: 14, maxWidth: 640 }}>
          {listaGroups.overdue.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Box onClick={() => setOverdueOpen(v => !v)} sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 0.5, cursor: 'pointer',
                borderBottom: `1px solid ${BORDER}`,
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#DC2626', flex: 1 }}>Vencidas</Typography>
                <Typography sx={{ fontSize: 11.5, color: T2 }}>{overdueCount} tarea{overdueCount === 1 ? '' : 's'}</Typography>
                <Typography sx={{ fontSize: 10, color: T2, transform: overdueOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</Typography>
              </Box>
              {overdueOpen && (
                <Box sx={{ pt: 1.25 }}>
                  {Object.entries(overdueByMonth).map(([mk, keys]) => (
                    <Box key={mk} sx={{ mb: 1.5 }}>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75 }}>
                        {monthLabelFor(mk)}
                      </Typography>
                      {keys.map(k => renderDaySection(k, { accent: '#DC2626' }))}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {renderDaySection(today)}
          {renderDaySection(tomorrowKey)}

          {Object.entries(restByMonth).map(([mk, keys]) => {
            const totalTasks = keys.reduce((s, k) => s + (tasks[k] || []).length, 0)
            const doneTasks  = keys.reduce((s, k) => s + (tasks[k] || []).filter(t => t.done).length, 0)
            const open = isMonthOpen(mk)
            return (
              <Box key={mk} sx={{ mb: 1.5 }}>
                <Box onClick={() => toggleMonth(mk)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 0.5, cursor: 'pointer',
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, flex: 1 }}>{monthLabelFor(mk)}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: T2 }}>{totalTasks ? `${doneTasks}/${totalTasks}` : 'Sin tareas'}</Typography>
                  <Typography sx={{ fontSize: 10, color: T2, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</Typography>
                </Box>
                {open && <Box sx={{ pt: 1.25 }}>{keys.map(k => renderDaySection(k))}</Box>}
              </Box>
            )
          })}
        </Box>
      )}

      {/* Días lado a lado, de izquierda a derecha — scrollea horizontal */}
      {viewMode === 'semana' && (
      <Box sx={{
        width: '100%', px: 3, pb: 10,
        display: 'flex', alignItems: 'flex-start', gap: 1.5, overflowX: 'auto',
        scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch',
      }}>
        {weekDays.map((d, i) => {
          const key = toKey(d)
          const isToday = key === today
          // Las tareas fijas siempre arriba, el resto en el orden en que se agregaron.
          const dayTasks = filters.tareas
            ? [...(tasks[key] || [])].sort((a, b) => (b.fijaId ? 1 : 0) - (a.fijaId ? 1 : 0))
            : []
          const dayGoogleEvents = (googleEvents[key] || []).filter(ev => filters[ev.source] !== false)
          const total = dayTasks.length
          const doneCount = dayTasks.filter(t => t.done).length
          const pct = total ? Math.round(doneCount / total * 100) : 0
          const confirmingClear = clearConfirmKey === key
          const isDragOver = dragOverKey === key
          return (
            <Box key={key}
              onDragOver={evt => handleDayDragOver(evt, key)}
              onDragLeave={() => setDragOverKey(prev => (prev === key ? null : prev))}
              onDrop={evt => handleDayDrop(evt, key)}
              sx={{
                width: COL_WIDTH, flexShrink: 0, scrollSnapAlign: 'start',
                bgcolor: CARD, borderRadius: '14px', boxShadow: CARD_SH,
                border: `1.5px ${isDragOver ? 'dashed' : 'solid'} ${isDragOver ? GREEN : isToday ? alpha(GREEN, 0.35) : BORDER}`,
                outline: isDragOver ? `3px solid ${alpha(GREEN, 0.12)}` : 'none',
                overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color .1s',
              }}>
              <Box sx={{ px: 2, py: 1.25, bgcolor: isToday ? alpha(GREEN, 0.06) : HEADER, borderBottom: `1px solid ${BORDER}` }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: isToday ? GREEN : T1 }}>{DIAS[i]}</Typography>
                  <Typography sx={{ fontSize: 11, color: T2 }}>{d.getDate()}</Typography>
                  {isToday && <Typography sx={{ fontSize: 9, fontWeight: 700, color: GREEN, ml: 'auto' }}>HOY</Typography>}
                  {total > 0 && <Typography sx={{ fontSize: 11, color: T2, ml: isToday ? 1 : 'auto' }}>{doneCount}/{total}</Typography>}
                  {confirmingClear ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Box component="button" onClick={() => clearDay(key)} sx={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Sí, borrar</Box>
                      <Box component="button" onClick={() => setClearConfirmKey(null)} sx={{ fontSize: 10, color: T2, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</Box>
                    </Box>
                  ) : total > 0 ? (
                    <Box onClick={() => setClearConfirmKey(key)} title="Borrar tareas del día" sx={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, opacity: 0.6, '&:hover': { opacity: 1, color: '#DC2626' } }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </Box>
                  ) : null}
                </Box>
                {total > 0 && (
                  <Box sx={{ mt: 0.75, height: 3, borderRadius: 2, bgcolor: '#EDEEF0', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: GREEN, transition: 'width 0.2s' }} />
                  </Box>
                )}
              </Box>

              <Box sx={{ p: 1.5, flex: 1 }}>
                {dayGoogleEvents.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                    {dayGoogleEvents.map(ev => {
                      const c = ev.source === 'vektor' ? '#F97316' : BLUE
                      return (
                        <Box key={ev.id} component="a" href={ev.htmlLink} target="_blank" rel="noreferrer" sx={{
                          display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none',
                          bgcolor: alpha(c, 0.06), border: `1px solid ${alpha(c, 0.18)}`, borderRadius: '8px', px: 1, py: 0.625,
                        }}>
                          <Typography sx={{ fontSize: 11 }}>{ev.source === 'vektor' ? '🏋️' : '🔗'}</Typography>
                          <Typography sx={{ flex: 1, fontSize: 12.5, color: c, fontWeight: 500 }}>{ev.title}</Typography>
                          {!ev.allDay && (
                            <Typography sx={{ fontSize: 10.5, color: c, opacity: 0.8 }}>
                              {new Date(ev.start).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                            </Typography>
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                )}

                {dayTasks.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: T2, opacity: 0.7, py: 0.5 }}>Sin tareas</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                    {dayTasks.map(t => (
                      <Box key={t.id}
                        draggable
                        onDragStart={evt => handleTaskDragStart(evt, key, t.id)}
                        onDragEnd={() => { setDraggedTask(null); setDragOverKey(null) }}
                        sx={{
                          cursor: 'grab', opacity: draggedTask?.taskId === t.id ? 0.4 : 1,
                          ...(t.fijaId ? {
                            borderLeft: `3px solid ${AMBER}`, bgcolor: alpha(AMBER, 0.05),
                            borderRadius: '6px', pl: 0.75, ml: -0.75,
                          } : {}),
                        }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box onClick={() => toggleTask(key, t.id)} sx={{
                            width: 18, height: 18, borderRadius: '5px', flexShrink: 0, cursor: 'pointer',
                            border: `1.5px solid ${t.done ? GREEN : BORDER}`, bgcolor: t.done ? GREEN : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </Box>
                          <Typography sx={{ flex: 1, fontSize: 13, color: t.done ? T2 : T1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</Typography>
                          {t.google_event_id && <Typography sx={{ fontSize: 10, color: BLUE, opacity: 0.6 }}>🔗</Typography>}
                          {t.notion_page_id && <Typography sx={{ fontSize: 10, opacity: 0.6 }}>📝</Typography>}
                          <Box onClick={() => setRemindingId(remindingId === t.id ? null : t.id)} sx={{
                            display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', flexShrink: 0,
                            color: t.remind_at ? AMBER : T2, opacity: t.remind_at ? 1 : 0.55,
                          }}>
                            <Typography sx={{ fontSize: 11 }}>⏰</Typography>
                            {t.remind_at && (
                              <Typography sx={{ fontSize: 10, fontWeight: 600 }}>
                                {new Date(t.remind_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })}
                              </Typography>
                            )}
                          </Box>
                          <Box onClick={() => deleteTask(key, t.id)} sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, fontSize: 14, flexShrink: 0 }}>×</Box>
                        </Box>
                        {remindingId === t.id && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, pl: 3.5 }}>
                            <Box component="input" type="time" defaultValue={t.remind_at ? new Date(t.remind_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }) : ''}
                              onChange={e => handleReminderTime(key, t, e.target.value)}
                              disabled={pushBusy}
                              sx={{ border: `1px solid ${BORDER}`, borderRadius: '6px', px: 1, py: 0.375, fontSize: 12, fontFamily: 'inherit', color: T1, outline: 'none', bgcolor: '#fff' }} />
                            {t.remind_at && (
                              <Box component="button" onClick={() => handleReminderTime(key, t, '')}
                                sx={{ fontSize: 11, color: T2, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Quitar
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <Box component="input" value={inputs[key] || ''} onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTask(key)}
                    placeholder="Nueva tarea..."
                    sx={{ flex: 1, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.25, py: 0.75, fontSize: 12.5, fontFamily: 'inherit', color: T1, outline: 'none', bgcolor: '#fff', '&:focus': { borderColor: GREEN } }} />
                  <Box component="button" onClick={() => addTask(key)} sx={{ px: 1.5, borderRadius: '8px', border: 'none', bgcolor: '#F3F4F6', color: T1, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+</Box>
                </Box>
              </Box>
            </Box>
          )
        })}
      </Box>
      )}

      {/* Vista mensual — grilla tipo calendario con mini-progreso por día;
          arrastrar una tarea a otra celda la reprograma igual que en semana.
          Click en una celda abre el día completo (mismas acciones que en la
          columna semanal) en un panel inferior. */}
      {viewMode === 'mes' && (
        <Box sx={{ px: 3, pb: 10 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', mb: '4px' }}>
            {DIA_LETRAS.map(l => (
              <Typography key={l} sx={{ fontSize: 10, fontWeight: 700, color: T2, textAlign: 'center', textTransform: 'uppercase' }}>{l}</Typography>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {monthGrid.map(({ date: d, out }) => {
              const key = toKey(d)
              const isToday = key === today
              const dayTasks = tasks[key] || []
              const total = dayTasks.length
              const doneCount = dayTasks.filter(t => t.done).length
              const isDragOver = dragOverKey === key
              const VISIBLE = 2
              return (
                <Box key={key}
                  onClick={() => setMonthDayOpen(key)}
                  onDragOver={evt => handleDayDragOver(evt, key)}
                  onDragLeave={() => setDragOverKey(prev => (prev === key ? null : prev))}
                  onDrop={evt => handleDayDrop(evt, key)}
                  sx={{
                    minHeight: 84, borderRadius: '10px', p: '6px', cursor: 'pointer',
                    bgcolor: out ? '#FAFAFA' : isDragOver ? alpha(GREEN, 0.08) : CARD,
                    border: `1.5px ${isDragOver ? 'dashed' : 'solid'} ${isDragOver ? GREEN : isToday ? alpha(GREEN, 0.4) : BORDER}`,
                    opacity: out ? 0.5 : 1, display: 'flex', flexDirection: 'column', gap: '3px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? GREEN : T1 }}>{d.getDate()}</Typography>
                    {total > 0 && <Typography sx={{ fontSize: 9.5, color: T2 }}>{doneCount}/{total}</Typography>}
                  </Box>
                  {total > 0 && (
                    <Box sx={{ height: 2.5, borderRadius: 2, bgcolor: '#EDEEF0', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${Math.round(doneCount / total * 100)}%`, bgcolor: GREEN }} />
                    </Box>
                  )}
                  {dayTasks.slice(0, VISIBLE).map(t => (
                    <Box key={t.id}
                      draggable
                      onDragStart={evt => { evt.stopPropagation(); handleTaskDragStart(evt, key, t.id) }}
                      onDragEnd={() => { setDraggedTask(null); setDragOverKey(null) }}
                      onClick={evt => { evt.stopPropagation(); toggleTask(key, t.id) }}
                      title={t.text}
                      sx={{
                        fontSize: 9.5, color: t.done ? T2 : T1, textDecoration: t.done ? 'line-through' : 'none',
                        bgcolor: t.fijaId ? alpha(AMBER, 0.1) : '#F3F4F6', borderRadius: '4px', px: '4px', py: '1px',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'grab',
                        opacity: draggedTask?.taskId === t.id ? 0.4 : 1,
                      }}
                    >{t.text}</Box>
                  ))}
                  {total > VISIBLE && <Typography sx={{ fontSize: 9, color: T2, textAlign: 'center' }}>+{total - VISIBLE} más</Typography>}
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {/* Sheet: día completo desde la vista mensual — mismas acciones que la
          columna de la vista semanal (agregar, completar, recordatorio, borrar) */}
      {monthDayOpen && (() => {
        const key = monthDayOpen
        const dayTasks = filters.tareas
          ? [...(tasks[key] || [])].sort((a, b) => (b.fijaId ? 1 : 0) - (a.fijaId ? 1 : 0))
          : []
        const dayGoogleEvents = (googleEvents[key] || []).filter(ev => filters[ev.source] !== false)
        const total = dayTasks.length
        const doneCount = dayTasks.filter(t => t.done).length
        const pct = total ? Math.round(doneCount / total * 100) : 0
        const isToday = key === today
        const confirmingClear = clearConfirmKey === key
        return (
          <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setMonthDayOpen(null)}>
            <Box onClick={e => e.stopPropagation()} sx={{
              bgcolor: BG, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto',
              borderRadius: '20px 20px 0 0', p: 2.5, pb: 4,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: isToday ? GREEN : T1 }}>
                    {monthDayData?.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Typography>
                  {total > 0 && <Typography sx={{ fontSize: 12, color: T2, mt: 0.25 }}>{doneCount}/{total} completadas</Typography>}
                </Box>
                <Box component="button" onClick={() => setMonthDayOpen(null)} sx={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 13 }}>✕</Box>
              </Box>
              {total > 0 && (
                <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#EDEEF0', overflow: 'hidden', mb: 1.5 }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: GREEN, transition: 'width 0.2s' }} />
                </Box>
              )}

              {dayGoogleEvents.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                  {dayGoogleEvents.map(ev => {
                    const c = ev.source === 'vektor' ? '#F97316' : BLUE
                    return (
                      <Box key={ev.id} component="a" href={ev.htmlLink} target="_blank" rel="noreferrer" sx={{
                        display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none',
                        bgcolor: alpha(c, 0.06), border: `1px solid ${alpha(c, 0.18)}`, borderRadius: '8px', px: 1, py: 0.625,
                      }}>
                        <Typography sx={{ fontSize: 11 }}>{ev.source === 'vektor' ? '🏋️' : '🔗'}</Typography>
                        <Typography sx={{ flex: 1, fontSize: 12.5, color: c, fontWeight: 500 }}>{ev.title}</Typography>
                        {!ev.allDay && (
                          <Typography sx={{ fontSize: 10.5, color: c, opacity: 0.8 }}>
                            {new Date(ev.start).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                          </Typography>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )}

              {dayTasks.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: T2, opacity: 0.7, py: 0.5, mb: 1 }}>Sin tareas</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                  {dayTasks.map(t => (
                    <Box key={t.id} sx={t.fijaId ? {
                      borderLeft: `3px solid ${AMBER}`, bgcolor: alpha(AMBER, 0.05),
                      borderRadius: '6px', pl: 0.75, ml: -0.75,
                    } : undefined}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box onClick={() => toggleTask(key, t.id)} sx={{
                          width: 18, height: 18, borderRadius: '5px', flexShrink: 0, cursor: 'pointer',
                          border: `1.5px solid ${t.done ? GREEN : BORDER}`, bgcolor: t.done ? GREEN : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </Box>
                        <Typography sx={{ flex: 1, fontSize: 13, color: t.done ? T2 : T1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</Typography>
                        {t.google_event_id && <Typography sx={{ fontSize: 10, color: BLUE, opacity: 0.6 }}>🔗</Typography>}
                        {t.notion_page_id && <Typography sx={{ fontSize: 10, opacity: 0.6 }}>📝</Typography>}
                        <Box onClick={() => deleteTask(key, t.id)} sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, fontSize: 14, flexShrink: 0 }}>×</Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 0.75, mb: total > 0 ? 1.5 : 0 }}>
                <Box component="input" value={inputs[key] || ''} onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTask(key)}
                  placeholder="Nueva tarea..."
                  sx={{ flex: 1, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.25, py: 0.75, fontSize: 12.5, fontFamily: 'inherit', color: T1, outline: 'none', bgcolor: '#fff', '&:focus': { borderColor: GREEN } }} />
                <Box component="button" onClick={() => addTask(key)} sx={{ px: 1.5, borderRadius: '8px', border: 'none', bgcolor: '#F3F4F6', color: T1, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+</Box>
              </Box>

              {total > 0 && (
                confirmingClear ? (
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Box component="button" onClick={() => clearDay(key)} sx={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Sí, borrar todo</Box>
                    <Box component="button" onClick={() => setClearConfirmKey(null)} sx={{ fontSize: 11, color: T2, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</Box>
                  </Box>
                ) : (
                  <Box component="button" onClick={() => setClearConfirmKey(key)} sx={{ fontSize: 11, color: T2, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Borrar tareas del día</Box>
                )
              )}
            </Box>
          </Box>
        )
      })()}

      {/* Quick add flotante — estilo Todoist: tocás el +, escribís algo como
          "Pagar arriendo mañana" y la fecha se detecta sola (ver
          parseQuickAdd). El "+" de cada sección de la lista abre lo mismo
          pero con la fecha fija a esa sección. */}
      {quickAdd && (
        <Box onClick={closeQuickAdd} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.25)', zIndex: 45 }} />
      )}
      {quickAdd ? (
        <Box sx={{ position: 'fixed', left: 16, right: 16, top: '22%', zIndex: 46, maxWidth: 480, mx: 'auto' }}>
          <Box onClick={e => e.stopPropagation()} sx={{
            bgcolor: CARD, borderRadius: '16px', boxShadow: '0 12px 32px rgba(0,0,0,0.22)', border: `1px solid ${BORDER}`, p: 2,
          }}>
            <Box component="input"
              ref={quickAddInputRef}
              value={quickAddText}
              onChange={e => handleQuickAddTextChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitQuickAdd(); if (e.key === 'Escape') closeQuickAdd() }}
              placeholder="Ej: Pagar arriendo mañana"
              autoFocus
              sx={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', color: T1, py: 0.5 }} />

            {/* Puntual (fecha explícita) vs fija (se repite cada semana) */}
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1.25, mb: 1 }}>
              <Box onClick={() => setQuickAddEsFija(false)} sx={{
                px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: '1px solid', borderColor: !quickAddEsFija ? GREEN : BORDER,
                bgcolor: !quickAddEsFija ? alpha(GREEN, 0.1) : 'transparent', color: !quickAddEsFija ? GREEN : T2,
              }}>📅 Un día</Box>
              <Box onClick={() => setQuickAddEsFija(true)} sx={{
                px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: '1px solid', borderColor: quickAddEsFija ? AMBER : BORDER,
                bgcolor: quickAddEsFija ? alpha(AMBER, 0.1) : 'transparent', color: quickAddEsFija ? AMBER : T2,
              }}>🔁 Cada semana</Box>
            </Box>

            {quickAddEsFija ? (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25 }}>
                {DIAS.map((label, i) => (
                  <Box key={label} onClick={() => setQuickAddFijaDia(DIA_GETDAY[i])} sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: '1px solid', borderColor: quickAddFijaDia === DIA_GETDAY[i] ? AMBER : BORDER,
                    bgcolor: quickAddFijaDia === DIA_GETDAY[i] ? AMBER : 'transparent',
                    color: quickAddFijaDia === DIA_GETDAY[i] ? '#fff' : T2,
                  }}>{DIA_LETRAS[i]}</Box>
                ))}
              </Box>
            ) : (
              <Box component="input" type="date" value={quickAddDate}
                onChange={e => { setQuickAddDate(e.target.value); setQuickAddDateTouched(true) }}
                sx={{ mb: 1.25, border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.25, py: 0.625, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', bgcolor: '#fff' }} />
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Box component="button" onClick={closeQuickAdd} sx={{ px: 1.25, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</Box>
                <Box component="button" onClick={submitQuickAdd} sx={{ px: 1.5, py: 0.625, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Agregar</Box>
              </Box>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box component="button" onClick={() => openQuickAdd(null)} sx={{
          position: 'fixed', right: 16, bottom: 150, zIndex: 25,
          width: 56, height: 56, borderRadius: '50%', border: 'none', bgcolor: GREEN, color: '#fff',
          fontSize: 28, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,167,111,0.4)',
        }}>+</Box>
      )}

      {/* Pomodoro flotante */}
      <Box sx={{ position: 'fixed', right: 16, bottom: 88, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        {pomodoroOpen && (
          <Box sx={{ bgcolor: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', p: 2, width: 200 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: T1, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtClock(pomodoroSeconds)}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 1, mb: 1.25 }}>
              {POMODORO_PRESETS.map(m => (
                <Box key={m} component="button" onClick={() => startPomodoro(m)} sx={{
                  px: 1, py: 0.375, borderRadius: '6px', border: `1px solid ${BORDER}`, bgcolor: 'transparent',
                  color: T2, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}>{m}m</Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Box component="button" onClick={() => setPomodoroRunning(r => !r)} sx={{
                flex: 1, py: 0.75, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff',
                fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              }}>{pomodoroRunning ? 'Pausar' : 'Iniciar'}</Box>
              <Box component="button" onClick={() => { setPomodoroRunning(false); setPomodoroSeconds(25 * 60) }} sx={{
                px: 1.25, py: 0.75, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent',
                color: T2, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              }}>↺</Box>
            </Box>
          </Box>
        )}
        <Box component="button" onClick={() => setPomodoroOpen(v => !v)} sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, px: 1.75, py: 1.125, borderRadius: '999px',
          border: 'none', bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,167,111,0.35)',
        }}>
          ⏳ {pomodoroRunning ? fmtClock(pomodoroSeconds) : 'Pomodoro'}
        </Box>
      </Box>

      {/* Sheet: tareas fijas semanales */}
      {fijasOpen && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setFijasOpen(false)}>
          <Box onClick={e => e.stopPropagation()} sx={{
            bgcolor: BG, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto',
            borderRadius: '20px 20px 0 0', p: 3, pb: 4,
          }}>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: T1, mb: 0.5 }}>📌 Tareas fijas de la semana</Typography>
            <Typography sx={{ fontSize: 12.5, color: T2, mb: 2 }}>Se agregan solas cada semana en el día que elijas y se sincronizan a tu Google Calendar y Notion — tachalas cuando las hagas, y vuelven frescas la próxima semana.</Typography>

            <Box sx={{ bgcolor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}`, p: 1.5, mb: 2.5 }}>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                {DIAS.map((label, i) => (
                  <Box key={label} onClick={() => setNuevaFijaDia(DIA_GETDAY[i])} sx={{
                    px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border: '1px solid', borderColor: nuevaFijaDia === DIA_GETDAY[i] ? AMBER : BORDER,
                    bgcolor: nuevaFijaDia === DIA_GETDAY[i] ? alpha(AMBER, 0.1) : 'transparent',
                    color: nuevaFijaDia === DIA_GETDAY[i] ? AMBER : T2,
                  }}>{DIA_LETRAS[i]}</Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Box component="input" value={nuevaFijaTexto} onChange={e => setNuevaFijaTexto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && crearFija()}
                  placeholder={`Nueva tarea fija para ${DIAS[DIA_GETDAY.indexOf(nuevaFijaDia)]}...`}
                  sx={{ flex: 1, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.25, py: 0.75, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: AMBER } }} />
                <Box component="button" onClick={crearFija} sx={{ px: 1.75, borderRadius: '8px', border: 'none', bgcolor: AMBER, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Agregar</Box>
              </Box>
            </Box>

            {tareasFijas.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: T2, textAlign: 'center', py: 3 }}>Todavía no tenés tareas fijas</Typography>
            ) : (
              DIAS.map((label, i) => {
                const dow = DIA_GETDAY[i]
                const items = tareasFijas.filter(f => f.dia === dow)
                if (!items.length) return null
                return (
                  <Box key={label} sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>{label}</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {items.map(f => (
                        <Box key={f.id} sx={{ bgcolor: CARD, borderRadius: '8px', border: `1px solid ${BORDER}`, px: 1.25, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ flex: 1, fontSize: 13, color: T1 }}>{f.texto}</Typography>
                          <Box onClick={() => borrarFija(f.id)} sx={{ cursor: 'pointer', color: T2, fontSize: 16, '&:hover': { color: '#DC2626' } }}>×</Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
