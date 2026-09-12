import { useMemo } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { useSnackbar } from 'src/context/SnackbarContext'
import { useSyncedState } from 'src/utils/cloudSync'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'

const LS_KEY = 'rumbo_ritual_v1'

function toKey(d) { return d.toLocaleDateString('en-CA') }

const PREGUNTAS = [
  { key: 'prioridad',   label: '¿Cuál es tu prioridad #1 de hoy?',           placeholder: 'La única cosa que si la logro, hoy fue un buen día' },
  { key: 'agradecido',  label: '¿Por qué estás agradecido hoy?',              placeholder: 'Una persona, un momento, algo simple' },
  { key: 'animo',       label: '¿Cómo llegas hoy?',                          placeholder: 'Cómo te sientes al arrancar el día', options: ['😄','🙂','😐','😔','😫'] },
  { key: 'intencion',   label: '¿Qué tipo de persona querés ser hoy?',       placeholder: 'Ej: paciente, enfocado, presente' },
]

export default function Ritual() {
  const { showToast } = useSnackbar()
  const [data, setData] = useSyncedState(LS_KEY, {})
  const hoy = toKey(new Date())
  const respuestasHoy = data[hoy] || {}
  const completadoHoy = !!respuestasHoy.completado

  const historial = useMemo(() => {
    return Object.entries(data)
      .filter(([k, v]) => k !== hoy && v.completado)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
  }, [data, hoy])

  const racha = useMemo(() => {
    let streak = completadoHoy ? 1 : 0
    const d = new Date()
    d.setDate(d.getDate() - 1)
    while (true) {
      const k = toKey(d)
      if (data[k]?.completado) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  }, [data, completadoHoy])

  function update(key, value) {
    setData(prev => ({ ...prev, [hoy]: { ...(prev[hoy] || {}), [key]: value } }))
  }

  function completar() {
    update('completado', true)
    showToast('☀️ Ritual completado — arranca el día con todo')
  }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>

        <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Ritual Matutino</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>10 minutos para arrancar con intención</Typography>
        </Box>

        {racha > 0 && (
          <Box sx={{ px: 2, mb: 2 }}>
            <Box sx={{ bgcolor: alpha(GREEN, 0.08), border: `1px solid ${alpha(GREEN, 0.25)}`, borderRadius: '12px', px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 18 }}>🔥</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>
                {racha} {racha === 1 ? 'día' : 'días'} seguidos
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ px: 2, pb: 4, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {completadoHoy && (
            <Box sx={{ bgcolor: alpha(GREEN, 0.08), border: `1px solid ${alpha(GREEN, 0.25)}`, borderRadius: '12px', p: 2, textAlign: 'center', mb: 0.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ Ya completaste tu ritual de hoy</Typography>
            </Box>
          )}

          {PREGUNTAS.map(p => (
            <Box key={p.key} sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1 }}>{p.label}</Typography>
              {p.options ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {p.options.map(opt => (
                    <Box key={opt} onClick={() => update(p.key, opt)} sx={{
                      flex: 1, textAlign: 'center', py: 1, borderRadius: '10px', cursor: 'pointer', fontSize: 22,
                      border: '1.5px solid', borderColor: respuestasHoy[p.key] === opt ? GREEN : BORDER,
                      bgcolor: respuestasHoy[p.key] === opt ? alpha(GREEN, 0.08) : 'transparent',
                      transition: 'all 0.12s',
                    }}>
                      {opt}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box component="textarea" rows={2} value={respuestasHoy[p.key] || ''} onChange={e => update(p.key, e.target.value)}
                  placeholder={p.placeholder}
                  sx={{
                    width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: '8px',
                    p: 1.25, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', resize: 'vertical',
                    bgcolor: '#fff', '&:focus': { borderColor: GREEN },
                  }} />
              )}
            </Box>
          ))}

          {!completadoHoy && (
            <Box component="button" onClick={completar} sx={{
              mt: 0.5, py: 1.25, borderRadius: '10px', border: 'none', bgcolor: GREEN, color: '#fff',
              fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,167,111,0.3)',
            }}>
              Completar ritual de hoy
            </Box>
          )}
        </Box>

        {historial.length > 0 && (
          <Box sx={{ px: 2, pb: 4 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
              Últimos días
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {historial.map(([fecha, r]) => (
                <Box key={fecha} sx={{ bgcolor: CARD, borderRadius: '10px', border: `1px solid ${BORDER}`, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Typography sx={{ fontSize: 18 }}>{r.animo || '✓'}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: T2 }}>{new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</Typography>
                    {r.prioridad && <Typography sx={{ fontSize: 12, color: T1, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prioridad}</Typography>}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
