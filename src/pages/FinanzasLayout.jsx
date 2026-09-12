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
  { path: 'ahorro',       featureKey: 'ahorro',      label: 'Ahorro' },
  { path: 'inversiones',  featureKey: null,           label: 'Inversiones' },
  { path: 'analisis',     featureKey: 'analisis',    label: 'Análisis' },
  { path: 'mercado',      featureKey: null,           label: 'Mercado' },
  { path: 'flujo',        featureKey: null,           label: 'Flujo' },
  { path: 'reportes',     featureKey: null,           label: 'Reportes' },
  { path: 'metas',        featureKey: null,           label: 'Metas $' },
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

  return (
    <Box>
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Finanzas</Typography>
      </Box>

      <Box sx={{
        display: 'flex', gap: 0.75, px: 2, pb: 1.5, overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
      }}>
        {visibleTabs.map(t => {
          const active = activeSub === t.path
          return (
            <Box key={t.path || 'resumen'} onClick={() => navigate(t.path ? `${base}/${t.path}` : base)} sx={{
              flexShrink: 0, px: 1.5, py: 0.625, borderRadius: '20px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              border: '1px solid', borderColor: active ? GREEN : BORDER,
              bgcolor: active ? 'rgba(0,167,111,0.08)' : CARD, color: active ? GREEN : T2,
              whiteSpace: 'nowrap', transition: 'all 0.12s',
            }}>{t.label}</Box>
          )
        })}
      </Box>

      <Outlet />
    </Box>
  )
}
