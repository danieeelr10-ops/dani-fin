import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, ToggleButton, ToggleButtonGroup, Chip, Stack } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'

const ONBOARDING_KEY = 'dani_fin_onboarding_done'

const CUENTAS_PRESET = [
  { nombre: 'Bancolombia', tipo: 'Bancaria', icono: '🏦' },
  { nombre: 'Nequi',       tipo: 'Bancaria', icono: '💜' },
  { nombre: 'Davivienda',  tipo: 'Bancaria', icono: '🏦' },
  { nombre: 'Banco de Bogotá', tipo: 'Bancaria', icono: '🏦' },
  { nombre: 'Daviplata',   tipo: 'Bancaria', icono: '📱' },
  { nombre: 'Efectivo',    tipo: 'Efectivo', icono: '💵' },
  { nombre: 'Otra cuenta', tipo: 'Bancaria', icono: '💳' },
]

const PERFILES = [
  {
    id: 'fijo',
    label: 'Salario fijo',
    desc: 'Recibo el mismo monto cada mes',
    icon: '📅',
  },
  {
    id: 'variable',
    label: 'Ingresos variables',
    desc: 'Mis ingresos cambian cada mes (freelance, ventas, etc.)',
    icon: '📈',
  },
  {
    id: 'mixto',
    label: 'Mixto',
    desc: 'Tengo un salario base + ingresos adicionales variables',
    icon: '⚡',
  },
]

export function needsOnboarding(state, user) {
  if (localStorage.getItem(ONBOARDING_KEY)) return false
  if (state.nombreUsuario) return false

  // Usuario con cuenta de más de 5 minutos → existente, saltar onboarding
  if (user?.created_at) {
    const isNew = Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000
    if (!isNew) {
      localStorage.setItem(ONBOARDING_KEY, '1')
      return false
    }
  }

  return true
}

export default function Onboarding() {
  const { state, saveNombreUsuario, savePerfilIngresos, saveConfig } = useFinanzas()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [nombre, setNombre] = useState('')
  const [perfil, setPerfil] = useState('variable')
  const [cuentasSeleccionadas, setCuentasSeleccionadas] = useState(['Nequi', 'Efectivo'])
  const [customCuenta, setCustomCuenta] = useState('')

  const totalSteps = 3

  function toggleCuenta(nombre) {
    setCuentasSeleccionadas(prev =>
      prev.includes(nombre) ? prev.filter(c => c !== nombre) : [...prev, nombre]
    )
  }

  function addCustomCuenta() {
    const val = customCuenta.trim()
    if (!val || cuentasSeleccionadas.includes(val)) return
    setCuentasSeleccionadas(prev => [...prev, val])
    setCustomCuenta('')
  }

  function finish() {
    // Guardar nombre y perfil
    if (nombre.trim()) saveNombreUsuario(nombre.trim())
    savePerfilIngresos(perfil)

    // Guardar cuentas seleccionadas (combinando con las que ya existían)
    const nuevasCuentas = cuentasSeleccionadas.map(nombre => {
      const preset = CUENTAS_PRESET.find(c => c.nombre === nombre)
      return preset ? preset.nombre : nombre
    })
    const cuentasActuales = state.cuentas || []
    const cuentasMerged = [
      ...nuevasCuentas.filter(n => !cuentasActuales.includes(n)),
      ...cuentasActuales,
    ]
    saveConfig({
      categoriasEgresoFijo:     state.categoriasEgresoFijo,
      categoriasEgresoVariable: state.categoriasEgresoVariable,
      categoriasIngreso:        state.categoriasIngreso,
      cuentas:                  cuentasMerged,
    })

    localStorage.setItem(ONBOARDING_KEY, '1')
    navigate('/inicio')
  }

  function skip() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    navigate('/inicio')
  }

  const steps = [
    {
      title: '¡Bienvenido! 👋',
      subtitle: 'Vamos a configurar tu cuenta en 3 pasos rápidos.',
      content: (
        <Stack gap={3}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
              ¿Cómo te llamas?
            </Typography>
            <TextField
              fullWidth
              placeholder="Tu nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && setStep(1)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
              ¿Cómo son tus ingresos?
            </Typography>
            <Stack gap={1.5}>
              {PERFILES.map(p => (
                <Box
                  key={p.id}
                  onClick={() => setPerfil(p.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    p: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: perfil === p.id ? 'primary.main' : 'divider',
                    background: perfil === p.id ? 'rgba(168,240,64,0.07)' : 'background.paper',
                    transition: 'all .15s',
                  }}
                >
                  <Box sx={{ fontSize: '22px', flexShrink: 0 }}>{p.icon}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '14px', color: perfil === p.id ? 'primary.main' : 'text.primary' }}>
                      {p.label}
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.25 }}>
                      {p.desc}
                    </Typography>
                  </Box>
                  {perfil === p.id && (
                    <Box sx={{ ml: 'auto', color: 'primary.main', fontWeight: 800, fontSize: '16px' }}>✓</Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      ),
      canContinue: true,
    },
    {
      title: '¿Dónde guardas tu plata? 💳',
      subtitle: 'Selecciona las cuentas que usas. Puedes agregar más después.',
      content: (
        <Stack gap={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {CUENTAS_PRESET.map(c => {
              const selected = cuentasSeleccionadas.includes(c.nombre)
              return (
                <Chip
                  key={c.nombre}
                  label={`${c.icono} ${c.nombre}`}
                  onClick={() => toggleCuenta(c.nombre)}
                  sx={{
                    fontWeight: 600, fontSize: '13px',
                    border: '1.5px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    background: selected ? 'rgba(168,240,64,0.12)' : 'background.paper',
                    color: selected ? 'primary.main' : 'text.secondary',
                    '&:hover': { background: selected ? 'rgba(168,240,64,0.18)' : 'action.hover' },
                    transition: 'all .15s',
                  }}
                />
              )
            })}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Otra cuenta..."
              value={customCuenta}
              onChange={e => setCustomCuenta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomCuenta()}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Button variant="outlined" onClick={addCustomCuenta} sx={{ borderRadius: '10px', minWidth: 0, px: 2 }}>
              +
            </Button>
          </Box>

          {cuentasSeleccionadas.length > 0 && (
            <Box sx={{ p: '12px 14px', borderRadius: '10px', background: 'rgba(168,240,64,0.06)', border: '1px solid rgba(168,240,64,0.2)' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'text.secondary', mb: 0.75, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Seleccionadas
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {cuentasSeleccionadas.map(c => (
                  <Chip
                    key={c}
                    label={c}
                    size="small"
                    onDelete={() => toggleCuenta(c)}
                    sx={{ fontWeight: 600, color: 'primary.main', borderColor: 'primary.main', border: '1px solid' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Stack>
      ),
      canContinue: cuentasSeleccionadas.length > 0,
    },
    {
      title: '¡Todo listo! 🎉',
      subtitle: 'Ya tienes lo esencial configurado. Estos son tus próximos pasos:',
      content: (
        <Stack gap={2}>
          {[
            { icon: '💰', title: 'Registra tu primer ingreso o gasto', desc: 'Ve a "Registro" y empieza a trackear tu plata.', path: '/registro' },
            { icon: '📊', title: 'Configura tu presupuesto mensual', desc: 'Define cuánto puedes gastar en cada categoría.', path: '/presupuesto' },
            { icon: '⚙️', title: 'Ajusta tus categorías', desc: 'Personaliza las categorías de gastos según tu vida.', path: '/config' },
          ].map((item, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex', gap: 2, p: '14px 16px',
                borderRadius: '12px', background: 'background.paper',
                border: '1px solid', borderColor: 'divider',
              }}
            >
              <Box sx={{ fontSize: '22px', flexShrink: 0, mt: 0.25 }}>{item.icon}</Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '14px', mb: 0.25 }}>{item.title}</Typography>
                <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>{item.desc}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      ),
      canContinue: true,
    },
  ]

  const current = steps[step]

  return (
    <Box sx={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default', p: 2,
    }}>
      <Box sx={{ width: '100%', maxWidth: 480 }}>

        {/* Progress dots */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <Box key={i} sx={{
              height: 4, borderRadius: '99px', transition: 'all .3s',
              width: i === step ? 24 : 8,
              bgcolor: i <= step ? 'primary.main' : 'divider',
            }} />
          ))}
        </Box>

        {/* Card */}
        <Box sx={{
          background: 'background.paper', borderRadius: '20px',
          border: '1px solid', borderColor: 'divider',
          p: { xs: '24px 20px', sm: '32px 28px' },
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75, fontSize: { xs: '22px', sm: '26px' } }}>
            {current.title}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '14px', mb: 3, lineHeight: 1.5 }}>
            {current.subtitle}
          </Typography>

          {current.content}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 4 }}>
            {step > 0 && (
              <Button
                variant="outlined"
                onClick={() => setStep(s => s - 1)}
                sx={{ borderRadius: '12px', fontWeight: 700, flex: 0 }}
              >
                ←
              </Button>
            )}
            <Button
              variant="contained"
              fullWidth
              disabled={!current.canContinue}
              onClick={() => step < totalSteps - 1 ? setStep(s => s + 1) : finish()}
              sx={{ borderRadius: '12px', fontWeight: 800, py: 1.5, fontSize: '15px' }}
            >
              {step < totalSteps - 1 ? 'Continuar' : 'Empezar'}
            </Button>
          </Box>

          {step === 0 && (
            <Typography
              onClick={skip}
              sx={{ textAlign: 'center', mt: 2, fontSize: '12px', color: 'text.disabled', cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
            >
              Saltar configuración
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
