import { useEffect, useState } from 'react'
import { Box, Typography, Switch, CircularProgress, alpha } from '@mui/material'
import { supabase } from 'src/lib/supabase'
import { useFeatures, ALL_FEATURES, ADMIN_EMAIL } from 'src/context/FeaturesContext'
import { useAuth } from 'src/context/AuthContext'
import { useNavigate } from 'react-router-dom'

const GREEN  = '#00A76F'
const BORDER = '#E5E7EB'
const T1     = '#111318'
const T2     = '#6B7280'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)  return 'justo ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export default function Admin() {
  const { isAdmin }               = useFeatures()
  const { user, loading: authLoading } = useAuth()
  const navigate                  = useNavigate()

  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState({})

  // ── Novedades ──
  const [novedad,        setNovedad]        = useState(null)
  const [historial,      setHistorial]      = useState([])
  const [nuevoMensaje,   setNuevoMensaje]   = useState('')
  const [savingNovedad,  setSavingNovedad]  = useState(false)
  const [showHistorial,  setShowHistorial]  = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) { navigate('/inicio'); return }
    loadUsers()
    loadNovedad()
  }, [isAdmin, authLoading])

  async function loadNovedad() {
    const { data } = await supabase
      .from('novedades')
      .select('*')
      .eq('activa', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setNovedad(data || null)
  }

  async function loadHistorial() {
    const { data } = await supabase
      .from('novedades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorial(data || [])
    setShowHistorial(true)
  }

  async function publicarNovedad() {
    const msg = nuevoMensaje.trim()
    if (!msg) return
    setSavingNovedad(true)
    // Desactivar novedad anterior si existe
    if (novedad) {
      await supabase.from('novedades').update({ activa: false }).eq('id', novedad.id)
    }
    const { data } = await supabase
      .from('novedades')
      .insert({ mensaje: msg, activa: true })
      .select()
      .single()
    setNovedad(data)
    setNuevoMensaje('')
    setSavingNovedad(false)
    if (showHistorial) loadHistorial()
  }

  async function desactivarNovedad() {
    if (!novedad) return
    await supabase.from('novedades').update({ activa: false }).eq('id', novedad.id)
    setNovedad(null)
    if (showHistorial) loadHistorial()
  }

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('user_features')
      .select('*')
      .order('email')
    setUsers(data || [])
    setLoading(false)
  }

  async function toggleFeature(userId, key, currentVal) {
    const userRow = users.find(u => u.user_id === userId)
    if (!userRow) return

    const newFeatures = { ...userRow.features, [key]: !currentVal }
    setSaving(s => ({ ...s, [`${userId}-${key}`]: true }))

    await supabase
      .from('user_features')
      .update({ features: newFeatures, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    setUsers(prev => prev.map(u =>
      u.user_id === userId ? { ...u, features: newFeatures } : u
    ))
    setSaving(s => { const n = { ...s }; delete n[`${userId}-${key}`]; return n })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60dvh' }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: T1 }}>Panel de administración</Typography>
        <Typography sx={{ fontSize: 14, color: T2, mt: 0.25 }}>{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</Typography>
      </Box>

      {/* ── Novedades ── */}
      <Box sx={{ borderRadius: '16px', border: `1px solid ${BORDER}`, bgcolor: '#fff', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`, bgcolor: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 16 }}>📢</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>Novedad para usuarios</Typography>
        </Box>

        <Box sx={{ p: 2.5 }}>
          {/* Novedad activa */}
          {novedad && (
            <Box sx={{ mb: 2, p: 1.5, borderRadius: '10px', bgcolor: alpha(GREEN, 0.05), border: `1px solid ${alpha(GREEN, 0.25)}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Activa · {timeAgo(novedad.created_at)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <Box component="button" onClick={() => {
                    localStorage.removeItem('dani_fin_novedad_' + novedad.id)
                    navigate('/inicio')
                  }} sx={{
                    px: 1.25, py: 0.25, borderRadius: '6px', border: `1px solid ${alpha(GREEN, 0.35)}`,
                    bgcolor: 'transparent', color: GREEN, fontWeight: 600, fontSize: 11,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                    👁 Ver banner
                  </Box>
                  <Box component="button" onClick={desactivarNovedad} sx={{
                    px: 1.25, py: 0.25, borderRadius: '6px', border: `1px solid ${alpha('#DC2626', 0.3)}`,
                    bgcolor: 'transparent', color: '#DC2626', fontWeight: 600, fontSize: 11,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                    Desactivar
                  </Box>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 13, color: T1, lineHeight: 1.55 }}>{novedad.mensaje}</Typography>
            </Box>
          )}

          {/* Formulario nueva novedad */}
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.75 }}>
              {novedad ? 'Publicar nueva (reemplaza la actual)' : 'Escribe la novedad'}
            </Typography>
            <Box
              component="textarea"
              value={nuevoMensaje}
              onChange={e => setNuevoMensaje(e.target.value)}
              placeholder="Ej: Ahora puedes editar las fechas de corte de tus TC desde Configuración..."
              rows={3}
              sx={{
                width: '100%', boxSizing: 'border-box', px: 1.5, py: 1,
                borderRadius: '10px', border: `1px solid ${BORDER}`,
                bgcolor: '#FAFAFA', fontSize: 13, fontFamily: 'inherit',
                color: T1, outline: 'none', resize: 'vertical', lineHeight: 1.55,
                '&:focus': { borderColor: GREEN, bgcolor: '#fff' },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Box component="button" onClick={publicarNovedad}
                disabled={!nuevoMensaje.trim() || savingNovedad}
                sx={{
                  px: 2.5, py: 0.875, borderRadius: '8px', border: 'none',
                  bgcolor: nuevoMensaje.trim() ? T1 : alpha('#919EAB', 0.16),
                  color: nuevoMensaje.trim() ? '#fff' : T2,
                  fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                  cursor: nuevoMensaje.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}>
                {savingNovedad ? 'Publicando...' : '📢 Publicar'}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Historial de novedades ── */}
      <Box sx={{ borderRadius: '16px', border: `1px solid ${BORDER}`, bgcolor: '#fff', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', mb: 3 }}>
        <Box
          onClick={() => showHistorial ? setShowHistorial(false) : loadHistorial()}
          sx={{ px: 2.5, py: 1.75, borderBottom: showHistorial ? `1px solid ${BORDER}` : 'none', bgcolor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { bgcolor: '#F3F4F6' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16 }}>🕐</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>Historial de novedades</Typography>
          </Box>
          <Box sx={{ color: T2, transform: showHistorial ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Box>

        {showHistorial && (
          <Box>
            {historial.length === 0 ? (
              <Box sx={{ px: 2.5, py: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, color: T2 }}>Sin novedades publicadas aún.</Typography>
              </Box>
            ) : historial.map((n, i) => (
              <Box key={n.id} sx={{
                px: 2.5, py: 1.75,
                borderBottom: i < historial.length - 1 ? `1px solid ${BORDER}` : 'none',
                bgcolor: n.activa ? alpha(GREEN, 0.03) : '#fff',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {n.activa
                      ? <Box sx={{ px: 0.875, py: 0.15, borderRadius: '5px', bgcolor: alpha(GREEN, 0.1), border: `1px solid ${alpha(GREEN, 0.25)}` }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: GREEN }}>ACTIVA</Typography>
                        </Box>
                      : <Box sx={{ px: 0.875, py: 0.15, borderRadius: '5px', bgcolor: '#F3F4F6', border: `1px solid ${BORDER}` }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2 }}>Archivada</Typography>
                        </Box>
                    }
                  </Box>
                  <Typography sx={{ fontSize: 11, color: T2 }}>{timeAgo(n.created_at)}</Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: T1, lineHeight: 1.55 }}>{n.mensaje}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {users.map(u => {
          const isMe = u.email === ADMIN_EMAIL
          return (
            <Box key={u.user_id} sx={{
              borderRadius: '16px', border: `1px solid ${BORDER}`,
              bgcolor: '#fff', overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {/* Header usuario */}
              <Box sx={{ px: 2.5, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: isMe ? alpha(GREEN, 0.04) : '#FAFAFA' }}>
                <Box sx={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: isMe ? `linear-gradient(135deg, #5BE49B, ${GREEN})` : '#E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: isMe ? '#fff' : T2 }}>
                    {(u.email?.[0] || '?').toUpperCase()}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, lineHeight: 1.2 }}>
                    {u.email || 'Sin email'}
                  </Typography>
                  {isMe && (
                    <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>Admin · Acceso completo</Typography>
                  )}
                </Box>
              </Box>

              {/* Features grid */}
              {!isMe && (
                <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 0.5 }}>
                  {Object.entries(ALL_FEATURES).map(([key, meta]) => {
                    const enabled = u.features?.[key] !== false
                    const isSaving = saving[`${u.user_id}-${key}`]
                    return (
                      <Box key={key} sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        px: 1.25, py: 0.875, borderRadius: '10px',
                        bgcolor: enabled ? alpha(GREEN, 0.06) : '#F9FAFB',
                        border: `1px solid ${enabled ? alpha(GREEN, 0.2) : BORDER}`,
                      }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: enabled ? T1 : T2 }}>
                          {meta.label}
                        </Typography>
                        {isSaving
                          ? <CircularProgress size={16} color="primary" />
                          : (
                            <Switch
                              size="small"
                              checked={enabled}
                              onChange={() => toggleFeature(u.user_id, key, enabled)}
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN },
                              }}
                            />
                          )
                        }
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )
        })}

        {users.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 14, color: T2 }}>No hay usuarios registrados aún.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
