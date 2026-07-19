import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, Chip, Stack, InputAdornment } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'
import { getMesActual } from 'src/utils/format'

const ONBOARDING_KEY = 'dani_fin_onboarding_done'

const CUENTAS_PRESET = [
  { nombre: 'Nequi',            icono: '🏦' },
  { nombre: 'Bancolombia',      icono: '🏦' },
  { nombre: 'Davivienda',       icono: '🏦' },
  { nombre: 'Daviplata',        icono: '🏦' },
  { nombre: 'Banco de Bogotá',  icono: '🏦' },
  { nombre: 'Efectivo',         icono: '💵' },
]

const PERFILES = [
  { id: 'fijo',     label: 'Salario fijo',       desc: 'El mismo monto cada mes',                    icon: '📅' },
  { id: 'variable', label: 'Ingresos variables',  desc: 'Cambia cada mes (freelance, ventas...)',     icon: '📈' },
  { id: 'mixto',    label: 'Mixto',               desc: 'Salario base + ingresos adicionales',        icon: '⚡' },
]

export function needsOnboarding() {
  // new_user tiene prioridad — siempre muestra el onboarding si acaba de registrarse
  if (localStorage.getItem('dani_fin_new_user')) return true
  if (localStorage.getItem(ONBOARDING_KEY)) return false
  return false
}

function fmt(val) {
  if (!val) return ''
  return Number(val.toString().replace(/\D/g, '')).toLocaleString('es-CO')
}
function parse(val) {
  return parseInt(val.toString().replace(/\D/g, '') || '0', 10)
}

export default function Onboarding({ onComplete }) {
  const { saveNombreUsuario, savePerfilIngresos, saveConfig, saveSaldoInicial, addPresupuestoItem, state } = useFinanzas()
  const navigate = useNavigate()

  const [step, setStep] = useState(() => {
    localStorage.removeItem('dani_fin_new_user')
    return 0
  })

  // Step 1
  const [nombre, setNombre] = useState('')
  const [perfil, setPerfil] = useState('variable')

  // Step 2
  const [cuentasSel, setCuentasSel] = useState(['Nequi', 'Efectivo'])
  const [customCuenta, setCustomCuenta] = useState('')
  const [saldos, setSaldos] = useState({})

  // Step 3
  const [ingreso, setIngreso] = useState('')

  const totalSteps = 4

  function toggleCuenta(nombre) {
    setCuentasSel(prev =>
      prev.includes(nombre) ? prev.filter(c => c !== nombre) : [...prev, nombre]
    )
  }

  function addCustom() {
    const v = customCuenta.trim()
    if (!v || cuentasSel.includes(v)) return
    setCuentasSel(prev => [...prev, v])
    setCustomCuenta('')
  }

  function finish() {
    const mes = getMesActual()

    // Guardar nombre y perfil
    if (nombre.trim()) saveNombreUsuario(nombre.trim())
    savePerfilIngresos(perfil)

    // Guardar cuentas
    saveConfig({
      categoriasEgresoFijo:     state.categoriasEgresoFijo,
      categoriasEgresoVariable: state.categoriasEgresoVariable,
      categoriasIngreso:        state.categoriasIngreso,
      cuentas:                  cuentasSel,
    })

    // Guardar saldos iniciales
    cuentasSel.forEach(c => {
      const monto = parse(saldos[c] || '0')
      if (monto > 0) saveSaldoInicial(c, monto)
    })

    // Guardar ingreso mensual como ítem de presupuesto del mes actual
    const montoIngreso = parse(ingreso)
    if (montoIngreso > 0) {
      const catIngreso = (state.categoriasIngreso || [])[0] || 'Salario'
      addPresupuestoItem(mes, {
        id: Date.now(),
        concepto: 'Ingreso mensual',
        categoria: catIngreso,
        monto: montoIngreso,
      })
    }

    localStorage.setItem(ONBOARDING_KEY, '1')
    onComplete?.()
    navigate('/presupuesto')
  }

  function skip() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onComplete?.()
    navigate('/inicio')
  }

  const GREEN = '#00A76F'
  const BG    = '#111'
  const CARD  = '#1a1a1a'
  const T1    = '#fff'
  const T2    = 'rgba(255,255,255,0.5)'
  const BORDER = 'rgba(255,255,255,0.1)'

  const steps = [
    // ── PASO 1: Nombre ───────────────────────────────────────────
    {
      title: '¡Hola! 👋',
      subtitle: '¿Cómo te llamas? Así personalizamos la app para ti.',
      canContinue: !!nombre.trim(),
      content: (
        <Box>
          <TextField
            fullWidth autoFocus
            placeholder="Escribe tu nombre..."
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nombre.trim() && setStep(1)}
            inputProps={{ style: { fontSize: 22, fontWeight: 700 } }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: '14px', color: T1 },
              '& input': { py: 2 },
            }}
          />
          <Typography sx={{ fontSize: 12, color: nombre.trim() ? GREEN : T2, mt: 1.5, transition: 'color .2s' }}>
            {nombre.trim() ? `¡Hola, ${nombre.trim()}! 👋` : 'Solo tu primer nombre está perfecto.'}
          </Typography>
        </Box>
      ),
    },

    // ── PASO 2: Cuentas + Saldos ─────────────────────────────────
    {
      title: '¿Dónde tienes tu plata? 💳',
      subtitle: 'Selecciona tus cuentas e ingresa cuánto tienes en cada una ahora mismo.',
      canContinue: cuentasSel.length > 0,
      content: (
        <Stack gap={2.5}>
          {/* Selector de cuentas */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {CUENTAS_PRESET.map(c => {
              const sel = cuentasSel.includes(c.nombre)
              return (
                <Chip key={c.nombre} label={`${c.icono} ${c.nombre}`}
                  onClick={() => toggleCuenta(c.nombre)}
                  sx={{
                    fontWeight: 600, fontSize: '13px', border: '1.5px solid',
                    borderColor: sel ? GREEN : BORDER,
                    bgcolor: sel ? 'rgba(0,167,111,0.12)' : CARD,
                    color: sel ? GREEN : T2,
                    '&:hover': { bgcolor: sel ? 'rgba(0,167,111,0.18)' : 'rgba(255,255,255,0.05)' },
                    transition: 'all .15s',
                  }}
                />
              )
            })}
          </Box>

          {/* Cuenta custom */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" placeholder="Otra cuenta..."
              value={customCuenta} onChange={e => setCustomCuenta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px', color: T1 } }}
            />
            <Button variant="outlined" onClick={addCustom} sx={{ borderRadius: '10px', minWidth: 0, px: 2, borderColor: BORDER, color: T2 }}>+</Button>
          </Box>

          {/* Saldos por cuenta */}
          {cuentasSel.length > 0 && (
            <Box sx={{ bgcolor: CARD, borderRadius: '14px', border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              <Typography sx={{ px: 2, pt: 1.5, pb: 1, fontSize: '11px', fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Saldo actual en cada cuenta
              </Typography>
              <Stack divider={<Box sx={{ height: '1px', bgcolor: BORDER }} />}>
                {cuentasSel.map(c => {
                  const preset = CUENTAS_PRESET.find(p => p.nombre === c)
                  return (
                    <Box key={c} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}>
                      <Typography sx={{ fontSize: '18px', flexShrink: 0 }}>{preset?.icono || '💳'}</Typography>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: T1, flex: 1, minWidth: 0 }}>{c}</Typography>
                      <TextField
                        size="small"
                        placeholder="$0"
                        value={saldos[c] ? '$' + fmt(saldos[c]) : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '')
                          setSaldos(prev => ({ ...prev, [c]: raw }))
                        }}
                        sx={{
                          width: 130,
                          '& .MuiOutlinedInput-root': { borderRadius: '8px', color: GREEN, fontWeight: 700 },
                          '& input': { textAlign: 'right', fontSize: '14px' },
                        }}
                      />
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      ),
    },

    // ── PASO 3: Ingreso mensual ───────────────────────────────────
    {
      title: '¿Cuánto recibes al mes? 💰',
      subtitle: 'Un estimado de tu ingreso mensual para ayudarte a planear tu presupuesto.',
      canContinue: true,
      content: (
        <Stack gap={2}>
          <Box sx={{ bgcolor: CARD, borderRadius: '14px', border: `1px solid ${BORDER}`, p: 2.5 }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: T2, mb: 1.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Ingreso mensual aproximado
            </Typography>
            <TextField
              fullWidth autoFocus
              placeholder="$0"
              value={ingreso ? '$' + fmt(ingreso) : ''}
              onChange={e => setIngreso(e.target.value.replace(/\D/g, ''))}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '12px', color: GREEN, fontWeight: 800, fontSize: '22px' },
                '& input': { textAlign: 'center' },
              }}
            />
            <Typography sx={{ fontSize: '12px', color: T2, mt: 1.5, textAlign: 'center', lineHeight: 1.5 }}>
              {perfil === 'variable'
                ? 'Pon el promedio de los últimos meses'
                : perfil === 'mixto'
                ? 'Pon solo tu salario base, los extras los registras después'
                : 'Tu salario neto después de deducciones'}
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: '12px', border: `1px solid rgba(0,167,111,0.2)`, bgcolor: 'rgba(0,167,111,0.05)' }}>
            <Typography sx={{ fontSize: '12px', color: T2, lineHeight: 1.6 }}>
              💡 Esto nos ayuda a mostrarte cuánto puedes gastar cada mes y si vas bien con tu presupuesto.
            </Typography>
          </Box>
        </Stack>
      ),
    },

    // ── PASO 4: Listo ────────────────────────────────────────────
    {
      title: '¡Todo listo! 🎉',
      subtitle: nombre.trim() ? `Bienvenido, ${nombre.trim()}. Tu cuenta está configurada.` : 'Tu cuenta está configurada.',
      canContinue: true,
      content: (
        <Stack gap={1.5}>
          {[
            { ok: !!nombre.trim(), text: nombre.trim() ? `Nombre: ${nombre.trim()}` : 'Nombre no ingresado' },
            { ok: cuentasSel.length > 0, text: `${cuentasSel.length} cuenta${cuentasSel.length !== 1 ? 's' : ''} agregada${cuentasSel.length !== 1 ? 's' : ''}` },
            { ok: parse(ingreso) > 0, text: parse(ingreso) > 0 ? `Ingreso mensual: $${fmt(ingreso)}` : 'Ingreso mensual (puedes agregarlo después)' },
          ].map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '14px 16px', borderRadius: '12px', bgcolor: CARD, border: `1px solid ${BORDER}` }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: item.ok ? 'rgba(0,167,111,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '12px', color: item.ok ? GREEN : T2 }}>{item.ok ? '✓' : '○'}</Typography>
              </Box>
              <Typography sx={{ fontSize: '13px', color: item.ok ? T1 : T2, fontWeight: item.ok ? 600 : 400 }}>{item.text}</Typography>
            </Box>
          ))}

          <Box sx={{ mt: 1, p: 2, borderRadius: '12px', border: `1px solid rgba(0,167,111,0.2)`, bgcolor: 'rgba(0,167,111,0.05)' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: GREEN, mb: 0.75 }}>Próximo paso recomendado</Typography>
            <Typography sx={{ fontSize: '12px', color: T2, lineHeight: 1.6 }}>
              Ve a <strong style={{ color: T1 }}>Registrar</strong> y anota tu primer ingreso del mes para empezar a trackear tu plata.
            </Typography>
          </Box>
        </Stack>
      ),
    },
  ]

  const current = steps[step]

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 480 }}>

        {/* Progress */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <Box key={i} sx={{
              height: 4, borderRadius: '99px', transition: 'all .3s',
              width: i === step ? 28 : 8,
              bgcolor: i < step ? GREEN : i === step ? GREEN : BORDER,
              opacity: i < step ? 0.5 : 1,
            }} />
          ))}
        </Box>

        {/* Card */}
        <Box sx={{ bgcolor: CARD, borderRadius: '20px', border: `1px solid ${BORDER}`, p: { xs: '24px 20px', sm: '32px 28px' }, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75, fontSize: { xs: '20px', sm: '24px' }, color: T1 }}>
            {current.title}
          </Typography>
          <Typography sx={{ color: T2, fontSize: '14px', mb: 3, lineHeight: 1.5 }}>
            {current.subtitle}
          </Typography>

          {current.content}

          {/* Acciones */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 4 }}>
            {step > 0 && (
              <Button variant="outlined" onClick={() => setStep(s => s - 1)}
                sx={{ borderRadius: '12px', fontWeight: 700, flex: 0, borderColor: BORDER, color: T2, '&:hover': { borderColor: T2 } }}>
                ←
              </Button>
            )}
            <Button variant="contained" fullWidth disabled={!current.canContinue}
              onClick={() => step < totalSteps - 1 ? setStep(s => s + 1) : finish()}
              sx={{ borderRadius: '12px', fontWeight: 800, py: 1.5, fontSize: '15px', bgcolor: GREEN, '&:hover': { bgcolor: '#00875a' } }}>
              {step < totalSteps - 1 ? 'Continuar →' : 'Empezar a usar la app'}
            </Button>
          </Box>

          {step === 0 && (
            <Typography onClick={skip} sx={{ textAlign: 'center', mt: 2, fontSize: '12px', color: T2, cursor: 'pointer', '&:hover': { color: T1 } }}>
              Saltar configuración
            </Typography>
          )}
        </Box>

        {/* Step counter */}
        <Typography sx={{ textAlign: 'center', mt: 2, fontSize: '12px', color: T2 }}>
          Paso {step + 1} de {totalSteps}
        </Typography>
      </Box>
    </Box>
  )
}
