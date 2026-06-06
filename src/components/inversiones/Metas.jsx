import { useState } from 'react'
import { Box, Typography, Card, alpha, LinearProgress } from '@mui/material'

const EMPTY = { nombre: '', objetivoUSD: '', fechaLimite: '' }

function fmtDate(d) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function daysUntil(d) {
  if (!d) return null
  const diff = new Date(d) - new Date(new Date().toISOString().split('T')[0])
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function Metas({ metas, totalUSD, onAdd, onDelete, onEdit }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  function handleSave() {
    if (!form.nombre.trim() || !form.objetivoUSD) return
    if (editId) {
      onEdit(editId, { nombre: form.nombre.trim(), objetivoUSD: parseFloat(form.objetivoUSD), fechaLimite: form.fechaLimite })
    } else {
      onAdd({ id: Date.now(), nombre: form.nombre.trim(), objetivoUSD: parseFloat(form.objetivoUSD), fechaLimite: form.fechaLimite })
    }
    setForm(EMPTY)
    setShowForm(false)
    setEditId(null)
  }

  function startEdit(m) {
    setForm({ nombre: m.nombre, objetivoUSD: String(m.objetivoUSD), fechaLimite: m.fechaLimite || '' })
    setEditId(m.id)
    setShowForm(true)
  }

  function cancel() {
    setForm(EMPTY)
    setShowForm(false)
    setEditId(null)
  }

  const canSave = form.nombre.trim() && form.objetivoUSD

  return (
    <Box sx={{ p: 2 }}>
      {/* Valor actual del portafolio */}
      <Box sx={{ px: 2, py: 1.25, mb: 2, borderRadius: 1.5, bgcolor: alpha('#00A76F', 0.07), border: '1px solid', borderColor: alpha('#00A76F', 0.2) }}>
        <Typography sx={{ fontSize: 11, color: 'success.dark', fontWeight: 600 }}>
          Portafolio actual: <strong>${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
        </Typography>
      </Box>

      {/* Lista de metas */}
      {metas.length === 0 && !showForm ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', mb: 2 }}>
          <Typography fontSize={28} mb={0.5}>🎯</Typography>
          <Typography fontSize={13}>Sin metas creadas aún</Typography>
        </Box>
      ) : (
        metas.map(m => {
          const pct = m.objetivoUSD > 0 ? Math.min((totalUSD / m.objetivoUSD) * 100, 100) : 0
          const restante = Math.max(0, m.objetivoUSD - totalUSD)
          const dias = daysUntil(m.fechaLimite)
          const alcanzada = totalUSD >= m.objetivoUSD
          const urgente = dias !== null && dias <= 30 && !alcanzada

          return (
            <Card key={m.id} sx={{ mb: 1.5, p: 2, border: '1px solid', borderColor: alcanzada ? alpha('#4ade80', 0.4) : urgente ? alpha('#f87171', 0.3) : 'divider', bgcolor: alcanzada ? alpha('#4ade80', 0.04) : 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{m.nombre}</Typography>
                    {alcanzada && (
                      <Box sx={{ px: 0.875, py: 0.2, borderRadius: 1, bgcolor: alpha('#4ade80', 0.15), border: '1px solid', borderColor: alpha('#4ade80', 0.3) }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'success.main' }}>✓ ALCANZADA</Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                    Meta: ${m.objetivoUSD.toLocaleString('en-US', { minimumFractionDigits: 0 })} USD
                    {m.fechaLimite && (
                      <span style={{ marginLeft: 6, color: urgente ? '#f87171' : 'inherit' }}>
                        · {fmtDate(m.fechaLimite)}{dias !== null ? ` (${dias > 0 ? `${dias}d` : 'vencida'})` : ''}
                      </span>
                    )}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Box onClick={() => startEdit(m)}
                    sx={{ width: 26, height: 26, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'text.disabled', '&:hover': { bgcolor: alpha('#00A76F', 0.1), color: 'primary.main' } }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </Box>
                  <Box onClick={() => onDelete(m.id)}
                    sx={{ width: 26, height: 26, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'text.disabled', '&:hover': { bgcolor: alpha('#FF5630', 0.1), color: 'error.main' } }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Box>
                </Box>
              </Box>

              <LinearProgress
                variant="determinate" value={pct}
                sx={{ height: 7, borderRadius: 4, bgcolor: alpha('#919EAB', 0.12),
                  '& .MuiLinearProgress-bar': { bgcolor: alcanzada ? '#4ade80' : urgente ? '#f87171' : 'primary.main', borderRadius: 4 } }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 0 })} / ${m.objetivoUSD.toLocaleString('en-US', { minimumFractionDigits: 0 })} USD
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: alcanzada ? 'success.main' : 'text.secondary' }}>
                  {alcanzada ? '¡Meta alcanzada!' : `Faltan $${restante.toLocaleString('en-US', { minimumFractionDigits: 0 })}`} · {pct.toFixed(1)}%
                </Typography>
              </Box>
            </Card>
          )
        })
      )}

      {/* Formulario */}
      {!showForm ? (
        <Box onClick={() => setShowForm(true)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5, borderRadius: 1.5, border: '1px dashed', borderColor: 'primary.main', cursor: 'pointer', color: 'primary.main', '&:hover': { bgcolor: alpha('#00A76F', 0.04) } }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'primary.main' }}>Nueva meta</Typography>
        </Box>
      ) : (
        <Card sx={{ p: 2, border: '1px solid', borderColor: alpha('#00A76F', 0.3), bgcolor: alpha('#00A76F', 0.03) }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
            {editId ? 'Editar meta' : 'Nueva meta'}
          </Typography>
          <Box sx={{ mb: 1.25 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Nombre</Typography>
            <Box component="input" placeholder="Ej: Fondo de emergencia" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              sx={{ width: '100%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: 'primary.main' } }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Objetivo (USD)</Typography>
              <Box component="input" type="number" placeholder="10000" value={form.objetivoUSD} onChange={e => setForm(f => ({ ...f, objetivoUSD: e.target.value }))}
                sx={{ width: '100%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: 'primary.main' } }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Fecha límite</Typography>
              <Box component="input" type="date" value={form.fechaLimite} onChange={e => setForm(f => ({ ...f, fechaLimite: e.target.value }))}
                sx={{ width: '100%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: 'primary.main' } }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box component="button" onClick={cancel}
              sx={{ flex: 1, py: 0.875, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'transparent', color: 'text.secondary', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              Cancelar
            </Box>
            <Box component="button" onClick={handleSave} disabled={!canSave}
              sx={{ flex: 2, py: 0.875, borderRadius: 1.5, border: 'none', bgcolor: canSave ? 'primary.main' : alpha('#919EAB', 0.16), color: canSave ? '#fff' : 'text.disabled', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: canSave ? 'pointer' : 'not-allowed' }}>
              {editId ? 'Guardar cambios' : 'Crear meta'}
            </Box>
          </Box>
        </Card>
      )}
    </Box>
  )
}
