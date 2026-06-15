import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Box, Typography, Card, Divider,
  alpha, Grid, Collapse,
} from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { computeMetrics } from 'src/utils/metrics';
import { computeIngresoStats } from 'src/utils/cashflow';
import { formatMoney, formatMoneyShort } from 'src/utils/format';
import { inferirCategoria } from 'src/utils/parsers';
import { MESES, MES_NAMES, CAT_ICONS, CAT_COLORS, CATEGORIAS_VOZ } from 'src/constants';

const BG      = '#F7F7F8'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'

function barColor(pct) {
  if (pct >= 100) return '#DC2626';
  if (pct >= 80)  return '#D97706';
  return '#00A76F';
}
function ingBarColor(pct) {
  if (pct >= 100) return '#00A76F';
  if (pct >= 60)  return '#D97706';
  return '#DC2626';
}
function parseAmt(str) {
  const n = parseInt(String(str).replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function fmtInput(val) {
  const n = parseInt(String(val).replace(/\D/g, ''), 10);
  return isNaN(n) || n === 0 ? '' : n.toLocaleString('es-CO');
}

// ── Sección desplegable ────────────────────────────────────
function CollapsibleSection({ label, summary, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ mb: 2 }}>
      <Box onClick={() => setOpen(v => !v)} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, mb: open ? 1.5 : 0,
        cursor: 'pointer', userSelect: 'none', py: 0.75, px: 1, borderRadius: 1,
        '&:hover': { bgcolor: 'rgba(145,158,171,0.05)' }, transition: 'background 0.1s',
      }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T2, flex: 1 }}>
          {label}
        </Typography>
        {summary && !open && (
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>{summary}</Typography>
        )}
        <Box sx={{ color: T2, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
        </Box>
      </Box>
      <Collapse in={open}>{children}</Collapse>
    </Box>
  );
}

// ── Lista limpia de categorías ─────────────────────────────
function CatListSection({ cats, presupuestoMes, actualVals, isIngreso = false, onEditCat }) {
  if (cats.length === 0) return null;
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      {cats.map((cat, i) => {
        const budget = presupuestoMes[cat] || 0;
        const actual = actualVals[cat]     || 0;
        const pct    = budget > 0 ? Math.min(actual / budget, 1) : 0;
        const icon   = CAT_ICONS[cat] || '·';
        const isLast = i === cats.length - 1;
        let bColor   = GREEN;
        if (!isIngreso) {
          if (pct >= 1)    bColor = '#DC2626';
          else if (pct >= 0.8) bColor = '#D97706';
        }
        return (
          <Box key={cat} onClick={() => onEditCat(cat)} sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.5, cursor: 'pointer',
            borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
            '&:active': { bgcolor: '#F9FAFB' },
          }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '10px', flexShrink: 0, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2 }}>{cat}</Typography>
              {budget > 0 ? (
                <Box sx={{ mt: 0.625 }}>
                  <Box sx={{ height: 3, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct * 100}%`, bgcolor: bColor, borderRadius: 2, transition: 'width 0.4s' }} />
                  </Box>
                  <Typography sx={{ fontSize: 10, color: actual > 0 ? bColor : T2, mt: 0.3, fontWeight: actual > 0 ? 600 : 400 }}>
                    {actual > 0 ? `${formatMoneyShort(actual)} · ${Math.round(pct * 100)}%` : 'Sin movimiento aún'}
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: 11, color: T2, mt: 0.2, opacity: 0.75 }}>Sin meta · toca para configurar</Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: budget > 0 ? T1 : T2 }}>
                {budget > 0 ? formatMoneyShort(budget) : '—'}
              </Typography>
              <Box sx={{ color: '#C4C8D0', display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Bottom sheet: categoría con ítems + meta ──────────────
function EditSheet({ cat, budget, actual, catItems, tarjetas = [], onSave, onAddItem, onDeleteItem, onClose }) {
  const icon       = CAT_ICONS[cat] || '·';
  const hayItems   = catItems.length > 0;
  const totalItems = catItems.reduce((s, i) => s + i.monto, 0);

  // Modo manual (sin ítems) — input de monto libre
  const [val, setVal]             = useState(!hayItems && budget > 0 ? fmtInput(budget) : '');
  // Nuevo ítem
  const [nConcepto, setNConcepto] = useState('');
  const [nMonto,    setNMonto]    = useState('');
  const [nTarjeta,  setNTarjeta]  = useState('');   // tarjeta TC opcional
  const [adding,    setAdding]    = useState(false);
  const inputRef  = useRef(null);
  const nConcRef  = useRef(null);

  useEffect(() => {
    if (!hayItems) setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    if (adding) setTimeout(() => nConcRef.current?.focus(), 80);
  }, [adding]);

  const totalEfectivo = hayItems ? totalItems : parseAmt(val);
  const pct       = totalEfectivo > 0 ? Math.min(actual / totalEfectivo, 1) : 0;
  const barColor  = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : GREEN;

  function confirmarItem() {
    const m = parseInt(nMonto.replace(/\D/g, ''), 10);
    if (!nConcepto.trim() || !m) return;
    onAddItem({ concepto: nConcepto.trim(), categoria: cat, monto: m, tarjeta: nTarjeta || null });
    setNConcepto(''); setNMonto(''); setNTarjeta('');
    setTimeout(() => nConcRef.current?.focus(), 50);
  }

  function handleGuardar() {
    if (!hayItems) onSave(cat, parseAmt(val));
    onClose();
  }

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', zIndex: 600 }} />
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 601,
        bgcolor: '#fff', borderRadius: '20px 20px 0 0',
        px: 2.5, pt: 1, pb: 'calc(env(safe-area-inset-bottom) + 20px)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        maxWidth: 600, mx: 'auto',
        maxHeight: '88dvh', overflowY: 'auto',
      }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: '#E5E7EB', mx: 'auto', mb: 1.75 }} />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: T1, lineHeight: 1.2 }}>{cat}</Typography>
            <Typography sx={{ fontSize: 12, color: T2 }}>
              {hayItems ? `${catItems.length} ítem${catItems.length !== 1 ? 's' : ''} · ${formatMoney(totalItems)} total` : 'Meta mensual'}
            </Typography>
          </Box>
          {actual > 0 && totalEfectivo > 0 && (
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontSize: 10, color: T2 }}>Gastado</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: barColor }}>{Math.round(pct * 100)}%</Typography>
            </Box>
          )}
        </Box>

        {/* Barra de progreso si hay gasto */}
        {actual > 0 && totalEfectivo > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ height: 5, borderRadius: 3, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, bgcolor: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
            </Box>
            <Typography sx={{ fontSize: 11, color: T2, mt: 0.375 }}>
              {formatMoneyShort(actual)} gastado de {formatMoneyShort(totalEfectivo)} · {formatMoneyShort(Math.max(0, totalEfectivo - actual))} disponible
            </Typography>
          </Box>
        )}

        {/* ── MODO CON ÍTEMS ── */}
        {hayItems && (
          <Box sx={{ mb: 1.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.875 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conceptos</Typography>
              <Box onClick={() => setAdding(v => !v)} sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.375,
                borderRadius: '20px', cursor: 'pointer', border: `1px solid ${adding ? GREEN : BORDER}`,
                bgcolor: adding ? 'rgba(0,167,111,0.07)' : 'transparent',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={adding ? GREEN : T2} strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: adding ? GREEN : T2 }}>Agregar</Typography>
              </Box>
            </Box>

            {/* Lista de ítems */}
            <Box sx={{ bgcolor: '#F9FAFB', borderRadius: '10px', border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {catItems.map((item, i) => (
                <Box key={item.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.125,
                  borderBottom: i < catItems.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 500, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.concepto}</Typography>
                    {item.tarjeta && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#6366F1' }}>{item.tarjeta}</Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, flexShrink: 0 }}>{formatMoney(item.monto)}</Typography>
                  <Box onClick={() => onDeleteItem(item.id)} sx={{
                    width: 24, height: 24, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T2, flexShrink: 0, '&:active': { bgcolor: '#FEF2F2', color: '#DC2626' },
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Box>
                </Box>
              ))}

              {/* Fila para agregar nuevo ítem */}
              {adding && (
                <Box sx={{ borderTop: `1px solid ${BORDER}`, bgcolor: 'rgba(0,167,111,0.03)' }}>
                  <Box sx={{ display: 'flex', gap: 0.75, px: 1.5, pt: 1, pb: 0.625, alignItems: 'center' }}>
                    <Box component="input" ref={nConcRef} type="text" placeholder="Concepto..." value={nConcepto}
                      onChange={e => setNConcepto(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && confirmarItem()}
                      sx={{ flex: 1, px: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, px: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 12, color: T2 }}>$</Typography>
                      <Box component="input" type="text" inputMode="numeric" placeholder="0" value={nMonto}
                        onChange={e => { const n = parseInt(e.target.value.replace(/\D/g,''),10); setNMonto(isNaN(n)?'':n.toLocaleString('es-CO')); }}
                        onKeyDown={e => e.key === 'Enter' && confirmarItem()}
                        sx={{ width: 72, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: T1 }}
                      />
                    </Box>
                    <Box onClick={confirmarItem} sx={{
                      width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                      bgcolor: nConcepto && nMonto ? GREEN : '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', '&:active': { opacity: 0.75 },
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={nConcepto && nMonto ? '#fff' : T2} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </Box>
                  </Box>
                  {/* Selector de tarjeta TC (opcional) */}
                  {tarjetas.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.625, px: 1.5, pb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: T2, flexShrink: 0 }}>TC:</Typography>
                      {tarjetas.map(t => (
                        <Box key={t.id} onClick={() => setNTarjeta(prev => prev === t.nombre ? '' : t.nombre)} sx={{
                          px: 1, py: 0.3, borderRadius: '20px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          borderColor: nTarjeta === t.nombre ? '#6366F1' : BORDER,
                          bgcolor: nTarjeta === t.nombre ? 'rgba(99,102,241,0.08)' : '#fff',
                          color: nTarjeta === t.nombre ? '#6366F1' : T2,
                          display: 'flex', alignItems: 'center', gap: 0.5,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                          {t.nombre}
                        </Box>
                      ))}
                      {nTarjeta && (
                        <Typography sx={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>→ Se registra en TC</Typography>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {/* Total de ítems */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.875, px: 0.25 }}>
              <Typography sx={{ fontSize: 12, color: T2 }}>Total presupuestado</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: T1 }}>{formatMoney(totalItems)}</Typography>
            </Box>
          </Box>
        )}

        {/* ── MODO SIN ÍTEMS (meta libre) ── */}
        {!hayItems && (
          <Box sx={{ mb: 1.75 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.625, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Meta mensual</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2, py: 1, borderRadius: '14px', border: '1.5px solid', borderColor: val ? 'rgba(0,167,111,0.45)' : BORDER, bgcolor: '#fff', transition: 'border-color 0.15s' }}>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: T2, flexShrink: 0, lineHeight: 1 }}>$</Typography>
              <Box component="input" ref={inputRef} type="text" inputMode="numeric" placeholder="0" value={val}
                onChange={e => { const n = parseInt(e.target.value.replace(/\D/g,''),10); setVal(isNaN(n)?'':n.toLocaleString('es-CO')); }}
                sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 32, fontWeight: 900, fontFamily: 'inherit', color: GREEN, letterSpacing: '-1px', '&::placeholder': { color: 'rgba(145,158,171,0.22)', fontWeight: 400, fontSize: 28 } }}
              />
              {val && <Box onClick={() => setVal('')} sx={{ color: T2, cursor: 'pointer', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</Box>}
            </Box>

            {/* Opción de desglosar */}
            <Box onClick={() => setAdding(true)} sx={{ mt: 1, display: 'inline-flex', alignItems: 'center', gap: 0.625, cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>Desglosar en conceptos</Typography>
            </Box>

            {/* Mini form para primer ítem */}
            {adding && (
              <Box sx={{ mt: 1.25, p: 1.25, borderRadius: '10px', border: `1px solid rgba(0,167,111,0.25)`, bgcolor: 'rgba(0,167,111,0.04)' }}>
                <Typography sx={{ fontSize: 11, color: T2, mb: 0.875, fontWeight: 600 }}>Primer concepto</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                  <Box component="input" ref={nConcRef} type="text" placeholder="Concepto..." value={nConcepto}
                    onChange={e => setNConcepto(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmarItem()}
                    sx={{ flex: 1, px: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }}
                  />
                </Box>
                {/* Selector TC en modo sin ítems */}
                {tarjetas.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 0.625, mt: 0.875, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11, color: T2, flexShrink: 0 }}>TC:</Typography>
                    {tarjetas.map(t => (
                      <Box key={t.id} onClick={() => setNTarjeta(prev => prev === t.nombre ? '' : t.nombre)} sx={{
                        px: 1, py: 0.3, borderRadius: '20px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                        borderColor: nTarjeta === t.nombre ? '#6366F1' : BORDER,
                        bgcolor: nTarjeta === t.nombre ? 'rgba(99,102,241,0.08)' : '#fff',
                        color: nTarjeta === t.nombre ? '#6366F1' : T2,
                        display: 'flex', alignItems: 'center', gap: 0.5,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        {t.nombre}
                      </Box>
                    ))}
                    {nTarjeta && <Typography sx={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>→ Se registra en TC</Typography>}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 11, color: T2, mt: 0.875 }}>
                    ¿Cargo de TC? Configura tus tarjetas en la sección{' '}
                    <Box component="span" sx={{ color: '#6366F1', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => { onClose(); setTimeout(() => window.location.hash = '/tc', 100); }}>
                      T.C →
                    </Box>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 0.75, mt: 1, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, px: 1, py: 0.625, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff' }}>
                    <Typography sx={{ fontSize: 12, color: T2 }}>$</Typography>
                    <Box component="input" type="text" inputMode="numeric" placeholder="0" value={nMonto}
                      onChange={e => { const n = parseInt(e.target.value.replace(/\D/g,''),10); setNMonto(isNaN(n)?'':n.toLocaleString('es-CO')); }}
                      onKeyDown={e => e.key === 'Enter' && confirmarItem()}
                      sx={{ width: 80, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: T1 }}
                    />
                  </Box>
                  <Box onClick={confirmarItem} sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: nConcepto && nMonto ? GREEN : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={nConcepto && nMonto ? '#fff' : T2} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Botones */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {budget > 0 && !hayItems && (
            <Box component="button" onClick={() => { onSave(cat, 0); onClose(); }} sx={{
              px: 2, py: 1.125, borderRadius: '12px', border: '1px solid #FECACA',
              bgcolor: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            }}>Quitar</Box>
          )}
          <Box component="button" onClick={handleGuardar} sx={{
            flex: 1, py: 1.125, borderRadius: '12px', border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', bgcolor: GREEN, color: '#fff', boxShadow: '0 4px 14px rgba(0,167,111,0.3)', transition: 'all 0.15s',
          }}>
            {hayItems ? 'Listo' : 'Guardar'}
          </Box>
        </Box>
      </Box>
    </>
  );
}

function StatusBadge({ label, color }) {
  return (
    <Typography sx={{ fontSize: 10, fontWeight: 700, color, bgcolor: `${color}18`, px: 0.75, py: 0.2, borderRadius: '6px', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
  )
}

// ── Tabla de progreso ──────────────────────────────────────
function ProgresoTable({ rows, isIngreso = false }) {
  const getColor = isIngreso ? ingBarColor : barColor;
  if (rows.length === 0) return null;
  const totals = { budget: rows.reduce((s,r) => s + r.budget, 0), actual: rows.reduce((s,r) => s + r.actual, 0) };
  const totalPct = totals.budget > 0 ? Math.round((totals.actual / totals.budget) * 100) : 0;
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: '12px', boxShadow: CARD_SH, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', gap: 1, px: 2, py: 0.875, bgcolor: '#F9FAFB', borderBottom: `1px solid ${BORDER}` }}>
        {['Categoría', isIngreso ? 'Recibido' : 'Gastado', '/ Meta', 'Estado'].map((h, i) => (
          <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: i > 0 ? 'right' : 'left' }}>{h}</Typography>
        ))}
      </Box>
      {rows.map((row, i) => {
        const icon     = CAT_ICONS[row.cat] || '·';
        const pctColor = getColor(row.pct);
        const cashPct  = row.budget > 0 ? Math.min((row.cashOnly || 0) / row.budget * 100, 100) : 0;
        const tcPct    = row.budget > 0 ? Math.min(((row.tcPart || 0) / row.budget) * 100, Math.max(0, 100 - cashPct)) : 0;
        return (
          <Box key={row.cat} sx={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px',
            gap: 1, px: 2, py: 1.25, alignItems: 'center',
            borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '8px', flexShrink: 0, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{row.cat}</Typography>
                  {row.tcPart > 0 && (
                    <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2, bgcolor: '#F3F4F6', px: 0.75, py: 0.125, borderRadius: '6px' }}>
                      TC {formatMoneyShort(row.tcPart)}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(145,158,171,0.12)', mt: 0.5, overflow: 'hidden', width: '100%', display: 'flex' }}>
                  <Box sx={{ height: '100%', width: `${cashPct}%`, bgcolor: pctColor, transition: 'width 0.4s' }} />
                  <Box sx={{ height: '100%', width: `${tcPct}%`, bgcolor: 'rgba(145,158,171,0.35)', transition: 'width 0.4s' }} />
                </Box>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: T1 }}>{formatMoneyShort(row.actual)}</Typography>
            <Typography sx={{ fontSize: 12, textAlign: 'right', color: T2 }}>{formatMoneyShort(row.budget)}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
              {isIngreso
                ? (row.pct >= 100 ? <StatusBadge label="Cumplido"  color={GREEN} />
                  : row.pct >= 60  ? <StatusBadge label="Parcial"   color="#D97706" />
                  :                  <StatusBadge label="Pendiente" color="#DC2626" />)
                : (row.pct >= 100 ? <StatusBadge label="Excedido"  color="#DC2626" />
                  : row.pct >= 80  ? <StatusBadge label="Riesgo"    color="#D97706" />
                  :                  <StatusBadge label="Libre"     color={GREEN} />)
              }
            </Box>
          </Box>
        );
      })}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', gap: 1, px: 2, py: 1.25, bgcolor: '#F9FAFB', borderTop: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2 }}>TOTAL</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, textAlign: 'right', color: T1 }}>{formatMoneyShort(totals.actual)}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, textAlign: 'right' }}>{formatMoneyShort(totals.budget)}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <StatusBadge label={`${totalPct}%`} color={getColor(totalPct)} />
        </Box>
      </Box>
    </Box>
  );
}

// ── Main ───────────────────────────────────────────────────
export default function Presupuesto() {
  const { state, savePresupuestoMes, copiarPresupuesto, savePlantilla, applyPlantilla, addPresupuestoItem, deletePresupuestoItem, updatePresupuestoItem, savePresupuestoTarjetas, pagarPresupuestoItem, despagarPresupuestoItem, deleteTransaccion, mesActivo, setMesActivo } = useFinanzas();
  const { showSnackbar } = useSnackbar();
  const mes = mesActivo;
  const setMes = setMesActivo;
  const [modo, setModo] = useState('configurar');
  const [editingCat, setEditingCat] = useState(null);

  const catFijo     = useMemo(() => [...state.categoriasEgresoFijo].sort(),     [state.categoriasEgresoFijo]);
  const catVariable = useMemo(() => [...state.categoriasEgresoVariable].sort(), [state.categoriasEgresoVariable]);
  const catIngreso  = useMemo(() => [...state.categoriasIngreso],               [state.categoriasIngreso]);
  const allCats     = useMemo(() => [...catFijo, ...catVariable, ...catIngreso], [catFijo, catVariable, catIngreso]);

  const presupuestoMes = state.presupuestos[mes] || {};
  const metrics = useMemo(() => computeMetrics(state.transacciones, mes), [state.transacciones, mes]);

  const makeEgresoRows = (cats) => cats
    .map(cat => {
      const budget  = presupuestoMes[cat] || 0;
      const actual  = metrics.byCatAll[cat] || 0;  // includes TC spending
      const cashOnly = metrics.byCat[cat] || 0;
      const tcPart   = actual - cashOnly;
      const pct      = budget > 0 ? Math.round((actual / budget) * 100) : (actual > 0 ? 999 : 0);
      return { cat, budget, actual, cashOnly, tcPart, pct };
    })
    .filter(r => r.budget > 0 || r.actual > 0)
    .sort((a, b) => b.pct - a.pct);

  const rowsFijo     = useMemo(() => makeEgresoRows(catFijo),     [catFijo, presupuestoMes, metrics]);
  const rowsVariable = useMemo(() => makeEgresoRows(catVariable), [catVariable, presupuestoMes, metrics]);
  const rowsIngreso  = useMemo(() =>
    catIngreso
      .map(cat => {
        const budget = presupuestoMes[cat] || 0;
        const actual = metrics.byIngresoCat[cat] || 0;
        const pct    = budget > 0 ? Math.round((actual / budget) * 100) : (actual > 0 ? 999 : 0);
        return { cat, budget, actual, pct };
      })
      .filter(r => r.budget > 0 || r.actual > 0),
    [catIngreso, presupuestoMes, metrics]
  );

  const sumRows = (rows) => ({ budget: rows.reduce((s,r) => s + r.budget, 0), actual: rows.reduce((s,r) => s + r.actual, 0) });
  const totFijo     = sumRows(rowsFijo);
  const totVariable = sumRows(rowsVariable);
  const totIng      = sumRows(rowsIngreso);
  const totEg       = { budget: totFijo.budget + totVariable.budget, actual: totFijo.actual + totVariable.actual };
  const egPct  = totEg.budget  > 0 ? Math.round((totEg.actual  / totEg.budget)  * 100) : 0;
  const ingPct = totIng.budget > 0 ? Math.round((totIng.actual / totIng.budget) * 100) : 0;

  const mesesConPresup = MESES.filter(m => Object.keys(state.presupuestos[m] || {}).some(k => (state.presupuestos[m][k] || 0) > 0));
  const mesIdx      = MESES.indexOf(mes);
  const mesAnterior = mesIdx > 0 ? MESES[mesIdx - 1] : null;
  const tieneAnterior = mesAnterior && mesesConPresup.includes(mesAnterior);

  // ── ConfigForm — lista limpia + bottom sheet ───────────────
  function ConfigForm() {

    const totalFijo     = catFijo.reduce((s, c)     => s + (presupuestoMes[c] || 0), 0);
    const totalVariable = catVariable.reduce((s, c) => s + (presupuestoMes[c] || 0), 0);
    const totalIng      = catIngreso.reduce((s, c)  => s + (presupuestoMes[c] || 0), 0);
    const totalEg       = Math.max(totalFijo + totalVariable, metrics.eg);
    const margen        = totalIng - totalEg;

    function handleSaveCat(cat, newVal) {
      const next = { ...presupuestoMes, [cat]: newVal };
      savePresupuestoMes(mes, next);
    }

    function handleCopiar() {
      copiarPresupuesto(mesAnterior, mes);
      showSnackbar(`Copiado de ${MES_NAMES[MESES.indexOf(mesAnterior)]}`, 'success');
    }

    function handlePlantilla() {
      savePlantilla({ ...presupuestoMes });
      showSnackbar('Guardado como plantilla ⭐', 'success');
    }

    const editingBudget = editingCat ? (presupuestoMes[editingCat] || 0) : 0;
    const editingActual = editingCat
      ? (catIngreso.includes(editingCat) ? (metrics.byIngresoCat[editingCat] || 0) : (metrics.byCatAll[editingCat] || 0))
      : 0;
    const editingItems  = editingCat
      ? (state.presupuestosDetalle[mes] || []).filter(i => i.categoria === editingCat)
      : [];

    // Referencia histórica para ingresos
    const ingStats  = computeIngresoStats(state.transacciones || [], mes);
    const tend      = { crecimiento: '↑', estabilidad: '→', caida: '↓' }[ingStats.tendencia] || '';
    const tendColor = { crecimiento: GREEN, estabilidad: '#D97706', caida: '#DC2626' }[ingStats.tendencia] || T2;

    return (
      <Box>
        {/* KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, mb: 2 }}>
          {[
            { label: 'Egresos',  value: formatMoneyShort(totalEg),    color: '#DC2626' },
            { label: 'Ingresos', value: formatMoneyShort(totalIng),   color: GREEN },
            { label: 'Margen',   value: (margen >= 0 ? '' : '−') + formatMoneyShort(Math.abs(margen)),
              color: margen >= 0 ? GREEN : '#DC2626' },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#fff', border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
              <Typography sx={{ fontSize: 10, color: T2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>{label}</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
            </Box>
          ))}
        </Box>

        {/* Acciones */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
          {tieneAnterior && (
            <Box component="button" onClick={handleCopiar} sx={{ px: 1.75, py: 0.75, borderRadius: '10px', border: `1px solid ${BORDER}`, cursor: 'pointer', bgcolor: '#fff', color: T2, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              📋 Copiar de {MES_NAMES[MESES.indexOf(mesAnterior)]}
            </Box>
          )}
          <Box component="button" onClick={handlePlantilla} sx={{ px: 1.75, py: 0.75, borderRadius: '10px', border: '1px solid rgba(0,167,111,0.3)', cursor: 'pointer', bgcolor: 'rgba(0,167,111,0.06)', color: GREEN, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
            ⭐ Guardar plantilla
          </Box>
        </Box>

        {/* Egresos Fijos */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.875 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#FFAB00', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Egresos fijos</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>{formatMoneyShort(totalFijo)}</Typography>
          </Box>
          <CatListSection cats={catFijo} presupuestoMes={presupuestoMes} actualVals={metrics.byCatAll} onEditCat={setEditingCat} />
        </Box>

        {/* Egresos Variables */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.875 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#FF5630', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Egresos variables</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>{formatMoneyShort(totalVariable)}</Typography>
          </Box>
          <CatListSection cats={catVariable} presupuestoMes={presupuestoMes} actualVals={metrics.byCatAll} onEditCat={setEditingCat} />
        </Box>

        {/* Referencia histórica ingresos */}
        {ingStats.prom3 > 0 && (
          <Box sx={{ mb: 1.25, p: 1.25, borderRadius: '10px', bgcolor: 'rgba(0,167,111,0.05)', border: '1px solid rgba(0,167,111,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[
                { label: 'Prom. 3m', val: ingStats.prom3 },
                { label: 'Prom. 6m', val: ingStats.prom6 },
                { label: 'Optimista',val: ingStats.optimistaEsperado },
              ].filter(x => x.val > 0).map(({ label, val }) => (
                <Box key={label}>
                  <Typography sx={{ fontSize: 9, color: T2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>{formatMoneyShort(val)}</Typography>
                </Box>
              ))}
            </Box>
            {tend && <Typography sx={{ fontSize: 16, fontWeight: 800, color: tendColor }}>{tend}</Typography>}
          </Box>
        )}

        {/* Ingresos */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.875 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ingresos</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>{formatMoneyShort(totalIng)}</Typography>
          </Box>
          <CatListSection cats={catIngreso} presupuestoMes={presupuestoMes} actualVals={metrics.byIngresoCat} isIngreso onEditCat={setEditingCat} />
        </Box>

        {/* Bottom sheet de edición */}
        {editingCat && (
          <EditSheet
            cat={editingCat}
            budget={editingBudget}
            actual={editingActual}
            catItems={editingItems}
            tarjetas={state.tarjetas || []}
            onSave={handleSaveCat}
            onAddItem={item => {
              addPresupuestoItem(mes, item);
            }}
            onDeleteItem={id => deletePresupuestoItem(mes, id)}
            onClose={() => setEditingCat(null)}
          />
        )}
      </Box>
    );
  }

  // ── ProgresoView ───────────────────────────────────────────
  function ProgresoView() {
    const noHayNada = rowsFijo.length === 0 && rowsVariable.length === 0 && rowsIngreso.length === 0;
    const tienePlantilla = Object.values(state.plantilla || {}).some(v => v > 0);

    if (noHayNada) {
      return (
        <Box sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', p: 3 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#111318', mb: 0.5 }}>
            Sin presupuesto para {MES_NAMES[MESES.indexOf(mes)]}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 2.5 }}>
            Elige una opción para empezar rápido:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {tienePlantilla && (
              <Box component="button" onClick={() => { applyPlantilla(mes); showSnackbar('Plantilla aplicada', 'success'); }} sx={{
                width: '100%', py: 1.5, px: 2, borderRadius: '12px', border: 'none',
                bgcolor: '#00A76F', color: '#fff', fontSize: 14, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 1.5,
              }}>
                <span style={{ fontSize: 20 }}>⭐</span>
                <Box>
                  <div>Aplicar mi plantilla</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>Pre-llena con tus montos habituales</div>
                </Box>
              </Box>
            )}
            {tieneAnterior && (
              <Box component="button" onClick={() => { copiarPresupuesto(mesAnterior, mes); showSnackbar(`Copiado de ${MES_NAMES[MESES.indexOf(mesAnterior)]}`, 'success'); }} sx={{
                width: '100%', py: 1.5, px: 2, borderRadius: '12px',
                border: '1px solid #E5E7EB', bgcolor: '#F9FAFB', color: '#111318',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 1.5,
              }}>
                <span style={{ fontSize: 20 }}>📋</span>
                <Box>
                  <div>Copiar de {MES_NAMES[MESES.indexOf(mesAnterior)]}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>Copia los valores del mes anterior</div>
                </Box>
              </Box>
            )}
            <Box component="button" onClick={() => setModo('configurar')} sx={{
              width: '100%', py: 1.25, px: 2, borderRadius: '12px',
              border: '1px solid #E5E7EB', bgcolor: 'transparent', color: '#6B7280',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              Configurar manualmente →
            </Box>
          </Box>
        </Box>
      );
    }

    return (
      <Box>
        {/* KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1, mb: 2.5 }}>
          {[
            { label: 'Ingreso meta', value: formatMoney(totIng.budget), color: T2  },
            { label: 'Ingresado',    value: formatMoney(totIng.actual), color: ingBarColor(ingPct) },
            { label: 'Egreso meta',  value: formatMoney(totEg.budget),  color: T2  },
            { label: 'Gastado',      value: formatMoney(totEg.actual),  color: barColor(egPct) },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{ p: 1.5, bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${BORDER}`, boxShadow: CARD_SH }}>
              <Typography sx={{ fontSize: 10, color: T2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color }}>{value}</Typography>
            </Box>
          ))}
        </Box>

        {rowsFijo.length > 0 && (
          <CollapsibleSection label="Egresos fijos" summary={`${formatMoneyShort(totFijo.actual)} / ${formatMoneyShort(totFijo.budget)}`}>
            <ProgresoTable rows={rowsFijo} isIngreso={false} />
          </CollapsibleSection>
        )}

        {rowsVariable.length > 0 && (
          <CollapsibleSection label="Egresos variables" summary={`${formatMoneyShort(totVariable.actual)} / ${formatMoneyShort(totVariable.budget)}`}>
            <ProgresoTable rows={rowsVariable} isIngreso={false} />
          </CollapsibleSection>
        )}

        {rowsIngreso.length > 0 && (
          <CollapsibleSection label="Ingresos" summary={`${formatMoneyShort(totIng.actual)} / ${formatMoneyShort(totIng.budget)}`}>
            <ProgresoTable rows={rowsIngreso} isIngreso={true} />
          </CollapsibleSection>
        )}

        {metrics.tcEg > 0 && (
          <CollapsibleSection label="Tarjeta de crédito" summary={formatMoneyShort(metrics.tcEg)}>
            <Box sx={{ bgcolor: '#fff', borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>Gastos en tarjeta</Typography>
                  <Typography sx={{ fontSize: 11, color: T2 }}>Pendientes de pago · no descontados del cash</Typography>
                </Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: T1 }}>-{formatMoneyShort(metrics.tcEg)}</Typography>
              </Box>
              {Object.entries(metrics.byCatAll).map(([cat]) => {
                const tcAmt = (metrics.byCatAll[cat] || 0) - (metrics.byCat[cat] || 0);
                if (tcAmt <= 0) return null;
                return (
                  <Box key={cat} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: `1px solid ${BORDER}`, '&:last-of-type': { borderBottom: 'none' } }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '8px', flexShrink: 0, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{CAT_ICONS[cat] || '·'}</Box>
                    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500, color: T1 }}>{cat}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: T2 }}>-{formatMoneyShort(tcAmt)}</Typography>
                  </Box>
                );
              })}
            </Box>
          </CollapsibleSection>
        )}
      </Box>
    );
  }

  // ── PagarView ─────────────────────────────────────────────
  function PagarView() {
    const [pagandoId, setPagandoId] = useState(null);
    const [cuentaSel, setCuentaSel] = useState('');
    const [tarjetaSel, setTarjetaSel] = useState('');
    const [openEgresos, setOpenEgresos] = useState(true);
    const [openIngresos, setOpenIngresos] = useState(true);

    const items   = state.presupuestosDetalle[mes] || [];
    const cuentas = state.cuentas?.length ? state.cuentas : ['Efectivo', 'T.C'];
    const tarjetas = state.tarjetas || [];
    const txsMes  = state.transacciones.filter(t => t.mes === mes);

    // Detectar si un item ya tiene transacción en la BD (por concepto + mes + movimiento)
    function txParaItem(item, esIngreso) {
      if (item.pagadoCon) return { cuenta: item.pagadoCon, tarjeta: item.tarjetaPago, fromPago: true };
      const mov = esIngreso ? 'Ingreso' : 'Egreso';
      const tx = txsMes.find(t =>
        t.movimiento === mov &&
        t.concepto?.toLowerCase() === item.concepto?.toLowerCase()
      );
      if (tx) return { cuenta: tx.cuenta, tarjeta: tx.tarjeta, fromTx: true, txId: tx.id };
      return null;
    }

    // Separar egresos vs ingresos por categoría
    const egresos  = items.filter(i => !catIngreso.includes(i.categoria));
    const ingresos = items.filter(i =>  catIngreso.includes(i.categoria));

    function abrirPago(id) {
      setPagandoId(id);
      setCuentaSel(cuentas[0] || 'Efectivo');
      setTarjetaSel('');
    }

    function confirmarPago() {
      if (!cuentaSel) return;
      pagarPresupuestoItem(mes, pagandoId, cuentaSel, tarjetaSel || null);
      setPagandoId(null);
    }

    if (items.length === 0) return (
      <Box sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: CARD_SH, p: 4, textAlign: 'center', border: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, mb: 0.5 }}>Sin items en el presupuesto</Typography>
        <Typography sx={{ fontSize: 13, color: T2 }}>Agrega conceptos en la pestaña Registro</Typography>
      </Box>
    );

    function ItemRow({ item, esIngreso }) {
      const pago    = txParaItem(item, esIngreso);
      const isPaid  = !!pago;
      const isOpen  = pagandoId === item.id;

      return (
        <Box sx={{ bgcolor: '#fff', borderRadius: '12px', border: `1px solid`, borderColor: isOpen ? GREEN : isPaid ? 'rgba(0,167,111,0.25)' : BORDER, boxShadow: CARD_SH, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
              bgcolor: isPaid ? 'rgba(0,167,111,0.1)' : '#F3F4F6' }}>
              {isPaid
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A76F" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : (CAT_ICONS[item.categoria] || '·')}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: isPaid ? 'line-through' : 'none', color: isPaid ? 'text.secondary' : 'text.primary' }}>
                {item.concepto}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {item.categoria} · {formatMoney(item.monto)}
                {isPaid && ` · ${pago.cuenta}${pago.tarjeta ? ' · ' + pago.tarjeta : ''}`}
                {pago?.fromTx && <span style={{ color: '#00A76F', fontWeight: 700 }}> ✓ en registros</span>}
              </Typography>
            </Box>
            {!isPaid ? (
              <Box onClick={() => isOpen ? setPagandoId(null) : abrirPago(item.id)}
                sx={{ px: 1.75, py: 0.625, borderRadius: 1.5, border: '1.5px solid', cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0,
                  borderColor: isOpen ? 'primary.main' : alpha(accentOk, 0.5),
                  bgcolor:     isOpen ? 'primary.main' : alpha(accentOk, 0.08),
                  color:       isOpen ? '#fff'          : 'primary.main',
                }}>
                {isOpen ? 'Cancelar' : esIngreso ? '✓ Recibido' : '✓ Pagar'}
              </Box>
            ) : (
              <Box
                onClick={() => {
                  if (pago?.fromPago) {
                    despagarPresupuestoItem(mes, item.id);
                    showSnackbar('Pago revertido', 'success');
                  } else if (pago?.fromTx) {
                    deleteTransaccion(pago.txId);
                    showSnackbar('Transacción eliminada', 'success');
                  }
                }}
                sx={{ fontSize: 11, fontWeight: 700, color: 'error.main', cursor: 'pointer', px: 1.25, py: 0.5, borderRadius: 1, border: '1.5px solid', borderColor: alpha('#FF5630', 0.35), bgcolor: alpha('#FF5630', 0.07), '&:active': { opacity: 0.7 }, transition: 'all 0.15s', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Devolver
              </Box>
            )}
          </Box>

          <Collapse in={isOpen}>
            <Box sx={{ px: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider', pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                {esIngreso ? '¿Con qué cuenta lo recibiste?' : '¿Con qué cuenta pagás?'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {cuentas.map(c => (
                  <Box key={c} onClick={() => { setCuentaSel(c); setTarjetaSel(''); }}
                    sx={{ px: 1.5, py: 0.6, borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', transition: 'all 0.15s',
                      borderColor: cuentaSel === c ? 'primary.main' : 'divider',
                      bgcolor:     cuentaSel === c ? 'primary.main' : 'background.default',
                      color:       cuentaSel === c ? '#fff'          : 'text.primary',
                    }}>{c}</Box>
                ))}
              </Box>
              {cuentaSel === 'T.C' && tarjetas.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {tarjetas.map(t => (
                    <Box key={t.id} onClick={() => setTarjetaSel(t.nombre)}
                      sx={{ px: 1.5, py: 0.6, borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', transition: 'all 0.15s',
                        borderColor: tarjetaSel === t.nombre ? 'error.main' : 'divider',
                        bgcolor:     tarjetaSel === t.nombre ? 'error.main' : 'background.default',
                        color:       tarjetaSel === t.nombre ? '#fff'       : 'text.primary',
                      }}>💳 {t.nombre}</Box>
                  ))}
                </Box>
              )}
              <Box component="button" onClick={confirmarPago}
                disabled={!cuentaSel || (cuentaSel === 'T.C' && tarjetas.length > 0 && !tarjetaSel)}
                sx={{ alignSelf: 'flex-end', px: 3, py: 0.875, borderRadius: 1.5, border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
                  bgcolor: cuentaSel ? 'primary.main' : alpha('#919EAB', 0.16),
                  color:   cuentaSel ? '#fff' : 'text.disabled',
                }}>
                Confirmar
              </Box>
            </Box>
          </Collapse>
        </Box>
      );
    }

    function Seccion({ titulo, items: list, esIngreso }) {
      const [open, setOpen] = useState(true);
      if (list.length === 0) return null;
      const pagadosCount = list.filter(i => !!txParaItem(i, esIngreso)).length;
      const totalMonto   = list.reduce((s, i) => s + i.monto, 0);
      const pagadoMonto  = list.filter(i => !!txParaItem(i, esIngreso)).reduce((s, i) => s + i.monto, 0);
      return (
        <Box sx={{ mb: 1 }}>
          <Box onClick={() => setOpen(v => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 0.5, cursor: 'pointer', userSelect: 'none', borderRadius: 1, '&:hover': { bgcolor: 'rgba(145,158,171,0.05)' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T2, flex: 1 }}>
              {titulo}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>{pagadosCount}/{list.length}</Typography>
            <Typography sx={{ fontSize: 12, color: T2, mx: 0.5 }}>{formatMoneyShort(pagadoMonto)} / {formatMoneyShort(totalMonto)}</Typography>
            <Box sx={{ color: T2, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </Box>
          </Box>
          <Collapse in={open}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.75 }}>
              {list.map(item => <ItemRow key={item.id} item={item} esIngreso={esIngreso} />)}
            </Box>
          </Collapse>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Seccion titulo="Egresos" items={egresos} esIngreso={false} />
        <Seccion titulo="Ingresos" items={ingresos} esIngreso={true} />
      </Box>
    );
  }

  // ── RegistroView ──────────────────────────────────────────
  function RegistroView() {
    const [concepto,     setConcepto]     = useState('');
    const [categoria,    setCategoria]    = useState('');
    const [catQuery,     setCatQuery]     = useState('');
    const [catOpen,      setCatOpen]      = useState(false);
    const [monto,        setMonto]        = useState('');
    const [tarjeta,      setTarjeta]      = useState('');
    const [autoSugerida, setAutoSugerida] = useState(false);
    const catRef      = useRef(null);
    const catInputRef = useRef(null);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
      if (catOpen && catInputRef.current) {
        const r = catInputRef.current.getBoundingClientRect();
        setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
      }
    }, [catOpen]);

    const allCatOptions = useMemo(() => [
      ...catFijo.map(c     => ({ c, tipo: 'Fijo'     })),
      ...catVariable.map(c => ({ c, tipo: 'Variable' })),
      ...catIngreso.map(c  => ({ c, tipo: 'Ingreso'  })),
    ], [catFijo, catVariable, catIngreso]);

    const catFiltradas = useMemo(() =>
      catQuery.trim()
        ? allCatOptions.filter(o => o.c.toLowerCase().includes(catQuery.toLowerCase()))
        : allCatOptions,
      [catQuery, allCatOptions]
    );

    const allAvailableCats = useMemo(() => new Set([...catFijo, ...catVariable, ...catIngreso]), [catFijo, catVariable, catIngreso]);

    function inferirDesdeCodigo(texto) {
      if (!texto) return '';
      const norm = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // 1. CATEGORIAS_VOZ lookup (word by word)
      for (const [key, val] of Object.entries(CATEGORIAS_VOZ).sort((a, b) => b[0].length - a[0].length)) {
        if (norm.includes(key.toLowerCase())) {
          if (allAvailableCats.has(val)) return val;
        }
      }
      // 2. inferirCategoria (comercio/keyword map)
      const inf = inferirCategoria(texto);
      if (inf && allAvailableCats.has(inf)) return inf;
      return '';
    }

    function handleConceptoChange(val) {
      setConcepto(val);
      // Solo autocompletar si el usuario no eligió manualmente
      if (!autoSugerida || !categoria) {
        const sugerida = inferirDesdeCodigo(val);
        if (sugerida) {
          setCategoria(sugerida);
          setCatQuery(sugerida);
          setAutoSugerida(true);
          setCatOpen(false);
        } else if (autoSugerida) {
          setCategoria('');
          setCatQuery('');
          setAutoSugerida(false);
        }
      }
    }

    function handleCategoriaChange(val) {
      setCategoria(val);
      setCatQuery(val);
      setAutoSugerida(false);
      setCatOpen(false);
    }

    function handleCatInputChange(val) {
      setCatQuery(val);
      setCategoria('');
      setAutoSugerida(false);
      setCatOpen(true);
    }

    function handleCatSelect(c) {
      setCategoria(c);
      setCatQuery(c);
      setAutoSugerida(false);
      setCatOpen(false);
    }

    const items = state.presupuestosDetalle[mes] || [];

    function handleAdd() {
      const montoNum = parseInt(monto.replace(/\D/g, ''), 10);
      if (!concepto.trim() || !categoria || !montoNum) return;
      addPresupuestoItem(mes, { concepto: concepto.trim(), categoria, monto: montoNum, tarjeta: tarjeta || null });
      setConcepto(''); setCategoria(''); setCatQuery(''); setMonto(''); setTarjeta(''); setAutoSugerida(false); setCatOpen(false);
    }

    // Agrupar por categoría
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.categoria]) grouped[item.categoria] = [];
      grouped[item.categoria].push(item);
    });
    const totalItems = items.reduce((s, i) => s + i.monto, 0);

    const catColor = (cat) => {
      if (catFijo.includes(cat))     return '#FFAB00';
      if (catVariable.includes(cat)) return '#FF5630';
      return '#00A76F';
    };

    return (
      <Box>
        {/* Nota explicativa */}
        <Box sx={{ mb: 2, px: 1.25, py: 1, borderRadius: '10px', bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <Typography sx={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
            <b>Detalle</b> — agrega conceptos específicos dentro de cada categoría. Ejemplo: "Arriendo" y "Luz" dentro de Hogar. También puedes hacerlo tocando la categoría en <b>Configurar</b>.
          </Typography>
        </Box>

        {/* Formulario agregar */}
        <Card sx={{ p: 2, mb: 2.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'text.secondary', mb: 1.5 }}>
            Agregar concepto
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Concepto */}
            <Box sx={{ flex: '1 1 160px', minWidth: 140 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Concepto</Typography>
              <Box
                component="input"
                type="text"
                placeholder="Ej: Internet, Arriendo..."
                value={concepto}
                onChange={e => handleConceptoChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                sx={{
                  width: '100%', boxSizing: 'border-box',
                  px: 1.5, py: 1, borderRadius: 1, border: '1px solid',
                  borderColor: 'divider', bgcolor: alpha('#919EAB', 0.04),
                  fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none',
                  '&:focus': { borderColor: 'primary.main' },
                }}
              />
            </Box>

            {/* Categoría combobox */}
            <Box ref={catRef} sx={{ flex: '1 1 150px', minWidth: 130, position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>Categoría</Typography>
                {autoSugerida && categoria && (
                  <Typography sx={{ fontSize: 10, color: 'primary.main', fontWeight: 600 }}>✦ auto</Typography>
                )}
              </Box>
              <Box
                ref={catInputRef}
                component="input"
                type="text"
                placeholder="Buscar o escribir..."
                value={catQuery}
                onChange={e => handleCatInputChange(e.target.value)}
                onFocus={() => setCatOpen(true)}
                onBlur={() => setTimeout(() => setCatOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setCatOpen(false);
                  if (e.key === 'Enter' && catFiltradas.length > 0) { handleCatSelect(catFiltradas[0].c); e.preventDefault(); }
                }}
                sx={{
                  width: '100%', boxSizing: 'border-box',
                  px: 1.5, py: 1, borderRadius: 1, border: '1px solid',
                  borderColor: categoria ? 'primary.main' : catOpen ? 'primary.main' : 'divider',
                  bgcolor: categoria ? alpha('#00A76F', 0.06) : alpha('#919EAB', 0.04),
                  fontSize: 13, fontFamily: 'inherit', color: 'text.primary', outline: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              />
              {/* Dropdown via portal para evitar clipping */}
              {catOpen && catFiltradas.length > 0 && createPortal(
                <Box sx={{
                  position: 'fixed', zIndex: 9999,
                  top: dropPos.top, left: dropPos.left, width: dropPos.width,
                  borderRadius: 1.5, border: '1px solid', borderColor: 'divider',
                  bgcolor: 'background.paper', boxShadow: '0 8px 32px rgba(145,158,171,0.24)',
                  maxHeight: 220, overflowY: 'auto',
                }}>
                  {catFiltradas.map(({ c, tipo }) => (
                    <Box key={c} onMouseDown={() => handleCatSelect(c)} sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 1.5, py: 0.875, cursor: 'pointer',
                      '&:hover': { bgcolor: '#F9FAFB' },
                      borderBottom: `1px solid ${BORDER}`,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 13 }}>{CAT_ICONS[c] || '·'}</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: T1 }}>{c}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2, bgcolor: '#F3F4F6', px: 0.75, py: 0.25, borderRadius: '4px' }}>{tipo}</Typography>
                    </Box>
                  ))}
                </Box>,
                document.body
              )}
            </Box>

            {/* Monto */}
            <Box sx={{ flex: '1 1 120px', minWidth: 110 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Monto</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: alpha('#919EAB', 0.04) }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }}>$</Typography>
                <Box
                  component="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={monto}
                  onChange={e => {
                    const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    setMonto(isNaN(n) ? '' : n.toLocaleString('es-CO'));
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  sx={{
                    flex: 1, minWidth: 0, bgcolor: 'transparent', border: 'none', outline: 'none',
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'text.primary',
                    '&::placeholder': { color: alpha('#919EAB', 0.5) },
                  }}
                />
              </Box>
            </Box>

            {/* Tarjeta (solo si hay tarjetas configuradas) */}
            {state.tarjetas?.length > 0 && (
              <Box sx={{ flex: '1 1 130px', minWidth: 120 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Tarjeta (opcional)</Typography>
                <Box
                  component="select"
                  value={tarjeta}
                  onChange={e => setTarjeta(e.target.value)}
                  sx={{
                    width: '100%', boxSizing: 'border-box',
                    px: 1.5, py: 1, borderRadius: 1, border: '1px solid',
                    borderColor: tarjeta ? alpha('#FFAB00', 0.5) : 'divider',
                    bgcolor: tarjeta ? alpha('#FFAB00', 0.06) : alpha('#919EAB', 0.04),
                    fontSize: 13, fontFamily: 'inherit',
                    color: tarjeta ? '#FFAB00' : 'text.secondary',
                    outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">💳 Sin tarjeta</option>
                  {state.tarjetas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </Box>
              </Box>
            )}

            {/* Botón agregar */}
            <Box
              component="button"
              onClick={handleAdd}
              disabled={!concepto.trim() || !categoria || !monto}
              sx={{
                px: 2.5, py: 1.1, borderRadius: 1, border: 'none', flexShrink: 0,
                cursor: (concepto.trim() && categoria && monto) ? 'pointer' : 'not-allowed',
                background: (concepto.trim() && categoria && monto) ? 'linear-gradient(135deg, #5BE49B 0%, #00A76F 100%)' : alpha('#919EAB', 0.16),
                color: (concepto.trim() && categoria && monto) ? '#fff' : 'text.secondary',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                alignSelf: 'flex-end',
              }}
            >
              + Agregar
            </Box>
          </Box>
        </Card>

        {/* Lista */}
        {items.length === 0 ? (
          <Box sx={{ bgcolor: '#fff', borderRadius: '16px', boxShadow: CARD_SH, p: 4, textAlign: 'center', border: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, mb: 0.5 }}>Sin conceptos para {MES_NAMES[MESES.indexOf(mes)]}</Typography>
            <Typography sx={{ fontSize: 13, color: T2 }}>Agrega el primero con el formulario de arriba</Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: T2 }}>
                {items.length} concepto{items.length !== 1 ? 's' : ''} · <strong style={{ color: T1 }}>{formatMoney(totalItems)}</strong>
              </Typography>
            </Box>

            {Object.entries(grouped).map(([cat, catItems]) => {
              const catTotal = catItems.reduce((s, i) => s + i.monto, 0);
              const icon     = CAT_ICONS[cat] || '·';
              const tipo     = catFijo.includes(cat) ? 'Fijo' : catVariable.includes(cat) ? 'Variable' : 'Ingreso';
              return (
                <Box key={cat} sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                  <Box sx={{ px: 2, py: 1.125, bgcolor: '#F9FAFB', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ fontSize: 15 }}>{icon}</Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, flex: 1 }}>{cat}</Typography>
                    <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2, bgcolor: '#EBEBEB', px: 0.75, py: 0.2, borderRadius: '4px' }}>{tipo}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: T1 }}>{formatMoney(catTotal)}</Typography>
                  </Box>

                  {catItems.map((item, i) => (
                    <Box key={item.id} sx={{
                      display: 'flex', alignItems: 'center', px: 2, py: 1,
                      borderBottom: i < catItems.length - 1 ? `1px solid ${BORDER}` : 'none',
                      '&:hover': { bgcolor: '#F9FAFB' },
                      '&:hover .del-btn': { opacity: 1 },
                    }}>
                      <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500, color: T1 }}>{item.concepto}</Typography>
                      {state.tarjetas?.length > 0 && (
                        <Box component="select" value={item.tarjeta || ''}
                          onChange={e => updatePresupuestoItem(mes, item.id, { tarjeta: e.target.value || null })}
                          sx={{ mr: 1, flexShrink: 0, bgcolor: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', px: 0.75, py: 0.25, fontSize: 10, fontFamily: 'inherit', color: T2, cursor: 'pointer', outline: 'none' }}>
                          <option value="">— TC</option>
                          {state.tarjetas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                        </Box>
                      )}
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1, mr: 1.5 }}>{formatMoney(item.monto)}</Typography>
                      <Box className="del-btn" component="button" onClick={() => deletePresupuestoItem(mes, item.id)}
                        sx={{ opacity: 0, transition: 'opacity 0.15s', border: 'none', bgcolor: 'transparent', cursor: 'pointer', color: '#DC2626', p: 0.25, borderRadius: 0.5, display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </Box>
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Presupuesto</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>{MES_NAMES[MESES.indexOf(mes)]} 2026</Typography>
        </Box>
        <Box sx={{ display: 'flex', bgcolor: '#EBEBEB', borderRadius: '10px', p: '3px', gap: '3px' }}>
          {[['pagar', 'Pagar'], ['configurar', 'Configurar'], ['registro', 'Detalle']].map(([key, label]) => (
            <Box key={key} onClick={() => setModo(key)} sx={{
              px: 1.75, py: 0.625, borderRadius: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              bgcolor: modo === key ? '#fff' : 'transparent',
              color:   modo === key ? T1 : T2,
              boxShadow: modo === key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>
              {label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Pestañas de meses */}
      <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 3, pb: 0.5 }}>
        {MESES.map((m, i) => {
          const tienePresup = mesesConPresup.includes(m);
          const activo      = m === mes;
          return (
            <Box key={m} onClick={() => setMes(m)} sx={{
              px: 1.75, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
              borderColor: activo ? T1 : BORDER,
              bgcolor:     activo ? T1 : '#fff',
              color:       activo ? '#fff' : tienePresup ? T1 : T2,
              position: 'relative',
            }}>
              {MES_NAMES[i]}
              {tienePresup && !activo && (
                <Box sx={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', bgcolor: GREEN }} />
              )}
            </Box>
          );
        })}
      </Box>

      {modo === 'pagar'      && <PagarView    key={mes} />}
      {modo === 'registro'   && <RegistroView key={mes} />}
      {modo === 'configurar' && <ConfigForm   key={mes} />}
    </Box>
    </Box>
  );
}
