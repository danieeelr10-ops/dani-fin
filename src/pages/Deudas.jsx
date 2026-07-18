import { useState, useMemo } from 'react'
import { Box, Typography, Collapse, alpha } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'
import { useSnackbar } from 'src/context/SnackbarContext'
import { formatMoney } from 'src/utils/format'

const BG     = '#F7F7F8'
const CARD   = '#FFFFFF'
const T1     = '#111318'
const T2     = '#6B7280'
const GREEN  = '#00A76F'
const RED    = '#DC2626'
const AMBER  = '#D97706'
const BORDER = '#E5E7EB'

function parseAmt(s) { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n }
function fmtInput(s) { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) || n === 0 ? '' : n.toLocaleString('es-CO') }
function todayISO() { return new Date().toISOString().split('T')[0] }

function ProgressBar({ pct, saldada }) {
  const color = saldada ? GREEN : pct > 0.8 ? GREEN : pct > 0.4 ? AMBER : RED
  return (
    <Box sx={{ height: 5, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', mt: 0.75 }}>
      <Box sx={{ height: '100%', width: `${Math.min(pct, 1) * 100}%`, bgcolor: color, borderRadius: 3, transition: 'width 0.4s' }} />
    </Box>
  )
}

function FieldInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>{label}</Typography>
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
          '&:focus': { borderColor: GREEN },
        }}
      />
    </Box>
  )
}

function NuevaDeudaForm({ onSave, onCancel }) {
  const [acreedor, setAcreedor] = useState('')
  const [concepto, setConcepto] = useState('')
  const [monto,    setMonto]    = useState('')
  const [fecha,    setFecha]    = useState(todayISO())

  function handleSave() {
    const m = parseAmt(monto)
    if (!acreedor.trim() || !m) return
    onSave({ acreedor: acreedor.trim(), concepto: concepto.trim(), montoTotal: m, fecha })
  }

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', p: 2, border: `1px solid ${BORDER}`, mb: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1.5 }}>Nueva deuda</Typography>
      <FieldInput label="A quién le debo" value={acreedor} onChange={setAcreedor} placeholder="Nombre del acreedor" />
      <FieldInput label="Concepto (opcional)" value={concepto} onChange={setConcepto} placeholder="Ej: préstamo viaje, compra celular…" />
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Monto total</Typography>
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
            '&:focus': { borderColor: GREEN },
          }}
        />
      </Box>
      <FieldInput label="Fecha" value={fecha} onChange={setFecha} type="date" />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box onClick={onCancel} sx={{ flex: 1, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T2 }}>Cancelar</Typography>
        </Box>
        <Box onClick={handleSave} sx={{ flex: 2, py: 0.875, borderRadius: '10px', bgcolor: RED, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.8 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Guardar deuda</Typography>
        </Box>
      </Box>
    </Box>
  )
}

function AbonoForm({ onSave, onCancel }) {
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [nota,  setNota]  = useState('')

  function handleSave() {
    const m = parseAmt(monto)
    if (!m) return
    onSave({ monto: m, fecha, nota: nota.trim() })
  }

  return (
    <Box sx={{ bgcolor: '#F9FAFB', borderRadius: '10px', p: 1.5, border: `1px solid ${BORDER}`, mt: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: T1, mb: 1 }}>Registrar abono</Typography>
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Monto</Typography>
        <Box
          component="input"
          type="text"
          inputMode="numeric"
          value={fmtInput(monto)}
          onChange={e => setMonto(e.target.value)}
          placeholder="$ 0"
          sx={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${BORDER}`, borderRadius: '8px',
            px: 1.25, py: 0.75, fontSize: 13, fontFamily: 'inherit',
            color: T1, outline: 'none', bgcolor: '#fff',
            '&:focus': { borderColor: GREEN },
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Fecha</Typography>
          <Box
            component="input"
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            sx={{
              width: '100%', boxSizing: 'border-box',
              border: `1px solid ${BORDER}`, borderRadius: '8px',
              px: 1.25, py: 0.75, fontSize: 13, fontFamily: 'inherit',
              color: T1, outline: 'none', bgcolor: '#fff',
              '&:focus': { borderColor: GREEN },
            }}
          />
        </Box>
      </Box>
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Nota (opcional)</Typography>
        <Box
          component="input"
          type="text"
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Transferencia, efectivo…"
          sx={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${BORDER}`, borderRadius: '8px',
            px: 1.25, py: 0.75, fontSize: 13, fontFamily: 'inherit',
            color: T1, outline: 'none', bgcolor: '#fff',
            '&:focus': { borderColor: GREEN },
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box onClick={onCancel} sx={{ flex: 1, py: 0.75, borderRadius: '8px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>Cancelar</Typography>
        </Box>
        <Box onClick={handleSave} sx={{ flex: 2, py: 0.75, borderRadius: '8px', bgcolor: GREEN, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.8 } }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>+ Abono</Typography>
        </Box>
      </Box>
    </Box>
  )
}

function DeudaCard({ deuda, onAddAbono, onDeleteAbono, onDeleteDeuda }) {
  const [open,       setOpen]       = useState(false)
  const [abonoOpen,  setAbonoOpen]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const totalAbonado = (deuda.abonos || []).reduce((s, a) => s + a.monto, 0)
  const saldo        = Math.max(deuda.montoTotal - totalAbonado, 0)
  const pct          = deuda.montoTotal > 0 ? totalAbonado / deuda.montoTotal : 0
  const saldada      = saldo === 0

  const statusColor = saldada ? GREEN : pct > 0.5 ? AMBER : RED
  const statusLabel = saldada ? 'Saldada' : 'Pendiente'

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', border: `1px solid ${BORDER}`, mb: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Header row */}
      <Box onClick={() => setOpen(o => !o)} sx={{ px: 2, pt: 1.75, pb: 1.5, cursor: 'pointer' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{deuda.acreedor}</Typography>
            {deuda.concepto && <Typography sx={{ fontSize: 12, color: T2, mt: 0.2 }}>{deuda.concepto}</Typography>}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: saldada ? GREEN : RED }}>
              {formatMoney(saldo)}
            </Typography>
            <Typography sx={{ fontSize: 10, color: T2 }}>de {formatMoney(deuda.montoTotal)}</Typography>
          </Box>
        </Box>

        <ProgressBar pct={pct} saldada={saldada} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: statusColor, bgcolor: alpha(statusColor, 0.1), px: 0.75, py: 0.2, borderRadius: '4px' }}>
            {statusLabel}
          </Typography>
          <Typography sx={{ fontSize: 11, color: T2 }}>
            {Math.round(pct * 100)}% pagado
          </Typography>
        </Box>
      </Box>

      {/* Expanded detail */}
      <Collapse in={open}>
        <Box sx={{ borderTop: `1px solid ${BORDER}`, px: 2, pt: 1.25, pb: 1.75 }}>

          {/* Abonos list */}
          {(deuda.abonos || []).length > 0 ? (
            <Box sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Abonos
              </Typography>
              {[...(deuda.abonos || [])].reverse().map(a => (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.6, borderBottom: `1px solid #F3F4F6` }}>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{formatMoney(a.monto)}</Typography>
                    <Typography sx={{ fontSize: 11, color: T2 }}>{a.fecha}{a.nota ? ` · ${a.nota}` : ''}</Typography>
                  </Box>
                  <Box
                    onClick={() => onDeleteAbono(deuda.id, a.id)}
                    sx={{ fontSize: 16, color: '#D1D5DB', cursor: 'pointer', px: 0.5, '&:active': { color: RED } }}
                  >
                    ×
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12, color: T2, mb: 1.25, textAlign: 'center', py: 0.5 }}>
              Sin abonos registrados
            </Typography>
          )}

          {/* Abono form */}
          {!saldada && (
            <>
              {abonoOpen ? (
                <AbonoForm
                  onSave={abono => { onAddAbono(deuda.id, abono); setAbonoOpen(false) }}
                  onCancel={() => setAbonoOpen(false)}
                />
              ) : (
                <Box onClick={() => setAbonoOpen(true)} sx={{ py: 0.75, borderRadius: '10px', border: `1px dashed ${GREEN}`, textAlign: 'center', cursor: 'pointer', mb: 1, '&:active': { opacity: 0.7 } }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: GREEN }}>+ Registrar abono</Typography>
                </Box>
              )}
            </>
          )}

          {/* Delete deuda */}
          {!confirmDel ? (
            <Box onClick={() => setConfirmDel(true)} sx={{ textAlign: 'center', cursor: 'pointer', mt: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: '#D1D5DB', '&:active': { color: RED } }}>Eliminar deuda</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Box onClick={() => setConfirmDel(false)} sx={{ flex: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, textAlign: 'center', cursor: 'pointer' }}>
                <Typography sx={{ fontSize: 12, color: T2 }}>Cancelar</Typography>
              </Box>
              <Box onClick={() => onDeleteDeuda(deuda.id)} sx={{ flex: 1, py: 0.625, borderRadius: '8px', bgcolor: RED, textAlign: 'center', cursor: 'pointer' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Eliminar</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

export default function Deudas() {
  const { state, addDeuda, deleteDeuda, addAbono, deleteAbono } = useFinanzas()
  const { showToast } = useSnackbar()
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState('activas') // 'activas' | 'saldadas'

  const deudas = state.deudas || []

  const { activas, saldadas, totalPendiente } = useMemo(() => {
    let totalPendiente = 0
    const activas = []
    const saldadas = []
    deudas.forEach(d => {
      const abonado = (d.abonos || []).reduce((s, a) => s + a.monto, 0)
      const saldo = Math.max(d.montoTotal - abonado, 0)
      if (saldo === 0) saldadas.push(d)
      else { activas.push(d); totalPendiente += saldo }
    })
    return { activas, saldadas, totalPendiente }
  }, [deudas])

  const lista = tab === 'activas' ? activas : saldadas

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: BG, pb: 10 }}>
      {/* Header */}
      <Box sx={{ bgcolor: CARD, borderBottom: `1px solid ${BORDER}`, px: 2, pt: 2.5, pb: 2 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: T1 }}>Deudas</Typography>
        {totalPendiente > 0 && (
          <Box sx={{ mt: 1, p: 1.25, bgcolor: alpha(RED, 0.06), borderRadius: '10px', border: `1px solid ${alpha(RED, 0.15)}` }}>
            <Typography sx={{ fontSize: 11, color: RED, fontWeight: 600 }}>Total pendiente</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: RED }}>{formatMoney(totalPendiente)}</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        {/* Nueva deuda button */}
        {!showForm && (
          <Box
            onClick={() => setShowForm(true)}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, py: 1.25, borderRadius: '12px', border: `1.5px dashed ${RED}`, cursor: 'pointer', mb: 2, '&:active': { opacity: 0.7 } }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: RED }}>+ Nueva deuda</Typography>
          </Box>
        )}

        {/* Form */}
        {showForm && (
          <NuevaDeudaForm
            onSave={deuda => { addDeuda(deuda); setShowForm(false); showToast('Deuda registrada', 'success') }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Tabs */}
        {deudas.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {[['activas', `Activas (${activas.length})`], ['saldadas', `Saldadas (${saldadas.length})`]].map(([key, label]) => (
              <Box
                key={key}
                onClick={() => setTab(key)}
                sx={{
                  px: 1.5, py: 0.6, borderRadius: '8px', cursor: 'pointer',
                  bgcolor: tab === key ? (key === 'activas' ? alpha(RED, 0.1) : alpha(GREEN, 0.1)) : 'transparent',
                  border: `1px solid ${tab === key ? (key === 'activas' ? alpha(RED, 0.3) : alpha(GREEN, 0.3)) : BORDER}`,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: tab === key ? (key === 'activas' ? RED : GREEN) : T2 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* List */}
        {lista.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 32, mb: 1 }}>🎉</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: T2 }}>
              {tab === 'activas' ? 'Sin deudas activas' : 'Sin deudas saldadas'}
            </Typography>
          </Box>
        ) : (
          lista.map(d => (
            <DeudaCard
              key={d.id}
              deuda={d}
              onAddAbono={(deudaId, abono) => { addAbono(deudaId, abono); showToast('Abono registrado', 'success') }}
              onDeleteAbono={(deudaId, abonoId) => { deleteAbono(deudaId, abonoId); showToast('Abono eliminado', 'info') }}
              onDeleteDeuda={id => { deleteDeuda(id); showToast('Deuda eliminada', 'info') }}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
