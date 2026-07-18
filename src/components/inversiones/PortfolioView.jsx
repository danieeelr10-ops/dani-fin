import { useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'

const T1 = '#111318'
const T2 = '#6B7280'
const GREEN = '#00A76F'
const RED = '#DC2626'
const BORDER = '#E5E7EB'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const BG = '#F7F7F8'
const BAR_COLORS = ['#60a5fa','#4ade80','#fbbf24','#a78bfa','#f87171','#34d399','#fb923c','#e879f9']

function fmt(n, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const EMPTY_FORM = {
  fecha: new Date().toISOString().split('T')[0],
  ticker: '',
  monto: '',
  precioCompra: '',
}

export default function PortfolioView({
  portfolio, precios, trm, trmLoading, trmFecha,
  preciosLoading, preciosFecha,
  aportes,
  onUpdatePrecios,
  onDeletePosition,
  onAddAporte, onDeleteAporte,
}) {
  const [showForm, setShowForm]       = useState(false)
  const [modoInput, setModoInput]     = useState('COP')
  const [form, setForm]               = useState(EMPTY_FORM)
  const [newTickerInput, setNewTickerInput] = useState('')
  const [expanded, setExpanded]       = useState({})
  const [editPrecios, setEditPrecios] = useState(null)
  const [editTrm, setEditTrm]         = useState('')
  const [confirmDel, setConfirmDel]   = useState(null)

  // ── Totales ──────────────────────────────────────────────────
  const totalActualUSD   = portfolio.reduce((s, p) => s + p.shares * (precios[p.ticker] || 0), 0)
  const totalActualCOP   = totalActualUSD * trm
  const totalInvertidoUSD = aportes.reduce((s, a) => s + a.usd, 0)
  const gananciaUSD      = totalActualUSD - totalInvertidoUSD
  const pctGanancia      = totalInvertidoUSD > 0 ? (gananciaUSD / totalInvertidoUSD) * 100 : 0

  // ── Por empresa ───────────────────────────────────────────────
  const tickerData = portfolio.map((p, idx) => {
    const precioActual  = precios[p.ticker] || 0
    const valorActual   = p.shares * precioActual
    const invertido     = aportes.filter(a => a.ticker === p.ticker).reduce((s, a) => s + a.usd, 0)
    const ganancia      = valorActual - invertido
    const pctGan        = invertido > 0 ? (ganancia / invertido) * 100 : 0
    const pctPortfolio  = totalActualUSD > 0 ? (valorActual / totalActualUSD) * 100 : 0
    const aportesT      = [...aportes.filter(a => a.ticker === p.ticker)].sort((a, b) => b.fecha.localeCompare(a.fecha))
    return { ...p, precioActual, valorActual, invertido, ganancia, pctGan, pctPortfolio, aportesT, color: BAR_COLORS[idx % BAR_COLORS.length] }
  })

  // ── Form ──────────────────────────────────────────────────────
  const resolvedTicker = newTickerInput.trim().toUpperCase()
  const montoNum  = parseFloat(form.monto) || 0
  const precioNum = parseFloat(form.precioCompra) || 0
  const montoUSD  = modoInput === 'COP' ? montoNum / trm : montoNum
  const montoCOP  = modoInput === 'COP' ? montoNum : montoNum * trm
  const sharesCalc = precioNum > 0 ? montoUSD / precioNum : 0
  const formValid  = resolvedTicker.length > 0 && montoUSD > 0 && precioNum > 0

  function handleSubmit() {
    if (!formValid) return
    onAddAporte({
      id: Date.now(),
      fecha: form.fecha,
      ticker: resolvedTicker,
      usd: montoUSD,
      cop: montoCOP,
      precioCompra: precioNum,
      shares: sharesCalc,
    })
    setForm(EMPTY_FORM)
    setNewTickerInput('')
    setShowForm(false)
  }

  function openEditPrecios() {
    const map = {}
    portfolio.forEach(p => { map[p.ticker] = String(precios[p.ticker] || '') })
    setEditPrecios(map); setEditTrm(String(trm))
  }
  function saveEditPrecios() {
    const newP = {}
    portfolio.forEach(p => { newP[p.ticker] = parseFloat(editPrecios[p.ticker]) || precios[p.ticker] || 0 })
    onUpdatePrecios(newP, parseFloat(editTrm) || trm)
    setEditPrecios(null)
  }

  const inputSx = {
    width: '100%', boxSizing: 'border-box', px: 1.5, py: 1,
    borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: '#fff',
    fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none',
    '&:focus': { borderColor: GREEN },
  }

  return (
    <Box sx={{ px: 2, pb: 10 }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              Portafolio actual
            </Typography>
            <Typography sx={{ fontSize: 32, fontWeight: 800, color: T1, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              ${fmt(totalActualUSD)}
            </Typography>
            <Typography sx={{ fontSize: 14, color: T2, mt: 0.25 }}>{fmtCOP(totalActualCOP)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            {totalInvertidoUSD > 0 && (
              <Box sx={{
                px: 1.25, py: 0.5, borderRadius: '8px', mb: 0.75, display: 'inline-block',
                bgcolor: gananciaUSD >= 0 ? alpha(GREEN, 0.08) : alpha(RED, 0.08),
                border: `1px solid ${gananciaUSD >= 0 ? alpha(GREEN, 0.2) : alpha(RED, 0.2)}`
              }}>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: gananciaUSD >= 0 ? GREEN : RED }}>
                  {gananciaUSD >= 0 ? '+' : ''}${fmt(gananciaUSD)}<br />
                  <span style={{ fontSize: 12 }}>({pctGanancia >= 0 ? '+' : ''}{pctGanancia.toFixed(1)}%)</span>
                </Typography>
              </Box>
            )}
            <Typography sx={{ fontSize: 11, color: T2, display: 'block' }}>
              Invertido ${fmt(totalInvertidoUSD)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: T2 }}>
              {trmLoading ? 'TRM…' : `TRM $${trm.toLocaleString('es-CO')}`}
              {trmFecha && !trmLoading && <span style={{ opacity: 0.6 }}> · {trmFecha}</span>}
            </Typography>
          </Box>
        </Box>

        <Box component="button" onClick={openEditPrecios} sx={{
          width: '100%', py: 0.75, borderRadius: '8px', border: `1px solid ${BORDER}`,
          bgcolor: BG, color: T2, fontWeight: 600, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          {preciosLoading ? 'Actualizando precios…' : `Actualizar precios${preciosFecha ? ` · al ${preciosFecha}` : ''}`}
        </Box>
      </Box>

      {/* ── Tarjetas por empresa ──────────────────────────────── */}
      {tickerData.map(td => (
        <Box key={td.ticker} sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: '14px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <Box sx={{ p: 2 }}>
            {/* Fila principal */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
              <Box sx={{
                width: 42, height: 42, borderRadius: '10px', bgcolor: BG, border: `1px solid ${BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Typography sx={{ fontSize: td.ticker.length > 4 ? 8 : 10, fontWeight: 900, color: T2 }}>{td.ticker}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{td.ticker}</Typography>
                    <Typography sx={{ fontSize: 11, color: T2 }}>
                      {td.shares.toFixed(5)} acc · ${fmt(td.precioActual)}/acc
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: T1 }}>${fmt(td.valorActual)}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: td.ganancia >= 0 ? GREEN : RED }}>
                      {td.ganancia >= 0 ? '+' : ''}${fmt(td.ganancia)} ({td.pctGan >= 0 ? '+' : ''}{td.pctGan.toFixed(1)}%)
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Barra */}
            <Box sx={{ height: 5, borderRadius: 3, bgcolor: BG, overflow: 'hidden', mb: 0.75 }}>
              <Box sx={{ height: '100%', width: `${td.pctPortfolio}%`, bgcolor: td.color, borderRadius: 3, transition: 'width 0.4s' }} />
            </Box>

            {/* Footer fila */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 11, color: T2 }}>
                Invertido ${fmt(td.invertido)} · {td.pctPortfolio.toFixed(1)}% del portafolio
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                <Box onClick={() => setExpanded(e => ({ ...e, [td.ticker]: !e[td.ticker] }))}
                  sx={{ fontSize: 11, color: GREEN, fontWeight: 600, cursor: 'pointer' }}>
                  {expanded[td.ticker] ? 'Ocultar' : 'Ver compras'}
                </Box>
                <Box onClick={() => setConfirmDel(td.ticker)}
                  sx={{ fontSize: 11, color: T2, cursor: 'pointer', '&:hover': { color: RED }, transition: 'color 0.15s' }}>
                  Eliminar
                </Box>
              </Box>
            </Box>

            {/* Historial de compras (expandible) */}
            {expanded[td.ticker] && (
              <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${BORDER}` }}>
                {td.aportesT.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: T2, textAlign: 'center', py: 1 }}>
                    Sin compras registradas aún
                  </Typography>
                ) : td.aportesT.map((a, i) => {
                  const valorHoy  = a.shares * td.precioActual
                  const ganAporte = valorHoy - a.usd
                  const pctAporte = a.usd > 0 ? (ganAporte / a.usd) * 100 : 0
                  return (
                    <Box key={a.id} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1, py: 1,
                      borderBottom: i < td.aportesT.length - 1 ? `1px solid ${BORDER}` : 'none',
                    }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: T1 }}>
                              {fmtDate(a.fecha)}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: T2 }}>
                              {a.shares.toFixed(6)} acc · ${fmt(a.precioCompra)}/acc
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: ganAporte >= 0 ? GREEN : RED }}>
                              {ganAporte >= 0 ? '+' : ''}${fmt(ganAporte)}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: T2 }}>
                              ${fmt(a.usd)} → ${fmt(valorHoy)} · {pctAporte >= 0 ? '+' : ''}{pctAporte.toFixed(1)}%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box onClick={() => onDeleteAporte(a.id)} sx={{
                        width: 24, height: 24, borderRadius: '6px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', color: T2, flexShrink: 0,
                        '&:hover': { bgcolor: alpha(RED, 0.08), color: RED },
                      }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        </Box>
      ))}

      {/* ── Estado vacío ─────────────────────────────────────── */}
      {portfolio.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '16px', bgcolor: alpha(GREEN, 0.08),
            border: `1.5px solid ${alpha(GREEN, 0.2)}`, mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, mb: 0.75 }}>
            Sin inversiones aún
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mb: 3, lineHeight: 1.5 }}>
            Registra tu primera compra e ingresa el ticker<br/>de la empresa (ej: QQQ, VOO, NVDA)
          </Typography>
          <Box component="button" onClick={() => setShowForm(true)} sx={{
            px: 3, py: 1.25, borderRadius: '12px', border: 'none',
            bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 15,
            fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex',
            alignItems: 'center', gap: 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar primera empresa
          </Box>
        </Box>
      )}

      {/* ── Botón registrar compra (cuando ya hay empresas) ──── */}
      {portfolio.length > 0 && (
        <Box component="button" onClick={() => setShowForm(true)} sx={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
          py: 1.375, borderRadius: '12px', border: 'none',
          bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 14,
          fontFamily: 'inherit', cursor: 'pointer', mb: 2,
          '&:active': { opacity: 0.85 },
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar compra
        </Box>
      )}

      {/* ── Modal: Registrar compra ───────────────────────────── */}
      {showForm && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', zIndex: 1300, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ width: '100%', bgcolor: '#fff', borderRadius: '20px 20px 0 0', p: 2.5, maxHeight: '92vh', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 700, color: T1 }}>Registrar compra</Typography>
              <Box onClick={() => setShowForm(false)} sx={{ cursor: 'pointer', color: T2, lineHeight: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </Box>
            </Box>

            {/* Empresa */}
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Empresa (ticker)</Typography>
              <Box component="input"
                placeholder="QQQ, NVDA, VOO, AAPL…"
                autoFocus
                value={newTickerInput}
                onChange={e => setNewTickerInput(e.target.value.toUpperCase())}
                sx={{ ...inputSx, letterSpacing: '0.05em', fontWeight: 700 }} />
              {portfolio.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.875, flexWrap: 'wrap' }}>
                  {portfolio.map(p => (
                    <Box key={p.ticker} onClick={() => setNewTickerInput(p.ticker)} sx={{
                      px: 1.25, py: 0.375, borderRadius: '6px', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: `1px solid ${BORDER}`,
                      bgcolor: newTickerInput === p.ticker ? T1 : BG,
                      color: newTickerInput === p.ticker ? '#fff' : T2,
                    }}>
                      {p.ticker}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Fecha */}
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Fecha de compra</Typography>
              <Box component="input" type="date" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} sx={inputSx} />
            </Box>

            {/* Monto con toggle COP/USD */}
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2 }}>Monto invertido</Typography>
                <Box sx={{ display: 'flex', bgcolor: '#F0F0F0', borderRadius: '6px', p: '2px' }}>
                  {['COP', 'USD'].map(m => (
                    <Box key={m} onClick={() => setModoInput(m)} sx={{
                      px: 1.25, py: 0.25, borderRadius: '5px', cursor: 'pointer',
                      bgcolor: modoInput === m ? '#fff' : 'transparent',
                      boxShadow: modoInput === m ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    }}>
                      <Typography sx={{ fontSize: 11, fontWeight: modoInput === m ? 700 : 500, color: modoInput === m ? T1 : T2 }}>{m}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="input" type="number"
                placeholder={modoInput === 'COP' ? 'Ej: 500000' : 'Ej: 120.00'}
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                sx={inputSx} />
              {montoNum > 0 && trm > 0 && (
                <Typography sx={{ fontSize: 11, color: T2, mt: 0.5 }}>
                  ≈ {modoInput === 'COP' ? `$${fmt(montoNum / trm)} USD` : fmtCOP(montoNum * trm)}
                </Typography>
              )}
            </Box>

            {/* Precio por acción */}
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>
                Precio de la acción al comprar (USD)
              </Typography>
              <Box component="input" type="number" placeholder="0.00"
                value={form.precioCompra}
                onChange={e => setForm(f => ({ ...f, precioCompra: e.target.value }))}
                sx={inputSx} />
            </Box>

            {/* Preview */}
            {sharesCalc > 0 && resolvedTicker && (
              <Box sx={{ px: 1.5, py: 1.125, mb: 1.5, borderRadius: '10px', bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.2)}` }}>
                <Typography sx={{ fontSize: 13, color: GREEN, fontWeight: 700 }}>
                  {sharesCalc.toFixed(6)} acciones de {resolvedTicker}
                </Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, opacity: 0.85, mt: 0.25 }}>
                  ${fmt(montoUSD)} USD · {fmtCOP(montoCOP)}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setNewTickerInput('') }}
                sx={{ flex: 1, py: 1.125, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </Box>
              <Box component="button" onClick={handleSubmit} disabled={!formValid}
                sx={{
                  flex: 2, py: 1.125, borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                  cursor: formValid ? 'pointer' : 'not-allowed',
                  bgcolor: formValid ? GREEN : alpha('#919EAB', 0.16),
                  color: formValid ? '#fff' : T2,
                }}>
                Registrar
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Modal: Actualizar precios ─────────────────────────── */}
      {editPrecios && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 1300, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ width: '100%', bgcolor: '#fff', borderRadius: '20px 20px 0 0', p: 2.5, maxHeight: '80vh', overflowY: 'auto' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, mb: 2 }}>Actualizar precios</Typography>
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>TRM (COP por 1 USD)</Typography>
              <Box component="input" type="number" value={editTrm}
                onChange={e => setEditTrm(e.target.value)} sx={inputSx} />
            </Box>
            {portfolio.map(p => (
              <Box key={p.ticker} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>
                  {p.ticker} — precio actual (USD/acción)
                </Typography>
                <Box component="input" type="number"
                  value={editPrecios[p.ticker] || ''}
                  onChange={e => setEditPrecios(prev => ({ ...prev, [p.ticker]: e.target.value }))}
                  sx={inputSx} />
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Box component="button" onClick={() => setEditPrecios(null)}
                sx={{ flex: 1, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </Box>
              <Box component="button" onClick={saveEditPrecios}
                sx={{ flex: 2, py: 1, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Guardar
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Modal: Confirmar eliminar ─────────────────────────── */}
      {confirmDel && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 1300, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ width: '100%', bgcolor: '#fff', borderRadius: '20px 20px 0 0', p: 2.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, mb: 0.75 }}>Eliminar {confirmDel}</Typography>
            <Typography sx={{ fontSize: 13, color: T2, mb: 2 }}>
              Se eliminará la posición del portafolio. Las compras registradas se mantendrán en el historial.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="button" onClick={() => setConfirmDel(null)}
                sx={{ flex: 1, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </Box>
              <Box component="button" onClick={() => { onDeletePosition(confirmDel); setConfirmDel(null) }}
                sx={{ flex: 2, py: 1, borderRadius: '8px', border: 'none', bgcolor: RED, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Eliminar
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
