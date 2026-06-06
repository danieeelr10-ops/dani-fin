import { useState, useMemo, useEffect } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import HabitoItem        from 'src/components/habitos/HabitoItem'
import HeatMap           from 'src/components/habitos/HeatMap'
import EstadisticasHabito from 'src/components/habitos/EstadisticasHabito'
import CrearHabito       from 'src/components/habitos/CrearHabito'
import { refreshBadge }  from 'src/utils/notifications'

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'

// ── Persistencia ──────────────────────────────────────────────
function ls(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def } }
function ss(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
function toKey(d) { return d.toISOString().split('T')[0] }

// ── Hábitos financieros por defecto ───────────────────────────
const DEFAULT_HABITOS = [
  { id: 'fin1', nombre: 'Aporte Hapi $50',         emoji: '💰', categoria: 'Finanzas',      frecuencia: 'diario',      color: '#60a5fa', activo: true, linkApp: '/inversiones', memo: 'VOO $17.50 · SCHD $10 · VIGI $5' },
  { id: 'fin2', nombre: 'Revisar presupuesto',      emoji: '📊', categoria: 'Finanzas',      frecuencia: { dias: [1] }, color: '#4ade80', activo: true, linkApp: '/presupuesto' },
  { id: 'fin3', nombre: 'Registrar gastos del día', emoji: '✏️', categoria: 'Finanzas',      frecuencia: 'diario',      color: '#fbbf24', activo: true, linkApp: '/registro' },
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

// ── Racha ─────────────────────────────────────────────────────
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

// ── Componente principal ──────────────────────────────────────
export default function Habitos() {
  const [habitos,  setHabitos]  = useState(() => ls('hab_habitos', null) ?? DEFAULT_HABITOS)
  const [done,     setDone]     = useState(() => ls('hab_done', {}))
  const [xp,       setXp]       = useState(() => ls('hab_xp', 0))
  const [tab,      setTab]      = useState('hoy')
  const [crearModal,  setCrearModal]  = useState(false)
  const [editHabito,  setEditHabito]  = useState(null)
  const [statsHabito, setStatsHabito] = useState(null)

  const today    = new Date()
  const todayKey = toKey(today)
  const activosHoy = useMemo(() => habitos.filter(appliesToday), [habitos])
  const doneHoy    = useMemo(() => new Set(done[todayKey] || []), [done, todayKey])
  const pct        = activosHoy.length > 0 ? doneHoy.size / activosHoy.length : 0
  const allDone    = activosHoy.length > 0 && doneHoy.size === activosHoy.length
  const lvl        = useMemo(() => getLevelInfo(xp), [xp])

  useEffect(() => { refreshBadge() }, [doneHoy.size])

  function toggleDone(habitId) {
    const current = done[todayKey] || []
    const wasDone = current.includes(habitId)
    const next    = wasDone ? current.filter(id => id !== habitId) : [...current, habitId]
    const newDone = { ...done, [todayKey]: next }
    setDone(newDone); ss('hab_done', newDone)

    let xpDelta = wasDone ? -XP_PER_HABIT : XP_PER_HABIT
    const newSize = next.length
    const wasAllDone = current.length === activosHoy.length
    const nowAllDone = newSize === activosHoy.length
    if (!wasDone && nowAllDone)  xpDelta += XP_DAY_BONUS
    if (wasDone  && wasAllDone)  xpDelta -= XP_DAY_BONUS
    const newXp = Math.max(0, xp + xpDelta)
    setXp(newXp); ss('hab_xp', newXp)
  }

  function handleSave(data) {
    const next = editHabito
      ? habitos.map(h => h.id === editHabito.id ? { ...h, ...data } : h)
      : [...habitos, { id: `h_${Date.now()}`, ...data }]
    setHabitos(next); ss('hab_habitos', next)
    setCrearModal(false); setEditHabito(null)
  }

  function handleDelete(id) {
    const next = habitos.filter(h => h.id !== id)
    setHabitos(next); ss('hab_habitos', next)
    setCrearModal(false); setEditHabito(null); setStatsHabito(null)
  }

  function openEdit(h) { setEditHabito(h); setCrearModal(true); setStatsHabito(null) }
  function openStats(h) { setStatsHabito(h) }

  const TABS = [['hoy','Hoy'],['mapa','Mapa'],['stats','Stats']]

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ px: '20px', pt: 3, pb: 0, position: 'sticky', top: 0, bgcolor: BG, zIndex: 10 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Hábitos</Typography>
              <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Construye tu rutina diaria</Typography>
            </Box>
            {/* XP / Nivel */}
            <Box sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: '8px', bgcolor: '#F3F4F6', border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: T1 }}>Nv.{lvl.level}</Typography>
                <Typography sx={{ fontSize: 10, color: T2, fontWeight: 600 }}>{lvl.name}</Typography>
              </Box>
              <Box sx={{ mt: 0.5, height: 3, borderRadius: 2, bgcolor: '#E5E7EB', overflow: 'hidden', width: 100, ml: 'auto' }}>
                <Box sx={{ height: '100%', width: `${lvl.pct * 100}%`, bgcolor: T1, borderRadius: 2, transition: 'width 0.4s' }} />
              </Box>
              <Typography sx={{ fontSize: 9, color: T2, mt: 0.25 }}>{xp} XP · {lvl.toNext} para Nv.{lvl.level + 1}</Typography>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <Box sx={{ flex: 1, display: 'flex', bgcolor: '#EBEBEB', borderRadius: '10px', p: 0.375 }}>
              {TABS.map(([id, label]) => (
                <Box key={id} onClick={() => setTab(id)} sx={{
                  flex: 1, py: 0.625, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  bgcolor: tab === id ? CARD : 'transparent',
                  boxShadow: tab === id ? CARD_SH : 'none',
                }}>
                  <Typography sx={{ fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? T1 : T2, lineHeight: 1 }}>{label}</Typography>
                </Box>
              ))}
            </Box>
            <Box onClick={() => { setEditHabito(null); setCrearModal(true) }} sx={{
              px: 1.5, py: 0.75, borderRadius: '10px', cursor: 'pointer',
              bgcolor: T1, color: '#fff', display: 'flex', alignItems: 'center', gap: 0.5,
              '&:active': { opacity: 0.85 }, flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Nuevo</Typography>
            </Box>
          </Box>
        </Box>

        {/* ══ TAB HOY ══ */}
        {tab === 'hoy' && (
          <Box sx={{ px: '20px', pt: 0.5 }}>
            {activosHoy.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: T1, mb: 0.5 }}>Sin hábitos todavía</Typography>
                <Typography sx={{ fontSize: 13, color: T2 }}>Toca "+ Nuevo" para crear tu primer hábito</Typography>
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
                </Box>

                {/* Pendientes */}
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
                          onToggle={() => toggleDone(h.id)} onDetails={() => openStats(h)} />
                      ))}
                    </Box>
                  </>
                )}

                {/* Completados */}
                {activosHoy.filter(h => doneHoy.has(h.id)).length > 0 && (
                  <>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>
                      Completados · {doneHoy.size}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {activosHoy.filter(h => doneHoy.has(h.id)).map(h => (
                        <HabitoItem key={h.id} habito={h} completado={true}
                          streak={getStreak(done, h.id)} missedYesterday={false}
                          onToggle={() => toggleDone(h.id)} onDetails={() => openStats(h)} />
                      ))}
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* ══ TAB MAPA ══ */}
        {tab === 'mapa' && (
          <Box sx={{ px: '20px', pt: 1 }}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: CARD, border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
              <HeatMap habitos={habitos} done={done} />
            </Box>
          </Box>
        )}

        {/* ══ TAB STATS ══ */}
        {tab === 'stats' && (
          <Box sx={{ px: '20px', pt: 1, display: 'flex', flexDirection: 'column', gap: 0.875 }}>
            {habitos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontWeight: 600, color: T2 }}>Crea hábitos para ver estadísticas</Typography>
              </Box>
            ) : habitos.map(h => {
              const streak = getStreak(done, h.id)
              const todayDone = doneHoy.has(h.id)
              return (
                <Box key={h.id} onClick={() => openStats(h)} sx={{
                  p: 1.75, borderRadius: '12px', bgcolor: CARD, border: `1px solid ${BORDER}`, boxShadow: CARD_SH,
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
                    {streak > 0 && (
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: T1 }}>{streak}d</Typography>
                    )}
                    <Typography sx={{ fontSize: 10, color: T2 }}>Ver detalle →</Typography>
                  </Box>
                </Box>
              )
            })}
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
