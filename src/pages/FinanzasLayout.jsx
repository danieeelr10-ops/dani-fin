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

function NavRows({ visibleTabs, activeSub, goTo }) {
  return visibleTabs.map(t => {
    const active = activeSub === t.path
    return (
      <Box key={t.path || 'resumen'} onClick={() => goTo(t)} sx={{
        px: 1.5, py: 1, borderRadius: '10px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
        borderLeft: '3px solid', borderLeftColor: active ? GREEN : 'transparent',
        bgcolor: active ? 'rgba(0,167,111,0.08)' : 'transparent',
        color: active ? GREEN : T2, transition: 'all 0.12s',
        '&:hover': { bgcolor: active ? 'rgba(0,167,111,0.08)' : '#F3F4F6', color: active ? GREEN : T1 },
        '&:active': { opacity: 0.7 },
      }}>{t.label}</Box>
    )
  })
}

export default function FinanzasLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hasFeature } = useFeatures()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const base = '/finanzas'
  const activeSub = pathname === base ? '' : pathname.replace(`${base}/`, '')

  const visibleTabs = TABS.filter(t => !t.featureKey || hasFeature(t.featureKey))
  const current = visibleTabs.find(t => t.path === activeSub) || visibleTabs[0]

  function goTo(t) {
    navigate(t.path ? `${base}/${t.path}` : base)
    setDrawerOpen(false)
  }

  return (
    <Box>
      <Box sx={{ px: 2, pt: 2.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        {/* Botón de menú — solo mobile, abre el cajón deslizante */}
        <Box onClick={() => setDrawerOpen(true)} sx={{
          display: { xs: 'flex', md: 'none' }, alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: '8px', flexShrink: 0, cursor: 'pointer', color: T1,
          '&:active': { bgcolor: '#F3F4F6' },
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Finanzas</Typography>
          <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 12, color: T2, mt: 0.1 }}>{current?.label}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'flex' }, alignItems: 'flex-start' }}>
        {/* Panel vertical fijo — solo desktop, donde sí hay espacio de sobra */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.25,
          width: 196, flexShrink: 0, py: 0.5, px: 1.5,
          position: 'sticky', top: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
        }}>
          <NavRows visibleTabs={visibleTabs} activeSub={activeSub} goTo={goTo} />
        </Box>

        {/* Contenido — ancho completo en mobile, el panel ahí es un cajón que se superpone */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>

      {/* Cajón deslizante — solo mobile, se superpone al contenido sin achicarlo */}
      {drawerOpen && (
        <>
          <Box onClick={() => setDrawerOpen(false)} sx={{
            display: { xs: 'block', md: 'none' },
            position: 'fixed', inset: 0, zIndex: 400, bgcolor: 'rgba(0,0,0,0.5)',
          }} />
          <Box sx={{
            display: { xs: 'flex', md: 'none' }, flexDirection: 'column',
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 401,
            width: '80%', maxWidth: 300, bgcolor: CARD,
            boxShadow: '6px 0 28px rgba(0,0,0,0.18)', overflowY: 'auto',
            pt: 'env(safe-area-inset-top)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2, pb: 1.5 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: T1, letterSpacing: '-0.3px' }}>Finanzas</Typography>
              <Box onClick={() => setDrawerOpen(false)} sx={{ color: T2, cursor: 'pointer', p: 0.5, '&:active': { opacity: 0.6 } }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </Box>
            </Box>
            <Box sx={{ px: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <NavRows visibleTabs={visibleTabs} activeSub={activeSub} goTo={goTo} />
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}
