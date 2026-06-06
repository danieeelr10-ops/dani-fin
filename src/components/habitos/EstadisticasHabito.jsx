import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Box, Typography, alpha } from '@mui/material'

function toKey(d) { return d.toISOString().split('T')[0] }

function getLast14(done, habitId) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key  = toKey(d)
    const isDone = (done[key] || []).includes(habitId)
    return { date: d, key, done: isDone }
  })
}

function getStreak(done, habitId) {
  let streak = 0
  const d = new Date()
  const todayKey = toKey(d)
  if (!(done[todayKey] || []).includes(habitId)) d.setDate(d.getDate() - 1)
  while (true) {
    const key = toKey(d)
    if ((done[key] || []).includes(habitId)) { streak++; d.setDate(d.getDate() - 1) }
    else break
    if (streak > 730) break
  }
  return streak
}

function getBestStreak(done, habitId) {
  let best = 0, current = 0
  const d = new Date()
  for (let i = 0; i < 730; i++) {
    const key = toKey(d)
    if ((done[key] || []).includes(habitId)) { current++; best = Math.max(best, current) }
    else current = 0
    d.setDate(d.getDate() - 1)
  }
  return best
}

function getSuccessRate30(done, habitId) {
  let count = 0
  const d = new Date()
  for (let i = 0; i < 30; i++) {
    if ((done[toKey(d)] || []).includes(habitId)) count++
    d.setDate(d.getDate() - 1)
  }
  return Math.round((count / 30) * 100)
}

export default function EstadisticasHabito({ habito, done, onEdit, onDelete, onClose }) {
  const { color, emoji, nombre, categoria } = habito

  const streak   = useMemo(() => getStreak(done, habito.id),      [done, habito.id])
  const best     = useMemo(() => getBestStreak(done, habito.id),  [done, habito.id])
  const rate30   = useMemo(() => getSuccessRate30(done, habito.id), [done, habito.id])
  const last14   = useMemo(() => getLast14(done, habito.id),      [done, habito.id])

  const rateColor = rate30 >= 80 ? '#4ade80' : rate30 >= 50 ? '#fbbf24' : '#ef4444'

  return createPortal(
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(0,0,0,0.6)' }} />
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1401,
        backgroundColor: '#fff',
        borderRadius: '20px 20px 0 0',
        maxHeight: '85dvh',
        display: 'flex', flexDirection: 'column',
        pb: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        {/* Handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: alpha('#919EAB', 0.3) }} />
        </Box>

        {/* Header */}
        <Box sx={{ px: 2, pb: 1.5, pt: 0.5, display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${color}`, bgcolor: alpha(color, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {emoji}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{nombre}</Typography>
            <Box sx={{ display: 'inline-block', px: 0.75, py: 0.2, borderRadius: 1, bgcolor: alpha(color, 0.12), mt: 0.25 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color }}>{categoria}</Typography>
            </Box>
          </Box>
          <Box onClick={onClose} sx={{ p: 0.5, cursor: 'pointer', color: 'text.secondary', display: 'flex', borderRadius: 1, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>

          {/* Stats cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, mb: 2.5 }}>
            {[
              { label: 'Éxito 30d', value: `${rate30}%`, color: rateColor },
              { label: 'Racha actual', value: `${streak}d`, color: streak > 0 ? '#fb923c' : 'text.secondary' },
              { label: 'Récord', value: `${best}d`, color: best > 0 ? color : 'text.secondary' },
            ].map(({ label, value, color: c }) => (
              <Box key={label} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: c, lineHeight: 1.1 }}>{value}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.25, fontWeight: 600 }}>{label}</Typography>
              </Box>
            ))}
          </Box>

          {/* Tasa de éxito bar */}
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Tasa de éxito (últimos 30 días)</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: rateColor }}>{rate30}%</Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 4, bgcolor: alpha('#919EAB', 0.12), overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${rate30}%`, bgcolor: rateColor, borderRadius: 4, transition: 'width 0.5s' }} />
            </Box>
          </Box>

          {/* Últimos 14 días */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>Últimos 14 días</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 56 }}>
            {last14.map(({ date, done: isDone }, i) => {
              const isToday = i === 13
              return (
                <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4, height: '100%', justifyContent: 'flex-end' }}>
                  <Box sx={{
                    width: '100%', borderRadius: 1,
                    height: isDone ? '100%' : '25%',
                    bgcolor: isDone ? color : alpha('#919EAB', 0.15),
                    transition: 'height 0.4s ease',
                    border: isToday ? `1px solid ${alpha(color, 0.5)}` : 'none',
                  }} />
                  <Typography sx={{ fontSize: 8, color: isToday ? color : 'text.disabled', fontWeight: isToday ? 800 : 400 }}>
                    {date.getDate()}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Acciones */}
        <Box sx={{ px: 2, pt: 1.5, pb: 2, borderTop: '1px solid', borderColor: '#e5e7eb', flexShrink: 0, display: 'flex', gap: 1, backgroundColor: '#fff' }}>
          <Box component="button" onClick={onDelete}
            sx={{ flex: 1, py: 1, borderRadius: 1.5, border: '1px solid', borderColor: alpha('#ef4444', 0.3), bgcolor: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            Eliminar
          </Box>
          <Box component="button" onClick={onEdit}
            sx={{ flex: 2, py: 1, borderRadius: 1.5, border: 'none', bgcolor: color, color: '#000', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            Editar hábito
          </Box>
        </Box>
      </Box>
    </>,
    document.body
  )
}
