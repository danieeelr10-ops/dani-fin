import { useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { useNavigate } from 'react-router-dom'

const T1     = '#111318'
const T2     = '#6B7280'
const GREEN  = '#00A76F'
const BORDER = '#E5E7EB'
const CARD   = '#FFFFFF'

const DIAS_SHORT = ['D','L','M','X','J','V','S']

function frecLabel(frec) {
  if (!frec || frec === 'diario') return 'Diario'
  if (frec.dias) return frec.dias.map(d => DIAS_SHORT[d]).join(' ')
  if (frec.vecesXSemana) return `${frec.vecesXSemana}× semana`
  return 'Diario'
}

export default function HabitoItem({ habito, completado, streak, missedYesterday, onToggle, onDetails }) {
  const [pressing, setPressing] = useState(false)
  const navigate = useNavigate()
  const { color, emoji, nombre, categoria, frecuencia, linkApp } = habito

  function handleCircleClick(e) {
    e.stopPropagation()
    setPressing(true)
    setTimeout(() => setPressing(false), 300)
    onToggle()
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 1.5, py: 1.25, borderRadius: '12px',
      bgcolor: completado ? alpha(GREEN, 0.04) : CARD,
      border: '1px solid',
      borderColor: completado ? alpha(GREEN, 0.2) : BORDER,
      opacity: completado ? 0.8 : 1,
      transition: 'all 0.25s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    }}>

      {/* Círculo check */}
      <Box onClick={handleCircleClick} sx={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: completado ? alpha(GREEN, 0.12) : pressing ? alpha(color, 0.2) : alpha(color, 0.08),
        border: `2.5px solid ${completado ? GREEN : alpha(color, 0.4)}`,
        transition: 'all 0.25s ease',
        transform: pressing ? 'scale(0.9)' : 'scale(1)',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        '&:active': { transform: 'scale(0.88)' },
      }}>
        {completado
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <Typography sx={{ fontSize: 20, lineHeight: 1 }}>{emoji}</Typography>
        }
      </Box>

      {/* Info */}
      <Box onClick={onDetails} sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.2 }}>
          {missedYesterday && !completado && (
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#F59E0B', flexShrink: 0 }} />
          )}
          <Typography sx={{
            fontSize: 14, fontWeight: 600, lineHeight: 1.25,
            textDecoration: completado ? 'line-through' : 'none',
            color: completado ? T2 : T1,
          }}>
            {nombre}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2, bgcolor: '#F3F4F6', px: 0.75, py: 0.2, borderRadius: '4px' }}>
            {categoria}
          </Typography>
          <Typography sx={{ fontSize: 11, color: T2 }}>{frecLabel(frecuencia)}</Typography>
          {streak > 0 && (
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2 }}>{streak}d</Typography>
          )}
        </Box>
      </Box>

      {/* Link financiero */}
      {linkApp && !completado && (
        <Box onClick={e => { e.stopPropagation(); navigate(linkApp) }} sx={{
          flexShrink: 0, p: 0.75, borderRadius: '8px', bgcolor: '#F3F4F6', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          '&:active': { opacity: 0.7 },
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
        </Box>
      )}
    </Box>
  )
}
