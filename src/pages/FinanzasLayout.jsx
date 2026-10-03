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

  const base = '/finanzas'
  const activeSub = pathname === base ? '' : pathname.replace(`${base}/`, '')

  const visibleTabs = TABS.filter(t => !t.featureKey || hasFeature(t.featureKey))

  function goTo(t) {
    navigate(t.path ? `${base}/${t.path}` : base)
  }

  return (
    <Box>
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Finanzas</Typography>
      </Box>

      {/* Panel vertical a la izquierda + contenido a la derecha — igual en todas las pantallas */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <Box sx={{
          display: 'flex', flexDirection: 'column', gap: 0.25,
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
                '&:active': { opacity: 0.7 },
              }}>{t.label}</Box>
            )
          })}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
