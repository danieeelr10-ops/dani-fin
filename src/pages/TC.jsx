import { useState, useMemo } from 'react';
import { Box, Typography, alpha, Collapse } from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { formatMoney, formatFechaShort } from 'src/utils/format';
import { MESES, MES_NAMES, CAT_ICONS } from 'src/constants';

const BG      = '#F7F7F8';
const CARD    = '#FFFFFF';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)';
const T1      = '#111318';
const T2      = '#6B7280';
const GREEN   = '#00A76F';
const RED     = '#DC2626';
const AMBER   = '#D97706';
const BORDER  = '#E5E7EB';
const DIAS    = Array.from({ length: 31 }, (_, i) => i + 1);

function daysUntilNext(dia) {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dia);
  if (thisMonth >= today) return Math.ceil((thisMonth - today) / 86400000);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dia);
  return Math.ceil((nextMonth - today) / 86400000);
}

// ── Status badge tarjeta ────────────────────────────────────
function EstadoBadge({ totalCargos, totalPagado }) {
  if (totalCargos === 0) return null;
  if (totalPagado <= 0)
    return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: alpha(RED, 0.1), border: `1px solid ${alpha(RED, 0.25)}` }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: RED }}>Pendiente</Typography>
    </Box>;
  if (totalPagado < totalCargos)
    return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: alpha(AMBER, 0.1), border: `1px solid ${alpha(AMBER, 0.25)}` }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: AMBER }}>Parcial</Typography>
    </Box>;
  return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: alpha(GREEN, 0.1), border: `1px solid ${alpha(GREEN, 0.25)}` }}>
    <Typography sx={{ fontSize: 10, fontWeight: 700, color: GREEN }}>Pagada ✓</Typography>
  </Box>;
}

// ── Extracto de una tarjeta ─────────────────────────────────
function ExtractoTarjeta({ tarjeta, cargos, pagos, mes, onAdd, onDeleteTx, onDeletePago, onPagar, cuentas }) {
  const [open, setOpen]           = useState(false);
  const [showPago, setShowPago]   = useState(false);
  const [monto, setMonto]         = useState('');
  const [cuenta, setCuenta]       = useState(cuentas[0] || 'Nequi');
  const [fecha, setFecha]         = useState(new Date().toISOString().split('T')[0]);

  const totalCargos = cargos.reduce((s, t) => s + Math.abs(t.total), 0);
  const totalPagado = pagos.reduce((s, t) => s + Math.abs(t.total), 0);
  const saldo       = Math.max(0, totalCargos - totalPagado);
  const pagada      = totalCargos > 0 && totalPagado >= totalCargos;
  const dias        = daysUntilNext(tarjeta.diaPago);
  const urgente     = dias <= 5 && !pagada;
  const sorted      = [...cargos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  function confirmarPago() {
    const val = parseInt(monto.replace(/\D/g, ''), 10);
    if (!val) return;
    onPagar(val, cuenta, fecha);
    setMonto(''); setShowPago(false);
  }

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', boxShadow: CARD_SH, border: `1px solid ${pagada ? alpha(GREEN, 0.35) : urgente ? alpha(RED, 0.35) : BORDER}`, overflow: 'hidden', mb: 2 }}>

      {/* ── Header tarjeta ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <Box onClick={() => setOpen(o => !o)} sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.75, cursor: 'pointer', '&:active': { opacity: 0.7 } }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '10px', flexShrink: 0, bgcolor: pagada ? alpha(GREEN, 0.1) : '#F3F4F6', border: `1px solid ${pagada ? alpha(GREEN, 0.25) : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pagada
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            }
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{tarjeta.nombre}</Typography>
              <EstadoBadge totalCargos={totalCargos} totalPagado={totalPagado} />
            </Box>
            <Typography sx={{ fontSize: 11, color: urgente ? RED : T2, fontWeight: urgente ? 600 : 400 }}>
              Pago el día {tarjeta.diaPago} · {dias === 0 ? '¡hoy!' : `${dias}d`}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: saldo > 0 ? RED : T2 }}>
              {formatMoney(saldo > 0 ? saldo : totalCargos)}
            </Typography>
            <Typography sx={{ fontSize: 10, color: T2 }}>
              {saldo > 0 ? 'por pagar' : totalCargos > 0 ? 'total' : `${cargos.length} cargos`}
            </Typography>
          </Box>
          <Box sx={{ color: T2, ml: 1, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Box>

        {/* Botón pagar rápido */}
        {!pagada && totalCargos > 0 && (
          <Box onClick={() => { setMonto(String(saldo)); setShowPago(true); setOpen(true); }} sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            px: 1.75, py: 1.5, cursor: 'pointer', borderLeft: `1px solid ${BORDER}`,
            bgcolor: alpha(GREEN, 0.04), gap: 0.4, flexShrink: 0,
            '&:active': { opacity: 0.7 },
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: GREEN }}>Pagar</Typography>
          </Box>
        )}
      </Box>

      {/* ── Cuerpo colapsable ── */}
      <Collapse in={open}>
        <Box sx={{ borderTop: `1px solid ${BORDER}` }}>

          {/* Lista de cargos */}
          {sorted.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: T2, mb: 0.5 }}>Sin cargos registrados este mes</Typography>
              <Typography sx={{ fontSize: 11, color: T2 }}>
                Los gastos que registres con esta tarjeta aparecen aquí automáticamente
              </Typography>
            </Box>
          ) : sorted.map((t, i) => {
            const cubierto = pagada;
            return (
              <Box key={t.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                borderBottom: i < sorted.length - 1 ? `1px solid ${BORDER}` : 'none',
                bgcolor: cubierto ? 'rgba(0,167,111,0.025)' : 'transparent',
              }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '8px', flexShrink: 0, bgcolor: cubierto ? alpha(GREEN, 0.1) : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                  {cubierto
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : (CAT_ICONS[t.categoria] || '·')
                  }
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: cubierto ? T2 : T1, textDecoration: cubierto ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.concepto}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: T2, mt: 0.15 }}>
                    {formatFechaShort(t.fecha)} · {t.categoria}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: cubierto ? T2 : RED, flexShrink: 0 }}>
                  −{formatMoney(Math.abs(t.total))}
                </Typography>
                <Box onClick={() => onDeleteTx(t.id)} sx={{ width: 26, height: 26, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, flexShrink: 0, '&:active': { bgcolor: alpha(RED, 0.08), color: RED } }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </Box>
              </Box>
            );
          })}

          {/* Totales */}
          {sorted.length > 0 && (
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#F9FAFB', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: T2 }}>Total cargos</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T1 }}>{formatMoney(totalCargos)}</Typography>
            </Box>
          )}

          {/* Pagos registrados */}
          {pagos.length > 0 && (
            <Box sx={{ borderTop: `1px solid ${BORDER}` }}>
              <Box sx={{ px: 2, py: 0.875, bgcolor: alpha(GREEN, 0.04) }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Pagos registrados · {formatMoney(totalPagado)} de {formatMoney(totalCargos)}
                </Typography>
              </Box>
              {pagos.map(p => (
                <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.125, borderBottom: `1px solid ${BORDER}` }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', flexShrink: 0, bgcolor: alpha(GREEN, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>Pago desde {p.cuenta}</Typography>
                    <Typography sx={{ fontSize: 11, color: T2 }}>{formatFechaShort(p.fecha)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: GREEN, flexShrink: 0 }}>{formatMoney(Math.abs(p.total))}</Typography>
                  <Box onClick={() => onDeletePago(p.id)} sx={{ width: 26, height: 26, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, flexShrink: 0, '&:active': { bgcolor: alpha(RED, 0.08), color: RED } }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Formulario de pago */}
          {showPago ? (
            <Box sx={{ p: 2, bgcolor: 'rgba(0,167,111,0.03)', borderTop: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: T1, mb: 1.25 }}>Registrar pago de tarjeta</Typography>

              {/* Monto */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.875, borderRadius: '10px', border: `1.5px solid rgba(0,167,111,0.4)`, bgcolor: '#fff', mb: 1 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: T2 }}>$</Typography>
                <Box component="input" type="text" inputMode="numeric" placeholder="0" value={monto}
                  onChange={e => { const n = parseInt(e.target.value.replace(/\D/g,''),10); setMonto(isNaN(n)?'':n.toLocaleString('es-CO')); }}
                  sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 22, fontWeight: 800, fontFamily: 'inherit', color: GREEN, letterSpacing: '-0.5px', '&::placeholder': { color: 'rgba(145,158,171,0.3)', fontWeight: 400, fontSize: 18 } }}
                />
                {saldo > 0 && (
                  <Box onClick={() => setMonto(String(saldo))} sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: alpha(GREEN, 0.1), cursor: 'pointer', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN }}>Total</Typography>
                  </Box>
                )}
              </Box>

              {/* Cuenta + fecha */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
                <Box component="select" value={cuenta} onChange={e => setCuenta(e.target.value)}
                  sx={{ flex: 1, px: 1.25, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', cursor: 'pointer' }}>
                  {cuentas.filter(c => c !== 'T.C').map(c => <option key={c} value={c}>{c}</option>)}
                </Box>
                <Box component="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  sx={{ flex: 1, px: 1.25, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', boxSizing: 'border-box' }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box component="button" onClick={() => { setShowPago(false); setMonto(''); }} sx={{ flex: 1, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                  Cancelar
                </Box>
                <Box component="button" onClick={confirmarPago} disabled={!monto} sx={{ flex: 2, py: 0.875, borderRadius: '8px', border: 'none', bgcolor: monto ? GREEN : alpha('#919EAB', 0.16), color: monto ? '#fff' : T2, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: monto ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                  Confirmar pago
                </Box>
              </Box>
            </Box>
          ) : (
            /* Botón abrir pago */
            !pagada && totalCargos > 0 && (
              <Box onClick={() => { setMonto(String(saldo)); setShowPago(true); }} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.375, cursor: 'pointer', borderTop: `1px solid ${BORDER}`, '&:active': { opacity: 0.7 } }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>
                  Pagar {formatMoney(saldo)}
                </Typography>
              </Box>
            )
          )}

        </Box>
      </Collapse>
    </Box>
  );
}

// ── Config tarjetas ─────────────────────────────────────────
function TarjetasConfig({ tarjetas, cuentas, onSave }) {
  const [nombre, setNombre] = useState('');
  const [dia, setDia]       = useState('');

  function add() {
    if (!nombre.trim() || !dia) return;
    onSave([...tarjetas, { id: Date.now(), nombre: nombre.trim(), diaPago: parseInt(dia) }]);
    setNombre(''); setDia('');
  }

  if (tarjetas.length === 0 && !nombre) return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', boxShadow: CARD_SH, border: `1.5px dashed ${BORDER}`, p: 2.5, mb: 2.5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, mb: 0.5 }}>No tienes tarjetas configuradas</Typography>
      <Typography sx={{ fontSize: 12, color: T2, mb: 1.75 }}>Agrega tus tarjetas para registrar y hacer seguimiento de cargos</Typography>
      <Box component="button" onClick={() => setNombre(' ')} sx={{ px: 2.5, py: 0.875, borderRadius: '10px', border: 'none', bgcolor: T1, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
        + Agregar tarjeta
      </Box>
    </Box>
  );

  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '14px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden', mb: 2.5 }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>Mis tarjetas</Typography>
          <Typography sx={{ fontSize: 12, color: T2, mt: 0.125 }}>Nombre · día de pago mensual</Typography>
        </Box>
      </Box>

      {tarjetas.map(t => {
        const dias = daysUntilNext(t.diaPago);
        const urgente = dias <= 5;
        return (
          <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375, borderBottom: `1px solid ${BORDER}` }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1 }}>{t.nombre}</Typography>
              <Typography sx={{ fontSize: 11, color: T2 }}>Pago el día {t.diaPago}</Typography>
            </Box>
            <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', bgcolor: urgente ? alpha(RED, 0.08) : '#F3F4F6' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: urgente ? RED : T2 }}>
                {dias === 0 ? '¡Hoy!' : `${dias}d`}
              </Typography>
            </Box>
            <Box onClick={() => onSave(tarjetas.filter(x => x.id !== t.id))} sx={{ width: 28, height: 28, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, flexShrink: 0, '&:active': { bgcolor: alpha(RED, 0.08), color: RED } }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Box>
          </Box>
        );
      })}

      {/* Formulario nueva tarjeta */}
      <Box sx={{ display: 'flex', gap: 1, p: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 2, minWidth: 130 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Nombre</Typography>
          <Box component="input" value={nombre.trim()} onChange={e => setNombre(e.target.value)} placeholder="Ej: Nu, Visa..." onKeyDown={e => e.key === 'Enter' && add()}
            sx={{ width: '100%', boxSizing: 'border-box', px: 1.25, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#F9FAFB', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 90 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Día de pago</Typography>
          <Box component="select" value={dia} onChange={e => setDia(e.target.value)}
            sx={{ width: '100%', boxSizing: 'border-box', px: 1.25, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#F9FAFB', fontSize: 13, fontFamily: 'inherit', color: dia ? T1 : T2, outline: 'none', cursor: 'pointer' }}>
            <option value="">Día</option>
            {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
          </Box>
        </Box>
        <Box component="button" onClick={add} disabled={!nombre.trim() || !dia} sx={{ px: 2, py: 0.875, borderRadius: '8px', border: 'none', cursor: nombre.trim() && dia ? 'pointer' : 'not-allowed', bgcolor: nombre.trim() && dia ? T1 : alpha('#919EAB', 0.16), color: nombre.trim() && dia ? '#fff' : T2, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
          + Agregar
        </Box>
      </Box>
    </Box>
  );
}

// ── Main ────────────────────────────────────────────────────
export default function TC() {
  const { state, saveTarjetas, addTransaccion, deleteTransaccion, mesActivo, liquidarTC } = useFinanzas();
  const mes = mesActivo;

  const cuentas = state.cuentas || ['Nequi', 'Nu', 'Daviplata', 'Efectivo'];

  // Cargos de TC por tarjeta en el mes activo
  const txsPorTarjeta = useMemo(() => {
    const map = {};
    state.transacciones
      .filter(t => t.mes === mes && t.cuenta === 'T.C' && t.movimiento === 'Egreso' && t.categoria !== 'Pago TC')
      .forEach(t => {
        const key = t.tarjeta || '(sin asignar)';
        if (!map[key]) map[key] = [];
        map[key].push(t);
      });
    return map;
  }, [state.transacciones, mes]);

  // Pagos por tarjeta en el mes activo
  const pagosPorTarjeta = useMemo(() => {
    const map = {};
    state.transacciones
      .filter(t => t.mes === mes && t.categoria === 'Pago TC' && t.movimiento === 'Egreso')
      .forEach(t => {
        const key = t.tarjeta || '';
        if (!map[key]) map[key] = [];
        map[key].push(t);
      });
    return map;
  }, [state.transacciones, mes]);

  // KPIs globales
  const totalTC = useMemo(() =>
    Object.values(txsPorTarjeta).flat().reduce((s, t) => s + Math.abs(t.total), 0),
    [txsPorTarjeta]
  );
  const totalPagado = useMemo(() =>
    Object.values(pagosPorTarjeta).flat().reduce((s, t) => s + Math.abs(t.total), 0),
    [pagosPorTarjeta]
  );
  const proximaTarjeta = useMemo(() =>
    (state.tarjetas || []).reduce((best, t) => {
      const d = daysUntilNext(t.diaPago);
      return (!best || d < best.dias) ? { nombre: t.nombre, dias: d, dia: t.diaPago } : best;
    }, null),
    [state.tarjetas]
  );

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Tarjetas de crédito</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>{MES_NAMES[MESES.indexOf(mes)]} · cargos y pagos</Typography>
        </Box>

        {/* Selector de mes */}
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 2.5, pb: 0.5 }}>
          {MESES.map((m, i) => (
            <Box key={m} onClick={() => {}} sx={{
              px: 1.75, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0,
              borderColor: m === mes ? T1 : BORDER, bgcolor: m === mes ? T1 : CARD, color: m === mes ? '#fff' : T2,
            }}>
              {MES_NAMES[i]}
            </Box>
          ))}
        </Box>

        {/* KPIs */}
        {totalTC > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 2.5 }}>
            {[
              { label: 'Total cargos', value: formatMoney(totalTC),   color: RED },
              { label: 'Pagado',       value: formatMoney(totalPagado), color: GREEN },
              { label: 'Por pagar',    value: formatMoney(Math.max(0, totalTC - totalPagado)), color: Math.max(0, totalTC - totalPagado) > 0 ? AMBER : T2 },
            ].map(({ label, value, color }) => (
              <Box key={label} sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 1.5 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>{label}</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Config tarjetas */}
        <TarjetasConfig tarjetas={state.tarjetas || []} cuentas={cuentas} onSave={saveTarjetas} />

        {/* Extracto por tarjeta */}
        {(state.tarjetas || []).length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
              Extracto · {MES_NAMES[MESES.indexOf(mes)]}
            </Typography>
            {(state.tarjetas || []).map(t => (
              <ExtractoTarjeta
                key={t.id}
                tarjeta={t}
                cargos={txsPorTarjeta[t.nombre] || []}
                pagos={pagosPorTarjeta[t.nombre] || []}
                mes={mes}
                cuentas={cuentas}
                onAdd={addTransaccion}
                onDeleteTx={deleteTransaccion}
                onDeletePago={(id) => {
                  const tx = state.transacciones.find(tr => tr.id === id);
                  if (tx?.pagoId) {
                    state.transacciones.filter(tr => tr.pagoId === tx.pagoId).forEach(tr => deleteTransaccion(tr.id));
                  } else deleteTransaccion(id);
                }}
                onPagar={(monto, cuenta, fecha) => {
                  const pagoId = Date.now();
                  const fechaISO = new Date(fecha + 'T12:00:00').toISOString();
                  addTransaccion({ id: pagoId, pagoId, concepto: `Pago ${t.nombre}`, total: -monto, pago: -monto, saldo: 0, categoria: 'Pago TC', movimiento: 'Egreso', tipo: 'Fijo', cuenta, tarjeta: t.nombre, fecha: fechaISO, mes });
                  addTransaccion({ id: pagoId + 1, pagoId, concepto: `Pago ${t.nombre}`, total: monto, pago: monto, saldo: 0, categoria: 'Pago TC', movimiento: 'Ingreso', tipo: 'Fijo', cuenta: 'T.C', tarjeta: t.nombre, fecha: fechaISO, mes });
                  liquidarTC(mes, t.nombre, cuenta);
                }}
              />
            ))}

            {/* Sin tarjetas asignadas */}
            {txsPorTarjeta['(sin asignar)']?.length > 0 && (
              <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${AMBER}30`, p: 2, mb: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: AMBER, mb: 0.5 }}>
                  {txsPorTarjeta['(sin asignar)'].length} cargo{txsPorTarjeta['(sin asignar)'].length !== 1 ? 's' : ''} sin tarjeta asignada
                </Typography>
                <Typography sx={{ fontSize: 12, color: T2 }}>
                  Edítalos en Historial para asignarlos a una tarjeta
                </Typography>
              </Box>
            )}
          </Box>
        )}

      </Box>
    </Box>
  );
}
