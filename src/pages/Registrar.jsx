import { useState, useRef, useMemo, useEffect } from 'react';
import { Box, Typography, alpha, Collapse } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { parsearVoz, inferirCategoria } from 'src/utils/parsers';
import { getMesActual } from 'src/utils/format';
import { CAT_ICONS, CATEGORIAS_VOZ, MESES, MES_NAMES } from 'src/constants';

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

function parseAmt(str) {
  const n = parseInt(String(str).replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function fmtCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function dateToMes(dateStr) {
  return 'M' + parseInt(dateStr.split('-')[1], 10);
}
function fmtDateLabel(dateStr) {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Hoy';
  if (dateStr === yesterday) return 'Ayer';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function Label({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.875 }}>
      {children}
    </Typography>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
      {children}
    </Typography>
  );
}

function GroupSection({ label, gastado, presupuestado, color, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = presupuestado > 0 ? Math.min((gastado / presupuestado) * 100, 100) : 0;
  const sobre = gastado > presupuestado && presupuestado > 0;
  return (
    <Box sx={{ mb: 2 }}>
      <Box onClick={() => setOpen(v => !v)} sx={{
        display: 'flex', alignItems: 'center', gap: 1, mb: open ? 1 : 0,
        cursor: 'pointer', userSelect: 'none', py: 0.75,
      }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T2, flex: 1 }}>
          {label}
        </Typography>
        {presupuestado > 0 && (
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: sobre ? RED : T2 }}>
            {fmtCOP(gastado)} / {fmtCOP(presupuestado)}
          </Typography>
        )}
        <Box sx={{ color: T2, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'flex', ml: 0.5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </Box>
      </Box>
      {presupuestado > 0 && (
        <Box sx={{ height: 2, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden', mb: open ? 1 : 0 }}>
          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: sobre ? RED : color, borderRadius: 2, transition: 'width 0.4s' }} />
        </Box>
      )}
      <Collapse in={open}>
        {children}
      </Collapse>
    </Box>
  );
}

// ── Selector de cuenta inline ──────────────────────────────
function CuentaSelector({ state, cuenta, setCuenta, tarjeta, setTarjeta }) {
  const tarjetas = state.tarjetas || [];
  const cuentasBase = state.cuentas.filter(c => c !== 'T.C');
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap', mb: state.cuentas.includes('T.C') ? 0.875 : 0 }}>
        {cuentasBase.map(c => {
          const sel = cuenta === c;
          return (
            <Box key={c} onClick={() => { setCuenta(sel ? '' : c); setTarjeta(''); }} sx={{
              px: 1.25, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
              borderColor: sel ? T1 : BORDER, bgcolor: sel ? T1 : CARD, color: sel ? '#fff' : T2,
            }}>{c}</Box>
          );
        })}
      </Box>
      {state.cuentas.includes('T.C') && (
        <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap' }}>
          {tarjetas.length === 0 ? (
            <Box onClick={() => { setCuenta(cuenta === 'T.C' ? '' : 'T.C'); setTarjeta(''); }} sx={{
              px: 1.25, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
              borderColor: cuenta === 'T.C' ? T1 : BORDER, bgcolor: cuenta === 'T.C' ? T1 : CARD, color: cuenta === 'T.C' ? '#fff' : T2,
            }}>T.C</Box>
          ) : tarjetas.map(t => {
            const sel = cuenta === 'T.C' && tarjeta === t.nombre;
            return (
              <Box key={t.id} onClick={() => { setCuenta('T.C'); setTarjeta(sel ? '' : t.nombre); }} sx={{
                px: 1.25, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                borderColor: sel ? T1 : BORDER, bgcolor: sel ? T1 : CARD, color: sel ? '#fff' : T2,
              }}>{t.nombre}</Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ── Fila simple (categoría sin detalle) ───────────────────
function SimpleRow({ cat, presupuesto, pagado, esIngreso, onOpen }) {
  const pct         = presupuesto > 0 ? Math.min((pagado / presupuesto) * 100, 100) : 0;
  const pagadoTotal = pagado >= presupuesto && presupuesto > 0;
  const icon        = CAT_ICONS[cat] || (esIngreso ? '💼' : '🔹');
  return (
    <Box onClick={() => !pagadoTotal && onOpen()}
      sx={{ borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden', mb: 0.875, cursor: pagadoTotal ? 'default' : 'pointer', '&:active': { opacity: pagadoTotal ? 1 : 0.75 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.375 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '9px', flexShrink: 0, bgcolor: pagadoTotal ? alpha(GREEN, 0.1) : '#F3F4F6', border: `1px solid ${pagadoTotal ? alpha(GREEN, 0.2) : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {pagadoTotal ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2 }}>{cat}</Typography>
          {presupuesto > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.3 }}>
              <Typography sx={{ fontSize: 11, color: pagadoTotal ? GREEN : T2 }}>{fmtCOP(pagado)}</Typography>
              <Typography sx={{ fontSize: 11, color: T2 }}>/ {fmtCOP(presupuesto)}</Typography>
            </Box>
          )}
        </Box>
        {pagadoTotal
          ? <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN, bgcolor: alpha(GREEN, 0.08), px: 0.875, py: 0.3, borderRadius: '6px' }}>{esIngreso ? 'Recibido' : 'Pagado'}</Typography>
          : <Box sx={{ px: 1, py: 0.5, borderRadius: '8px', bgcolor: '#F3F4F6', border: `1px solid ${BORDER}` }}><Typography sx={{ fontSize: 11, fontWeight: 700, color: T2 }}>{esIngreso ? 'Recibir' : 'Pagar'}</Typography></Box>
        }
      </Box>
      {presupuesto > 0 && (
        <Box sx={{ mx: 1.75, mb: 0.875, height: 3, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pagadoTotal ? GREEN : T1, borderRadius: 2, transition: 'width 0.4s' }} />
        </Box>
      )}
    </Box>
  );
}

// ── Acordeón por categoría ────────────────────────────────
// items=[] → muestra formulario libre; items=[...] → muestra sub-items
function CategoryAccordion({ cat, items, presupuesto, pagadoCat, txById, esIngreso, esVariable, onOpenItem, onPagarLibre }) {
  const [open, setOpen] = useState(false);
  const icon = CAT_ICONS[cat] || (esIngreso ? '💼' : '🔹');

  const tieneItems  = items && items.length > 0;
  const totalPres   = tieneItems ? items.reduce((s, i) => s + i.monto, 0) : (presupuesto || 0);
  const totalPagado = esVariable
    ? (pagadoCat || 0)
    : tieneItems
      ? items.reduce((s, i) => { if (!i.pagadoCon) return s; const tx = txById[i.txId]; return s + (tx ? Math.abs(tx.total) : i.monto); }, 0)
      : (pagadoCat || 0);
  // Variables: el denominador muestra lo real si supera el presupuesto
  const totalDenom   = esVariable ? Math.max(totalPres, totalPagado) : totalPres;
  const pct          = totalDenom > 0 ? Math.min((totalPagado / totalDenom) * 100, 100) : 0;
  const todosPagados = tieneItems ? items.every(i => i.pagadoCon) : (pagadoCat >= presupuesto && presupuesto > 0);

  const sinMovimiento = totalPagado === 0;

  return (
    <Box sx={{ borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH, border: `1px solid ${open ? T1 : BORDER}`, overflow: 'hidden', mb: 0.875, transition: 'all 0.15s', opacity: sinMovimiento ? 0.5 : 1 }}>
      {/* Cabecera */}
      <Box onClick={() => setOpen(o => !o)} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.375, cursor: 'pointer', '&:active': { opacity: 0.75 } }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '9px', flexShrink: 0, bgcolor: todosPagados ? alpha(GREEN, 0.1) : open ? alpha(T1, 0.06) : '#F3F4F6', border: `1px solid ${todosPagados ? alpha(GREEN, 0.2) : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {todosPagados ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, lineHeight: 1.2 }}>{cat}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.3 }}>
            <Typography sx={{ fontSize: 11, color: todosPagados ? GREEN : T2 }}>{fmtCOP(totalPagado)}</Typography>
            <Typography sx={{ fontSize: 11, color: T2 }}>/ {fmtCOP(totalDenom)}{tieneItems ? ` · ${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}` : ''}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </Box>
      </Box>

      {/* Barra */}
      {totalPres > 0 && (
        <Box sx={{ mx: 1.75, mb: open ? 0 : 0.875, height: 3, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: todosPagados ? GREEN : T1, borderRadius: 2, transition: 'width 0.4s' }} />
        </Box>
      )}

      {/* Contenido expandido */}
      <Box sx={{ maxHeight: open ? '600px' : 0, overflow: 'hidden', transition: 'max-height 0.28s ease' }}>
        <Box sx={{ mx: 1.25, mb: 1.25, mt: 0.875, display: 'flex', flexDirection: 'column', gap: 0.625 }}>
          {tieneItems ? (
            // Sub-items pre-definidos
            items.map(item => {
              // Soporte modelo nuevo (pagos[]) y viejo (txId)
              const pagos = item.pagos?.length ? item.pagos : (item.txId ? [{ txId: item.txId }] : []);
              const pagadoItem = pagos.reduce((s, p) => {
                const tx = txById[p.txId];
                return s + (tx ? Math.abs(tx.total) : 0);
              }, 0);
              const restante   = Math.max(item.monto - pagadoItem, 0);
              const itemPagado = pagadoItem >= item.monto && item.monto > 0;
              const parcial    = pagadoItem > 0 && !itemPagado;
              return (
                <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.875, borderRadius: '10px', bgcolor: itemPagado ? alpha(GREEN, 0.05) : parcial ? 'rgba(251,191,36,0.04)' : '#F9FAFB', border: `1px solid ${itemPagado ? alpha(GREEN, 0.15) : parcial ? 'rgba(251,191,36,0.25)' : BORDER}` }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{item.concepto}</Typography>
                    <Typography sx={{ fontSize: 11, color: itemPagado ? GREEN : parcial ? '#D97706' : T2 }}>
                      {parcial ? `${fmtCOP(pagadoItem)} / ${fmtCOP(item.monto)} · falta ${fmtCOP(restante)}` : fmtCOP(item.monto)}
                    </Typography>
                  </Box>
                  {itemPagado
                    ? <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN, bgcolor: alpha(GREEN, 0.1), px: 0.75, py: 0.25, borderRadius: '6px' }}>✓ Pagado</Typography>
                    : <Box component="button" onClick={e => { e.stopPropagation(); onOpenItem(item, pagadoItem); }}
                        sx={{ px: 1.25, py: 0.5, borderRadius: '8px', border: `1px solid ${T1}`, bgcolor: T1, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                        {parcial ? `Pagar más` : 'Pagar'}
                      </Box>
                  }
                </Box>
              );
            })
          ) : (
            // Sin items: botón directo para pagar
            <Box sx={{ px: 1.25, py: 1, borderRadius: '10px', bgcolor: '#F9FAFB', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: T2 }}>Registrar pago en {cat}</Typography>
              <Box component="button" onClick={e => { e.stopPropagation(); onPagarLibre(); }}
                sx={{ px: 1.5, py: 0.625, borderRadius: '8px', border: 'none', bgcolor: T1, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                Pagar
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ── Bottom sheet de pago ───────────────────────────────────
function PaySheet({ sel, state, onClose, onConfirm }) {
  const [monto,   setMonto]   = useState('');
  const [concepto, setConcepto] = useState('');
  const [cuenta,  setCuenta]  = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [fecha,   setFecha]   = useState(todayStr());

  // Reiniciar al abrir un nuevo item
  useEffect(() => {
    if (sel) {
      const restante = Math.max((sel.presupuesto || 0) - (sel.pagado || 0), 0);
      setMonto(restante > 0 ? String(restante) : sel.presupuesto ? String(sel.presupuesto) : '');
      setConcepto(sel.conceptoFijo || '');
      setCuenta('');
      setTarjeta('');
      setFecha(todayStr());
    }
  }, [sel?.cat, sel?.itemId]);

  if (!sel) return null;

  const canConfirm = parseAmt(monto) > 0 && cuenta;
  const accion = sel.esIngreso ? 'Recibir' : 'Pagar';

  function confirm() {
    if (!canConfirm) return;
    onConfirm({ monto: parseAmt(monto), concepto: concepto.trim() || sel.cat, cuenta, tarjeta, fecha });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', zIndex: 1300 }} />
      {/* Sheet */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1301,
        bgcolor: CARD, borderRadius: '20px 20px 0 0',
        p: 2.5, pb: 4,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: '#E5E7EB', mx: 'auto', mb: 2 }} />

        {/* Título */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '9px', bgcolor: sel.esIngreso ? alpha(GREEN, 0.1) : '#F3F4F6', border: `1px solid ${sel.esIngreso ? alpha(GREEN, 0.2) : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {CAT_ICONS[sel.cat] || (sel.esIngreso ? '💼' : '·')}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T1, lineHeight: 1.2 }}>{accion} · {sel.cat}</Typography>
            {sel.categoriaReal && sel.categoriaReal !== sel.cat && (
              <Typography sx={{ fontSize: 12, color: T2 }}>{sel.categoriaReal}</Typography>
            )}
          </Box>
        </Box>

        {/* Concepto (solo egresos sin concepto fijo) */}
        {!sel.esIngreso && !sel.conceptoFijo && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>¿Qué estás pagando?</Typography>
            <Box component="input" type="text" placeholder={`Ej: Arriendo, Internet…`}
              value={concepto} onChange={e => setConcepto(e.target.value)}
              sx={{ width: '100%', boxSizing: 'border-box', px: 1.25, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: '#FAFAFA', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: T1, bgcolor: CARD }, '&::placeholder': { color: alpha('#919EAB', 0.5) } }}
            />
          </Box>
        )}

        {/* Monto */}
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 1, borderRadius: '12px', border: `1px solid ${BORDER}`, bgcolor: '#FAFAFA' }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: T2, lineHeight: 1, flexShrink: 0 }}>$</Typography>
            <Box component="input" type="text" inputMode="numeric" placeholder="0" value={monto}
              onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setMonto(isNaN(n) ? '' : n.toLocaleString('es-CO')); }}
              sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 22, fontWeight: 800, fontFamily: 'inherit', color: T1, '&::placeholder': { color: alpha('#919EAB', 0.3), fontWeight: 400 } }}
            />
          </Box>
        </Box>

        {/* Fecha */}
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</Typography>
          <Box component="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            sx={{ width: '100%', boxSizing: 'border-box', px: 1.25, py: 0.75, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: '#FAFAFA', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: T1 } }}
          />
        </Box>

        {/* Cuenta */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cuenta</Typography>
          <CuentaSelector state={state} cuenta={cuenta} setCuenta={setCuenta} tarjeta={tarjeta} setTarjeta={setTarjeta} />
        </Box>

        {/* Botones */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box component="button" onClick={onClose}
            sx={{ flex: 1, py: 0.875, borderRadius: '12px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancelar
          </Box>
          <Box component="button" onClick={confirm} disabled={!canConfirm}
            sx={{ flex: 2, py: 0.875, borderRadius: '12px', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed', bgcolor: canConfirm ? GREEN : alpha('#919EAB', 0.16), color: canConfirm ? '#fff' : T2, boxShadow: canConfirm ? `0 4px 14px ${alpha(GREEN, 0.3)}` : 'none', transition: 'all 0.15s' }}>
            Confirmar {sel.esIngreso ? 'ingreso' : 'pago'}
          </Box>
        </Box>
      </Box>
    </>
  );
}

// ── Fila de ingreso ya recibido (solo lectura) ─────────────
function IngresoRecibido({ tx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25,
      borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH, border: `1px solid ${BORDER}`, mb: 0.875 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '9px', flexShrink: 0,
        bgcolor: alpha(GREEN, 0.08), border: `1px solid ${alpha(GREEN, 0.18)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.concepto || tx.categoria}
        </Typography>
        {tx.concepto && tx.concepto !== tx.categoria && (
          <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>{tx.categoria}</Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: GREEN, flexShrink: 0 }}>
        +{fmtCOP(Math.abs(tx.total))}
      </Typography>
    </Box>
  );
}

// ── Tab: Mis pagos ─────────────────────────────────────────
function MisPagos({ state, addTransaccion, pagarPresupuestoItem, showToast }) {
  const [mes, setMes] = useState(getMesActual());
  const mesIdx = MESES.indexOf(mes);

  const presupMes = state.presupuestos?.[mes] || {};
  const txsMes = useMemo(() => state.transacciones.filter(t => t.mes === mes), [state.transacciones, mes]);

  // Calcular lo ya pagado por categoría (solo Egresos)
  const pagadoPorCat = useMemo(() => {
    const map = {};
    txsMes.filter(t => t.movimiento === 'Egreso').forEach(t => {
      if (!map[t.categoria]) map[t.categoria] = 0;
      map[t.categoria] += Math.abs(t.total);
    });
    return map;
  }, [txsMes]);

  // Items de ingreso del presupuesto detallado
  const ingresosDetalle = useMemo(() => {
    const items = state.presupuestosDetalle?.[mes] || [];
    return items.filter(i => state.categoriasIngreso.includes(i.categoria));
  }, [state.presupuestosDetalle, mes, state.categoriasIngreso]);

  // Items de egreso del presupuesto detallado, agrupados por categoría
  const egresoDetallePorCat = useMemo(() => {
    const map = {};
    const items = state.presupuestosDetalle?.[mes] || [];
    items.filter(i => !state.categoriasIngreso.includes(i.categoria)).forEach(i => {
      if (!map[i.categoria]) map[i.categoria] = [];
      map[i.categoria].push(i);
    });
    return map;
  }, [state.presupuestosDetalle, mes, state.categoriasIngreso]);

  // Mapa de transacciones por id (para lookup de pagadoCon)
  const txById = useMemo(() => {
    const map = {};
    (state.transacciones || []).forEach(t => { map[t.id] = t; });
    return map;
  }, [state.transacciones]);

  // Ingresos recibidos este mes por concepto
  const ingresosRecibidos = useMemo(() => {
    const map = {};
    txsMes.filter(t => t.movimiento === 'Ingreso').forEach(t => {
      const key = t.concepto || t.categoria;
      if (!map[key]) map[key] = 0;
      map[key] += Math.abs(t.total);
    });
    return map;
  }, [txsMes]);

  // Grupos: fijos y variables ordenados por % gastado desc (más críticos primero)
  const fijos = state.categoriasEgresoFijo
    .filter(c => presupMes[c] > 0)
    .sort((a, b) => {
      const pctA = (pagadoPorCat[a] || 0) / presupMes[a];
      const pctB = (pagadoPorCat[b] || 0) / presupMes[b];
      return pctB - pctA;
    });
  const vars = state.categoriasEgresoVariable
    .filter(c => presupMes[c] > 0)
    .sort((a, b) => {
      const pctA = (pagadoPorCat[a] || 0) / presupMes[a];
      const pctB = (pagadoPorCat[b] || 0) / presupMes[b];
      return pctB - pctA;
    });

  // Resumen del mes
  const totalPresupuestado = [...fijos, ...vars].reduce((s, c) => s + (presupMes[c] || 0), 0);
  const totalGastado       = [...fijos, ...vars].reduce((s, c) => s + (pagadoPorCat[c] || 0), 0);
  const totalIngPresup     = state.categoriasIngreso.reduce((s, c) => s + (presupMes[c] || 0), 0);
  const totalIngRecibido   = txsMes.filter(t => t.movimiento === 'Ingreso' && t.categoria !== 'Pago TC').reduce((s, t) => s + Math.abs(t.total), 0);
  const balance            = totalIngRecibido - totalGastado;
  // Caja: solo gastos que ya salieron de cuentas reales (excluye T.C)
  const gastosCaja   = txsMes.filter(t => t.movimiento === 'Egreso' && t.cuenta !== 'T.C').reduce((s, t) => s + Math.abs(t.total), 0);
  const balanceCaja  = totalIngRecibido - gastosCaja;

  const [payModal, setPayModal] = useState(null);

  function openPay(data) { setPayModal(data); }
  function closePay()    { setPayModal(null); }

  function handleConfirm({ monto, concepto, cuenta, tarjeta, fecha }) {
    if (!payModal) return;
    const { cat, categoriaReal, esIngreso, itemId } = payModal;
    const catFinal = categoriaReal || cat;

    if (itemId) {
      // Item de presupuestosDetalle — usar pagarPresupuestoItem
      pagarPresupuestoItem(mes, itemId, cuenta, tarjeta || null, monto);
    } else {
      // Categoría sin detalle — crear transacción genérica
      const mes2 = dateToMes(fecha);
      const esTarjeta = (state.tarjetas || []).some(t => t.nombre === cuenta);
      const cuentaFinal  = esTarjeta ? 'T.C' : cuenta;
      const tarjetaFinal = esTarjeta ? cuenta : (cuenta === 'T.C' && tarjeta ? tarjeta : undefined);
      addTransaccion({
        id: Date.now(),
        fecha: new Date(fecha + 'T12:00:00').toISOString(),
        mes: mes2,
        tipo: esIngreso ? 'Variable' : (state.categoriasEgresoFijo.includes(catFinal) ? 'Fijo' : 'Variable'),
        movimiento: esIngreso ? 'Ingreso' : 'Egreso',
        categoria: catFinal,
        concepto: concepto || catFinal,
        total: esIngreso ? monto : -monto,
        pago:  esIngreso ? monto : -monto,
        saldo: 0,
        cuenta: esIngreso ? (cuenta || '') : cuentaFinal,
        ...(tarjetaFinal ? { tarjeta: tarjetaFinal } : {}),
      });
    }
    showToast(esIngreso ? `${concepto || cat} recibido` : `${concepto || cat} pagado`, 'success');
  }

  const hayFijos = fijos.length > 0;
  const hayVars  = vars.length > 0;

  return (
    <Box sx={{ px: '20px', pb: 10 }}>

      {/* Selector de mes */}
      <Box sx={{ display: 'flex', gap: 0.625, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 2.5, pb: 0.5 }}>
        {MESES.map((m, i) => (
          <Box key={m} onClick={() => setMes(m)} sx={{
            px: 1.5, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
            whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
            borderColor: m === mes ? T1 : BORDER, bgcolor: m === mes ? T1 : CARD, color: m === mes ? '#fff' : T2,
          }}>
            {MES_NAMES[i]}
          </Box>
        ))}
      </Box>

      {/* ── Resumen del mes ── */}
      {(totalPresupuestado > 0 || totalIngPresup > 0) && (
        <Box sx={{ mb: 2.5, borderRadius: '14px', bgcolor: CARD, boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          {/* Fila 1: Ingresos / Gastos / Balance presupuestal */}
          <Box sx={{ p: 1.5, pb: 1.25 }}>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>Presupuestal</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.25 }}>
              {[
                { lbl: 'Ingresos', val: totalIngRecibido, meta: totalIngPresup, color: GREEN },
                { lbl: 'Gastos', val: totalGastado, meta: totalPresupuestado, color: totalGastado > totalPresupuestado ? RED : T1 },
                { lbl: 'Balance', val: balance, color: balance >= 0 ? GREEN : RED },
              ].map(({ lbl, val, meta, color }) => (
                <Box key={lbl} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 9, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>{lbl}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>
                    {val < 0 ? '-' : ''}{fmtCOP(Math.abs(val))}
                  </Typography>
                  {meta != null && meta > 0 && (
                    <Typography sx={{ fontSize: 9, color: T2, mt: 0.25 }}>de {fmtCOP(meta)}</Typography>
                  )}
                </Box>
              ))}
            </Box>
            {totalPresupuestado > 0 && (
              <Box sx={{ height: 3, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 2, transition: 'width 0.4s',
                  width: `${Math.min((totalGastado / totalPresupuestado) * 100, 100)}%`,
                  bgcolor: totalGastado > totalPresupuestado ? RED : totalGastado / totalPresupuestado > 0.8 ? '#D97706' : GREEN,
                }} />
              </Box>
            )}
          </Box>

          {/* Divider */}
          <Box sx={{ height: '1px', bgcolor: BORDER, mx: 1.5 }} />

          {/* Fila 2: Balance de caja */}
          <Box sx={{ p: 1.5, pt: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.25 }}>Caja disponible</Typography>
              <Typography sx={{ fontSize: 9, color: T2 }}>Ingresos − gastos reales (sin T.C)</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: balanceCaja >= 0 ? GREEN : RED, fontFamily: 'monospace', lineHeight: 1 }}>
                {balanceCaja < 0 ? '-' : ''}{fmtCOP(Math.abs(balanceCaja))}
              </Typography>
              <Typography sx={{ fontSize: 9, color: T2, mt: 0.25 }}>
                {fmtCOP(gastosCaja)} en cuentas reales
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Layout responsive: 1 col mobile / 2 col desktop ── */}
      <Box sx={{ display: { xs: 'block', md: 'grid' }, gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>

        {/* Columna izquierda: Ingresos + Egresos fijos */}
        <Box>
          <GroupSection label="Ingresos" gastado={totalIngRecibido} presupuestado={totalIngPresup} color={GREEN} defaultOpen>
            {ingresosDetalle.length > 0 ? (
              ingresosDetalle.map(item => (
                <SimpleRow key={item.id}
                  cat={item.concepto || item.categoria}
                  presupuesto={item.monto}
                  pagado={ingresosRecibidos[item.concepto || item.categoria] || 0}
                  esIngreso={true}
                  onOpen={() => openPay({ cat: item.concepto || item.categoria, categoriaReal: item.categoria, presupuesto: item.monto, pagado: ingresosRecibidos[item.concepto || item.categoria] || 0, esIngreso: true, itemId: item.id, conceptoFijo: item.concepto || item.categoria })}
                />
              ))
            ) : (
              state.categoriasIngreso.map(cat => (
                <SimpleRow key={cat}
                  cat={cat} presupuesto={presupMes[cat] || 0}
                  pagado={ingresosRecibidos[cat] || 0}
                  esIngreso={true}
                  onOpen={() => openPay({ cat, presupuesto: presupMes[cat] || 0, pagado: ingresosRecibidos[cat] || 0, esIngreso: true, conceptoFijo: cat })}
                />
              ))
            )}
          </GroupSection>

          {hayFijos && (
            <GroupSection label="Egresos fijos" gastado={fijos.reduce((s,c) => s+(pagadoPorCat[c]||0),0)} presupuestado={fijos.reduce((s,c) => s+(presupMes[c]||0),0)} color="#FFAB00" defaultOpen>
              {fijos.map(cat => (
                <CategoryAccordion key={cat}
                  cat={cat}
                  items={egresoDetallePorCat[cat] || []}
                  presupuesto={presupMes[cat] || 0}
                  pagadoCat={pagadoPorCat[cat] || 0}
                  txById={txById} esIngreso={false}
                  onOpenItem={(item, pagadoItem) => openPay({ cat: item.concepto, categoriaReal: cat, presupuesto: item.monto, pagado: pagadoItem, esIngreso: false, itemId: item.id, conceptoFijo: item.concepto })}
                  onPagarLibre={() => openPay({ cat, presupuesto: presupMes[cat] || 0, pagado: pagadoPorCat[cat] || 0, esIngreso: false })}
                />
              ))}
            </GroupSection>
          )}
        </Box>

        {/* Columna derecha: Egresos variables */}
        <Box>
          {hayVars && (
            <GroupSection label="Egresos variables" gastado={vars.reduce((s,c) => s+(pagadoPorCat[c]||0),0)} presupuestado={vars.reduce((s,c) => s+(presupMes[c]||0),0)} color="#FF5630" defaultOpen>
              {vars.map(cat => (
                <CategoryAccordion key={cat}
                  cat={cat}
                  esVariable={true}
                  items={egresoDetallePorCat[cat] || []}
                  presupuesto={presupMes[cat] || 0}
                  pagadoCat={pagadoPorCat[cat] || 0}
                  txById={txById} esIngreso={false}
                  onOpenItem={(item, pagadoItem) => openPay({ cat: item.concepto, categoriaReal: cat, presupuesto: item.monto, pagado: pagadoItem, esIngreso: false, itemId: item.id, conceptoFijo: item.concepto })}
                  onPagarLibre={() => openPay({ cat, presupuesto: presupMes[cat] || 0, pagado: pagadoPorCat[cat] || 0, esIngreso: false })}
                />
              ))}
            </GroupSection>
          )}
        </Box>

      </Box>

      {!hayFijos && !hayVars && (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14, color: T1, fontWeight: 600, mb: 0.5 }}>Sin presupuesto para {MES_NAMES[mesIdx]}</Typography>
          <Typography sx={{ fontSize: 13, color: T2 }}>Ve a Presupuesto para asignar montos a tus categorías</Typography>
        </Box>
      )}

      {/* ── Bottom sheet de pago ── */}
      <PaySheet sel={payModal} state={state} onClose={closePay} onConfirm={handleConfirm} />
    </Box>
  );
}

// ── Tab: Formulario manual ─────────────────────────────────
function FormRegistrar({ state, addTransaccion, showToast }) {
  const navigate = useNavigate();

  const [tipo,        setTipo]        = useState('Egreso');
  const [tipoMov,     setTipoMov]     = useState('Variable');
  const [monto,       setMonto]       = useState('');
  const [concepto,    setConcepto]    = useState('');
  const [cuenta,      setCuenta]      = useState('');
  const [tarjeta,     setTarjeta]     = useState('');
  const [categoria,   setCategoria]   = useState('');
  const [catSearch,   setCatSearch]   = useState('');
  const [autoSug,     setAutoSug]     = useState(false);
  const [fecha,       setFecha]       = useState(todayStr());
  const [showFecha,   setShowFecha]   = useState(false);
  const [pagoParcial, setPagoParcial] = useState(false);
  const [montoPago,   setMontoPago]   = useState('');
  const [vozPreview,  setVozPreview]  = useState('');
  const [escuchando,  setEscuchando]  = useState(false);
  const [esFuturo,    setEsFuturo]    = useState(false);
  const [clienteRef,  setClienteRef]  = useState('');
  const recognitionRef = useRef(null);
  const tarjetas = state.tarjetas || [];

  const globalCatSet = useMemo(() => new Set([
    ...state.categoriasEgresoFijo, ...state.categoriasEgresoVariable, ...state.categoriasIngreso,
  ]), [state.categoriasEgresoFijo, state.categoriasEgresoVariable, state.categoriasIngreso]);

  const allCats = useMemo(() => {
    if (tipo === 'Ingreso') return state.categoriasIngreso;
    if (tipoMov === 'Fijo')     return state.categoriasEgresoFijo;
    if (tipoMov === 'Variable') return state.categoriasEgresoVariable;
    return [...state.categoriasEgresoVariable, ...state.categoriasEgresoFijo];
  }, [tipo, tipoMov, state.categoriasIngreso, state.categoriasEgresoFijo, state.categoriasEgresoVariable]);

  const catsFiltradas = useMemo(() =>
    catSearch.trim() ? allCats.filter(c => c.toLowerCase().includes(catSearch.toLowerCase())) : allCats,
    [catSearch, allCats]
  );

  function inferirDesdeTexto(texto) {
    if (!texto) return '';
    const norm = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [key, val] of Object.entries(CATEGORIAS_VOZ).sort((a, b) => b[0].length - a[0].length)) {
      if (norm.includes(key.toLowerCase()) && globalCatSet.has(val)) return val;
    }
    const inf = inferirCategoria(texto);
    return inf && globalCatSet.has(inf) ? inf : '';
  }

  function handleConceptoChange(val) {
    setConcepto(val);
    if (!autoSug || !categoria) {
      const sug = inferirDesdeTexto(val);
      if (sug) {
        setCategoria(sug); setAutoSug(true); setCatSearch('');
        if (state.categoriasIngreso.includes(sug)) setTipo('Ingreso');
        else if (state.categoriasEgresoFijo.includes(sug)) { setTipo('Egreso'); setTipoMov('Fijo'); }
        else if (state.categoriasEgresoVariable.includes(sug)) { setTipo('Egreso'); setTipoMov('Variable'); }
      } else if (autoSug) { setCategoria(''); setAutoSug(false); }
    }
  }

  function handleTipoChange(t) { setTipo(t); setCategoria(''); setCatSearch(''); setAutoSug(false); }
  function handleTipoMovChange(tm) { setTipoMov(tm); setCategoria(''); setCatSearch(''); setAutoSug(false); }

  function resetForm() {
    setMonto(''); setCategoria(''); setCatSearch(''); setConcepto(''); setCuenta('');
    setTarjeta(''); setTipoMov('Variable'); setPagoParcial(false); setMontoPago('');
    setVozPreview(''); setAutoSug(false); setFecha(todayStr());
    setEsFuturo(false); setClienteRef('');
  }

  function guardar(overrides = {}) {
    const montoVal    = parseAmt(overrides.monto    ?? monto);
    const catVal      = overrides.categoria          ?? categoria;
    const conceptoVal = overrides.concepto           ?? concepto;
    const cuentaVal   = overrides.cuenta             ?? cuenta;
    const tipoMovVal  = overrides.tipoMov            ?? tipoMov;
    const tipoVal     = overrides.tipo               ?? tipo;
    const fechaVal    = overrides.fecha              ?? fecha;

    if (!montoVal || montoVal <= 0) { showToast('Ingresa un monto válido', 'error'); return false; }
    if (!catVal)                    { showToast('Selecciona una categoría', 'error'); return false; }

    const montoFinal = tipoVal === 'Egreso' ? -Math.abs(montoVal) : Math.abs(montoVal);
    const pagoVal    = pagoParcial && parseAmt(montoPago) > 0
      ? (tipoVal === 'Egreso' ? -Math.abs(parseAmt(montoPago)) : Math.abs(parseAmt(montoPago)))
      : montoFinal;
    const mesVal = dateToMes(fechaVal);

    const esTarjeta = (state.tarjetas || []).some(t => t.nombre === cuentaVal);
    const cuentaFinal = esTarjeta ? 'T.C' : cuentaVal;
    const tarjetaFinal = esTarjeta ? cuentaVal : (cuentaVal === 'T.C' && tarjeta ? tarjeta : undefined);

    addTransaccion({
      id: Date.now(), fecha: new Date(fechaVal + 'T12:00:00').toISOString(), mes: mesVal,
      tipo: tipoMovVal, movimiento: tipoVal,
      categoria: catVal, concepto: conceptoVal || catVal,
      total: montoFinal, pago: pagoVal, saldo: montoFinal - pagoVal,
      cuenta: cuentaFinal || '',
      ...(tarjetaFinal ? { tarjeta: tarjetaFinal } : {}),
      estado: esFuturo ? 'pendiente' : 'realizado',
      esFuturo: esFuturo || false,
      ...(clienteRef.trim() ? { clienteRef: clienteRef.trim() } : {}),
    });

    const presupuestoMes = state.presupuestos[mesVal] || {};
    if (tipoVal === 'Egreso' && presupuestoMes[catVal]) {
      const txsMes = [...state.transacciones, { movimiento: tipoVal, categoria: catVal, total: montoFinal, mes: mesVal }];
      const gastado = txsMes.filter(t => t.mes === mesVal && t.movimiento === 'Egreso' && t.categoria === catVal).reduce((s, t) => s + Math.abs(t.total), 0);
      const limite = presupuestoMes[catVal];
      if (gastado >= limite)            showToast(`${catVal}: presupuesto superado`, 'error');
      else if (gastado >= limite * 0.8) showToast(`${catVal}: 80% del presupuesto`, 'error');
    }

    showToast('Guardado', 'success');
    resetForm();
    return true;
  }

  function toggleVoz() {
    if (escuchando) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Tu navegador no soporta voz', 'error'); return; }
    const r = new SR(); recognitionRef.current = r;
    r.lang = 'es-CO'; r.interimResults = true; r.maxAlternatives = 3;
    r.onstart  = () => { setEscuchando(true); setVozPreview('Escuchando...'); };
    r.onresult = (e) => {
      const transcript = Array.from(e.results).map(res => res[0].transcript).join('');
      setVozPreview(transcript);
      if (e.results[e.results.length - 1].isFinal) aplicarVoz(transcript);
    };
    r.onerror  = (e) => { showToast('Error: ' + e.error, 'error'); setEscuchando(false); };
    r.onend    = () => setEscuchando(false);
    r.start();
  }

  function aplicarVoz(transcript) {
    setEscuchando(false);
    const { monto: m, categoria: c, cuenta: cu, concepto: co, movimiento: mov, tipoMov: tm } = parsearVoz(transcript);
    if (!m) { setVozPreview('No detecté el monto. Ej: "treinta mil Rappi Nequi"'); return; }
    const catFinal = c || inferirCategoria(co) || 'Extras';
    const ok = guardar({ monto: m, categoria: catFinal, concepto: co, cuenta: cu, tipoMov: tm, tipo: mov });
    if (ok) { setVozPreview(''); navigate('/historial'); }
  }

  const canSave = parseAmt(monto) > 0 && concepto.trim() && categoria && (tipo === 'Ingreso' || cuenta);
  const esEgreso = tipo === 'Egreso';

  return (
    <Box sx={{ pb: 12 }}>

      {/* ── Ya ocurrió / Programado ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 0, p: '3px', borderRadius: '10px', bgcolor: '#EBEBEB' }}>
          {[
            { val: false, label: 'Ya ocurrió' },
            { val: true,  label: 'Programado' },
          ].map(({ val, label }) => (
            <Box key={label} onClick={() => {
              setEsFuturo(val);
              if (val && fecha <= todayStr()) {
                const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                setFecha(tomorrow.toISOString().split('T')[0]);
              }
              if (!val) setFecha(todayStr());
            }} sx={{
              flex: 1, py: 0.75, borderRadius: '8px', textAlign: 'center',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              bgcolor: esFuturo === val ? '#fff' : 'transparent',
              color:   esFuturo === val ? (val ? '#6366F1' : T1) : T2,
              boxShadow: esFuturo === val ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>
              {val ? '📅 ' : ''}{label}
            </Box>
          ))}
        </Box>
        {esFuturo && (
          <Box sx={{ mt: 0.75, px: 1, py: 0.625, borderRadius: '8px', bgcolor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
            <Typography sx={{ fontSize: 11, color: '#4338CA', fontWeight: 500 }}>
              Se registra como pendiente · aparece en Flujo de Caja
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Egreso / Ingreso ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 0, p: '3px', borderRadius: '10px', bgcolor: '#EBEBEB' }}>
          {[{ val: 'Egreso', color: RED }, { val: 'Ingreso', color: GREEN }].map(({ val, color }) => (
            <Box key={val} onClick={() => handleTipoChange(val)} sx={{
              flex: 1, py: 0.875, borderRadius: '8px', textAlign: 'center',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              bgcolor: tipo === val ? '#fff' : 'transparent',
              color:   tipo === val ? color : T2,
              boxShadow: tipo === val ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{val}</Box>
          ))}
        </Box>
      </Box>

      {/* ── Monto ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2, py: 1.25, borderRadius: '12px', border: '1.5px solid', borderColor: monto ? (esEgreso ? alpha(RED, 0.4) : alpha(GREEN, 0.4)) : BORDER, bgcolor: '#fff', transition: 'all 0.15s' }}>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: T2, lineHeight: 1, flexShrink: 0 }}>$</Typography>
          <Box component="input" type="text" inputMode="numeric" placeholder="0" value={monto}
            onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setMonto(isNaN(n) ? '' : n.toLocaleString('es-CO')); }}
            sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 32, fontWeight: 900, fontFamily: 'inherit', letterSpacing: '-1px', color: esEgreso ? RED : GREEN, '&::placeholder': { color: alpha('#919EAB', 0.3), fontWeight: 400, fontSize: 28 } }}
          />
          {monto && <Box onClick={() => setMonto('')} sx={{ color: T2, cursor: 'pointer', fontSize: 18, lineHeight: 1, px: 0.5 }}>×</Box>}
        </Box>
      </Box>

      {/* ── Fijo/Variable (solo Egreso) ── */}
      {tipo === 'Egreso' && (
        <Box sx={{ px: '20px', mb: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 0, p: '3px', borderRadius: '10px', bgcolor: '#EBEBEB', width: 'fit-content' }}>
            {['Variable', 'Fijo'].map(t => (
              <Box key={t} onClick={() => handleTipoMovChange(t)} sx={{
                px: 2, py: 0.625, borderRadius: '8px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                bgcolor: tipoMov === t ? '#fff' : 'transparent', color: tipoMov === t ? T1 : T2,
                boxShadow: tipoMov === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{t}</Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Fecha ── */}
      <Box sx={{ px: '20px', mb: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Box onClick={() => setShowFecha(v => !v)} sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.625, borderRadius: 2, cursor: 'pointer',
          border: '1px solid', transition: 'all 0.15s',
          borderColor: showFecha ? GREEN : BORDER, bgcolor: fecha !== todayStr() ? '#FFFBEB' : '#fff', color: fecha !== todayStr() ? '#92400E' : T2,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'inherit' }}>{fmtDateLabel(fecha)}</Typography>
        </Box>
      </Box>
      <Collapse in={showFecha}>
        <Box sx={{ px: '20px', mb: 1.5 }}>
          <Box component="input" type="date" value={fecha} onChange={e => { setFecha(e.target.value); setShowFecha(false); }}
            sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: 1.5, border: `1px solid ${GREEN}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none' }}
          />
        </Box>
      </Collapse>

      {/* ── Concepto ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        <Label>{esFuturo && tipo === 'Ingreso' ? 'Descripción del cobro' : 'Concepto'}</Label>
        <Box component="input" type="text"
          placeholder={esFuturo && tipo === 'Ingreso' ? 'Ej: Sesión Juan, Proyecto web...' : 'Ej: Vittoria, Internet, Netflix...'}
          value={concepto}
          onChange={e => handleConceptoChange(e.target.value)}
          sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: '10px', border: '1px solid', borderColor: concepto ? alpha(GREEN, 0.5) : BORDER, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', transition: 'border-color 0.15s', '&:focus': { borderColor: GREEN } }}
        />
      </Box>

      {/* ── Cliente (solo ingresos programados) ── */}
      {esFuturo && tipo === 'Ingreso' && (
        <Box sx={{ px: '20px', mb: 1.5 }}>
          <Label>¿A quién cobrar? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></Label>
          <Box component="input" type="text" placeholder="Ej: Juan Pérez, Empresa XYZ..."
            value={clienteRef}
            onChange={e => setClienteRef(e.target.value)}
            sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: '10px', border: '1px solid', borderColor: clienteRef ? alpha('#6366F1', 0.5) : BORDER, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', transition: 'border-color 0.15s', '&:focus': { borderColor: '#6366F1' } }}
          />
        </Box>
      )}

      {/* ── Categorías ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        <Label>Categoría {autoSug && categoria && <span style={{ color: GREEN, marginLeft: 4, fontWeight: 800 }}>· auto</span>}</Label>
        <Box component="input" type="text" placeholder="Buscar categoría..." value={catSearch}
          onChange={e => { setCatSearch(e.target.value); if (autoSug) { setCategoria(''); setAutoSug(false); } }}
          sx={{ width: '100%', boxSizing: 'border-box', px: 1.25, py: 0.875, mb: 1, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {catsFiltradas.map(c => {
            const sel = categoria === c;
            return (
              <Box key={c} onClick={() => { setCategoria(c); setCatSearch(''); setAutoSug(false); }} sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.6, borderRadius: '20px', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
                borderColor: sel ? alpha(GREEN, 0.6) : BORDER, bgcolor: sel ? alpha(GREEN, 0.08) : '#fff', color: sel ? GREEN : T2,
                boxShadow: sel ? `0 0 0 2px ${alpha(GREEN, 0.15)}` : 'none', '&:active': { transform: 'scale(0.95)' },
              }}>
                <span style={{ fontSize: 14 }}>{CAT_ICONS[c] || '·'}</span>
                {c}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Cuenta ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        {state.cuentas.filter(c => c !== 'T.C').length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Label>Cuenta</Label>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {state.cuentas.filter(c => c !== 'T.C').map(c => {
                const sel = cuenta === c;
                return (
                  <Box key={c} onClick={() => { setCuenta(sel ? '' : c); setTarjeta(''); }} sx={{
                    px: 1.5, py: 0.625, borderRadius: '20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
                    borderColor: sel ? alpha(GREEN, 0.6) : BORDER, bgcolor: sel ? GREEN : '#fff', color: sel ? '#fff' : T2,
                  }}>{c}</Box>
                );
              })}
            </Box>
          </Box>
        )}
        {state.cuentas.includes('T.C') && (
          <Box>
            <Label>Tarjeta de crédito</Label>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {tarjetas.length === 0 && (
                <Box onClick={() => { setCuenta(cuenta === 'T.C' ? '' : 'T.C'); setTarjeta(''); }} sx={{ px: 1.5, py: 0.625, borderRadius: '20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: cuenta === 'T.C' ? alpha(GREEN, 0.6) : BORDER, bgcolor: cuenta === 'T.C' ? GREEN : '#fff', color: cuenta === 'T.C' ? '#fff' : T2 }}>T.C</Box>
              )}
              {tarjetas.map(t => {
                const sel = cuenta === 'T.C' && tarjeta === t.nombre;
                return (
                  <Box key={t.id} onClick={() => { setCuenta('T.C'); setTarjeta(sel ? '' : t.nombre); }} sx={{ px: 1.5, py: 0.625, borderRadius: '20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: sel ? alpha(GREEN, 0.6) : BORDER, bgcolor: sel ? GREEN : '#fff', color: sel ? '#fff' : T2 }}>{t.nombre}</Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Voz ── */}
      <Box sx={{ px: '20px', mb: 1.5 }}>
        <Box onClick={toggleVoz} sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25,
          py: 1.125, borderRadius: '10px', border: '1px dashed', cursor: 'pointer',
          borderColor: escuchando ? GREEN : BORDER, bgcolor: escuchando ? alpha(GREEN, 0.06) : '#fff', color: escuchando ? GREEN : T2,
          transition: 'all 0.2s', animation: escuchando ? 'pulse 1.2s infinite' : 'none',
          '@keyframes pulse': { '0%,100%': { boxShadow: 'none' }, '50%': { boxShadow: `0 0 0 6px ${alpha(GREEN, 0.12)}` } },
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'inherit' }}>{escuchando ? 'Escuchando...' : 'Dictar por voz'}</Typography>
        </Box>
        {vozPreview && (
          <Box sx={{ mt: 0.75, px: 1.5, py: 1, borderRadius: '10px', bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.2)}` }}>
            <Typography sx={{ fontSize: 13, color: GREEN }}>{vozPreview}</Typography>
          </Box>
        )}
      </Box>

      {/* ── Pago parcial ── */}
      <Box sx={{ px: '20px', mb: 2 }}>
        <Box onClick={() => setPagoParcial(v => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none' }}>
          <Box sx={{ width: 18, height: 18, borderRadius: 0.5, border: '1.5px solid', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: pagoParcial ? GREEN : BORDER, bgcolor: pagoParcial ? GREEN : 'transparent' }}>
            {pagoParcial && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: T2 }}>Pago parcial (queda saldo pendiente)</Typography>
        </Box>
        <Collapse in={pagoParcial}>
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: '#fff' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: T2, flexShrink: 0 }}>$</Typography>
            <Box component="input" type="text" inputMode="numeric" placeholder="Monto ya pagado" value={montoPago}
              onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setMontoPago(isNaN(n) ? '' : n.toLocaleString('es-CO')); }}
              sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', color: T1, '&::placeholder': { color: alpha('#919EAB', 0.4), fontWeight: 400 } }}
            />
          </Box>
        </Collapse>
      </Box>

      {/* ── Botón guardar fijo ── */}
      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, pb: 3, bgcolor: BG, borderTop: `1px solid ${BORDER}`, zIndex: 50 }}>
        <Box component="button" onClick={() => guardar()} disabled={!canSave} sx={{
          width: '100%', py: 1.625, borderRadius: '12px', border: 'none',
          cursor: canSave ? 'pointer' : 'not-allowed',
          bgcolor: canSave ? GREEN : alpha('#919EAB', 0.16), color: canSave ? '#fff' : T2,
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          boxShadow: canSave ? `0 4px 16px ${alpha(GREEN, 0.3)}` : 'none', transition: 'all 0.15s',
        }}>
          {canSave ? `Guardar ${tipo === 'Egreso' ? 'egreso' : 'ingreso'}${categoria ? ` · ${categoria}` : ''}` : 'Completa monto y categoría'}
        </Box>
      </Box>
    </Box>
  );
}

// ── Página principal ───────────────────────────────────────
export default function Registrar() {
  const { addTransaccion, pagarPresupuestoItem, state } = useFinanzas();
  const { showToast } = useSnackbar();
  const [tab, setTab] = useState('pagos');

  const TABS = [['pagos', 'Mis pagos'], ['registrar', 'Registrar']];

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
      <Box sx={{ maxWidth: { xs: 500, md: 960 }, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ px: '20px', pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2, mb: 1.5 }}>
            Registrar
          </Typography>
          {/* Tab toggle */}
          <Box sx={{ display: 'flex', bgcolor: '#EBEBEB', borderRadius: '10px', p: '3px' }}>
            {TABS.map(([id, label]) => (
              <Box key={id} onClick={() => setTab(id)} sx={{
                flex: 1, py: 0.75, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                bgcolor: tab === id ? CARD : 'transparent', boxShadow: tab === id ? CARD_SH : 'none',
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? T1 : T2, lineHeight: 1 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {tab === 'pagos'     && <MisPagos     state={state} addTransaccion={addTransaccion} pagarPresupuestoItem={pagarPresupuestoItem} showToast={showToast} />}
        {tab === 'registrar' && <FormRegistrar state={state} addTransaccion={addTransaccion} showToast={showToast} />}

      </Box>
    </Box>
  );
}
