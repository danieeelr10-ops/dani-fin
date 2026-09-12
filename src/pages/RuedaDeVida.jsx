import { useState, useMemo } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { useSnackbar } from 'src/context/SnackbarContext'
import { useSyncedState } from 'src/utils/cloudSync'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'

const LS_KEY = 'rumbo_rueda_vida_v1'

function mesKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

const AREAS = [
  { key: 'salud',       label: 'Salud',       icono: '🏃' },
  { key: 'finanzas',    label: 'Finanzas',    icono: '💰' },
  { key: 'relaciones',  label: 'Relaciones',  icono: '❤️' },
  { key: 'carrera',     label: 'Carrera',     icono: '💼' },
  { key: 'desarrollo',  label: 'Desarrollo personal', icono: '📚' },
  { key: 'ocio',        label: 'Diversión / Ocio', icono: '🎉' },
  { key: 'espiritual',  label: 'Espiritualidad', icono: '🧘' },
  { key: 'familia',     label: 'Familia',     icono: '👨‍👩‍👧' },
]

export default function RuedaDeVida() {
  const { showToast } = useSnackbar()
  const [data, setData] = useSyncedState(LS_KEY, {})
  const [mes, setMes] = useState(mesKey())

  const valores = data[mes] || Object.fromEntries(AREAS.map(a => [a.key, 5]))

  function setValor(key, val) {
    setData(prev => ({ ...prev, [mes]: { ...(prev[mes] || valores), [key]: Number(val) } }))
  }

  function guardar() {
    showToast('Rueda de la vida guardada')
  }

  const chartData = AREAS.map(a => ({ area: a.label, valor: valores[a.key] ?? 5, full: 10 }))
  const promedio = useMemo(() => (AREAS.reduce((s, a) => s + (valores[a.key] ?? 5), 0) / AREAS.length).toFixed(1), [valores])

  const meses = useMemo(() => {
    const arr = []
    const d = new Date()
    for (let i = 0; i < 6; i++) {
      arr.push(mesKey(d))
      d.setMonth(d.getMonth() - 1)
    }
    return arr
  }, [])

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>

        <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Rueda de la Vida</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Evalúa cada área del 1 al 10, una vez al mes</Typography>
        </Box>

        {/* Selector de mes */}
        <Box sx={{ px: 2, mb: 2, display: 'flex', gap: 0.75, overflowX: 'auto' }}>
          {meses.map(m => {
            const [y, mm] = m.split('-')
            const label = new Date(`${y}-${mm}-01T12:00:00`).toLocaleDateString('es-CO', { month: 'short' })
            return (
              <Box key={m} onClick={() => setMes(m)} sx={{
                flexShrink: 0, px: 1.5, py: 0.625, borderRadius: '20px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: '1px solid', borderColor: mes === m ? GREEN : BORDER,
                bgcolor: mes === m ? alpha(GREEN, 0.08) : CARD, color: mes === m ? GREEN : T2,
                textTransform: 'capitalize',
              }}>{label}</Box>
            )
          })}
        </Box>

        {/* Gráfico */}
        <Box sx={{ px: 2, mb: 2 }}>
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance general</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: T1 }}>{promedio}<span style={{ fontSize: 12, color: T2, fontWeight: 400 }}>/10</span></Typography>
            </Box>
            <Box sx={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <RadarChart data={chartData} outerRadius="75%">
                  <PolarGrid stroke={BORDER} />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 10, fill: T2 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 8, fill: T2 }} tickCount={6} />
                  <Radar dataKey="valor" stroke={GREEN} fill={GREEN} fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Box>

        {/* Sliders por área */}
        <Box sx={{ px: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {AREAS.map(a => (
            <Box key={a.key} sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{a.icono} {a.label}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{valores[a.key] ?? 5}</Typography>
              </Box>
              <Box component="input" type="range" min={1} max={10} value={valores[a.key] ?? 5} onChange={e => setValor(a.key, e.target.value)}
                sx={{ width: '100%', accentColor: GREEN }} />
            </Box>
          ))}
        </Box>

        <Box sx={{ px: 2, pb: 4 }}>
          <Box component="button" onClick={guardar} sx={{
            width: '100%', py: 1.25, borderRadius: '10px', border: 'none', bgcolor: GREEN, color: '#fff',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,167,111,0.3)',
          }}>
            Guardar evaluación
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
