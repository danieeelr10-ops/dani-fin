import { useState } from 'react'
import { Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, alpha } from '@mui/material'
import { useSnackbar } from 'src/context/SnackbarContext'
import { useSyncedState } from 'src/utils/cloudSync'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

const LS_KEY = 'rumbo_metas_vida_v1'

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

const TIPOS = [
  { key: 'personal',    label: 'Personal',    icono: '🌱', color: '#8B5CF6' },
  { key: 'profesional', label: 'Profesional', icono: '💼', color: '#3B82F6' },
]
const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.key, t]))

export default function MetasVida() {
  const { showToast } = useSnackbar()
  const [metas, setMetas] = useSyncedState(LS_KEY, [])
  const [filtro, setFiltro] = useState('todas')
  const [modal, setModal] = useState(null) // null | 'new' | meta_obj

  const [nombre, setNombre]     = useState('')
  const [tipo, setTipo]         = useState('personal')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha]       = useState('')
  const [progreso, setProgreso] = useState(0)

  function persist(next) { setMetas(next) }

  function openNew() {
    setNombre(''); setTipo('personal'); setDescripcion(''); setFecha(''); setProgreso(0)
    setModal('new')
  }
  function openEdit(m) {
    setNombre(m.nombre); setTipo(m.tipo); setDescripcion(m.descripcion || ''); setFecha(m.fecha || ''); setProgreso(m.progreso || 0)
    setModal(m)
  }

  function guardar() {
    if (!nombre.trim()) { showToast('El nombre es requerido', 'error'); return }
    const data = { nombre: nombre.trim(), tipo, descripcion: descripcion.trim(), fecha, progreso: Number(progreso) }
    if (modal === 'new') {
      persist([...metas, { id: uid(), ...data, creado: new Date().toISOString() }])
    } else {
      persist(metas.map(m => m.id === modal.id ? { ...m, ...data } : m))
    }
    setModal(null)
    showToast('Meta guardada')
  }

  function eliminar(id) {
    if (!window.confirm('¿Eliminar esta meta?')) return
    persist(metas.filter(m => m.id !== id))
  }

  const visibles = metas.filter(m => filtro === 'todas' || m.tipo === filtro)

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>

        <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Metas de Vida</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Personal y profesional — separado de tus metas financieras</Typography>
        </Box>

        {/* Filtro */}
        <Box sx={{ display: 'flex', gap: 0, p: '3px', mx: 2, mb: 2, borderRadius: '10px', bgcolor: '#EBEBEB' }}>
          {[{ k: 'todas', l: 'Todas' }, ...TIPOS.map(t => ({ k: t.key, l: t.label }))].map(f => (
            <Box key={f.k} onClick={() => setFiltro(f.k)} sx={{
              flex: 1, py: 0.625, borderRadius: '8px', textAlign: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              bgcolor: filtro === f.k ? '#fff' : 'transparent', color: filtro === f.k ? T1 : T2,
              boxShadow: filtro === f.k ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s',
            }}>{f.l}</Box>
          ))}
        </Box>

        <Box sx={{ px: 2, pb: 4 }}>
          <Box onClick={openNew} sx={{
            mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            py: 1.125, borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH,
            border: `1.5px dashed ${BORDER}`, cursor: 'pointer', '&:active': { opacity: 0.7 },
          }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: GREEN }}>Nueva meta</Typography>
          </Box>

          {visibles.length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', p: 3, textAlign: 'center', border: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 14, color: T2, mb: 0.5 }}>Sin metas todavía</Typography>
              <Typography sx={{ fontSize: 12, color: T2 }}>¿Qué querés lograr este año, a nivel personal o profesional?</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {visibles.map(m => {
                const cfg = TIPO_MAP[m.tipo] || TIPOS[0]
                let diasTxt = null
                if (m.fecha) {
                  const dias = Math.round((new Date(m.fecha) - new Date()) / 86400000)
                  diasTxt = dias > 0 ? `${dias}d restantes` : dias === 0 ? 'Hoy' : 'Vencida'
                }
                return (
                  <Box key={m.id} sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: m.descripcion ? 1 : 1.25 }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: `${cfg.color}14`, border: `1px solid ${cfg.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {cfg.icono}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{m.nombre}</Typography>
                        <Typography sx={{ fontSize: 11, color: T2 }}>{cfg.label}{diasTxt ? ` · ${diasTxt}` : ''}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: T1 }}>{m.progreso || 0}%</Typography>
                        <Box onClick={() => openEdit(m)} sx={{ width: 26, height: 26, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, '&:hover': { bgcolor: '#F3F4F6' } }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Box>
                        <Box onClick={() => eliminar(m.id)} sx={{ width: 26, height: 26, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, '&:hover': { bgcolor: alpha(RED, 0.08), color: RED } }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </Box>
                      </Box>
                    </Box>
                    {m.descripcion && <Typography sx={{ fontSize: 12, color: T2, mb: 1 }}>{m.descripcion}</Typography>}
                    <Box sx={{ height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${m.progreso || 0}%`, bgcolor: (m.progreso || 0) >= 100 ? GREEN : cfg.color, borderRadius: 3, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        <Dialog open={!!modal} onClose={() => setModal(null)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: T1, pb: 1 }}>{modal === 'new' ? 'Nueva meta' : 'Editar meta'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.75 }}>Tipo</Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {TIPOS.map(t => (
                    <Box key={t.key} onClick={() => setTipo(t.key)} sx={{
                      display: 'flex', alignItems: 'center', gap: 0.625, px: 1.25, py: 0.5, borderRadius: '20px', cursor: 'pointer',
                      border: '1px solid', borderColor: tipo === t.key ? t.color : BORDER,
                      bgcolor: tipo === t.key ? `${t.color}12` : 'transparent',
                    }}>
                      <Typography sx={{ fontSize: 13 }}>{t.icono}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: tipo === t.key ? t.color : T2 }}>{t.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Nombre</Typography>
                <Box component="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Correr una media maratón"
                  sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Descripción <span style={{ fontWeight: 400 }}>(opcional)</span></Typography>
                <Box component="textarea" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', resize: 'vertical', '&:focus': { borderColor: GREEN } }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Fecha objetivo <span style={{ fontWeight: 400 }}>(opcional)</span></Typography>
                <Box component="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2 }}>Progreso</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T1 }}>{progreso}%</Typography>
                </Box>
                <Box component="input" type="range" min={0} max={100} value={progreso} onChange={e => setProgreso(e.target.value)}
                  sx={{ width: '100%', accentColor: GREEN }} />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Box component="button" onClick={() => setModal(null)} sx={{ flex: 1, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</Box>
            <Box component="button" onClick={guardar} sx={{ flex: 2, py: 1, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Guardar</Box>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  )
}
