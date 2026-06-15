import { useState } from 'react'
import { Box, Typography, alpha } from '@mui/material'

const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const BG      = '#F7F7F8'

const BAR_COLORS = ['#60a5fa','#4ade80','#fbbf24','#a78bfa','#f87171','#34d399','#fb923c','#e879f9','#38bdf8','#a3e635']

function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export default function PortfolioSummary({ portfolio, precios, trm, trmLoading, trmFecha, preciosLoading, preciosFecha, onUpdatePrecios, onUpdateShares, onAddPosition, onDeletePosition }) {
  const [showAdd, setShowAdd]     = useState(false)
  const [newTicker, setNewTicker] = useState('')
  const [newShares, setNewShares] = useState('')
  const [newPrice,  setNewPrice]  = useState('')
  const [newValor,  setNewValor]  = useState('')

  const [editPrecios, setEditPrecios] = useState(null)
  const [editTrm,     setEditTrm]     = useState('')
  const [sharesEdit,  setSharesEdit]  = useState(null) // { ticker, shares, valorUSD }
  const [confirmDel,  setConfirmDel]  = useState(null)

  const totalUSD       = portfolio.reduce((s, p) => s + p.shares * (precios[p.ticker] || 0), 0)
  const totalCOP       = totalUSD * trm
  const totalInvertido = portfolio.reduce((s, p) => s + p.shares * (p.avgPrice || 0), 0)
  const ganancia       = totalUSD - totalInvertido
  const pctTotal       = totalInvertido > 0 ? (ganancia / totalInvertido) * 100 : 0

  function handleAddSubmit() {
    const t = newTicker.trim().toUpperCase()
    const s = parseFloat(newShares) || 0
    const v = parseFloat(newValor)  || 0
    const p = parseFloat(newPrice)  || 0
    if (!t) return
    // Precio actual: si ingresó valor total y acciones, calcula precio por acción
    const precioActual = (v > 0 && s > 0) ? v / s : p
    onAddPosition(t, s, p || precioActual, precioActual)
    setNewTicker(''); setNewShares(''); setNewPrice(''); setNewValor('')
    setShowAdd(false)
  }

  function openEditPrecios() {
    const map = {}
    portfolio.forEach(p => { map[p.ticker] = String(precios[p.ticker] || '') })
    setEditPrecios(map)
    setEditTrm(String(trm))
  }

  function saveEditPrecios() {
    const newP = {}
    portfolio.forEach(p => { newP[p.ticker] = parseFloat(editPrecios[p.ticker]) || precios[p.ticker] || 0 })
    onUpdatePrecios(newP, parseFloat(editTrm) || trm)
    setEditPrecios(null)
  }

  function saveShares() {
    const s = parseFloat(sharesEdit.shares) || 0
    const v = parseFloat(sharesEdit.valorUSD) || 0
    onUpdateShares(sharesEdit.ticker, s, v > 0 && s > 0 ? v / s : null)
    setSharesEdit(null)
  }

  return (
    <Box sx={{ px: 2, pb: 4 }}>

      {/* Total portafolio */}
      <Box sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>Portafolio total</Typography>
            <Typography sx={{ fontSize: 30, fontWeight: 800, color: T1, letterSpacing: '-0.5px', lineHeight: 1.1 }}>${fmt(totalUSD)}</Typography>
            <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>{fmtCOP(totalCOP)}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            {totalInvertido > 0 && (
              <Box sx={{ px: 1.25, py: 0.5, borderRadius: '8px', display: 'inline-block',
                bgcolor: ganancia >= 0 ? alpha(GREEN, 0.08) : alpha(RED, 0.08),
                border: `1px solid ${ganancia >= 0 ? alpha(GREEN, 0.2) : alpha(RED, 0.2)}` }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: ganancia >= 0 ? GREEN : RED }}>
                  {ganancia >= 0 ? '+' : ''}{fmt(ganancia)} ({pctTotal >= 0 ? '+' : ''}{pctTotal.toFixed(1)}%)
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 0.75 }}>
              {trmLoading
                ? <Typography sx={{ fontSize: 11, color: T2 }}>Actualizando TRM…</Typography>
                : <Typography sx={{ fontSize: 11, color: T2 }}>TRM ${trm.toLocaleString('es-CO')}{trmFecha && <span style={{ marginLeft: 4, opacity: 0.6 }}>· {trmFecha}</span>}</Typography>
              }
            </Box>
          </Box>
        </Box>
        {preciosLoading
          ? <Typography sx={{ fontSize: 11, color: T2, mb: 1 }}>Actualizando precios…</Typography>
          : preciosFecha ? <Typography sx={{ fontSize: 11, color: T2, mb: 1 }}>Precios al {preciosFecha}</Typography>
          : <Box sx={{ mb: 1 }} />
        }
        <Box component="button" onClick={openEditPrecios}
          sx={{ width: '100%', py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, color: T1, fontWeight: 600, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
          Actualizar precios manualmente
        </Box>
      </Box>

      {/* Posiciones */}
      {portfolio.map((p, idx) => {
        const precio       = precios[p.ticker] || 0
        const valorUSD     = p.shares * precio
        const valorCOP     = valorUSD * trm
        const change       = p.avgPrice > 0 ? ((precio - p.avgPrice) / p.avgPrice) * 100 : null
        const color        = BAR_COLORS[idx % BAR_COLORS.length]
        const pctPortfolio = totalUSD > 0 ? (valorUSD / totalUSD) * 100 : 0
        const ganP         = p.shares * (precio - p.avgPrice)

        return (
          <Box key={p.ticker} sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: BG, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: p.ticker.length > 4 ? 8 : 10, fontWeight: 900, color: T2 }}>{p.ticker}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{p.ticker}</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: T1 }}>${fmt(valorUSD)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: T2 }}>{p.shares.toFixed(5)} acc · ${fmt(precio)}</Typography>
                      <Box component="span" onClick={() => setSharesEdit({ ticker: p.ticker, shares: String(p.shares), valorUSD: String(fmt(p.shares * precio)) })}
                        sx={{ fontSize: 10, color: GREEN, cursor: 'pointer', fontWeight: 700 }}>editar</Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: 11, color: T2 }}>{fmtCOP(valorCOP)}</Typography>
                      {change !== null && (
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: change >= 0 ? GREEN : RED }}>
                          {change >= 0 ? '+' : ''}{change.toFixed(2)}% ({ganP >= 0 ? '+' : ''}${fmt(ganP)})
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ height: 4, borderRadius: 2, bgcolor: BG, overflow: 'hidden', mb: 0.5 }}>
                <Box sx={{ height: '100%', width: `${pctPortfolio}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.4s' }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 10, color: T2 }}>{pctPortfolio.toFixed(1)}% del portafolio</Typography>
                <Box onClick={() => setConfirmDel(p.ticker)}
                  sx={{ fontSize: 10, color: T2, cursor: 'pointer', '&:hover': { color: RED }, transition: 'color 0.15s' }}>
                  Eliminar
                </Box>
              </Box>
            </Box>
          </Box>
        )
      })}

      {/* Botón agregar */}
      {!showAdd && (
        <Box onClick={() => setShowAdd(true)} sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
          py: 1.25, borderRadius: '12px', border: `1.5px dashed ${BORDER}`,
          cursor: 'pointer', color: T2, fontSize: 13, fontWeight: 600,
          '&:active': { opacity: 0.7 },
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar empresa
        </Box>
      )}

      {/* Form agregar */}
      {showAdd && (
        <Box sx={{ bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH, p: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mb: 1.5 }}>Nueva posición</Typography>
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Ticker (ej: AAPL, TSLA, BTC-USD)</Typography>
            <Box component="input" placeholder="AAPL" value={newTicker}
              onChange={e => setNewTicker(e.target.value.toUpperCase())}
              sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN }, letterSpacing: '0.05em' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Acciones</Typography>
              <Box component="input" type="number" placeholder="0.52667" value={newShares}
                onChange={e => setNewShares(e.target.value)}
                sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Valor actual (USD)</Typography>
              <Box component="input" type="number" placeholder="105.55" value={newValor}
                onChange={e => setNewValor(e.target.value)}
                sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
            </Box>
          </Box>
          {/* Preview del precio por acción calculado */}
          {parseFloat(newShares) > 0 && parseFloat(newValor) > 0 && (
            <Box sx={{ mb: 1, px: 1.25, py: 0.625, borderRadius: '8px', bgcolor: 'rgba(0,167,111,0.06)', border: '1px solid rgba(0,167,111,0.18)' }}>
              <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>
                Precio actual calculado: ${fmt(parseFloat(newValor) / parseFloat(newShares))} / acción
              </Typography>
            </Box>
          )}
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Precio de compra promedio (USD/acción) <span style={{ fontWeight: 400, opacity: 0.6 }}>— opcional</span></Typography>
            <Box component="input" type="number" placeholder="0.00" value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box component="button" onClick={() => { setShowAdd(false); setNewTicker(''); setNewShares(''); setNewPrice(''); setNewValor('') }}
              sx={{ flex: 1, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              Cancelar
            </Box>
            <Box component="button" onClick={handleAddSubmit} disabled={!newTicker.trim()}
              sx={{ flex: 2, py: 0.875, borderRadius: '8px', border: 'none', bgcolor: newTicker.trim() ? T1 : BG, color: newTicker.trim() ? '#fff' : T2, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: newTicker.trim() ? 'pointer' : 'not-allowed' }}>
              Agregar
            </Box>
          </Box>
        </Box>
      )}

      {/* Modal editar precios */}
      {editPrecios && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 1300, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ width: '100%', bgcolor: '#fff', borderRadius: '20px 20px 0 0', p: 2.5, maxHeight: '80vh', overflowY: 'auto' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, mb: 2 }}>Actualizar precios</Typography>
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>TRM (COP por 1 USD)</Typography>
              <Box component="input" type="number" value={editTrm} onChange={e => setEditTrm(e.target.value)}
                sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
            </Box>
            {portfolio.map(p => (
              <Box key={p.ticker} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>{p.ticker} — precio actual (USD)</Typography>
                <Box component="input" type="number" value={editPrecios[p.ticker] || ''} onChange={e => setEditPrecios(prev => ({ ...prev, [p.ticker]: e.target.value }))}
                  sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
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

      {/* Modal editar acciones */}
      {sharesEdit && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 1300, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ width: '100%', bgcolor: '#fff', borderRadius: '20px 20px 0 0', p: 2.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, mb: 1.5 }}>Editar {sharesEdit.ticker}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Acciones</Typography>
                <Box component="input" type="number" value={sharesEdit.shares} onChange={e => setSharesEdit(s => ({ ...s, shares: e.target.value }))}
                  sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Valor actual (USD)</Typography>
                <Box component="input" type="number" value={sharesEdit.valorUSD} onChange={e => setSharesEdit(s => ({ ...s, valorUSD: e.target.value }))}
                  sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: BG, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
              </Box>
            </Box>
            {parseFloat(sharesEdit.shares) > 0 && parseFloat(sharesEdit.valorUSD) > 0 && (
              <Box sx={{ mb: 1.5, px: 1.25, py: 0.625, borderRadius: '8px', bgcolor: 'rgba(0,167,111,0.06)', border: '1px solid rgba(0,167,111,0.18)' }}>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>
                  Precio calculado: ${fmt(parseFloat(sharesEdit.valorUSD) / parseFloat(sharesEdit.shares))} / acción
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="button" onClick={() => setSharesEdit(null)}
                sx={{ flex: 1, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </Box>
              <Box component="button" onClick={saveShares}
                sx={{ flex: 2, py: 1, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Guardar
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Confirmar eliminar */}
      {confirmDel && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', zIndex: 1300, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ width: '100%', bgcolor: '#fff', borderRadius: '20px 20px 0 0', p: 2.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, mb: 0.75 }}>Eliminar {confirmDel}</Typography>
            <Typography sx={{ fontSize: 13, color: T2, mb: 2 }}>¿Seguro que quieres eliminar esta posición del portafolio?</Typography>
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
