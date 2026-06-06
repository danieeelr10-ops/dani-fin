import { useState, useRef, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { getMesActual, formatMoney } from 'src/utils/format';

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const data = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
        resolve(data);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function parsePrecio(val) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const cleaned = String(val).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function formatCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Mercado() {
  const { state, registrarMercado, deleteMercado } = useFinanzas();
  const [step, setStep] = useState('capture');
  const [items, setItems] = useState([]);
  const [checked, setChecked] = useState([]);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [cuenta, setCuenta] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const fileRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setPreview(URL.createObjectURL(file));
    setStep('loading');
    try {
      const image = await compressImage(file);
      const res = await fetch('/api/mercado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('capture'); return; }
      if (!data.items?.length) { setError('No se encontraron productos en la factura.'); setStep('capture'); return; }
      const mapped = data.items.map((it, i) => ({ ...it, id: i, precio: parsePrecio(it.precio), cantidad: it.cantidad || 1 }));
      setItems(mapped);
      setChecked(mapped.map(it => it.id));
      setStep('review');
    } catch {
      setError('Error al procesar la imagen. Intenta de nuevo.');
      setStep('capture');
    }
  }

  function toggleItem(id) {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function updateItem(id, field, value) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  }

  function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
    setChecked(prev => prev.filter(x => x !== id));
  }

  function confirmar() {
    const selected = items.filter(it => checked.includes(it.id));
    if (!selected.length) return;
    const mes = getMesActual();
    const now = new Date().toISOString();
    const batchId = Date.now();

    const mercadoItems = selected.map((it, i) => ({
      id: batchId + i, nombre: it.nombre, precio: parsePrecio(it.precio),
      cantidad: parseInt(it.cantidad, 10) || 1, fecha: now, mes,
    }));

    // Si la cuenta elegida es una tarjeta de crédito, guardar como T.C + tarjeta
    const esTarjeta = (state.tarjetas || []).some(t => t.nombre === cuenta)
    const cuentaFinal  = esTarjeta ? 'T.C' : cuenta
    const tarjetaFinal = esTarjeta ? cuenta : (cuenta === 'T.C' && tarjeta ? tarjeta : undefined)

    const transacciones = selected.map((it, i) => ({
      id: batchId + selected.length + i, concepto: it.nombre,
      total: -(parsePrecio(it.precio) * (parseInt(it.cantidad, 10) || 1)),
      pago:  -(parsePrecio(it.precio) * (parseInt(it.cantidad, 10) || 1)),
      saldo: 0, categoria: 'Mercado', movimiento: 'Egreso', tipo: 'Variable',
      cuenta: cuentaFinal,
      ...(tarjetaFinal ? { tarjeta: tarjetaFinal } : {}),
      fecha: now, mes, cantidad: parseInt(it.cantidad, 10) || 1,
    }));

    registrarMercado(mercadoItems, transacciones);
    setStep('done');
  }

  function reset() {
    setStep('capture'); setItems([]); setChecked([]); setError(''); setPreview(null);
    setCuenta(''); setTarjeta('');
  }

  const total = items.filter(it => checked.includes(it.id)).reduce((s, it) => s + parsePrecio(it.precio), 0);

  // Agrupar historial por fecha
  const historial = useMemo(() => {
    const sorted = [...(state.mercado || [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const groups = [];
    let lastFecha = null;
    sorted.forEach(item => {
      const fecha = item.fecha ? item.fecha.split('T')[0] : 'Sin fecha';
      if (fecha !== lastFecha) { groups.push({ fecha, items: [] }); lastFecha = fecha; }
      groups[groups.length - 1].items.push(item);
    });
    return groups;
  }, [state.mercado]);

  // Agrupar historial de gastos por batch (para mostrar como "compras")
  const compras = useMemo(() => {
    const txMercado = (state.transacciones || []).filter(t => t.categoria === 'Mercado' && t.movimiento === 'Egreso');
    const byBatch = {};
    txMercado.forEach(t => {
      const batchKey = t.fecha ? t.fecha.split('T')[0] + '_' + (t.cuenta || '') : String(t.id);
      if (!byBatch[batchKey]) byBatch[batchKey] = { fecha: t.fecha, cuenta: t.cuenta, tarjeta: t.tarjeta, items: [] };
      byBatch[batchKey].items.push(t);
    });
    return Object.values(byBatch).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
  }, [state.transacciones]);

  const inputSx = {
    bgcolor: '#F9FAFB', border: `1px solid ${BORDER}`, borderRadius: '6px',
    px: 1, py: 0.5, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none',
    '&:focus': { borderColor: GREEN },
  }

  const cuentasPosibles = state.cuentas?.length ? state.cuentas : ['Efectivo', 'T.C'];

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Mercado</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Escanea tu factura y agrega los gastos</Typography>
        </Box>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />

        {/* ── STEP: CAPTURE ── */}
        {step === 'capture' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box onClick={() => fileRef.current?.click()} sx={{
              bgcolor: CARD, borderRadius: '16px', border: `2px dashed ${BORDER}`, p: 4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              cursor: 'pointer', transition: 'all 0.2s', boxShadow: CARD_SH,
              '&:active': { opacity: 0.8 },
            }}>
              <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="1.6">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: T1, mb: 0.5 }}>Tomar foto o subir imagen</Typography>
                <Typography sx={{ fontSize: 13, color: T2 }}>Foto de tu factura o tiquete de mercado</Typography>
              </Box>
            </Box>

            {error && (
              <Box sx={{ p: 2, bgcolor: alpha(RED, 0.06), border: `1px solid ${alpha(RED, 0.2)}`, borderRadius: '12px' }}>
                <Typography sx={{ fontSize: 13, color: RED }}>{error}</Typography>
              </Box>
            )}

            {/* Compras recientes */}
            {compras.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
                  Compras recientes
                </Typography>
                {compras.map((compra, gi) => {
                  const total = compra.items.reduce((s, t) => s + Math.abs(t.total), 0);
                  return (
                    <Box key={gi} sx={{ mb: 1.5, bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                      <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>
                            {formatFecha(compra.fecha)}
                          </Typography>
                          {compra.cuenta && (
                            <Typography sx={{ fontSize: 11, color: T2 }}>
                              {compra.tarjeta || compra.cuenta}
                            </Typography>
                          )}
                        </Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{formatCOP(total)}</Typography>
                      </Box>
                      {compra.items.slice(0, 3).map((item, i) => (
                        <Box key={item.id} sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          px: 2, py: 0.875,
                          borderBottom: i < Math.min(compra.items.length, 3) - 1 ? `1px solid ${BORDER}` : 'none',
                        }}>
                          <Typography sx={{ fontSize: 13, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {item.concepto}
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1, flexShrink: 0, ml: 1 }}>
                            {formatCOP(Math.abs(item.total))}
                          </Typography>
                        </Box>
                      ))}
                      {compra.items.length > 3 && (
                        <Box sx={{ px: 2, py: 0.75, bgcolor: '#F9FAFB' }}>
                          <Typography sx={{ fontSize: 11, color: T2 }}>+{compra.items.length - 3} más</Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ── STEP: LOADING ── */}
        {step === 'loading' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, pt: 6 }}>
            {preview && (
              <Box component="img" src={preview} sx={{ width: 180, height: 180, objectFit: 'cover', borderRadius: '12px', boxShadow: CARD_SH }} />
            )}
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${BORDER}`, borderTopColor: GREEN, animation: 'spin 0.8s linear infinite',
              '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: T1, mb: 0.5 }}>Analizando factura...</Typography>
              <Typography sx={{ fontSize: 13, color: T2 }}>Claude está extrayendo los productos</Typography>
            </Box>
          </Box>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === 'review' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Selector cuenta */}
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 1.75 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>Pagar con</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {cuentasPosibles.map(c => (
                  <Box key={c} onClick={() => { setCuenta(c); setTarjeta(''); }} sx={{
                    px: 1.5, py: 0.625, borderRadius: '20px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                    borderColor: cuenta === c ? T1 : BORDER,
                    bgcolor: cuenta === c ? T1 : CARD,
                    color: cuenta === c ? '#fff' : T2,
                  }}>
                    {c}
                  </Box>
                ))}
              </Box>
              {cuenta === 'T.C' && state.tarjetas?.length > 0 && (
                <Box sx={{ mt: 1.25 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.75 }}>Tarjeta</Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {state.tarjetas.map(t => (
                      <Box key={t.id} onClick={() => setTarjeta(t.nombre)} sx={{
                        px: 1.5, py: 0.625, borderRadius: '20px', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                        borderColor: tarjeta === t.nombre ? T1 : BORDER,
                        bgcolor: tarjeta === t.nombre ? T1 : CARD,
                        color: tarjeta === t.nombre ? '#fff' : T2,
                      }}>
                        {t.nombre}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            {/* Header lista */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{items.length} productos encontrados</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2, bgcolor: '#F3F4F6', px: 1, py: 0.25, borderRadius: '6px' }}>
                  {checked.length} sel.
                </Typography>
                <Box onClick={() => setChecked(checked.length === items.length ? [] : items.map(it => it.id))}
                  sx={{ fontSize: 12, color: GREEN, cursor: 'pointer', fontWeight: 600 }}>
                  {checked.length === items.length ? 'Quitar todos' : 'Todos'}
                </Box>
              </Box>
            </Box>

            {/* Items */}
            {items.map(it => {
              const sel = checked.includes(it.id);
              return (
                <Box key={it.id} sx={{
                  p: 1.5, borderRadius: '12px', border: '1px solid',
                  borderColor: sel ? alpha(GREEN, 0.3) : BORDER,
                  bgcolor: sel ? alpha(GREEN, 0.03) : CARD,
                  display: 'flex', alignItems: 'center', gap: 1.25, transition: 'all 0.15s',
                  boxShadow: CARD_SH,
                }}>
                  {/* Checkbox custom */}
                  <Box onClick={() => toggleItem(it.id)} sx={{
                    width: 22, height: 22, borderRadius: '6px', flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${sel ? GREEN : BORDER}`,
                    bgcolor: sel ? GREEN : CARD,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                  }}>
                    {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box component="input" value={it.nombre} onChange={e => updateItem(it.id, 'nombre', e.target.value)}
                      sx={{ ...inputSx, width: '100%', fontWeight: 600, border: 'none', bgcolor: 'transparent', px: 0, py: 0, fontSize: 14, boxSizing: 'border-box' }} />
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.25, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: T2 }}>Cant:</Typography>
                      <Box component="input" value={it.cantidad} onChange={e => updateItem(it.id, 'cantidad', e.target.value)}
                        type="number" sx={{ ...inputSx, width: 44, textAlign: 'center', py: 0.2, px: 0.5, fontSize: 12 }} />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Box component="input" value={it.precio} onChange={e => updateItem(it.id, 'precio', e.target.value)}
                      type="number" sx={{ ...inputSx, width: 100, textAlign: 'right', fontWeight: 700 }} />
                    <Box onClick={() => removeItem(it.id)} sx={{ cursor: 'pointer', color: T2, p: 0.25, '&:hover': { color: RED } }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    </Box>
                  </Box>
                </Box>
              );
            })}

            {/* Total + Confirmar */}
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2, mt: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: 14, color: T2 }}>Total a registrar</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: T1 }}>{formatCOP(total)}</Typography>
              </Box>
              {!cuenta && (
                <Typography sx={{ fontSize: 12, color: RED, mb: 1, textAlign: 'center' }}>
                  Selecciona una cuenta para continuar
                </Typography>
              )}
              <Box component="button"
                disabled={!checked.length || !cuenta || (cuenta === 'T.C' && state.tarjetas?.length > 0 && !tarjeta)}
                onClick={confirmar}
                sx={{
                  width: '100%', py: 1.25, borderRadius: '10px', border: 'none', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: 700, cursor: !checked.length || !cuenta ? 'not-allowed' : 'pointer',
                  bgcolor: !checked.length || !cuenta ? alpha('#919EAB', 0.16) : GREEN,
                  color: !checked.length || !cuenta ? T2 : '#fff',
                  transition: 'all 0.15s',
                }}>
                Confirmar y agregar a gastos
              </Box>
              <Box onClick={reset} sx={{ mt: 1, py: 0.75, textAlign: 'center', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
                <Typography sx={{ fontSize: 13, color: T2 }}>Tomar otra foto</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, pt: 6 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: alpha(GREEN, 0.1), border: `2px solid ${alpha(GREEN, 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: T1, mb: 0.5 }}>Listo</Typography>
              <Typography sx={{ fontSize: 14, color: T2 }}>Productos agregados como egreso de Mercado</Typography>
            </Box>
            <Box component="button" onClick={reset} sx={{
              px: 4, py: 1, borderRadius: '10px', border: 'none', bgcolor: T1,
              color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              Escanear otra factura
            </Box>
          </Box>
        )}

      </Box>
    </Box>
  );
}
