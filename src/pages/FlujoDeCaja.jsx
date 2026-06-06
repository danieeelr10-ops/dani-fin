import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFinanzas } from 'src/context/FinanzasContext';
import {
  computeDisponibleHoy, computePorCobrar,
  computeProximosPagos, computeAlertas, diasHasta,
} from 'src/utils/cashflow';
import { formatMoney, formatMoneyShort, getMesActual } from 'src/utils/format';
import AlertasBanner from 'src/components/AlertasBanner';

const BG      = '#F7F7F8';
const CARD    = '#FFFFFF';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)';
const T1      = '#111318';
const T2      = '#6B7280';
const GREEN   = '#00A76F';
const RED     = '#DC2626';
const BORDER  = '#E5E7EB';
const INDIGO  = '#6366F1';

function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
      {children}
    </Typography>
  );
}

function DiaChip({ dias }) {
  if (dias === null) return null;
  if (dias < 0)  return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: '#FEE2E2', border: '1px solid #FCA5A5' }}><Typography sx={{ fontSize: 10, fontWeight: 700, color: RED }}>VENCIDO</Typography></Box>;
  if (dias === 0) return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: '#FFF7ED', border: '1px solid #FED7AA' }}><Typography sx={{ fontSize: 10, fontWeight: 700, color: '#D97706' }}>HOY</Typography></Box>;
  if (dias === 1) return <Box sx={{ px: 0.875, py: 0.2, borderRadius: '6px', bgcolor: '#FFFBEB', border: '1px solid #FDE68A' }}><Typography sx={{ fontSize: 10, fontWeight: 700, color: '#D97706' }}>MAÑANA</Typography></Box>;
  return <Typography sx={{ fontSize: 11, color: T2, fontWeight: 500 }}>+{dias}d</Typography>;
}

export default function FlujoDeCaja() {
  const navigate = useNavigate();
  const { state, getCarryOver } = useFinanzas();
  const mes       = getMesActual();
  const carryOver = getCarryOver(mes);
  const txs       = state.transacciones || [];

  const disponible     = useMemo(() => computeDisponibleHoy(txs, mes, carryOver),  [txs, mes, carryOver]);
  const porCobrar      = useMemo(() => computePorCobrar(txs),                       [txs]);
  const pagos30        = useMemo(() => computeProximosPagos(txs, 30),              [txs]);
  const pagos7         = useMemo(() => computeProximosPagos(txs, 7),               [txs]);
  const cobros7        = useMemo(() => porCobrar.proximos7d,                        [porCobrar]);
  const alertas        = useMemo(() => computeAlertas(txs, mes, carryOver),        [txs, mes, carryOver]);
  const proyectado30d  = disponible + porCobrar.total - pagos30.total;
  const flujoNeto7d    = (cobros7.reduce((s, t) => s + (Math.abs(t.total) - (t.montoPagado || 0)), 0)) - pagos7.total7d;

  // Barra de proyección
  const proyMax = Math.max(Math.abs(disponible), Math.abs(proyectado30d), 1);
  const proyPct = Math.min((proyectado30d / proyMax) * 100, 100);

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            Flujo de caja
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Liquidez real · proyección</Typography>
        </Box>

        {/* Alertas */}
        <AlertasBanner alertas={alertas} />

        {/* Hero disponible */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
            Disponible hoy
          </Typography>
          <Typography sx={{ fontSize: 40, fontWeight: 800, color: disponible >= 0 ? GREEN : RED, letterSpacing: '-1.5px', lineHeight: 1 }}>
            {disponible < 0 ? '−' : ''}{formatMoney(Math.abs(disponible))}
          </Typography>
          <Typography sx={{ fontSize: 12, color: T2, mt: 0.5 }}>
            Ingresos recibidos − gastos reales{carryOver > 0 ? ` + ${formatMoneyShort(carryOver)} del mes anterior` : ''}
          </Typography>
        </Box>

        {/* Próximos 7 días */}
        <Box sx={{ mb: 2 }}>
          <SectionLabel>Próximos 7 días</SectionLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 1.75, border: `1px solid ${BORDER}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: GREEN, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por cobrar</Typography>
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: cobros7.length > 0 ? GREEN : T2, letterSpacing: '-0.5px' }}>
                {formatMoneyShort(cobros7.reduce((s, t) => s + (Math.abs(t.total) - (t.montoPagado || 0)), 0))}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>{cobros7.length} cobro{cobros7.length !== 1 ? 's' : ''}</Typography>
            </Box>
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 1.75, border: `1px solid ${BORDER}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: RED, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por pagar</Typography>
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: pagos7.total7d > 0 ? RED : T2, letterSpacing: '-0.5px' }}>
                {formatMoneyShort(pagos7.total7d)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>{pagos7.items.filter(t => diasHasta(t.fecha) <= 7).length} pago{pagos7.items.length !== 1 ? 's' : ''}</Typography>
            </Box>
          </Box>
          {/* Flujo neto 7d */}
          <Box sx={{ bgcolor: flujoNeto7d >= 0 ? 'rgba(0,167,111,0.06)' : 'rgba(220,38,38,0.04)', borderRadius: '10px', px: 1.5, py: 1, border: `1px solid ${flujoNeto7d >= 0 ? 'rgba(0,167,111,0.18)' : 'rgba(220,38,38,0.15)'}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: T2, fontWeight: 500 }}>Flujo neto 7 días</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: flujoNeto7d >= 0 ? GREEN : RED }}>
                {flujoNeto7d >= 0 ? '+' : '−'}{formatMoneyShort(Math.abs(flujoNeto7d))}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Proyección 30 días */}
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Proyección 30 días</SectionLabel>
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2, border: `1px solid ${BORDER}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: T2, mb: 0.25 }}>Proyectado</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, color: proyectado30d >= 0 ? T1 : RED, letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {proyectado30d < 0 ? '−' : ''}{formatMoney(Math.abs(proyectado30d))}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: 10, color: T2 }}>Hoy</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T2 }}>{formatMoneyShort(disponible)}</Typography>
              </Box>
            </Box>

            {/* Barra visual hoy → 30d */}
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 10, color: T2 }}>Hoy</Typography>
                <Typography sx={{ fontSize: 10, color: T2 }}>+30 días</Typography>
              </Box>
              <Box sx={{ position: 'relative', height: 8, borderRadius: 4, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                <Box sx={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${Math.max(Math.min(((disponible / proyMax) * 100), 100), 2)}%`,
                  bgcolor: disponible >= 0 ? GREEN : RED, borderRadius: 4,
                  opacity: 0.4,
                }} />
                <Box sx={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${Math.max(Math.min(proyPct, 100), 2)}%`,
                  bgcolor: proyectado30d >= 0 ? GREEN : RED, borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </Box>
            </Box>

            {/* Detalle de la proyección */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625 }}>
              {[
                { label: 'Disponible hoy',   val: disponible,       color: disponible >= 0 ? GREEN : RED },
                { label: '+ Por cobrar',      val: porCobrar.total,  color: GREEN },
                { label: '− Pagos programados', val: -pagos30.total, color: RED   },
              ].map(({ label, val, color }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: T2 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: Math.abs(val) > 0 ? color : T2 }}>
                    {val < 0 ? '−' : val > 0 ? '+' : ''}{formatMoneyShort(Math.abs(val))}
                  </Typography>
                </Box>
              ))}
              <Box sx={{ height: '1px', bgcolor: BORDER, my: 0.25 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>Proyectado</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: proyectado30d >= 0 ? GREEN : RED }}>
                  {proyectado30d < 0 ? '−' : ''}{formatMoneyShort(Math.abs(proyectado30d))}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Por cobrar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
            <SectionLabel>Por cobrar{porCobrar.total > 0 ? ` · ${formatMoneyShort(porCobrar.total)}` : ''}</SectionLabel>
            {porCobrar.totalVencido > 0 && (
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: RED, bgcolor: '#FEF2F2', px: 0.875, py: 0.25, borderRadius: '6px', mb: 1.25 }}>
                {formatMoneyShort(porCobrar.totalVencido)} vencido
              </Typography>
            )}
          </Box>

          {porCobrar.pendientes.length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 2.5, textAlign: 'center', border: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 14, color: T2, mb: 0.5 }}>Sin cobros pendientes</Typography>
              <Box onClick={() => navigate('/registro')} sx={{ display: 'inline-flex', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: GREEN }}>Registrar cobro →</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {porCobrar.pendientes.map((t, i) => {
                const dv    = diasHasta(t.fechaVencimiento || t.fecha);
                const monto = Math.abs(t.total) - (t.montoPagado || 0);
                const isLast = i === porCobrar.pendientes.length - 1;
                return (
                  <Box key={t.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375,
                    borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
                    bgcolor: dv !== null && dv < 0 ? 'rgba(220,38,38,0.03)' : 'transparent',
                  }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(0,167,111,0.08)', border: '1px solid rgba(0,167,111,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      🤝
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.concepto || t.categoria}
                      </Typography>
                      {t.clienteRef && (
                        <Typography sx={{ fontSize: 11, color: T2, mt: 0.15 }}>{t.clienteRef}</Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.375, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: GREEN }}>{formatMoneyShort(monto)}</Typography>
                      <DiaChip dias={dv} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Próximos pagos programados */}
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Pagos programados{pagos30.total > 0 ? ` · ${formatMoneyShort(pagos30.total)}` : ''}</SectionLabel>

          {pagos30.items.length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, p: 2.5, textAlign: 'center', border: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 14, color: T2, mb: 0.5 }}>Sin pagos programados</Typography>
              <Box onClick={() => navigate('/registro')} sx={{ display: 'inline-flex', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: T2 }}>Registrar pago programado →</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {pagos30.items.map((t, i) => {
                const d      = diasHasta(t.fecha);
                const isLast = i === pagos30.items.length - 1;
                const urgente = d !== null && d <= 3;
                return (
                  <Box key={t.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375,
                    borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
                    bgcolor: urgente ? 'rgba(220,38,38,0.03)' : 'transparent',
                  }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#F3F4F6', border: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      📅
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.concepto || t.categoria}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: T2, mt: 0.15 }}>{t.categoria}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.375, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: urgente ? RED : T1 }}>
                        {formatMoneyShort(Math.abs(t.total))}
                      </Typography>
                      <DiaChip dias={d} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* CTA registrar */}
        <Box onClick={() => navigate('/registro')} sx={{
          bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH,
          border: `1px solid ${BORDER}`, p: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', '&:active': { opacity: 0.7 },
        }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1 }}>Registrar cobro o pago futuro</Typography>
            <Typography sx={{ fontSize: 12, color: T2, mt: 0.2 }}>Usa el toggle "Programado" en el formulario</Typography>
          </Box>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </Box>
        </Box>

      </Box>
    </Box>
  );
}
