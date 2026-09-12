import { useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { useSyncedState } from 'src/utils/cloudSync'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

const CARPETAS_KEY = 'rumbo_notas_carpetas_v1'
const NOTAS_KEY    = 'rumbo_notas_v1'
const EMOJIS_PRESET = ['📁','💡','✍️','🛒','✈️','👨‍👩‍👧','💼','🎯','📚','🎨','🏠','⭐']

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const DEFAULT_CARPETAS = [
  { id: 'general', nombre: 'General', emoji: '📝' },
]

export default function Notas() {
  const [carpetas, setCarpetas] = useSyncedState(CARPETAS_KEY, DEFAULT_CARPETAS)
  const [notas,    setNotas]    = useSyncedState(NOTAS_KEY, [])
  const [openId,   setOpenId]   = useState(null)
  const [nuevaCarpeta, setNuevaCarpeta] = useState(false)
  const [nombreNueva,  setNombreNueva]  = useState('')
  const [emojiNueva,   setEmojiNueva]   = useState(EMOJIS_PRESET[0])
  const [editId, setEditId] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [confirmDelId, setConfirmDelId] = useState(null)
  const [texto, setTexto] = useState('')

  const folder = carpetas.find(c => c.id === openId)
  const notasFolder = notas.filter(n => n.folderId === openId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function crearCarpeta() {
    const nombre = nombreNueva.trim()
    if (!nombre) return
    setCarpetas(prev => [...prev, { id: uid(), nombre, emoji: emojiNueva }])
    setNombreNueva(''); setEmojiNueva(EMOJIS_PRESET[0]); setNuevaCarpeta(false)
  }

  function guardarEdicion(id) {
    const nombre = editNombre.trim()
    if (!nombre) { setEditId(null); return }
    setCarpetas(prev => prev.map(c => c.id === id ? { ...c, nombre } : c))
    setEditId(null)
  }

  function borrarCarpeta(id) {
    // Las notas de la carpeta borrada pasan a "General" en vez de perderse.
    const destino = carpetas.find(c => c.id !== id)?.id
    if (destino) {
      setNotas(prev => prev.map(n => n.folderId === id ? { ...n, folderId: destino } : n))
    } else {
      setNotas(prev => prev.filter(n => n.folderId !== id))
    }
    setCarpetas(prev => prev.filter(c => c.id !== id))
    setConfirmDelId(null)
  }

  function agregarNota() {
    const t = texto.trim()
    if (!t || !openId) return
    setNotas(prev => [...prev, { id: uid(), folderId: openId, texto: t, createdAt: new Date().toISOString() }])
    setTexto('')
  }

  function borrarNota(id) {
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  function contarNotas(folderId) {
    return notas.filter(n => n.folderId === folderId).length
  }

  // ══ Vista carpeta abierta ══
  if (folder) {
    return (
      <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box onClick={() => setOpenId(null)} sx={{ cursor: 'pointer', color: T2, display: 'flex', alignItems: 'center', px: 0.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </Box>
            <Typography sx={{ fontSize: 20 }}>{folder.emoji}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>{folder.nombre}</Typography>
          </Box>

          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH, p: 1.5 }}>
              <Box component="textarea" rows={2} value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) agregarNota() }}
                placeholder="Anotá algo rápido..."
                sx={{
                  width: '100%', boxSizing: 'border-box', border: 'none', resize: 'vertical',
                  fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', p: 0,
                }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Box component="button" onClick={agregarNota} disabled={!texto.trim()} sx={{
                  px: 1.75, py: 0.625, borderRadius: '8px', border: 'none',
                  bgcolor: texto.trim() ? GREEN : '#F3F4F6', color: texto.trim() ? '#fff' : T2,
                  fontWeight: 700, fontSize: 12.5, cursor: texto.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                }}>Agregar</Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ px: 3, pb: 6, display: 'flex', flexDirection: 'column', gap: 0.875 }}>
            {notasFolder.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ fontSize: 13, color: T2 }}>Sin notas en esta carpeta todavía</Typography>
              </Box>
            ) : notasFolder.map(n => (
              <Box key={n.id} sx={{ bgcolor: CARD, borderRadius: '10px', border: `1px solid ${BORDER}`, p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, color: T1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{n.texto}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: T2, mt: 0.5 }}>{fmtFecha(n.createdAt)}</Typography>
                </Box>
                <Box onClick={() => borrarNota(n.id)} sx={{ flexShrink: 0, cursor: 'pointer', color: T2, opacity: 0.6, '&:hover': { opacity: 1, color: RED }, fontSize: 16, lineHeight: 1 }}>×</Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    )
  }

  // ══ Vista grilla de carpetas ══
  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Anotaciones</Typography>
            <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Tus categorías y notas, todo en un solo lugar</Typography>
          </Box>
          <Box onClick={() => setNuevaCarpeta(v => !v)} sx={{
            px: 1.75, py: 0.875, borderRadius: '10px', cursor: 'pointer', bgcolor: GREEN, color: '#fff',
            fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva categoría
          </Box>
        </Box>

        {nuevaCarpeta && (
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH, p: 1.75 }}>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25, flexWrap: 'wrap' }}>
                {EMOJIS_PRESET.map(e => (
                  <Box key={e} onClick={() => setEmojiNueva(e)} sx={{
                    width: 34, height: 34, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, cursor: 'pointer', border: '1.5px solid', borderColor: emojiNueva === e ? GREEN : BORDER,
                    bgcolor: emojiNueva === e ? alpha(GREEN, 0.1) : 'transparent',
                  }}>{e}</Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Box component="input" value={nombreNueva} onChange={e => setNombreNueva(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && crearCarpeta()}
                  placeholder="Nombre de la categoría" autoFocus
                  sx={{ flex: 1, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.25, py: 0.75, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
                <Box component="button" onClick={crearCarpeta} sx={{ px: 1.75, borderRadius: '8px', border: 'none', bgcolor: T1, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Crear</Box>
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ px: 3, pb: 6, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.25 }}>
          {carpetas.map(c => {
            const n = contarNotas(c.id)
            const isEditing = editId === c.id
            const isConfirming = confirmDelId === c.id
            return (
              <Box key={c.id} sx={{
                bgcolor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH,
                p: 1.5, display: 'flex', alignItems: 'center', gap: 1,
              }}>
                {isEditing ? (
                  <Box component="input" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarEdicion(c.id)}
                    onBlur={() => guardarEdicion(c.id)} autoFocus
                    sx={{ flex: 1, minWidth: 0, border: `1px solid ${GREEN}`, borderRadius: '6px', px: 0.875, py: 0.375, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none' }} />
                ) : (
                  <Box onClick={() => setOpenId(c.id)} sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.875, cursor: 'pointer' }}>
                    <Typography sx={{ fontSize: 12, color: T2, flexShrink: 0 }}>›</Typography>
                    <Typography sx={{ fontSize: 15, flexShrink: 0 }}>{c.emoji}</Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: T2 }}>{n} nota{n !== 1 ? 's' : ''}</Typography>
                    </Box>
                  </Box>
                )}

                {isConfirming ? (
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Box component="button" onClick={() => borrarCarpeta(c.id)} sx={{ fontSize: 10.5, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Sí</Box>
                    <Box component="button" onClick={() => setConfirmDelId(null)} sx={{ fontSize: 10.5, color: T2, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>No</Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                    <Box onClick={() => { setEditId(c.id); setEditNombre(c.nombre) }} sx={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, borderRadius: '6px', '&:hover': { bgcolor: '#F3F4F6' } }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                    </Box>
                    {carpetas.length > 1 && (
                      <Box onClick={() => setConfirmDelId(c.id)} sx={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, borderRadius: '6px', '&:hover': { bgcolor: alpha(RED, 0.1), color: RED } }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
