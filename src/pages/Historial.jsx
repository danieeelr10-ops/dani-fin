import { useState, useMemo } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { computeMetrics } from 'src/utils/metrics';
import { formatMoney } from 'src/utils/format';
import { CAT_ICONS, MESES, MES_NAMES } from 'src/constants';

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

function formatDia(dateKey) {
  if (!dateKey) return '';
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Historial() {
  const { state, deleteTransaccion, deleteMercadoDia, updateMercadoCuenta, updateTransaccion, mesActivo, setMesActivo } = useFinanzas();
  const { showToast } = useSnackbar();
  const mes = mesActivo;
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  function exportCSV() {
    const cols = ['Fecha','Concepto','Categoría','Movimiento','Cuenta','Total','Estado'];
    const rows = txsFiltradas.map(t => [
      t.fecha?.split('T')[0] || '',
      `"${(t.concepto || t.categoria || '').replace(/"/g, '""')}"`,
      t.categoria || '',
      t.movimiento || '',
      t.cuenta || '',
      Math.abs(t.total || 0),
      t.estado || 'realizado',
    ]);
    const csv = [cols.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `finanzas-${mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Filtros
  const [filtroTipo,    setFiltroTipo]    = useState('Todos');   // 'Todos' | 'Ingreso' | 'Egreso'
  const [filtroBuscar,  setFiltroBuscar]  = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const m = computeMetrics(state.transacciones, mes);
  const txsMes = state.transacciones.filter(t => t.mes === mes);

  const txsFiltradas = useMemo(() => {
    let base = txsMes;
    if (filtroTipo !== 'Todos') base = base.filter(t => t.movimiento === filtroTipo);
    if (filtroBuscar.trim()) {
      const q = filtroBuscar.toLowerCase();
      base = base.filter(t => (t.concepto || '').toLowerCase().includes(q) || (t.categoria || '').toLowerCase().includes(q));
    }
    return base;
  }, [txsMes, filtroTipo, filtroBuscar]);

  const grupos = useMemo(() => {
    const sorted = [...txsFiltradas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const byDay = {};
    sorted.forEach(t => {
      const day = t.fecha?.split('T')[0] || 'unknown';
      if (!byDay[day]) byDay[day] = { mercado: [], otros: [] };
      if (t.categoria === 'Mercado') byDay[day].mercado.push(t);
      else byDay[day].otros.push(t);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, { mercado, otros }]) => ({ day, mercado, otros }));
  }, [txsFiltradas]);

  function handleDelete(id) {
    deleteTransaccion(id);
    showToast('Transacción eliminada', 'success');
  }

  function handleDeleteMercadoDia(day) {
    deleteMercadoDia(day);
    showToast('Registros de mercado eliminados', 'success');
  }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 4 }}>
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1, position: 'sticky', top: 0, bgcolor: BG, zIndex: 10 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Historial</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {/* Export CSV */}
            <Box onClick={exportCSV} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5,
              borderRadius: '20px', cursor: 'pointer', border: `1px solid ${BORDER}`, bgcolor: CARD,
              '&:active': { opacity: 0.7 },
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T2} strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: T2 }}>CSV</Typography>
            </Box>
            <Box onClick={() => setMostrarFiltros(v => !v)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5,
              borderRadius: '20px', cursor: 'pointer', border: '1px solid',
              borderColor: (filtroTipo !== 'Todos' || filtroBuscar) ? GREEN : BORDER,
              bgcolor: (filtroTipo !== 'Todos' || filtroBuscar) ? 'rgba(0,167,111,0.07)' : CARD,
              '&:active': { opacity: 0.7 },
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={(filtroTipo !== 'Todos' || filtroBuscar) ? GREEN : T2} strokeWidth="2.5">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: (filtroTipo !== 'Todos' || filtroBuscar) ? GREEN : T2 }}>
                Filtros{(filtroTipo !== 'Todos' || filtroBuscar) ? ' ·' : ''}
              </Typography>
            </Box>
            {/* Mes selector compacto */}
            <Box component="select" value={mes} onChange={e => setMesActivo(e.target.value)}
              sx={{ px: 1.25, py: 0.5, borderRadius: '20px', border: `1px solid ${BORDER}`, bgcolor: CARD, fontSize: 12, fontWeight: 600, color: T2, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
              {MESES.map((m2, i) => <option key={m2} value={m2}>{MES_NAMES[i]}</option>)}
            </Box>
          </Box>
        </Box>

        {/* Panel de filtros */}
        <Collapse in={mostrarFiltros}>
          <Box sx={{ pb: 1, display: 'flex', flexDirection: 'column', gap: 0.875 }}>
            {/* Búsqueda */}
            <Box component="input" type="text" placeholder="Buscar concepto o categoría..."
              value={filtroBuscar} onChange={e => setFiltroBuscar(e.target.value)}
              sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: CARD, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }}
            />
            {/* Tipo */}
            <Box sx={{ display: 'flex', gap: 0.625 }}>
              {['Todos', 'Ingreso', 'Egreso'].map(t => (
                <Box key={t} onClick={() => setFiltroTipo(t)} sx={{
                  px: 1.375, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
                  borderColor: filtroTipo === t ? T1 : BORDER,
                  bgcolor: filtroTipo === t ? T1 : CARD,
                  color: filtroTipo === t ? '#fff' : T2,
                }}>{t}</Box>
              ))}
              {(filtroTipo !== 'Todos' || filtroBuscar) && (
                <Box onClick={() => { setFiltroTipo('Todos'); setFiltroBuscar(''); }} sx={{
                  px: 1.375, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid', borderColor: 'rgba(220,38,38,0.3)', color: RED, bgcolor: 'rgba(220,38,38,0.06)',
                }}>Limpiar</Box>
              )}
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, px: 2, mb: 2 }}>
        <Box sx={{ p: 1.75, bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ingresos</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 0.5, color: GREEN }}>{formatMoney(m.ing)}</Typography>
        </Box>
        <Box sx={{ p: 1.75, bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Egresos</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 0.5, color: RED }}>{formatMoney(m.eg)}</Typography>
        </Box>
      </Box>

      {/* Lista agrupada por día */}
      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {grupos.length === 0 ? (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: T2, mb: 0.5 }}>Sin registros este mes</Typography>
            <Typography sx={{ fontSize: 12, color: T2 }}>Los movimientos que registres aparecerán aquí</Typography>
          </Box>
        ) : grupos.map(({ day, mercado, otros }) => (
          <Box key={day}>
            {/* Encabezado del día */}
            <Typography sx={{
              fontSize: 11, fontWeight: 700, color: T2,
              textTransform: 'capitalize', letterSpacing: '0.04em',
              mb: 0.75, px: 0.5,
            }}>
              {formatDia(day)}
            </Typography>

            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {/* Transacciones individuales */}
              {otros.map((t, i) => {
                const esIngreso = t.movimiento === 'Ingreso';
                const isLast = i === otros.length - 1 && mercado.length === 0;
                const isEditing = editingTx === t.id;
                const cuentas = state.cuentas?.length ? state.cuentas : ['Efectivo', 'T.C'];
                return (
                  <Box key={t.id} sx={{
                    borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                      <Box sx={{
                        width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                        bgcolor: '#F3F4F6',
                      }}>
                        {CAT_ICONS[t.categoria] || '💳'}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.concepto}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.2, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 12, color: T2 }}>
                            {t.categoria}{t.cuenta ? ` · ${t.cuenta}` : ''}
                            {t.tarjeta ? ` · ${t.tarjeta}` : ''}
                          </Typography>
                          {!t.cuenta && (
                            <Box sx={{ fontSize: 10, fontWeight: 700, color: T2, bgcolor: '#F3F4F6', px: 0.75, py: 0.1, borderRadius: '4px', border: `1px solid ${BORDER}` }}>
                              sin cuenta
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: esIngreso ? GREEN : RED }}>
                          {esIngreso ? '+' : '−'}{formatMoney(Math.abs(t.total))}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', mt: 0.4 }}>
                          <Box onClick={() => setEditingTx(isEditing ? null : t.id)} sx={{
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            color: isEditing ? GREEN : T2,
                            bgcolor: isEditing ? `${GREEN}14` : '#F3F4F6',
                            px: 1, py: 0.25, borderRadius: '4px',
                            border: `1px solid ${isEditing ? `${GREEN}40` : BORDER}`,
                            '&:active': { opacity: 0.7 },
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </Box>
                          <Box onClick={() => handleDelete(t.id)} sx={{
                            fontSize: 11, fontWeight: 700, color: RED, cursor: 'pointer',
                            bgcolor: `${RED}12`, px: 1, py: 0.25, borderRadius: '4px',
                            border: `1px solid ${RED}30`, display: 'flex', alignItems: 'center',
                            '&:active': { opacity: 0.7 },
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Edición inline de cuenta */}
                    <Collapse in={isEditing}>
                      <Box sx={{ px: 2, pb: 1.5, pt: 0 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>
                          {esIngreso ? '¿A qué cuenta entró?' : '¿Con qué pagaste?'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          {cuentas.map(c => {
                            const sel = t.cuenta === c;
                            return (
                              <Box key={c} onClick={() => {
                                updateTransaccion(t.id, { cuenta: c, ...(c !== 'T.C' ? { tarjeta: null } : {}) });
                                if (c !== 'T.C') { setEditingTx(null); showToast('Cuenta actualizada', 'success'); }
                              }} sx={{
                                px: 1.5, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                                borderColor: sel ? `${GREEN}60` : BORDER,
                                bgcolor:     sel ? GREEN : '#fff',
                                color:       sel ? '#fff' : T2,
                              }}>
                                {c}
                              </Box>
                            );
                          })}
                        </Box>
                        {t.cuenta === 'T.C' && state.tarjetas?.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                            {state.tarjetas.map(tj => (
                              <Box key={tj.id} onClick={() => {
                                updateTransaccion(t.id, { tarjeta: tj.nombre });
                                setEditingTx(null);
                                showToast('Tarjeta actualizada', 'success');
                              }} sx={{
                                px: 1.5, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                                borderColor: t.tarjeta === tj.nombre ? `${GREEN}60` : BORDER,
                                bgcolor:     t.tarjeta === tj.nombre ? GREEN : '#fff',
                                color:       t.tarjeta === tj.nombre ? '#fff' : T2,
                              }}>
                                {tj.nombre}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}

              {/* Mercado colapsado */}
              {mercado.length > 0 && (() => {
                const totalMercado = mercado.reduce((s, t) => s + Math.abs(t.total), 0);
                const cuentaActual = mercado[0]?.cuenta || 'Efectivo';
                const nItems = mercado.length;
                const isEditing = editingCuenta === day;
                return (
                  <Box sx={{ borderTop: otros.length > 0 ? `1px solid ${BORDER}` : 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                      <Box sx={{
                        width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                        bgcolor: '#F3F4F6',
                      }}>
                        {CAT_ICONS['Mercado'] || '🛒'}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1 }}>Mercado</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.2 }}>
                          <Typography sx={{ fontSize: 12, color: T2 }}>
                            {nItems} producto{nItems > 1 ? 's' : ''} · {cuentaActual}{mercado[0]?.tarjeta ? ` · ${mercado[0].tarjeta}` : ''}
                          </Typography>
                          <Box onClick={() => setEditingCuenta(isEditing ? null : day)}
                            sx={{ fontSize: 11, color: GREEN, cursor: 'pointer', fontWeight: 600 }}>
                            {isEditing ? 'cerrar' : 'editar'}
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: RED }}>
                          −{formatMoney(totalMercado)}
                        </Typography>
                        <Box onClick={() => handleDeleteMercadoDia(day)} sx={{
                          mt: 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: RED, cursor: 'pointer',
                          bgcolor: `${RED}12`, px: 1, py: 0.25, borderRadius: '4px',
                          border: `1px solid ${RED}30`,
                          '&:active': { opacity: 0.7 },
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </Box>
                      </Box>
                    </Box>

                    <Collapse in={isEditing}>
                      <Box sx={{ px: 2, pb: 1.5 }}>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
                          {(state.cuentas?.length ? state.cuentas : ['Efectivo', 'T.C']).map(c => (
                            <Box key={c} onClick={() => {
                              if (c !== 'T.C') {
                                updateMercadoCuenta(day, c, null);
                                setEditingCuenta(null);
                                showToast('Cuenta actualizada', 'success');
                              } else {
                                if (!state.tarjetas?.length) {
                                  updateMercadoCuenta(day, c, null);
                                  setEditingCuenta(null);
                                  showToast('Cuenta actualizada', 'success');
                                } else {
                                  updateMercadoCuenta(day, c, null);
                                }
                              }
                            }} sx={{
                              px: 1.5, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                              cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                              borderColor: cuentaActual === c ? `${GREEN}60` : BORDER,
                              bgcolor:     cuentaActual === c ? GREEN : '#fff',
                              color:       cuentaActual === c ? '#fff' : T2,
                            }}>
                              {c}
                            </Box>
                          ))}
                        </Box>
                        {cuentaActual === 'T.C' && state.tarjetas?.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                            {state.tarjetas.map(t => (
                              <Box key={t.id} onClick={() => {
                                updateMercadoCuenta(day, 'T.C', t.nombre);
                                setEditingCuenta(null);
                                showToast('Tarjeta actualizada', 'success');
                              }} sx={{
                                px: 1.5, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                                borderColor: mercado[0]?.tarjeta === t.nombre ? `${GREEN}60` : BORDER,
                                bgcolor:     mercado[0]?.tarjeta === t.nombre ? GREEN : '#fff',
                                color:       mercado[0]?.tarjeta === t.nombre ? '#fff' : T2,
                              }}>
                                {t.nombre}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })()}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
