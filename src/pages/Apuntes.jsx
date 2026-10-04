import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Collapse } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'
import { useSnackbar } from 'src/context/SnackbarContext'
import { formatMoney } from 'src/utils/format'
import { generarExtractoPDF } from 'src/utils/extractoPdf'

const BG     = '#F7F7F8'
const CARD   = '#FFFFFF'
const T1     = '#111318'
const T2     = '#6B7280'
const GREEN  = '#00A76F'
const RED    = '#DC2626'
const AMBER  = '#D97706'
const BLUE   = '#3B82F6'
const BORDER = '#E5E7EB'

const EMOJIS_PRESET = ['📁', '⚽', '🏆', '📊', '🏋️', '🎓', '🏢', '🎵', '🎨', '🚗']

function parseAmt(s) { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n }
function fmtInput(s) { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) || n === 0 ? '' : n.toLocaleString('es-CO') }
function todayISO() { return new Date().toLocaleDateString('en-CA') }
function fmtFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function InputField({ label, value, onChange, type = 'text', placeholder, multiline }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>{label}</Typography>
      {multiline ? (
        <Box
          component="textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          sx={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            border: `1px solid ${BORDER}`, borderRadius: '10px',
            px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit',
            color: T1, outline: 'none', bgcolor: '#fff', lineHeight: 1.5,
            '&:focus': { borderColor: BLUE },
          }}
        />
      ) : (
        <Box
          component="input"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          sx={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${BORDER}`, borderRadius: '10px',
            px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit',
            color: T1, outline: 'none', bgcolor: '#fff',
            '&:focus': { borderColor: BLUE },
          }}
        />
      )}
    </Box>
  )
}

// ── CUENTA EXTERNA (pagos/reportes tipo Club) ────────────────────────────────

function PagoForm({ onSave, onCancel }) {
  const [movimiento, setMovimiento] = useState('Egreso') // 'Ingreso' | 'Egreso'
  const [concepto, setConcepto] = useState('')
  const [monto,    setMonto]    = useState('')
  const [fecha,    setFecha]    = useState(todayISO())
  const [nota,     setNota]     = useState('')

  function handleSave() {
    if (!concepto.trim()) return
    onSave({ movimiento, concepto: concepto.trim(), monto: parseAmt(monto), fecha, nota: nota.trim() })
  }

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', p: 2, border: `1px solid ${BORDER}`, mb: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1.5 }}>Nuevo pago</Typography>
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
        {[['Egreso', 'Sale'], ['Ingreso', 'Entra']].map(([key, label]) => (
          <Box key={key} onClick={() => setMovimiento(key)} sx={{
            flex: 1, py: 0.75, borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
            border: `1.5px solid ${movimiento === key ? (key === 'Ingreso' ? GREEN : BLUE) : BORDER}`,
            bgcolor: movimiento === key ? (key === 'Ingreso' ? '#ECFDF5' : '#EFF6FF') : '#fff',
          }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: movimiento === key ? (key === 'Ingreso' ? GREEN : BLUE) : T2 }}>
              {key === 'Ingreso' ? '+ ' : '− '}{label}
            </Typography>
          </Box>
        ))}
      </Box>
      <InputField label="Concepto" value={concepto} onChange={setConcepto} placeholder="Ej: Compra balones, pago árbitro…" />
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Monto (opcional)</Typography>
        <Box
          component="input"
          type="text"
          inputMode="numeric"
          value={fmtInput(monto)}
          onChange={e => setMonto(e.target.value)}
          placeholder="$ 0"
          sx={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${BORDER}`, borderRadius: '10px',
            px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit',
            color: T1, outline: 'none', bgcolor: '#fff',
            '&:focus': { borderColor: BLUE },
          }}
        />
      </Box>
      <InputField label="Fecha" value={fecha} onChange={setFecha} type="date" />
      <InputField label="Nota (opcional)" value={nota} onChange={setNota} placeholder="Detalle adicional, método de pago…" />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box onClick={onCancel} sx={{ flex: 1, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T2 }}>Cancelar</Typography>
        </Box>
        <Box onClick={handleSave} sx={{ flex: 2, py: 0.875, borderRadius: '10px', bgcolor: BLUE, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.8 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Guardar</Typography>
        </Box>
      </Box>
    </Box>
  )
}

function PagoCard({ pago, onToggle, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [open, setOpen] = useState(false)
  const esIngreso = pago.movimiento === 'Ingreso'
  const colorMonto = pago.reportado ? T2 : (esIngreso ? GREEN : BLUE)

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', border: `1px solid ${pago.reportado ? '#D1FAE5' : BORDER}`, mb: 1.25, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <Box onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1.5, cursor: 'pointer' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: esIngreso ? GREEN : BLUE, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: pago.reportado ? T2 : T1, textDecoration: pago.reportado ? 'line-through' : 'none', lineHeight: 1.3 }}>
                {pago.concepto}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>{fmtFecha(pago.fecha)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {pago.monto > 0 && (
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: colorMonto }}>
                {esIngreso ? '+ ' : '− '}{formatMoney(pago.monto)}
              </Typography>
            )}
            <Typography sx={{
              fontSize: 9, fontWeight: 700, mt: 0.25,
              color: pago.reportado ? GREEN : AMBER,
              bgcolor: pago.reportado ? '#D1FAE5' : '#FEF3C7',
              px: 0.75, py: 0.2, borderRadius: '4px', display: 'inline-block',
            }}>
              {pago.reportado ? 'Reportado' : 'Pendiente'}
            </Typography>
          </Box>
        </Box>
        {pago.nota && (
          <Typography sx={{ fontSize: 12, color: T2, mt: 0.5, lineHeight: 1.4 }}>{pago.nota}</Typography>
        )}
      </Box>

      <Collapse in={open}>
        <Box sx={{ borderTop: `1px solid ${BORDER}`, px: 2, py: 1.25, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box
            onClick={() => onToggle(pago.id)}
            sx={{ flex: 2, py: 0.625, borderRadius: '8px', bgcolor: pago.reportado ? '#FEF3C7' : '#D1FAE5', textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.7 } }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: pago.reportado ? AMBER : GREEN }}>
              {pago.reportado ? '↩ Pendiente' : '✓ Reportado'}
            </Typography>
          </Box>
          {!confirmDel ? (
            <Box onClick={() => setConfirmDel(true)} sx={{ flex: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer' }}>
              <Typography sx={{ fontSize: 12, color: '#D1D5DB' }}>Eliminar</Typography>
            </Box>
          ) : (
            <>
              <Box onClick={() => setConfirmDel(false)} sx={{ flex: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer' }}>
                <Typography sx={{ fontSize: 12, color: T2 }}>No</Typography>
              </Box>
              <Box onClick={() => onDelete(pago.id)} sx={{ flex: 1, py: 0.625, borderRadius: '8px', bgcolor: RED, textAlign: 'center', cursor: 'pointer' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Sí</Typography>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

function TabCuentaExterna({ cuenta, addPago, togglePago, deletePago, showToast }) {
  const [showForm, setShowForm] = useState(false)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'pendientes' | 'reportados'

  const pagos = cuenta.pagos || []
  const pendientes = pagos.filter(p => !p.reportado)
  const reportados = pagos.filter(p => p.reportado)
  const lista = filtro === 'pendientes' ? pendientes : filtro === 'reportados' ? reportados : pagos

  // Pagos viejos no tienen "movimiento" — se tratan como Egreso (comportamiento
  // original, antes de que existiera esta distinción)
  const esIngreso = p => p.movimiento === 'Ingreso'
  const pendIng = pendientes.filter(esIngreso)
  const pendEg  = pendientes.filter(p => !esIngreso(p))
  const totalPendIng = pendIng.reduce((s, p) => s + (p.monto || 0), 0)
  const totalPendEg  = pendEg.reduce((s, p) => s + (p.monto || 0), 0)
  const netoPendiente = totalPendIng - totalPendEg

  return (
    <Box>
      {(totalPendIng > 0 || totalPendEg > 0) && (
        <Box sx={{ p: 1.5, bgcolor: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', mb: 2 }}>
          <Typography sx={{ fontSize: 11, color: BLUE, fontWeight: 600, mb: 0.5 }}>Por reportar</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {totalPendEg > 0 && (
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: BLUE }}>− {formatMoney(totalPendEg)}</Typography>
                <Typography sx={{ fontSize: 11, color: T2 }}>{pendEg.length} egreso{pendEg.length !== 1 ? 's' : ''} pendiente{pendEg.length !== 1 ? 's' : ''}</Typography>
              </Box>
            )}
            {totalPendIng > 0 && (
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: GREEN }}>+ {formatMoney(totalPendIng)}</Typography>
                <Typography sx={{ fontSize: 11, color: T2 }}>{pendIng.length} ingreso{pendIng.length !== 1 ? 's' : ''} pendiente{pendIng.length !== 1 ? 's' : ''}</Typography>
              </Box>
            )}
          </Box>
          {totalPendIng > 0 && totalPendEg > 0 && (
            <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid #BFDBFE' }}>
              <Typography sx={{ fontSize: 11, color: T2, fontWeight: 600 }}>Total en teoría</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: netoPendiente >= 0 ? GREEN : RED }}>
                {netoPendiente >= 0 ? '+' : '−'} {formatMoney(Math.abs(netoPendiente))}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {!showForm && (
        <Box onClick={() => setShowForm(true)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.25, borderRadius: '12px', border: `1.5px dashed ${BLUE}`, cursor: 'pointer', mb: 2, '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: BLUE }}>+ Registrar pago en {cuenta.nombre}</Typography>
        </Box>
      )}

      {showForm && (
        <PagoForm
          onSave={p => { addPago(p); setShowForm(false); showToast('Pago registrado', 'success') }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {pagos.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, alignItems: 'center' }}>
          {[['todos', 'Todos'], ['pendientes', 'Pendientes'], ['reportados', 'Reportados']].map(([key, label]) => (
            <Box
              key={key}
              onClick={() => setFiltro(key)}
              sx={{ px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', border: `1px solid ${filtro === key ? BLUE : BORDER}`, bgcolor: filtro === key ? '#EFF6FF' : 'transparent' }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: filtro === key ? BLUE : T2 }}>{label}</Typography>
            </Box>
          ))}
          <Box sx={{ flex: 1 }} />
          <Box
            onClick={() => { generarExtractoPDF(cuenta, lista, { filtro }); showToast('Extracto generado', 'success') }}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2 }}>Extracto</Typography>
          </Box>
        </Box>
      )}

      {lista.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography sx={{ fontSize: 28, mb: 1 }}>{cuenta.emoji}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: T2 }}>
            {filtro === 'todos' ? 'Sin pagos registrados' : `Sin pagos ${filtro}`}
          </Typography>
        </Box>
      ) : (
        lista.map(p => (
          <PagoCard
            key={p.id}
            pago={p}
            onToggle={id => { togglePago(id); showToast('Estado actualizado', 'info') }}
            onDelete={id => { deletePago(id); showToast('Pago eliminado', 'info') }}
          />
        ))
      )}
    </Box>
  )
}

// ── CONFIGURAR CUENTAS EXTERNAS ───────────────────────────────────────────────

function ConfigCuentasExternas({ cuentasExternas, addCuentaExterna, updateCuentaExterna, deleteCuentaExterna, showToast, onClose }) {
  const [nombre, setNombre] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS_PRESET[0])
  const [confirmDelId, setConfirmDelId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editNombre, setEditNombre] = useState('')

  function crear() {
    if (!nombre.trim()) return
    addCuentaExterna({ nombre: nombre.trim(), emoji })
    showToast('Cuenta creada', 'success')
    setNombre('')
    setEmoji(EMOJIS_PRESET[0])
  }

  function guardarEdicion(id) {
    if (!editNombre.trim()) return
    updateCuentaExterna(id, { nombre: editNombre.trim() })
    setEditId(null)
    showToast('Cuenta actualizada', 'success')
  }

  return (
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 500, bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
      <Box onClick={e => e.stopPropagation()} sx={{ bgcolor: BG, width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: T1 }}>Configurar cuentas externas</Typography>
          <Box onClick={onClose} sx={{ cursor: 'pointer', color: T2, p: 0.5 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </Box>
        </Box>

        <Typography sx={{ fontSize: 12, color: T2, mb: 2, lineHeight: 1.5 }}>
          Cada cuenta es un seguimiento de pagos/reportes independiente — para contabilidad externa a tus finanzas personales (Club, Sports Manage, etc.).
        </Typography>

        {cuentasExternas.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
            {cuentasExternas.map(c => (
              <Box key={c.id} sx={{ bgcolor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}`, p: 1.5 }}>
                {editId === c.id ? (
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <Box component="input" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                      sx={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.25, py: 0.625, fontSize: 13, fontFamily: 'inherit', outline: 'none', '&:focus': { borderColor: BLUE } }} />
                    <Box onClick={() => guardarEdicion(c.id)} sx={{ px: 1.25, py: 0.625, borderRadius: '8px', bgcolor: BLUE, cursor: 'pointer' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Guardar</Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 18 }}>{c.emoji}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>{c.nombre}</Typography>
                      <Typography sx={{ fontSize: 11, color: T2 }}>{(c.pagos || []).length} pago{(c.pagos || []).length !== 1 ? 's' : ''}</Typography>
                    </Box>
                    <Box onClick={() => { setEditId(c.id); setEditNombre(c.nombre) }} sx={{ cursor: 'pointer', color: T2, p: 0.5 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </Box>
                    {confirmDelId === c.id ? (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Box onClick={() => setConfirmDelId(null)} sx={{ px: 1, py: 0.5, borderRadius: '6px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                          <Typography sx={{ fontSize: 11, color: T2 }}>No</Typography>
                        </Box>
                        <Box onClick={() => { deleteCuentaExterna(c.id); setConfirmDelId(null); showToast('Cuenta eliminada', 'info') }} sx={{ px: 1, py: 0.5, borderRadius: '6px', bgcolor: RED, cursor: 'pointer' }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Sí</Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box onClick={() => setConfirmDelId(c.id)} sx={{ cursor: 'pointer', color: '#D1D5DB', p: 0.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ bgcolor: CARD, borderRadius: '14px', p: 2, border: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1.25 }}>+ Nueva cuenta</Typography>
          <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap', mb: 1.25 }}>
            {EMOJIS_PRESET.map(e => (
              <Box key={e} onClick={() => setEmoji(e)} sx={{
                width: 36, height: 36, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, cursor: 'pointer', border: `1.5px solid ${emoji === e ? BLUE : BORDER}`, bgcolor: emoji === e ? '#EFF6FF' : '#fff',
              }}>
                {e}
              </Box>
            ))}
          </Box>
          <InputField label="Nombre" value={nombre} onChange={setNombre} placeholder="Ej: Sports Manage" />
          <Box onClick={crear} sx={{ py: 0.875, borderRadius: '10px', bgcolor: BLUE, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.8 } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Crear cuenta</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ── NOTAS / BLOG ─────────────────────────────────────────────────────────────

function NotaForm({ onSave, onCancel }) {
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')

  function handleSave() {
    if (!cuerpo.trim()) return
    onSave({ titulo: titulo.trim(), cuerpo: cuerpo.trim() })
  }

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', p: 2, border: `1px solid ${BORDER}`, mb: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1.5 }}>Nueva nota</Typography>
      <InputField label="Título (opcional)" value={titulo} onChange={setTitulo} placeholder="Ej: Recordatorio julio…" />
      <InputField label="Contenido" value={cuerpo} onChange={setCuerpo} placeholder="Escribe lo que necesites…" multiline />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box onClick={onCancel} sx={{ flex: 1, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T2 }}>Cancelar</Typography>
        </Box>
        <Box onClick={handleSave} sx={{ flex: 2, py: 0.875, borderRadius: '10px', bgcolor: T1, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.8 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Guardar</Typography>
        </Box>
      </Box>
    </Box>
  )
}

function NotaCard({ nota, onDelete }) {
  const [open, setOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', border: `1px solid ${BORDER}`, mb: 1.25, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <Box onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1.5, cursor: 'pointer' }}>
        {nota.titulo && (
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, mb: 0.375 }}>{nota.titulo}</Typography>
        )}
        <Typography sx={{ fontSize: 13, color: nota.titulo ? T2 : T1, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: open ? 'visible' : 'hidden' }}>
          {nota.cuerpo}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.75 }}>{fmtFecha(nota.fecha)}</Typography>
      </Box>

      <Collapse in={open}>
        <Box sx={{ borderTop: `1px solid ${BORDER}`, px: 2, py: 1.25, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {!confirmDel ? (
            <Box onClick={() => setConfirmDel(true)} sx={{ px: 1.5, py: 0.5, borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
              <Typography sx={{ fontSize: 12, color: '#D1D5DB' }}>Eliminar</Typography>
            </Box>
          ) : (
            <>
              <Box onClick={() => setConfirmDel(false)} sx={{ px: 1.5, py: 0.5, borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                <Typography sx={{ fontSize: 12, color: T2 }}>Cancelar</Typography>
              </Box>
              <Box onClick={() => onDelete(nota.id)} sx={{ px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: RED, cursor: 'pointer' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Eliminar</Typography>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

function TabNotas({ notas, addNota, deleteNota, showToast }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <Box>
      {!showForm && (
        <Box onClick={() => setShowForm(true)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.25, borderRadius: '12px', border: `1.5px dashed ${T2}`, cursor: 'pointer', mb: 2, '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T2 }}>+ Nueva nota</Typography>
        </Box>
      )}

      {showForm && (
        <NotaForm
          onSave={n => { addNota(n); setShowForm(false); showToast('Nota guardada', 'success') }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {notas.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography sx={{ fontSize: 28, mb: 1 }}>📝</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: T2 }}>Sin notas todavía</Typography>
        </Box>
      ) : (
        notas.map(n => (
          <NotaCard
            key={n.id}
            nota={n}
            onDelete={id => { deleteNota(id); showToast('Nota eliminada', 'info') }}
          />
        ))
      )}
    </Box>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────

export default function Apuntes() {
  const {
    state, addNota, deleteNota,
    addCuentaExterna, updateCuentaExterna, deleteCuentaExterna,
    addPagoExterno, togglePagoExterno, deletePagoExterno,
  } = useFinanzas()
  const { showToast } = useSnackbar()

  const cuentasExternas = state.cuentasExternas || []
  const notas = state.apuntes?.notas || []

  const [tab, setTab] = useState(() => cuentasExternas[0] ? `cuenta:${cuentasExternas[0].id}` : 'notas')
  const [showConfig, setShowConfig] = useState(false)

  // Si al montar todavía no había cuentas (p.ej. la migración de "Club" aún no
  // corría) y aparece una, selecciónala — para que no parezca que los datos
  // desaparecieron la primera vez que se abre esta pantalla tras el cambio.
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && tab === 'notas' && cuentasExternas.length > 0) {
      autoSelectedRef.current = true
      setTab(`cuenta:${cuentasExternas[0].id}`)
    }
  }, [cuentasExternas])

  const cuentaActiva = tab.startsWith('cuenta:') ? cuentasExternas.find(c => `cuenta:${c.id}` === tab) : null

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: BG, pb: 10 }}>
      {/* Header */}
      <Box sx={{ bgcolor: CARD, borderBottom: `1px solid ${BORDER}`, px: 2, pt: 2.5, pb: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: T1 }}>Apuntes</Typography>
          <Box onClick={() => setShowConfig(true)} sx={{ cursor: 'pointer', color: T2, p: 0.5, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {cuentasExternas.map(c => {
            const pendientesCount = (c.pagos || []).filter(p => !p.reportado).length
            const key = `cuenta:${c.id}`
            return (
              <Box
                key={key}
                onClick={() => setTab(key)}
                sx={{
                  px: 1.75, py: 1.25, cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap',
                  borderBottom: tab === key ? `2.5px solid ${BLUE}` : '2.5px solid transparent',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: tab === key ? 700 : 500, color: tab === key ? BLUE : T2 }}>
                  {c.emoji} {c.nombre}{pendientesCount > 0 ? ` · ${pendientesCount}` : ''}
                </Typography>
              </Box>
            )
          })}
          <Box
            onClick={() => setTab('notas')}
            sx={{
              px: 1.75, py: 1.25, cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap',
              borderBottom: tab === 'notas' ? `2.5px solid ${T1}` : '2.5px solid transparent',
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: tab === 'notas' ? 700 : 500, color: tab === 'notas' ? T1 : T2 }}>
              📝 Notas
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        {cuentaActiva && (
          <TabCuentaExterna
            cuenta={cuentaActiva}
            addPago={p => addPagoExterno(cuentaActiva.id, p)}
            togglePago={id => togglePagoExterno(cuentaActiva.id, id)}
            deletePago={id => deletePagoExterno(cuentaActiva.id, id)}
            showToast={showToast}
          />
        )}
        {tab === 'notas' && (
          <TabNotas
            notas={notas}
            addNota={addNota}
            deleteNota={deleteNota}
            showToast={showToast}
          />
        )}
        {cuentasExternas.length === 0 && tab !== 'notas' && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 32, mb: 1 }}>📁</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, mb: 0.5 }}>Sin cuentas externas todavía</Typography>
            <Typography sx={{ fontSize: 12, color: T2, mb: 2 }}>Crea una para llevar pagos y reportes de algo externo a tus finanzas — Club, Sports Manage, etc.</Typography>
            <Box onClick={() => setShowConfig(true)} sx={{ display: 'inline-flex', px: 2, py: 1, borderRadius: '10px', bgcolor: BLUE, cursor: 'pointer' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>+ Crear cuenta</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {showConfig && (
        <ConfigCuentasExternas
          cuentasExternas={cuentasExternas}
          addCuentaExterna={addCuentaExterna}
          updateCuentaExterna={updateCuentaExterna}
          deleteCuentaExterna={id => {
            deleteCuentaExterna(id)
            if (tab === `cuenta:${id}`) setTab('notas')
          }}
          showToast={showToast}
          onClose={() => setShowConfig(false)}
        />
      )}
    </Box>
  )
}
