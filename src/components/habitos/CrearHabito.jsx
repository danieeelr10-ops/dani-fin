import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Box, Typography, alpha } from '@mui/material'

const CATEGORIAS = ['Salud', 'Finanzas', 'Productividad', 'Personal', 'Otro']
const CAT_COLORS  = { Salud: '#4ade80', Finanzas: '#60a5fa', Productividad: '#a78bfa', Personal: '#fbbf24', Otro: '#f87171' }
const COLORS = ['#4ade80', '#60a5fa', '#a78bfa', '#fbbf24', '#f87171', '#fb923c']
const EMOJIS = ['💰','📊','✏️','💪','🏃','🧘','📚','💧','🥗','😴','🎯','🧠','🌿','💊','🚴','🌅','🙏','⭐','💻','🎸','🧹','🛌','🔥','⚡']
const DIAS_LABEL = ['D','L','M','X','J','V','S']

function Input({ label, value, onChange, placeholder }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
      <Box component="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        sx={{ width: '100%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, fontSize: 14, fontFamily: 'inherit', color: 'text.primary', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: 'primary.main' } }} />
    </Box>
  )
}

export default function CrearHabito({ habito, onSave, onDelete, onClose }) {
  const isEdit = !!habito

  const [nombre,     setNombre]     = useState(habito?.nombre     || '')
  const [emoji,      setEmoji]      = useState(habito?.emoji      || '🎯')
  const [categoria,  setCategoria]  = useState(habito?.categoria  || 'Salud')
  const [color,      setColor]      = useState(habito?.color      || '#4ade80')
  const [activo,     setActivo]     = useState(habito?.activo     !== false)
  const [frecTipo,   setFrecTipo]   = useState(() => {
    if (!habito || habito.frecuencia === 'diario') return 'diario'
    if (habito.frecuencia?.dias) return 'dias'
    if (habito.frecuencia?.vecesXSemana) return 'veces'
    return 'diario'
  })
  const [diasSel,    setDiasSel]    = useState(habito?.frecuencia?.dias       || [1,2,3,4,5])
  const [veces,      setVeces]      = useState(habito?.frecuencia?.vecesXSemana || 3)
  const [confirmDel, setConfirmDel] = useState(false)

  // Auto-color por categoría al crear
  useEffect(() => {
    if (!isEdit) setColor(CAT_COLORS[categoria] || '#4ade80')
  }, [categoria])

  function getFrecuencia() {
    if (frecTipo === 'diario') return 'diario'
    if (frecTipo === 'dias')   return { dias: diasSel }
    return { vecesXSemana: veces }
  }

  function handleSave() {
    if (!nombre.trim()) return
    onSave({ nombre: nombre.trim(), emoji, categoria, color, activo, frecuencia: getFrecuencia() })
  }

  function toggleDia(d) {
    setDiasSel(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  return createPortal(
    <>
      {/* Overlay */}
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(0,0,0,0.6)' }} />

      {/* Sheet */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1401,
        backgroundColor: '#fff',
        borderRadius: '20px 20px 0 0',
        maxHeight: '92dvh',
        display: 'flex', flexDirection: 'column',
        pb: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        {/* Handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.25, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: alpha('#919EAB', 0.3) }} />
        </Box>

        {/* Header */}
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid', borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{isEdit ? 'Editar hábito' : 'Nuevo hábito'}</Typography>
          <Box onClick={onClose} sx={{ p: 0.5, cursor: 'pointer', color: 'text.secondary', display: 'flex', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </Box>
        </Box>

        {/* Body scrollable */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 2, pb: 1, backgroundColor: '#fff' }}>

          {/* Preview */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: alpha(color, 0.08), border: '1px solid', borderColor: alpha(color, 0.2) }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, bgcolor: alpha(color, 0.12) }}>
              {emoji}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: nombre ? 'text.primary' : 'text.disabled' }}>{nombre || 'Nombre del hábito'}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{categoria}</Typography>
            </Box>
          </Box>

          <Input label="Nombre" value={nombre} onChange={setNombre} placeholder="Ej: Tomar agua" />

          {/* Emoji */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ícono</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {EMOJIS.map(e => (
                <Box key={e} onClick={() => setEmoji(e)} sx={{
                  width: 38, height: 38, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer',
                  bgcolor: emoji === e ? alpha(color, 0.2) : 'action.hover',
                  border: '1px solid', borderColor: emoji === e ? alpha(color, 0.5) : 'transparent',
                }}>
                  {e}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Categoría */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categoría</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {CATEGORIAS.map(c => (
                <Box key={c} onClick={() => setCategoria(c)} sx={{
                  px: 1.5, py: 0.75, borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  bgcolor: categoria === c ? alpha(CAT_COLORS[c], 0.18) : 'action.hover',
                  color: categoria === c ? CAT_COLORS[c] : 'text.secondary',
                  border: '1px solid', borderColor: categoria === c ? alpha(CAT_COLORS[c], 0.4) : 'transparent',
                }}>
                  {c}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Color */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {COLORS.map(c => (
                <Box key={c} onClick={() => setColor(c)} sx={{
                  width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: color === c ? `3px solid ${c}` : '3px solid transparent',
                  outline: color === c ? '2px solid' : 'none', outlineColor: alpha(c, 0.5),
                  transition: 'all 0.15s',
                }} />
              ))}
            </Box>
          </Box>

          {/* Frecuencia */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frecuencia</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25 }}>
              {[['diario','Diario'],['dias','Días específicos'],['veces','X por semana']].map(([id, label]) => (
                <Box key={id} onClick={() => setFrecTipo(id)} sx={{
                  flex: 1, textAlign: 'center', py: 0.875, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  bgcolor: frecTipo === id ? alpha(color, 0.15) : 'action.hover',
                  color: frecTipo === id ? color : 'text.secondary',
                  border: '1px solid', borderColor: frecTipo === id ? alpha(color, 0.35) : 'transparent',
                }}>
                  {label}
                </Box>
              ))}
            </Box>
            {frecTipo === 'dias' && (
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                {DIAS_LABEL.map((d, i) => (
                  <Box key={i} onClick={() => toggleDia(i)} sx={{
                    flex: 1, height: 36, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                    bgcolor: diasSel.includes(i) ? alpha(color, 0.2) : 'action.hover',
                    color: diasSel.includes(i) ? color : 'text.secondary',
                    border: '1px solid', borderColor: diasSel.includes(i) ? alpha(color, 0.4) : 'transparent',
                  }}>
                    {d}
                  </Box>
                ))}
              </Box>
            )}
            {frecTipo === 'veces' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box onClick={() => setVeces(v => Math.max(1, v - 1))} sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>{veces}</Typography>
                <Box onClick={() => setVeces(v => Math.min(7, v + 1))} sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</Box>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>veces por semana</Typography>
              </Box>
            )}
          </Box>

          {/* Activo */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Activo</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Aparece en el check diario</Typography>
            </Box>
            <Box onClick={() => setActivo(a => !a)} sx={{ width: 44, height: 24, borderRadius: 12, bgcolor: activo ? color : alpha('#919EAB', 0.3), cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <Box sx={{ position: 'absolute', top: 2, left: activo ? 22 : 2, width: 20, height: 20, borderRadius: '50%', bgcolor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </Box>
          </Box>
        </Box>

        {/* Acciones */}
        <Box sx={{ px: 2, pt: 1.5, pb: 2, borderTop: '1px solid', borderColor: '#e5e7eb', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1, backgroundColor: '#fff' }}>
          <Box component="button" onClick={handleSave} disabled={!nombre.trim()}
            sx={{ width: '100%', py: 1.25, borderRadius: 1.5, border: 'none', bgcolor: nombre.trim() ? color : alpha('#919EAB', 0.2), color: nombre.trim() ? '#000' : 'text.disabled', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: nombre.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
            {isEdit ? 'Guardar cambios' : 'Crear hábito'}
          </Box>
          {isEdit && !confirmDel && (
            <Box component="button" onClick={() => setConfirmDel(true)}
              sx={{ width: '100%', py: 1, borderRadius: 1.5, border: '1px solid', borderColor: alpha('#ef4444', 0.3), bgcolor: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              Eliminar hábito
            </Box>
          )}
          {isEdit && confirmDel && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="button" onClick={() => setConfirmDel(false)} sx={{ flex: 1, py: 1, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'transparent', color: 'text.secondary', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</Box>
              <Box component="button" onClick={onDelete} sx={{ flex: 2, py: 1, borderRadius: 1.5, border: 'none', bgcolor: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Sí, eliminar</Box>
            </Box>
          )}
        </Box>
      </Box>
    </>,
    document.body
  )
}
