import { useState, useRef, useMemo } from 'react';
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

// ── Item de presupuesto con pago rápido ────────────────────
function PresupuestoItem({ cat, categoriaReal, presupuesto, pagado, esIngreso, state, onPagar }) {
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [fecha, setFecha] = useState(todayStr());

  const restante = Math.max(presupuesto - pagado, 0);
  const pct = presupuesto > 0 ? Math.min((pagado / presupuesto) * 100, 100) : 0;
  const pagadoTotal = pagado >= presupuesto && presupuesto > 0;
  const icon = CAT_ICONS[cat] || (esIngreso ? '💼' : '·');

  function handleOpen() {
    setOpen(o => !o);
    if (!monto && !open) setMonto(restante > 0 ? String(restante) : String(presupuesto));
  }

  function handleConfirm() {
    const val = parseAmt(monto);
    if (!val) return;
    onPagar({ cat: categoriaReal || cat, concepto: cat, monto: val, cuenta, tarjeta, fecha, esIngreso });
    setOpen(false);
    setMonto('');
    setCuenta('');
    setTarjeta('');
  }

  const canConfirm = parseAmt(monto) > 0 && cuenta;

  return (
    <Box sx={{ borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden', mb: 0.875 }}>
      {/* Fila principal */}
      <Box onClick={handleOpen} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.375, cursor: 'pointer', '&:active': { opacity: 0.7 } }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '9px', flexShrink: 0,
          bgcolor: pagadoTotal ? alpha(GREEN, 0.1) : '#F3F4F6',
          border: `1px solid ${pagadoTotal ? alpha(GREEN, 0.2) : BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>
          {pagadoTotal
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            : icon
          }
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2 }}>{cat}</Typography>
          {presupuesto > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.3 }}>
              <Typography sx={{ fontSize: 11, color: pagadoTotal ? GREEN : T2 }}>
                {fmtCOP(pagado)}
              </Typography>
              {presupuesto > 0 && (
                <Typography sx={{ fontSize: 11, color: T2 }}>/ {fmtCOP(presupuesto)}</Typography>
              )}
            </Box>
          )}
        </Box>
        {/* Estado / acción */}
        {pagadoTotal ? (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN, bgcolor: alpha(GREEN, 0.08), px: 0.875, py: 0.3, borderRadius: '6px' }}>
            Pagado
          </Typography>
        ) : (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.5, borderRadius: '8px', bgcolor: open ? T1 : '#F3F4F6',
            border: `1px solid ${open ? T1 : BORDER}`,
          }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: open ? '#fff' : T2 }}>
              {esIngreso ? 'Recibir' : 'Pagar'}
            </Typography>
          </Box>
        )}
        {/* Barra de progreso */}
      </Box>

      {/* Mini barra */}
      {presupuesto > 0 && (
        <Box sx={{ mx: 1.75, mb: 0.875, height: 3, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pagadoTotal ? GREEN : T1, borderRadius: 2, transition: 'width 0.4s' }} />
        </Box>
      )}

      {/* Formulario de pago inline */}
      <Box sx={{ overflow: 'hidden', maxHeight: open ? 400 : 0, transition: 'max-height 0.3s ease' }}>
        <Box sx={{ px: 1.75, pb: 1.5, pt: 0.5, borderTop: `1px solid ${BORDER}`, bgcolor: '#FAFAFA' }}>
          {/* Monto */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: CARD, mb: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: T2, lineHeight: 1, flexShrink: 0 }}>$</Typography>
            <Box component="input" type="text" inputMode="numeric" placeholder="0"
              value={monto}
              onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setMonto(isNaN(n) ? '' : n.toLocaleString('es-CO')); }}
              sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 20, fontWeight: 800, fontFamily: 'inherit', color: T1, '&::placeholder': { color: alpha('#919EAB', 0.3), fontWeight: 400 } }}
            />
          </Box>

          {/* Fecha */}
          <Box sx={{ mb: 1 }}>
            <Box component="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              sx={{ width: '100%', boxSizing: 'border-box', px: 1.25, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: CARD, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }}
            />
          </Box>

          {/* Cuenta */}
          <Box sx={{ mb: 1 }}>
            <CuentaSelector state={state} cuenta={cuenta} setCuenta={setCuenta} tarjeta={tarjeta} setTarjeta={setTarjeta} />
          </Box>

          {/* Botones */}
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Box component="button" onClick={() => setOpen(false)}
              sx={{ flex: 1, py: 0.75, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              Cancelar
            </Box>
            <Box component="button" onClick={handleConfirm} disabled={!canConfirm}
              sx={{ flex: 2, py: 0.75, borderRadius: '8px', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed', bgcolor: canConfirm ? GREEN : alpha('#919EAB', 0.16), color: canConfirm ? '#fff' : T2 }}>
              Confirmar {esIngreso ? 'ingreso' : 'pago'}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
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

  // Calcular lo ya pagado por categoría
  const pagadoPorCat = useMemo(() => {
    const map = {};
    txsMes.forEach(t => {
      if (!map[t.categoria]) map[t.categoria] = 0;
      map[t.categoria] += Math.abs(t.total);
    });
    return map;
  }, [txsMes]);

  // Grupos: ingresos, fijos, variables
  const fijos    = state.categoriasEgresoFijo.filter(c => presupMes[c] > 0);
  const vars     = state.categoriasEgresoVariable.filter(c => presupMes[c] > 0);

  // Items de ingreso del presupuesto detallado
  const ingresosDetalle = useMemo(() => {
    const items = state.presupuestosDetalle?.[mes] || [];
    return items.filter(i => state.categoriasIngreso.includes(i.categoria));
  }, [state.presupuestosDetalle, mes, state.categoriasIngreso]);

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

  function handlePagar({ cat, concepto, monto, cuenta, tarjeta, fecha, esIngreso }) {
    const mes2 = dateToMes(fecha);
    const esTarjeta = (state.tarjetas || []).some(t => t.nombre === cuenta);
    const cuentaFinal = esTarjeta ? 'T.C' : cuenta;
    const tarjetaFinal = esTarjeta ? cuenta : (cuenta === 'T.C' && tarjeta ? tarjeta : undefined);
    const tipoMov = esIngreso ? 'Variable' : (state.categoriasEgresoFijo.includes(cat) ? 'Fijo' : 'Variable');
    const conceptoFinal = concepto || cat;

    addTransaccion({
      id: Date.now(),
      fecha: new Date(fecha + 'T12:00:00').toISOString(),
      mes: mes2,
      tipo: tipoMov,
      movimiento: esIngreso ? 'Ingreso' : 'Egreso',
      categoria: cat,
      concepto: conceptoFinal,
      total: esIngreso ? monto : -monto,
      pago:  esIngreso ? monto : -monto,
      saldo: 0,
      cuenta: esIngreso ? (cuenta || '') : cuentaFinal,
      ...(tarjetaFinal ? { tarjeta: tarjetaFinal } : {}),
    });
    showToast(esIngreso ? `${conceptoFinal} registrado` : `${conceptoFinal} pagado`, 'success');
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

      {/* ── Sección: Ingresos ── */}
      <Box sx={{ mb: 2.5 }}>
        <SectionLabel>Ingresos</SectionLabel>

        {ingresosDetalle.length > 0 ? (
          ingresosDetalle.map(item => (
            <PresupuestoItem key={item.id}
              cat={item.concepto || item.categoria}
              categoriaReal={item.categoria}
              presupuesto={item.monto}
              pagado={ingresosRecibidos[item.concepto || item.categoria] || 0}
              esIngreso={true} state={state}
              onPagar={({ monto, cuenta, tarjeta }) => {
                pagarPresupuestoItem(mes, item.id, cuenta, tarjeta, monto);
                showToast(`${item.concepto || item.categoria} recibido`, 'success');
              }}
            />
          ))
        ) : (
          state.categoriasIngreso.map(cat => (
            <PresupuestoItem key={cat}
              cat={cat} presupuesto={presupMes[cat] || 0}
              pagado={ingresosRecibidos[cat] || 0}
              esIngreso={true} state={state} onPagar={handlePagar}
            />
          ))
        )}

        {ingresosDetalle.length === 0 && state.categoriasIngreso.length === 0 && (
          <Typography sx={{ fontSize: 13, color: T2, py: 1 }}>Sin ingresos este mes</Typography>
        )}
      </Box>

      {/* ── Sección: Egresos fijos ── */}
      {hayFijos && (
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Egresos fijos</SectionLabel>
          {fijos.map(cat => (
            <PresupuestoItem key={cat}
              cat={cat} presupuesto={presupMes[cat] || 0} pagado={pagadoPorCat[cat] || 0}
              esIngreso={false} state={state} onPagar={handlePagar}
            />
          ))}
        </Box>
      )}

      {/* ── Sección: Egresos variables ── */}
      {hayVars && (
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Egresos variables</SectionLabel>
          {vars.map(cat => (
            <PresupuestoItem key={cat}
              cat={cat} presupuesto={presupMes[cat] || 0} pagado={pagadoPorCat[cat] || 0}
              esIngreso={false} state={state} onPagar={handlePagar}
            />
          ))}
        </Box>
      )}

      {!hayFijos && !hayVars && (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14, color: T1, fontWeight: 600, mb: 0.5 }}>Sin presupuesto para {MES_NAMES[mesIdx]}</Typography>
          <Typography sx={{ fontSize: 13, color: T2 }}>Ve a Presupuesto para asignar montos a tus categorías</Typography>
        </Box>
      )}
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
        <Label>Concepto</Label>
        <Box component="input" type="text" placeholder="Ej: Vittoria, Internet, Netflix..." value={concepto}
          onChange={e => handleConceptoChange(e.target.value)}
          sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: '10px', border: '1px solid', borderColor: concepto ? alpha(GREEN, 0.5) : BORDER, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', transition: 'border-color 0.15s', '&:focus': { borderColor: GREEN } }}
        />
      </Box>

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
      <Box sx={{ maxWidth: 500, mx: 'auto' }}>

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
