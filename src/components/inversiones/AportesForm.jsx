import { useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'

const T1     = '#111318'
const T2     = '#6B7280'
const GREEN  = '#00A76F'
const RED    = '#DC2626'
const BORDER = '#E5E7EB'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'

const EMPTY = (firstTicker = '') => ({ fecha: new Date().toISOString().split('T')[0], ticker: firstTicker, usd: '', precioCompra: '' })

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function FieldLabel({ children }) {
  return <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>{children}</Typography>
}

export default function AportesForm({ portfolio = [], aportes, onAdd, onDelete }) {
  const tickers = portfolio.map(p => p.ticker)
  const [form, setForm] = useState(() => EMPTY(tickers[0] || ''))
  const [showForm, setShowForm] = useState(false)

  const usd       = parseFloat(form.usd) || 0
  const precio    = parseFloat(form.precioCompra) || 0
  const sharesCalc = precio > 0 ? usd / precio : 0

  function handleAdd() {
    if (!usd || !precio) return
    onAdd({ id: Date.now(), fecha: form.fecha, ticker: form.ticker, usd, precioCompra: precio, shares: sharesCalc })
    setForm(EMPTY(tickers[0] || ''))
    setShowForm(false)
  }

  const allTickers = [...new Set([...tickers, ...aportes.map(a => a.ticker)])]
  const totalesByTicker = allTickers.reduce((acc, t) => {
    const txs = aportes.filter(a => a.ticker === t)
    acc[t] = { usd: txs.reduce((s, a) => s + a.usd, 0), shares: txs.reduce((s, a) => s + a.shares, 0), count: txs.length }
    return acc
  }, {})
  const totalGeneral = aportes.reduce((s, a) => s + a.usd, 0)
  const sorted = [...aportes].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const inputSx = { width: '100%', bgcolor: '#fff', border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: GREEN } }

  return (
    <Box sx={{ p: 2 }}>
      {/* Resumen por ticker */}
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
        Total aportado · ${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {allTickers.filter(t => totalesByTicker[t].count > 0).map(t => (
          <Box key={t} sx={{ px: 1.5, py: 1, flex: '1 1 auto', minWidth: 90, bgcolor: '#fff', borderRadius: '10px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: T1 }}>{t}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>${totalesByTicker[t].usd.toLocaleString('en-US', { minimumFractionDigits: 0 })}</Typography>
            <Typography sx={{ fontSize: 10, color: T2 }}>{totalesByTicker[t].shares.toFixed(5)} acc</Typography>
          </Box>
        ))}
      </Box>

      {/* Botón / Formulario */}
      {!showForm ? (
        <Box onClick={() => setShowForm(true)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5, mb: 2, borderRadius: '10px', border: `1px dashed ${alpha(GREEN, 0.5)}`, cursor: 'pointer', color: GREEN, bgcolor: alpha(GREEN, 0.03) }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>Registrar aporte</Typography>
        </Box>
      ) : (
        <Box sx={{ p: 2, mb: 2, bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Nuevo aporte</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <FieldLabel>Ticker</FieldLabel>
              <Box component="select" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                sx={{ ...inputSx, cursor: 'pointer' }}>
                {tickers.length === 0
                  ? <option value="">Sin posiciones</option>
                  : tickers.map(t => <option key={t} value={t}>{t}</option>)
                }
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <FieldLabel>Fecha</FieldLabel>
              <Box component="input" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} sx={inputSx} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <FieldLabel>Monto (USD)</FieldLabel>
              <Box component="input" type="number" placeholder="0.00" value={form.usd} onChange={e => setForm(f => ({ ...f, usd: e.target.value }))} sx={inputSx} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <FieldLabel>Precio compra (USD)</FieldLabel>
              <Box component="input" type="number" placeholder="0.00" value={form.precioCompra} onChange={e => setForm(f => ({ ...f, precioCompra: e.target.value }))} sx={inputSx} />
            </Box>
          </Box>
          {sharesCalc > 0 && (
            <Box sx={{ px: 1.5, py: 0.875, mb: 1, borderRadius: '8px', bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.2)}` }}>
              <Typography sx={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>
                ≈ {sharesCalc.toFixed(6)} acciones de {form.ticker}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box component="button" onClick={() => { setShowForm(false); setForm(EMPTY) }}
              sx={{ flex: 1, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              Cancelar
            </Box>
            <Box component="button" onClick={handleAdd} disabled={!usd || !precio}
              sx={{ flex: 2, py: 0.875, borderRadius: '8px', border: 'none', bgcolor: usd && precio ? GREEN : alpha('#919EAB', 0.16), color: usd && precio ? '#fff' : T2, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: usd && precio ? 'pointer' : 'not-allowed' }}>
              Registrar aporte
            </Box>
          </Box>
        </Box>
      )}

      {/* Historial */}
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
        Historial de aportes
      </Typography>
      {sorted.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: T2 }}>Sin aportes registrados aún</Typography>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH, overflow: 'hidden' }}>
          {sorted.map((a, i) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375, borderBottom: i < sorted.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '8px', flexShrink: 0, bgcolor: '#F3F4F6', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 900, color: T2 }}>{a.ticker}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{a.ticker} · ${a.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</Typography>
                <Typography sx={{ fontSize: 11, color: T2, mt: 0.2 }}>
                  {fmtDate(a.fecha)} · {a.shares.toFixed(6)} acc · ${a.precioCompra.toLocaleString('en-US', { minimumFractionDigits: 2 })}/acc
                </Typography>
              </Box>
              <Box onClick={() => onDelete(a.id)}
                sx={{ width: 26, height: 26, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, flexShrink: 0, '&:hover': { bgcolor: alpha(RED, 0.08), color: RED } }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
