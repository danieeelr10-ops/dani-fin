import { useMemo, useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { computePorCobrar, computeIngresoStats, diasHasta } from 'src/utils/cashflow';
import { formatMoney, formatMoneyShort, getMesActual } from 'src/utils/format';
import { MES_NAMES, MESES } from 'src/constants';

const BG      = '#F7F7F8';
const CARD    = '#FFFFFF';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)';
const T1      = '#111318';
const T2      = '#6B7280';
const GREEN   = '#00A76F';
const RED     = '#DC2626';
const AMBER   = '#D97706';
const BORDER  = '#E5E7EB';
const INDIGO  = '#6366F1';

const TENDENCIA_CONFIG = {
  crecimiento:  { label: 'Creciendo',   color: GREEN,  icono: '↑' },
  estabilidad:  { label: 'Estable',     color: AMBER,  icono: '→' },
  caida:        { label: 'Bajando',     color: RED,    icono: '↓' },
  insuficiente: { label: 'Sin datos',   color: T2,     icono: '—' },
};

function DiaChip({ dias }) {
  if (dias === null) return null;
  if (dias < 0) return (
    <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: '#FEE2E2', border: '1px solid #FCA5A5' }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: RED }}>VENCIDO {Math.abs(dias)}d</Typography>
    </Box>
  );
  if (dias === 0) return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: '#FFF7ED', border: '1px solid #FED7AA' }}><Typography sx={{ fontSize: 10, fontWeight: 700, color: AMBER }}>HOY</Typography></Box>;
  if (dias === 1) return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: '#FFFBEB', border: '1px solid #FDE68A' }}><Typography sx={{ fontSize: 10, fontWeight: 700, color: AMBER }}>MAÑANA</Typography></Box>;
  return <Typography sx={{ fontSize: 11, color: T2, fontWeight: 500 }}>+{dias}d</Typography>;
}

export default function Cobros() {
  const navigate = useNavigate();
  const { state, updateTransaccion } = useFinanzas();
  const { showToast } = useSnackbar();
  const mes = getMesActual();
  const txs = state.transacciones || [];

  const porCobrar   = useMemo(() => computePorCobrar(txs),                    [txs]);
  const ingStats    = useMemo(() => computeIngresoStats(txs, mes),             [txs, mes]);
  const tend        = TENDENCIA_CONFIG[ingStats.tendencia] || TENDENCIA_CONFIG.insuficiente;

  // Cobros pendientes ordenados: vencidos primero, luego por fecha
  const cobrosOrdenados = useMemo(() => [...porCobrar.pendientes].sort((a, b) => {
    const da = diasHasta(a.fechaVencimiento || a.fecha) ?? 999;
    const db = diasHasta(b.fechaVencimiento || b.fecha) ?? 999;
    return da - db;
  }), [porCobrar.pendientes]);

  // Cobros ya recibidos este mes (para historial)
  const cobrosRecibidos = useMemo(() => txs.filter(t =>
    t.mes === mes &&
    t.movimiento === 'Ingreso' &&
    t.estado === 'realizado' &&
    !t.esFuturo &&
    t.categoria !== 'Pago TC'
  ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)), [txs, mes]);

  const [confirmando, setConfirmando] = useState(null);

  function marcarRecibido(tx) {
    updateTransaccion(tx.id, {
      estado: 'realizado',
      esFuturo: false,
      montoPagado: Math.abs(tx.total),
      fecha: new Date().toISOString(),
    });
    showToast(`${tx.concepto || tx.categoria} marcado como recibido`, 'success');
    setConfirmando(null);
  }

  const mesNombre = MES_NAMES[MESES.indexOf(mes)];

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            Cobros
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Ingresos pendientes y estadísticas</Typography>
        </Box>

        {/* KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
          <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 1.75, border: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Por cobrar</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: porCobrar.total > 0 ? GREEN : T2, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {formatMoneyShort(porCobrar.total)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>
              {cobrosOrdenados.length} cobro{cobrosOrdenados.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Box sx={{ bgcolor: porCobrar.totalVencido > 0 ? '#FEF2F2' : CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 1.75, border: `1px solid ${porCobrar.totalVencido > 0 ? '#FECACA' : BORDER}` }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Vencidos</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: porCobrar.totalVencido > 0 ? RED : T2, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {formatMoneyShort(porCobrar.totalVencido)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: porCobrar.totalVencido > 0 ? RED : T2, mt: 0.25, fontWeight: porCobrar.totalVencido > 0 ? 600 : 400 }}>
              {porCobrar.vencidos.length > 0 ? `${porCobrar.vencidos.length} sin recibir` : 'Todo al día'}
            </Typography>
          </Box>
        </Box>

        {/* Estadísticas de ingresos */}
        {ingStats.mesesConDatos > 0 && (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2, mb: 2, border: `1px solid ${BORDER}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tendencia de ingresos
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.875, py: 0.25, borderRadius: '6px', bgcolor: `${tend.color}14`, border: `1px solid ${tend.color}30` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: tend.color }}>{tend.icono}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: tend.color }}>{tend.label}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.5 }}>
              {[
                { label: 'Prom. 3m',  val: ingStats.prom3  },
                { label: 'Prom. 6m',  val: ingStats.prom6  },
                { label: 'Prom. 12m', val: ingStats.prom12 },
              ].map(({ label, val }) => (
                <Box key={label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 10, color: T2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.25 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: val > 0 ? T1 : T2, lineHeight: 1 }}>
                    {val > 0 ? formatMoneyShort(val) : '—'}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Rango esperado */}
            {ingStats.prom3 > 0 && (
              <Box sx={{ pt: 1.25, borderTop: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.875 }}>
                  Próximo mes esperado
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {[
                    { label: 'Mínimo',    val: ingStats.minEsperado,       color: RED   },
                    { label: 'Probable',  val: ingStats.probableEsperado,  color: T1    },
                    { label: 'Optimista', val: ingStats.optimistaEsperado, color: GREEN },
                  ].map(({ label, val, color }) => (
                    <Box key={label} sx={{ flex: 1, textAlign: 'center', py: 0.875, borderRadius: '8px', bgcolor: `${color}08`, border: `1px solid ${color}20` }}>
                      <Typography sx={{ fontSize: 9, color: T2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.25 }}>{label}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1 }}>{formatMoneyShort(val)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Lista de cobros pendientes */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pendientes de cobro
            </Typography>
            <Box onClick={() => navigate('/registro')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>+ Nuevo</Typography>
            </Box>
          </Box>

          {cobrosOrdenados.length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 3, textAlign: 'center', border: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 14, color: T2, mb: 0.5 }}>Sin cobros pendientes</Typography>
              <Typography sx={{ fontSize: 12, color: T2, mb: 2 }}>
                Registra un ingreso como "Programado" para verlo aquí
              </Typography>
              <Box onClick={() => navigate('/registro')} sx={{ display: 'inline-flex', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: GREEN }}>Registrar cobro →</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {cobrosOrdenados.map((t, i) => {
                const d       = diasHasta(t.fechaVencimiento || t.fecha);
                const monto   = Math.abs(t.total) - (t.montoPagado || 0);
                const vencido = d !== null && d < 0;
                const isLast  = i === cobrosOrdenados.length - 1;
                const isConf  = confirmando === t.id;

                return (
                  <Box key={t.id} sx={{ borderBottom: isLast ? 'none' : `1px solid ${BORDER}`, bgcolor: vencido ? 'rgba(220,38,38,0.025)' : 'transparent' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375 }}>
                      <Box sx={{
                        width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
                        bgcolor: vencido ? '#FEF2F2' : 'rgba(0,167,111,0.08)',
                        border: `1px solid ${vencido ? '#FECACA' : 'rgba(0,167,111,0.15)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>
                        🤝
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.concepto || t.categoria}
                        </Typography>
                        {t.clienteRef && (
                          <Typography sx={{ fontSize: 11, color: INDIGO, mt: 0.15, fontWeight: 500 }}>{t.clienteRef}</Typography>
                        )}
                        {!t.clienteRef && (
                          <Typography sx={{ fontSize: 11, color: T2, mt: 0.15 }}>{t.categoria}</Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.375, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: GREEN }}>{formatMoneyShort(monto)}</Typography>
                        <DiaChip dias={d} />
                      </Box>
                    </Box>

                    {/* Acción: marcar como recibido */}
                    {!isConf ? (
                      <Box sx={{ px: 2, pb: 1.25 }}>
                        <Box onClick={() => setConfirmando(t.id)} sx={{
                          display: 'inline-flex', px: 1.5, py: 0.5, borderRadius: '8px',
                          border: `1px solid ${alpha(GREEN, 0.35)}`, bgcolor: alpha(GREEN, 0.06),
                          cursor: 'pointer', '&:active': { opacity: 0.7 },
                        }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>Marcar como recibido</Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ px: 2, pb: 1.25, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 12, color: T2, flex: 1 }}>
                          ¿Recibiste {formatMoneyShort(monto)}?
                        </Typography>
                        <Box onClick={() => marcarRecibido(t)} sx={{
                          px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: GREEN, cursor: 'pointer', '&:active': { opacity: 0.8 },
                        }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Sí, recibido</Typography>
                        </Box>
                        <Box onClick={() => setConfirmando(null)} sx={{
                          px: 1.25, py: 0.5, borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: 'pointer',
                        }}>
                          <Typography sx={{ fontSize: 12, color: T2 }}>No</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Recibidos este mes */}
        {cobrosRecibidos.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
              Recibidos en {mesNombre}
            </Typography>
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {cobrosRecibidos.map((t, i) => (
                <Box key={t.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                  borderBottom: i < cobrosRecibidos.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: GREEN, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.concepto || t.categoria}
                    </Typography>
                    {t.clienteRef && <Typography sx={{ fontSize: 11, color: INDIGO }}>{t.clienteRef}</Typography>}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: GREEN, flexShrink: 0 }}>
                    +{formatMoneyShort(Math.abs(t.total))}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

      </Box>
    </Box>
  );
}
