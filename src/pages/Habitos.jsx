import { useState, useMemo, useEffect } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import HabitoItem        from 'src/components/habitos/HabitoItem'
import EstadisticasHabito from 'src/components/habitos/EstadisticasHabito'
import CrearHabito       from 'src/components/habitos/CrearHabito'
import { refreshBadge }  from 'src/utils/notifications'
import { useSyncedState } from 'src/utils/cloudSync'

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'
const WEEK_COLORS = ['#00A76F', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899']

// ── Persistencia ──────────────────────────────────────────────
function toKey(d) { return d.toLocaleDateString('en-CA') }

// ── Hábitos financieros por defecto ───────────────────────────
const DEFAULT_HABITOS = [
  { id: 'fin1', nombre: 'Aporte Hapi $50',         emoji: '💰', categoria: 'Finanzas',      frecuencia: 'diario',      color: '#60a5fa', activo: true, linkApp: '/finanzas/inversiones', memo: 'VOO $17.50 · SCHD $10 · VIGI $5' },
  { id: 'fin2', nombre: 'Revisar presupuesto',      emoji: '📊', categoria: 'Finanzas',      frecuencia: { dias: [1] }, color: '#4ade80', activo: true, linkApp: '/finanzas/presupuesto' },
  { id: 'fin3', nombre: 'Registrar gastos del día', emoji: '✏️', categoria: 'Finanzas',      frecuencia: 'diario',      color: '#fbbf24', activo: true, linkApp: '/finanzas/registro' },
]

// ── XP / Niveles ──────────────────────────────────────────────
const XP_PER_HABIT = 10
const XP_DAY_BONUS = 25
const XP_THRESH    = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000]
const LEVEL_NAMES  = ['Principiante','Constante','Disciplinado','Dedicado','Experto','Maestro','Leyenda','Élite','Mítico']

function getLevelInfo(xp) {
  let lvl = 0
  for (let i = XP_THRESH.length - 1; i >= 0; i--) { if (xp >= XP_THRESH[i]) { lvl = i; break } }
  const cur  = XP_THRESH[lvl]  || 0
  const next = XP_THRESH[lvl + 1] || cur + 500
  const pct  = Math.min((xp - cur) / (next - cur), 1)
  return { level: lvl + 1, name: LEVEL_NAMES[lvl], xp, cur, next, pct, toNext: next - xp }
}

// ── Racha por hábito ────────────────────────────────────────────
function getStreak(done, habitId) {
  let streak = 0
  const d = new Date()
  if (!(done[toKey(d)] || []).includes(habitId)) d.setDate(d.getDate() - 1)
  while (streak < 730) {
    if ((done[toKey(d)] || []).includes(habitId)) { streak++; d.setDate(d.getDate() - 1) }
    else break
  }
  return streak
}

function missedYesterday(done, habitId) {
  const y = new Date(); y.setDate(y.getDate() - 1)
  return !(done[toKey(y)] || []).includes(habitId)
}

function appliesToday(habito) {
  return habito.activo !== false
}

// ¿Aplica este hábito en esta fecha puntual? (para la tabla mensual)
function appliesOnDate(habito, date) {
  if (habito.activo === false) return false
  const f = habito.frecuencia
  if (!f || f === 'diario') return true
  if (f.dias) return f.dias.includes(date.getDay())
  return true // 'vecesXSemana': meta semanal, se puede marcar cualquier día
}

// Meta del hábito para un mes completo
function metaDelMes(habito, year, month) {
  const dim = new Date(year, month + 1, 0).getDate()
  const f = habito.frecuencia
  if (!f || f === 'diario') return dim
  if (f.dias) {
    let count = 0
    for (let d = 1; d <= dim; d++) { if (f.dias.includes(new Date(year, month, d).getDay())) count++ }
    return count
  }
  if (f.vecesXSemana) return Math.round(dim / 7 * f.vecesXSemana)
  return dim
}

// Racha global: días consecutivos con el 100% de los hábitos de ese día completados
function getGlobalStreak(habitos, done) {
  function dayComplete(dateKey, date) {
    const activos = habitos.filter(h => appliesOnDate(h, date))
    if (activos.length === 0) return false
    const doneSet = new Set(done[dateKey] || [])
    return activos.every(h => doneSet.has(h.id))
  }
  let streak = 0
  const d = new Date()
  if (!dayComplete(toKey(d), d)) d.setDate(d.getDate() - 1)
  while (streak < 730) {
    if (dayComplete(toKey(d), d)) { streak++; d.setDate(d.getDate() - 1) }
    else break
  }
  return streak
}

function weekChunks(daysInMonth) {
  const chunks = []
  for (let start = 1; start <= daysInMonth; start += 7) {
    chunks.push({ start, end: Math.min(start + 6, daysInMonth) })
  }
  return chunks
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIA_CORTO = ['dom','lun','mar','mié','jue','vie','sáb']

// ── Componente principal ──────────────────────────────────────
export default function Habitos() {
  const [habitos,  setHabitos]  = useSyncedState('hab_habitos', DEFAULT_HABITOS)
  const [done,     setDone]     = useSyncedState('hab_done', {})
  const [xp,       setXp]       = useSyncedState('hab_xp', 0)
  const [tiempos,  setTiempos]  = useSyncedState('hab_tiempos', {}) // { [dateKey]: { [habitId]: minutos } }
  const [view,     setView]     = useState('mensual')
  const [monthAnchor, setMonthAnchor] = useState(new Date())
  const [yearAnchor,  setYearAnchor]  = useState(new Date().getFullYear())
  const [manageOpen,  setManageOpen]  = useState(false)
  const [crearModal,  setCrearModal]  = useState(false)
  const [editHabito,  setEditHabito]  = useState(null)
  const [statsHabito, setStatsHabito] = useState(null)
  const [timerHabitId, setTimerHabitId] = useState(null)
  const [timerStartedAt, setTimerStartedAt] = useState(null)
  const [tick, setTick] = useState(0)

  // Refresca cada segundo mientras hay un temporizador corriendo, para que
  // el mm:ss se vea en vivo.
  useEffect(() => {
    if (!timerHabitId) return
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [timerHabitId])

  const today    = new Date()
  const todayKey = toKey(today)
  const activosHoy = useMemo(() => habitos.filter(appliesToday), [habitos])
  const doneHoy    = useMemo(() => new Set(done[todayKey] || []), [done, todayKey])
  const pct        = activosHoy.length > 0 ? doneHoy.size / activosHoy.length : 0
  const allDone    = activosHoy.length > 0 && doneHoy.size === activosHoy.length
  const lvl        = useMemo(() => getLevelInfo(xp), [xp])
  const racha      = useMemo(() => getGlobalStreak(habitos, done), [habitos, done])

  useEffect(() => { refreshBadge() }, [doneHoy.size])

  function toggleDone(habitId) {
    const current = done[todayKey] || []
    const wasDone = current.includes(habitId)
    const next    = wasDone ? current.filter(id => id !== habitId) : [...current, habitId]
    const newDone = { ...done, [todayKey]: next }
    setDone(newDone)

    let xpDelta = wasDone ? -XP_PER_HABIT : XP_PER_HABIT
    const newSize = next.length
    const wasAllDone = current.length === activosHoy.length
    const nowAllDone = newSize === activosHoy.length
    if (!wasDone && nowAllDone)  xpDelta += XP_DAY_BONUS
    if (wasDone  && wasAllDone)  xpDelta -= XP_DAY_BONUS
    const newXp = Math.max(0, xp + xpDelta)
    setXp(newXp)
  }

  // Toggle desde la tabla mensual — cualquier fecha, sin tocar XP.
  function toggleDoneOnDate(dateKey, habitId) {
    const current = done[dateKey] || []
    const next = current.includes(habitId) ? current.filter(id => id !== habitId) : [...current, habitId]
    const newDone = { ...done, [dateKey]: next }
    setDone(newDone)
  }

  function handleSave(data) {
    const next = editHabito
      ? habitos.map(h => h.id === editHabito.id ? { ...h, ...data } : h)
      : [...habitos, { id: `h_${Date.now()}`, ...data }]
    setHabitos(next)
    setCrearModal(false); setEditHabito(null)
  }

  function handleDelete(id) {
    const next = habitos.filter(h => h.id !== id)
    setHabitos(next)
    setCrearModal(false); setEditHabito(null); setStatsHabito(null)
  }

  function openEdit(h) { setEditHabito(h); setCrearModal(true); setStatsHabito(null) }
  function openStats(h) { setStatsHabito(h) }

  // ── Tiempo por hábito (temporizador + registro manual) ─────────
  function startTimer(habitId) {
    setTimerHabitId(habitId)
    setTimerStartedAt(Date.now())
  }

  function stopTimer() {
    if (!timerHabitId || !timerStartedAt) return
    const minutos = Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000))
    const actuales = tiempos[todayKey]?.[timerHabitId] || 0
    setTiempos(prev => ({ ...prev, [todayKey]: { ...(prev[todayKey] || {}), [timerHabitId]: actuales + minutos } }))
    setTimerHabitId(null)
    setTimerStartedAt(null)
  }

  function setTiempoManual(habitId, minutos) {
    setTiempos(prev => ({ ...prev, [todayKey]: { ...(prev[todayKey] || {}), [habitId]: minutos } }))
  }

  const timerElapsedSeg = timerStartedAt ? Math.floor((Date.now() - timerStartedAt) / 1000) : 0
  void tick // fuerza el re-render cada segundo mientras corre el timer

  const VIEWS = [['diario','Diario'],['mensual','Mensual'],['anual','Anual']]

  // ── Datos del mes (para el dashboard "Mensual") ────────────────
  const monthData = useMemo(() => {
    const year = monthAnchor.getFullYear(), month = monthAnchor.getMonth()
    const dim = new Date(year, month + 1, 0).getDate()
    let completados = 0, totalSlots = 0
    const chart = []
    const minutosPorHabito = {}
    for (let d = 1; d <= dim; d++) {
      const date = new Date(year, month, d)
      const dateKey = toKey(date)
      const doneSet = new Set(done[dateKey] || [])
      const aplican = habitos.filter(h => appliesOnDate(h, date))
      const doneCount = aplican.filter(h => doneSet.has(h.id)).length
      completados += doneCount
      totalSlots  += aplican.length
      chart.push({ dia: d, completados: doneCount })

      const tiemposDia = tiempos[dateKey] || {}
      for (const [habitId, min] of Object.entries(tiemposDia)) {
        minutosPorHabito[habitId] = (minutosPorHabito[habitId] || 0) + min
      }
    }
    const restantes = Math.max(0, totalSlots - completados)
    const pctMes = totalSlots > 0 ? Math.round(completados / totalSlots * 100) : 0
    return { year, month, dim, chart, completados, restantes, pctMes, minutosPorHabito }
  }, [monthAnchor, habitos, done, tiempos])

  const semanas = useMemo(() => weekChunks(monthData.dim), [monthData.dim])

  // ── Datos del año (para "Anual") ────────────────────────────────
  const yearData = useMemo(() => {
    return MESES.map((label, m) => {
      const dim = new Date(yearAnchor, m + 1, 0).getDate()
      let completados = 0, totalSlots = 0
      for (let d = 1; d <= dim; d++) {
        const date = new Date(yearAnchor, m, d)
        const dateKey = toKey(date)
        const doneSet = new Set(done[dateKey] || [])
        const aplican = habitos.filter(h => appliesOnDate(h, date))
        completados += aplican.filter(h => doneSet.has(h.id)).length
        totalSlots  += aplican.length
      }
      return { mes: label.slice(0, 3), pct: totalSlots > 0 ? Math.round(completados / totalSlots * 100) : 0 }
    })
  }, [yearAnchor, habitos, done])

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Panel de Hábitos</Typography>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75, px: 1.25, py: 0.5, borderRadius: '20px', bgcolor: alpha(GREEN, 0.1), border: `1px solid ${alpha(GREEN, 0.25)}` }}>
                <Typography sx={{ fontSize: 13 }}>🔥</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{racha} Racha diaria</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', bgcolor: '#EBEBEB', borderRadius: '10px', p: 0.375 }}>
                {VIEWS.map(([id, label]) => (
                  <Box key={id} onClick={() => setView(id)} sx={{
                    px: 1.5, py: 0.625, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                    bgcolor: view === id ? CARD : 'transparent',
                    boxShadow: view === id ? CARD_SH : 'none',
                  }}>
                    <Typography sx={{ fontSize: 13, fontWeight: view === id ? 700 : 500, color: view === id ? T1 : T2, lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
              <Box onClick={() => setManageOpen(true)} sx={{
                px: 1.5, py: 0.75, borderRadius: '10px', cursor: 'pointer', border: `1px solid ${alpha(GREEN, 0.4)}`,
                color: GREEN, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0,
                '&:active': { opacity: 0.75 },
              }}>
                <Typography sx={{ fontSize: 13 }}>✏️</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Hábitos</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ══ VISTA DIARIO ══ */}
        {view === 'diario' && (
          <Box sx={{ px: 3 }}>
            {activosHoy.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: T1, mb: 0.5 }}>Sin hábitos todavía</Typography>
                <Typography sx={{ fontSize: 13, color: T2 }}>Tocá "✏️ Hábitos" para crear el primero</Typography>
              </Box>
            ) : (
              <>
                {/* Progreso del día */}
                <Box sx={{ p: 2, mb: 2, borderRadius: '16px', bgcolor: CARD, border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
                  {allDone ? (
                    <Box sx={{ textAlign: 'center', py: 0.75 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: GREEN }}>Día perfecto</Typography>
                      <Typography sx={{ fontSize: 12, color: T2, mt: 0.25 }}>+{XP_DAY_BONUS} XP bonus ganados</Typography>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                        <Box>
                          <Typography sx={{ fontSize: 11, color: T2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </Typography>
                          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, mt: 0.25, color: T1 }}>
                            {doneHoy.size}
                            <Typography component="span" sx={{ fontSize: 16, fontWeight: 500, color: T2 }}> / {activosHoy.length}</Typography>
                          </Typography>
                        </Box>
                        <Box sx={{ position: 'relative', width: 56, height: 56 }}>
                          <svg width="56" height="56" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="22" fill="none" stroke="#F3F4F6" strokeWidth="5"/>
                            <circle cx="28" cy="28" r="22" fill="none" stroke={GREEN} strokeWidth="5"
                              strokeDasharray={`${2 * Math.PI * 22}`}
                              strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct)}`}
                              strokeLinecap="round"
                              style={{ transformOrigin: '28px 28px', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                          </svg>
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, color: T1 }}>{Math.round(pct * 100)}%</Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ height: 5, borderRadius: 3, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${pct * 100}%`, borderRadius: 3, bgcolor: GREEN, transition: 'width 0.5s ease' }} />
                      </Box>
                    </>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, pt: 1.25, borderTop: `1px solid ${BORDER}` }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.375, borderRadius: '8px', bgcolor: '#F3F4F6' }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: T1 }}>Nv.{lvl.level}</Typography>
                      <Typography sx={{ fontSize: 10, color: T2, fontWeight: 600 }}>{lvl.name}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 10, color: T2 }}>{xp} XP · {lvl.toNext} para Nv.{lvl.level + 1}</Typography>
                  </Box>
                </Box>

                {activosHoy.filter(h => !doneHoy.has(h.id)).length > 0 && (
                  <>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>
                      Por hacer · {activosHoy.filter(h => !doneHoy.has(h.id)).length}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
                      {activosHoy.filter(h => !doneHoy.has(h.id)).map(h => (
                        <HabitoItem key={h.id} habito={h} completado={false}
                          streak={getStreak(done, h.id)}
                          missedYesterday={getStreak(done, h.id) === 0 && missedYesterday(done, h.id)}
                          onToggle={() => toggleDone(h.id)} onDetails={() => openStats(h)}
                          minutosHoy={tiempos[todayKey]?.[h.id] || 0}
                          isTimerRunning={timerHabitId === h.id}
                          timerSeg={timerHabitId === h.id ? timerElapsedSeg : 0}
                          onStartTimer={() => startTimer(h.id)}
                          onStopTimer={stopTimer}
                          onSetMinutos={m => setTiempoManual(h.id, m)} />
                      ))}
                    </Box>
                  </>
                )}

                {activosHoy.filter(h => doneHoy.has(h.id)).length > 0 && (
                  <>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>
                      Completados · {doneHoy.size}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {activosHoy.filter(h => doneHoy.has(h.id)).map(h => (
                        <HabitoItem key={h.id} habito={h} completado={true}
                          streak={getStreak(done, h.id)} missedYesterday={false}
                          onToggle={() => toggleDone(h.id)} onDetails={() => openStats(h)}
                          minutosHoy={tiempos[todayKey]?.[h.id] || 0}
                          isTimerRunning={timerHabitId === h.id}
                          timerSeg={timerHabitId === h.id ? timerElapsedSeg : 0}
                          onStartTimer={() => startTimer(h.id)}
                          onStopTimer={stopTimer}
                          onSetMinutos={m => setTiempoManual(h.id, m)} />
                      ))}
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* ══ VISTA MENSUAL ══ */}
        {view === 'mensual' && (
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{MESES[monthData.month]} {monthData.year}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box component="button" onClick={() => setMonthAnchor(new Date(monthData.year, monthData.month - 1, 1))}
                  sx={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 12 }}>←</Box>
                <Box component="button" onClick={() => setMonthAnchor(new Date(monthData.year, monthData.month + 1, 1))}
                  sx={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 12 }}>→</Box>
              </Box>
            </Box>

            {habitos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: T1, mb: 0.5 }}>Sin hábitos todavía</Typography>
                <Typography sx={{ fontSize: 13, color: T2 }}>Tocá "✏️ Hábitos" para crear el primero</Typography>
              </Box>
            ) : (
              <>
                {/* Progreso del mes */}
                <Box sx={{ p: 2, mb: 2, borderRadius: '16px', bgcolor: CARD, border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T1, mb: 1 }}>Progreso del mes</Typography>
                  <Box sx={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthData.chart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="habitosFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={BORDER} />
                        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: T2 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: T2 }} axisLine={false} tickLine={false} width={24} />
                        <Tooltip formatter={v => [`${v} hábitos`, 'Completados']} labelFormatter={d => `Día ${d}`} />
                        <Area type="monotone" dataKey="completados" stroke={GREEN} strokeWidth={2} fill="url(#habitosFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
                    <Box sx={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r="20" fill="none" stroke="#F3F4F6" strokeWidth="6"/>
                        <circle cx="26" cy="26" r="20" fill="none" stroke={GREEN} strokeWidth="6"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeDashoffset={`${2 * Math.PI * 20 * (1 - monthData.pctMes / 100)}`}
                          strokeLinecap="round"
                          style={{ transformOrigin: '26px 26px', transform: 'rotate(-90deg)' }}
                        />
                      </svg>
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: T1 }}>{monthData.pctMes}%</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2.5 }}>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: T2 }}>Completados</Typography>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{monthData.completados}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: T2 }}>Restantes</Typography>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{monthData.restantes}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: T2 }}>Número de días</Typography>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{monthData.dim}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Hábitos diarios */}
                <Box sx={{ borderRadius: '16px', bgcolor: CARD, border: `1px solid ${BORDER}`, boxShadow: CARD_SH, overflow: 'hidden', mb: 2 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T1, px: 2, pt: 1.75 }}>Hábitos diarios</Typography>
                  <Box sx={{ overflowX: 'auto', px: 2, pb: 1.75, pt: 1 }}>
                    <Box sx={{ display: 'inline-block', minWidth: '100%' }}>
                      {/* Encabezado semanas */}
                      <Box sx={{ display: 'flex', gap: '2px', pl: '190px' }}>
                        {semanas.map((s, i) => (
                          <Box key={i} sx={{ display: 'flex', gap: '2px' }}>
                            {Array.from({ length: s.end - s.start + 1 }).map((_, j) => (
                              <Box key={j} sx={{ width: 26 }}>
                                {j === 0 && (
                                  <Typography sx={{ fontSize: 9, fontWeight: 700, color: WEEK_COLORS[i % WEEK_COLORS.length], textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                    Semana {i + 1}
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </Box>
                        ))}
                      </Box>
                      {/* Encabezado días */}
                      <Box sx={{ display: 'flex', gap: '2px', pl: '190px', mb: 0.5 }}>
                        {Array.from({ length: monthData.dim }).map((_, i) => {
                          const d = i + 1
                          const date = new Date(monthData.year, monthData.month, d)
                          const isToday = toKey(date) === todayKey
                          return (
                            <Box key={d} sx={{ width: 26, textAlign: 'center' }}>
                              <Typography sx={{ fontSize: 8, color: T2, lineHeight: 1.3 }}>{DIA_CORTO[date.getDay()]}</Typography>
                              <Typography sx={{ fontSize: 9, fontWeight: isToday ? 800 : 600, color: isToday ? GREEN : T1 }}>{d}</Typography>
                            </Box>
                          )
                        })}
                      </Box>
                      {/* Filas por hábito */}
                      {habitos.map(h => {
                        const meta = metaDelMes(h, monthData.year, monthData.month)
                        const minutosMes = monthData.minutosPorHabito[h.id] || 0
                        return (
                          <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: '2px', py: 0.5, borderTop: `1px solid ${BORDER}` }}>
                            <Box sx={{ width: 190, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.625, pr: 1 }}>
                              <Typography sx={{ fontSize: 14, flexShrink: 0 }}>{h.emoji}</Typography>
                              <Typography sx={{ fontSize: 12, fontWeight: 600, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{h.nombre}</Typography>
                              {minutosMes > 0 && (
                                <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#D97706', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                  ⏱{minutosMes >= 60 ? `${Math.floor(minutosMes / 60)}h${minutosMes % 60 ? minutosMes % 60 + 'm' : ''}` : `${minutosMes}m`}
                                </Typography>
                              )}
                              <Typography sx={{ fontSize: 10, color: T2, flexShrink: 0 }}>{meta}</Typography>
                            </Box>
                            {semanas.map((s, wi) => (
                              <Box key={wi} sx={{ display: 'flex', gap: '2px' }}>
                                {Array.from({ length: s.end - s.start + 1 }).map((_, j) => {
                                  const d = s.start + j
                                  const date = new Date(monthData.year, monthData.month, d)
                                  const dateKey = toKey(date)
                                  const applies = appliesOnDate(h, date)
                                  const isDone = (done[dateKey] || []).includes(h.id)
                                  const c = WEEK_COLORS[wi % WEEK_COLORS.length]
                                  return (
                                    <Box key={d} onClick={() => applies && toggleDoneOnDate(dateKey, h.id)} sx={{
                                      width: 26, height: 26, flexShrink: 0, borderRadius: '6px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: applies ? 'pointer' : 'default',
                                      bgcolor: !applies ? 'transparent' : isDone ? alpha(c, 0.18) : '#F9FAFB',
                                      border: !applies ? 'none' : `1.5px solid ${isDone ? c : BORDER}`,
                                    }}>
                                      {applies && isDone && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </Box>
                                  )
                                })}
                              </Box>
                            ))}
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}

        {/* ══ VISTA ANUAL ══ */}
        {view === 'anual' && (
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{yearAnchor}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box component="button" onClick={() => setYearAnchor(y => y - 1)}
                  sx={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 12 }}>←</Box>
                <Box component="button" onClick={() => setYearAnchor(y => y + 1)}
                  sx={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}`, bgcolor: CARD, cursor: 'pointer', fontSize: 12 }}>→</Box>
              </Box>
            </Box>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: CARD, border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: T1, mb: 1 }}>% de cumplimiento por mes</Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={BORDER} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T2 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: T2 }} axisLine={false} tickLine={false} width={28} unit="%" />
                    <Tooltip formatter={v => [`${v}%`, 'Cumplimiento']} />
                    <Bar dataKey="pct" fill={GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Box>
        )}

        {/* Sheet: gestionar hábitos */}
        {manageOpen && (
          <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setManageOpen(false)}>
            <Box onClick={e => e.stopPropagation()} sx={{
              bgcolor: BG, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto',
              borderRadius: '20px 20px 0 0', p: 3, pb: 4,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 17, fontWeight: 700, color: T1 }}>Tus hábitos</Typography>
                <Box onClick={() => { setEditHabito(null); setCrearModal(true) }} sx={{
                  px: 1.5, py: 0.75, borderRadius: '10px', cursor: 'pointer',
                  bgcolor: T1, color: '#fff', display: 'flex', alignItems: 'center', gap: 0.5,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Nuevo</Typography>
                </Box>
              </Box>

              {habitos.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography sx={{ fontWeight: 600, color: T2 }}>Todavía no creaste hábitos</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
                  {habitos.map(h => {
                    const streak = getStreak(done, h.id)
                    const todayDone = doneHoy.has(h.id)
                    return (
                      <Box key={h.id} onClick={() => openStats(h)} sx={{
                        p: 1.75, borderRadius: '12px', bgcolor: CARD, border: `1px solid ${BORDER}`,
                        display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                        '&:active': { opacity: 0.75 },
                      }}>
                        <Box sx={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          bgcolor: todayDone ? alpha(GREEN, 0.1) : '#F3F4F6',
                          border: `2px solid ${todayDone ? GREEN : BORDER}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}>
                          {todayDone
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : h.emoji
                          }
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2 }}>{h.nombre}</Typography>
                          <Typography sx={{ fontSize: 11, color: T2 }}>{h.categoria}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          {streak > 0 && <Typography sx={{ fontSize: 13, fontWeight: 800, color: T1 }}>{streak}d</Typography>}
                          <Typography sx={{ fontSize: 10, color: T2 }}>Ver detalle →</Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Modal Crear/Editar */}
        {crearModal && (
          <CrearHabito habito={editHabito} onSave={handleSave}
            onDelete={() => handleDelete(editHabito?.id)}
            onClose={() => { setCrearModal(false); setEditHabito(null) }} />
        )}

        {/* Panel Estadísticas */}
        {statsHabito && (
          <EstadisticasHabito habito={statsHabito} done={done}
            onEdit={() => openEdit(statsHabito)}
            onDelete={() => handleDelete(statsHabito.id)}
            onClose={() => setStatsHabito(null)} />
        )}

      </Box>
    </Box>
  )
}
