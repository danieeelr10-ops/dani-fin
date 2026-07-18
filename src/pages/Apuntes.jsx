import { useState } from 'react'
import { Box, Typography, Collapse } from '@mui/material'
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
const BLUE   = '#3B82F6'
const BORDER = '#E5E7EB'

function parseAmt(s) { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n }
function fmtInput(s) { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) || n === 0 ? '' : n.toLocaleString('es-CO') }
function todayISO() { return new Date().toISOString().split('T')[0] }
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

// ── PAGOS CLUB ──────────────────────────────────────────────────────────────

function PagoClubForm({ onSave, onCancel }) {
  const [concepto, setConcepto] = useState('')
  const [monto,    setMonto]    = useState('')
  const [fecha,    setFecha]    = useState(todayISO())
  const [nota,     setNota]     = useState('')

  function handleSave() {
    if (!concepto.trim()) return
    onSave({ concepto: concepto.trim(), monto: parseAmt(monto), fecha, nota: nota.trim() })
  }

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', p: 2, border: `1px solid ${BORDER}`, mb: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1.5 }}>Nuevo pago del club</Typography>
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

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', border: `1px solid ${pago.reportado ? '#D1FAE5' : BORDER}`, mb: 1.25, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <Box onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1.5, cursor: 'pointer' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: pago.reportado ? T2 : T1, textDecoration: pago.reportado ? 'line-through' : 'none', lineHeight: 1.3 }}>
              {pago.concepto}
            </Typography>
            <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>{fmtFecha(pago.fecha)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            {pago.monto > 0 && (
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: pago.reportado ? T2 : BLUE }}>
                {formatMoney(pago.monto)}
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

function TabClub({ pagosClub, addPagoClub, togglePagoClub, deletePagoClub, showToast }) {
  const [showForm, setShowForm] = useState(false)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'pendientes' | 'reportados'

  const pendientes = pagosClub.filter(p => !p.reportado)
  const reportados = pagosClub.filter(p => p.reportado)
  const lista = filtro === 'pendientes' ? pendientes : filtro === 'reportados' ? reportados : pagosClub

  const totalPendiente = pendientes.reduce((s, p) => s + (p.monto || 0), 0)

  return (
    <Box>
      {totalPendiente > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', mb: 2 }}>
          <Typography sx={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>Por reportar al contador</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: BLUE }}>{formatMoney(totalPendiente)}</Typography>
          <Typography sx={{ fontSize: 11, color: T2 }}>{pendientes.length} pago{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</Typography>
        </Box>
      )}

      {!showForm && (
        <Box onClick={() => setShowForm(true)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.25, borderRadius: '12px', border: `1.5px dashed ${BLUE}`, cursor: 'pointer', mb: 2, '&:active': { opacity: 0.7 } }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: BLUE }}>+ Registrar pago del club</Typography>
        </Box>
      )}

      {showForm && (
        <PagoClubForm
          onSave={p => { addPagoClub(p); setShowForm(false); showToast('Pago registrado', 'success') }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {pagosClub.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
          {[['todos', 'Todos'], ['pendientes', 'Pendientes'], ['reportados', 'Reportados']].map(([key, label]) => (
            <Box
              key={key}
              onClick={() => setFiltro(key)}
              sx={{ px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', border: `1px solid ${filtro === key ? BLUE : BORDER}`, bgcolor: filtro === key ? '#EFF6FF' : 'transparent' }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: filtro === key ? BLUE : T2 }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {lista.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography sx={{ fontSize: 28, mb: 1 }}>⚽</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: T2 }}>
            {filtro === 'todos' ? 'Sin pagos registrados' : `Sin pagos ${filtro}`}
          </Typography>
        </Box>
      ) : (
        lista.map(p => (
          <PagoCard
            key={p.id}
            pago={p}
            onToggle={id => { togglePagoClub(id); showToast('Estado actualizado', 'info') }}
            onDelete={id => { deletePagoClub(id); showToast('Pago eliminado', 'info') }}
          />
        ))
      )}
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
  const { state, addPagoClub, togglePagoClub, deletePagoClub, addNota, deleteNota } = useFinanzas()
  const { showToast } = useSnackbar()
  const [tab, setTab] = useState('club')

  const pagosClub = state.apuntes?.pagosClub || []
  const notas     = state.apuntes?.notas     || []

  const pendientesCount = pagosClub.filter(p => !p.reportado).length

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: BG, pb: 10 }}>
      {/* Header */}
      <Box sx={{ bgcolor: CARD, borderBottom: `1px solid ${BORDER}`, px: 2, pt: 2.5, pb: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: T1, mb: 1.5 }}>Apuntes</Typography>

        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 0 }}>
          {[
            ['club', `⚽ Club${pendientesCount > 0 ? ` · ${pendientesCount}` : ''}`],
            ['notas', '📝 Notas'],
          ].map(([key, label]) => (
            <Box
              key={key}
              onClick={() => setTab(key)}
              sx={{
                px: 2, py: 1.25, cursor: 'pointer', position: 'relative',
                borderBottom: tab === key ? `2.5px solid ${key === 'club' ? BLUE : T1}` : '2.5px solid transparent',
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: tab === key ? 700 : 500, color: tab === key ? (key === 'club' ? BLUE : T1) : T2 }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        {tab === 'club' && (
          <TabClub
            pagosClub={pagosClub}
            addPagoClub={addPagoClub}
            togglePagoClub={togglePagoClub}
            deletePagoClub={deletePagoClub}
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
      </Box>
    </Box>
  )
}
