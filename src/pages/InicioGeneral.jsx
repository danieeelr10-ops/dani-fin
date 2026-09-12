import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, alpha } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'
import { useAuth } from 'src/context/AuthContext'
import { computeMetrics } from 'src/utils/metrics'
import { formatMoneyShort } from 'src/utils/format'
import { MESES } from 'src/constants'
import { useSyncedState } from 'src/utils/cloudSync'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

function toKey(d) { return d.toLocaleDateString('en-CA') }
function mesKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

function SummaryCard({ icon, title, subtitle, right, color = GREEN, onClick }) {
  return (
    <Box onClick={onClick} sx={{
      bgcolor: CARD, borderRadius: '14px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`,
      p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
      transition: 'transform 0.1s', '&:active': { transform: 'scale(0.98)' },
    }}>
      <Box sx={{
        width: 42, height: 42, borderRadius: '12px', flexShrink: 0, fontSize: 19,
        bgcolor: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.25)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{title}</Typography>
        <Typography sx={{ fontSize: 11.5, color: T2, mt: 0.125 }}>{subtitle}</Typography>
      </Box>
      {right && <Box sx={{ textAlign: 'right', flexShrink: 0 }}>{right}</Box>}
      <Typography sx={{ fontSize: 16, color: T2, opacity: 0.5 }}>›</Typography>
    </Box>
  )
}

export default function InicioGeneral() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { state } = useFinanzas()

  const nombre = (user?.user_metadata?.name || user?.email || '').split(' ')[0].split('@')[0]
  const hoy = toKey(new Date())
  const mesActual = 'M' + (new Date().getMonth() + 1)

  // Finanzas
  const fin = useMemo(() => computeMetrics(state.transacciones, mesActual), [state.transacciones, mesActual])

  // Ritual
  const [ritual] = useSyncedState('rumbo_ritual_v1', {})
  const ritualHoy = !!ritual[hoy]?.completado

  // Planificador
  const [planif] = useSyncedState('rumbo_planificador_v1', {})
  const tareasHoy = planif[hoy] || []
  const tareasPendientes = tareasHoy.filter(t => !t.done).length

  // Hábitos
  const [habitos] = useSyncedState('hab_habitos', [])
  const [habDone] = useSyncedState('hab_done', {})
  const habitosHoy = habitos.filter(h => h.activo !== false)
  const habitosCompletados = (habDone[hoy] || []).length

  // Metas de vida
  const [metasVida] = useSyncedState('rumbo_metas_vida_v1', [])
  const metasProgreso = metasVida.length
    ? Math.round(metasVida.reduce((s, m) => s + (m.progreso || 0), 0) / metasVida.length)
    : null

  // Rueda de vida
  const [ruedaData] = useSyncedState('rumbo_rueda_vida_v1', {})
  const ruedaMes = ruedaData[mesKey()]
  const ruedaProm = ruedaMes
    ? (Object.values(ruedaMes).reduce((s, v) => s + v, 0) / Object.values(ruedaMes).length).toFixed(1)
    : null

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>

        <Box sx={{ px: 2, pt: 2.5, pb: 2 }}>
          <Typography sx={{ fontSize: 13, color: T2 }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px', textTransform: 'capitalize' }}>
            Hola{nombre ? `, ${nombre}` : ''} 👋
          </Typography>
        </Box>

        <Box sx={{ px: 2, pb: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>

          <SummaryCard
            icon="💰" title="Finanzas" color="#3B82F6"
            subtitle={`Este mes: ${formatMoneyShort(fin.ing)} ingresos · ${formatMoneyShort(fin.eg)} gastos`}
            onClick={() => navigate('/finanzas')}
          />

          <SummaryCard
            icon="☀️" title="Ritual Matutino" color="#F59E0B"
            subtitle={ritualHoy ? 'Completado hoy ✓' : 'Todavía no lo hiciste hoy'}
            right={!ritualHoy && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F59E0B' }} />}
            onClick={() => navigate('/ritual')}
          />

          <SummaryCard
            icon="📅" title="Planificador" color="#3B82F6"
            subtitle={tareasHoy.length === 0 ? 'Sin tareas para hoy' : `${tareasPendientes} de ${tareasHoy.length} pendientes hoy`}
            onClick={() => navigate('/planificador')}
          />

          <SummaryCard
            icon="✅" title="Hábitos" color={GREEN}
            subtitle={habitosHoy.length === 0 ? 'Sin hábitos configurados' : `${habitosCompletados} de ${habitosHoy.length} hoy`}
            onClick={() => navigate('/habitos')}
          />

          <SummaryCard
            icon="🎯" title="Metas de Vida" color="#8B5CF6"
            subtitle={metasVida.length === 0 ? 'Sin metas creadas' : `${metasVida.length} meta${metasVida.length !== 1 ? 's' : ''} · ${metasProgreso}% promedio`}
            onClick={() => navigate('/metas-vida')}
          />

          <SummaryCard
            icon="🎡" title="Rueda de la Vida" color="#EC4899"
            subtitle={ruedaProm ? `${ruedaProm}/10 este mes` : 'Sin evaluar este mes'}
            onClick={() => navigate('/rueda-vida')}
          />

        </Box>
      </Box>
    </Box>
  )
}
