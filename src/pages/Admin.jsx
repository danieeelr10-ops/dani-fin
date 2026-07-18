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

export default function Admin() {
  const { isAdmin } = useFeatures()
  const { user }    = useAuth()
  const navigate    = useNavigate()

  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState({})

  useEffect(() => {
    if (!isAdmin) { navigate('/inicio'); return }
    loadUsers()
  }, [isAdmin])

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
