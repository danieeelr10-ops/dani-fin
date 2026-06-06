import { useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'

const MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS = ['D','L','M','X','J','V','S']

function toKey(d) { return d.toISOString().split('T')[0] }

function dayColor(pct) {
  if (pct === null)  return 'transparent'
  if (pct === 0)     return alpha('#919EAB', 0.12)
  if (pct < 0.5)    return alpha('#ef4444', 0.55)
  if (pct < 0.8)    return alpha('#fbbf24', 0.7)
  return alpha('#4ade80', 0.75)
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d))
  return cells
}

export default function HeatMap({ habitos, done }) {
  const today   = new Date()
  const todayKey = toKey(today)
  const [month, setMonth] = useState(today.getMonth())
  const [year,  setYear]  = useState(today.getFullYear())
  const [selected, setSelected] = useState(null)

  const grid = getMonthGrid(year, month)
  const activos = habitos.filter(h => h.activo !== false)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  function getPct(date) {
    if (!date) return null
    const key = toKey(date)
    if (key > todayKey) return null
    if (activos.length === 0) return null
    const doneIds = done[key] || []
    return doneIds.length / activos.length
  }

  const selectedKey = selected ? toKey(selected) : null
  const selectedDone = selectedKey ? (done[selectedKey] || []) : []

  return (
    <Box>
      {/* Nav mes */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box onClick={prevMonth} sx={{ p: 1, borderRadius: 1.5, cursor: 'pointer', color: 'text.secondary', '&:active': { bgcolor: 'action.selected' } }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{MES[month]} {year}</Typography>
        <Box onClick={nextMonth} sx={{ p: 1, borderRadius: 1.5, cursor: 'pointer', color: 'text.secondary', '&:active': { bgcolor: 'action.selected' } }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </Box>
      </Box>

      {/* Cabeceras días */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', mb: 0.5 }}>
        {DIAS.map(d => (
          <Typography key={d} sx={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'text.disabled', py: 0.25 }}>{d}</Typography>
        ))}
      </Box>

      {/* Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '3px' }}>
        {grid.map((date, i) => {
          if (!date) return <Box key={i} />
          const key  = toKey(date)
          const pct  = getPct(date)
          const isTd = key === todayKey
          const isSel = key === selectedKey
          const isFut = key > todayKey

          return (
            <Box key={key} onClick={() => !isFut && setSelected(date === selected ? null : date)}
              sx={{
                aspectRatio: '1', borderRadius: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: dayColor(pct),
                border: '1.5px solid',
                borderColor: isTd ? '#4ade80' : isSel ? 'primary.main' : 'transparent',
                cursor: isFut ? 'default' : 'pointer',
                opacity: isFut ? 0.25 : 1,
                transition: 'all 0.15s',
              }}>
              <Typography sx={{ fontSize: 11, fontWeight: isTd ? 800 : 500, color: isTd ? '#4ade80' : 'text.secondary', lineHeight: 1 }}>
                {date.getDate()}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Leyenda */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
        {[
          { color: dayColor(0),    label: 'Sin datos' },
          { color: dayColor(0.3),  label: '< 50%' },
          { color: dayColor(0.65), label: '50–79%' },
          { color: dayColor(1),    label: '80–100%' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, border: '1px solid', borderColor: alpha('#919EAB', 0.2) }} />
            <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Detalle día seleccionado */}
      {selected && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1, color: 'text.secondary' }}>
            {selected.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
          {activos.length === 0
            ? <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>Sin hábitos activos</Typography>
            : activos.map(h => {
                const done_ = selectedDone.includes(h.id)
                return (
                  <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: done_ ? h.color : alpha('#919EAB', 0.2), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {done_ && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </Box>
                    <Typography sx={{ fontSize: 12, color: done_ ? 'text.primary' : 'text.disabled', fontWeight: done_ ? 600 : 400 }}>
                      {h.emoji} {h.nombre}
                    </Typography>
                  </Box>
                )
              })
          }
        </Box>
      )}
    </Box>
  )
}
