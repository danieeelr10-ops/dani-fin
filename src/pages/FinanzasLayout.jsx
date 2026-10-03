import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useFeatures } from 'src/context/FeaturesContext'

const CARD    = '#FFFFFF'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'

const TABS = [
  { path: '',             featureKey: null,           label: 'Resumen' },
  { path: 'registro',     featureKey: 'registro',    label: 'Registrar' },
  { path: 'historial',    featureKey: 'historial',   label: 'Historial' },
  { path: 'presupuesto',  featureKey: 'presupuesto', label: 'Presupuesto' },
  { path: 'tc',           featureKey: 'tc',          label: 'T.C' },
  { path: 'deudas',       featureKey: 'deudas',      label: 'Deudas' },
  { path: 'patrimonio',   featureKey: null,           label: 'Patrimonio' },
  { path: 'analisis',     featureKey: 'analisis',    label: 'Análisis' },
  { path: 'mercado',      featureKey: null,           label: 'Mercado' },
  { path: 'reportes',     featureKey: null,           label: 'Reportes' },
  { path: 'cuentas',      featureKey: null,           label: 'Cuentas bancarias' },
  { path: 'apuntes',      featureKey: null,           label: 'Cuentas' },
]

export default function FinanzasLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hasFeature } = useFeatures()
  const [menuOpen, setMenuOpen] = useState(false)

  const base = '/finanzas'
  const activeSub = pathname === base ? '' : pathname.replace(`${base}/`, '')

  const visibleTabs = TABS.filter(t => !t.featureKey || hasFeature(t.featureKey))
  const current = visibleTabs.find(t => t.path === activeSub) || visibleTabs[0]

  function goTo(t) {
    navigate(t.path ? `${base}/${t.path}` : base)
    setMenuOpen(false)
  }

  return (
    <Box>
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Finanzas</Typography>
      </Box>

      {/* ── Mobile: botón que abre la misma lista vertical que en desktop, como bottom sheet ── */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, pb: 1.5 }}>
        <Box onClick={() => setMenuOpen(true)} sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.75, py: 1, borderRadius: '12px', cursor: 'pointer',
          border: `1px solid ${BORDER}`, bgcolor: CARD, '&:active': { opacity: 0.8 },
        }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{current?.label}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: T2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>Cambiar sección</Typography>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </Box>
        </Box>
      </Box>

      {/* ── Desktop: panel vertical a la izquierda + contenido a la derecha ── */}
      <Box sx={{ display: { xs: 'block', md: 'flex' }, alignItems: 'flex-start' }}>
        <Box sx={{
          display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.25,
          width: 196, flexShrink: 0, py: 0.5, px: 1.5,
          position: 'sticky', top: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
        }}>
          {visibleTabs.map(t => {
            const active = activeSub === t.path
            return (
              <Box key={t.path || 'resumen'} onClick={() => goTo(t)} sx={{
                px: 1.5, py: 1, borderRadius: '10px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                borderLeft: '3px solid', borderLeftColor: active ? GREEN : 'transparent',
                bgcolor: active ? 'rgba(0,167,111,0.08)' : 'transparent',
                color: active ? GREEN : T2, transition: 'all 0.12s',
                '&:hover': { bgcolor: active ? 'rgba(0,167,111,0.08)' : '#F3F4F6', color: active ? GREEN : T1 },
              }}>{t.label}</Box>
            )
          })}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>

      {/* ── Mobile: bottom sheet con la lista completa de secciones ── */}
      {menuOpen && (
        <>
          <Box onClick={() => setMenuOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 300, bgcolor: 'rgba(0,0,0,0.5)' }} />
          <Box sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
            bgcolor: CARD, borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
            pb: 'calc(env(safe-area-inset-bottom) + 8px)',
            maxHeight: '80dvh', overflowY: 'auto',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 1 }}>
              <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'rgba(145,158,171,0.3)' }} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', px: 2.5, pb: 1 }}>
              Secciones de Finanzas
            </Typography>
            <Box sx={{ px: 1.5, pb: 1 }}>
              {visibleTabs.map(t => {
                const active = activeSub === t.path
                return (
                  <Box key={t.path || 'resumen'} onClick={() => goTo(t)} sx={{
                    px: 1.5, py: 1.25, borderRadius: '10px', cursor: 'pointer', fontSize: 14.5, fontWeight: 600,
                    bgcolor: active ? 'rgba(0,167,111,0.08)' : 'transparent',
                    color: active ? GREEN : T1, '&:active': { bgcolor: '#F3F4F6' },
                  }}>{t.label}</Box>
                )
              })}
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}
