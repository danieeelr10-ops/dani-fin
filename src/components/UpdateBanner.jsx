import { useRegisterSW } from 'virtual:pwa-register/react'
import { Box, Typography } from '@mui/material'

const GREEN  = '#00A76F'
const BORDER = '#E5E7EB'

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <Box sx={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9999,
      bgcolor: '#111318', borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 2, py: 1.5,
    }}>
      <Typography sx={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🆕</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
          Nueva versión disponible
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mt: 0.2 }}>
          Toca para aplicar la actualización
        </Typography>
      </Box>
      <Box
        component="button"
        onClick={() => updateServiceWorker(true)}
        sx={{
          px: 1.75, py: 0.625, borderRadius: '8px', border: 'none',
          bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 12,
          fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Actualizar
      </Box>
      <Box
        onClick={() => setNeedRefresh(false)}
        sx={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', flexShrink: 0, '&:hover': { color: '#fff' } }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </Box>
    </Box>
  )
}
