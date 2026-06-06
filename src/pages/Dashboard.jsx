import { useState, useMemo, Component } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import ReactApexChart from 'react-apexcharts';
import { useFinanzas } from 'src/context/FinanzasContext';
import { computeMetrics } from 'src/utils/metrics';
import { formatMoney, getMesActual } from 'src/utils/format';
import { MESES, MES_NAMES, CAT_ICONS } from 'src/constants';

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

// ── Error boundary ────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <Box sx={{ p: 4 }}>
        <Typography sx={{ color: RED, fontWeight: 700 }}>Error en Gráficas</Typography>
        <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: T2 }}>{this.state.error.message}</Typography>
      </Box>
    );
    return this.props.children;
  }
}

function chartBase(overrides = {}) {
  return {
    chart: { background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "'Inter Variable', sans-serif", foreColor: '#919EAB', animations: { speed: 300 } },
    dataLabels: { enabled: false },
    stroke: { width: 2.5, curve: 'smooth' },
    grid: { strokeDashArray: 3, borderColor: 'rgba(145,158,171,0.18)', padding: { right: 8, left: 0 }, xaxis: { lines: { show: false } } },
    xaxis: { axisBorder: { show: false }, axisTicks: { show: false } },
    markers: { size: 0 },
    legend: { show: false },
    tooltip: { theme: 'dark', intersect: false },
    ...overrides,
  };
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
      {children}
    </Typography>
  );
}

function StatusBadge({ rate }) {
  if (rate >= 0.2) return <Typography sx={{ fontSize: 9, fontWeight: 700, color: GREEN, bgcolor: alpha(GREEN, 0.1), px: 0.75, py: 0.2, borderRadius: '4px' }}>Bien</Typography>
  if (rate >= 0)   return <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#D97706', bgcolor: alpha('#D97706', 0.1), px: 0.75, py: 0.2, borderRadius: '4px' }}>Ok</Typography>
  return               <Typography sx={{ fontSize: 9, fontWeight: 700, color: RED, bgcolor: alpha(RED, 0.1), px: 0.75, py: 0.2, borderRadius: '4px' }}>Negativo</Typography>
}

function DashboardInner() {
  const { state } = useFinanzas();
  const [mes, setMes] = useState(getMesActual());

  const m        = useMemo(() => computeMetrics(state.transacciones, mes), [state.transacciones, mes]);
  const mesIdx   = MESES.indexOf(mes);
  const mesName  = MES_NAMES[mesIdx];
  const allMetrics = useMemo(() => MESES.map(ms => computeMetrics(state.transacciones, ms)), [state.transacciones]);
  const txsMes   = useMemo(() => state.transacciones.filter(t => t.mes === mes), [state.transacciones, mes]);

  const daysInMonth = new Date(2026, mesIdx + 1, 0).getDate();
  const today = mes === getMesActual() ? new Date().getDate() : daysInMonth;

  // Gasto acumulado diario
  const { dailySpend, dailyTarget } = useMemo(() => {
    const byDay = Array(daysInMonth).fill(0);
    txsMes.filter(t => t.movimiento === 'Egreso').forEach(t => {
      const d = new Date(t.fecha).getDate() - 1;
      if (d >= 0 && d < daysInMonth) byDay[d] += Math.abs(t.total);
    });
    const acum = []; let sum = 0;
    for (let i = 0; i < today; i++) { sum += byDay[i]; acum.push(Math.round(sum)); }
    const target = Array.from({ length: today }, (_, i) => Math.round((m.eg || 0) * (i + 1) / daysInMonth));
    return { dailySpend: acum, dailyTarget: target };
  }, [txsMes, daysInMonth, today, m.eg]);

  const xDays = Array.from({ length: today }, (_, i) => i + 1);

  // Categorías ordenadas
  const catData = useMemo(() =>
    Object.entries(m.byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
    [m.byCat]
  );
  const catTotal = catData.reduce((s, [, v]) => s + v, 0) || 1;

  // Tendencia anual
  const ingSeries  = allMetrics.map(mt => mt.ing);
  const egSeries   = allMetrics.map(mt => mt.eg);
  const netoSeries = allMetrics.map(mt => mt.neto);

  // Saldo acumulado real + proyección
  const { saldoAcumReal, saldoAcumProy } = useMemo(() => {
    const mesActualIdx = MESES.indexOf(getMesActual());
    // Acumulado real: suma de netos de meses con datos
    const real = allMetrics.reduce((acc, mt, i) => {
      const prev = i > 0 ? acc[i - 1] : 0;
      acc.push(mt.hasData ? Math.round(prev + mt.neto) : null);
      return acc;
    }, []);
    // Proyección: para los meses futuros, extrapolar con el promedio de los últimos 3 meses
    const ultimosDatos = allMetrics.slice(Math.max(0, mesActualIdx - 2), mesActualIdx + 1).filter(mt => mt.hasData);
    const promNeto = ultimosDatos.length ? ultimosDatos.reduce((s, mt) => s + mt.neto, 0) / ultimosDatos.length : 0;
    const proy = allMetrics.map((mt, i) => {
      if (i <= mesActualIdx) return null;
      const base = real[mesActualIdx] ?? 0;
      return Math.round(base + promNeto * (i - mesActualIdx));
    });
    return { saldoAcumReal: real, saldoAcumProy: proy };
  }, [allMetrics]);

  const gastoHoy = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return txsMes.filter(t => t.movimiento === 'Egreso' && t.fecha?.split('T')[0] === todayStr)
      .reduce((s, t) => s + Math.abs(t.total), 0);
  }, [txsMes]);
  const promDiario = today > 0 ? Math.round(m.eg / today) : 0;
  const proyectado = Math.round(promDiario * daysInMonth);

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Gráficas</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Análisis de {mesName}</Typography>
        </Box>

        {/* Month pills */}
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 2.5, pb: 0.5 }}>
          {MESES.map((m2, i) => (
            <Box key={m2} onClick={() => setMes(m2)} sx={{
              px: 1.75, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
              borderColor: m2 === mes ? T1 : BORDER,
              bgcolor: m2 === mes ? T1 : CARD,
              color: m2 === mes ? '#fff' : T2,
            }}>
              {MES_NAMES[i]}
            </Box>
          ))}
        </Box>

        {/* KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
          {[
            { label: 'Ingresos',    value: formatMoney(m.ing),   color: GREEN, sub: null },
            { label: 'Egresos',     value: formatMoney(m.eg),    color: RED,   sub: null },
            { label: 'Neto',        value: (m.neto >= 0 ? '+' : '') + formatMoney(m.neto), color: m.neto >= 0 ? GREEN : RED, sub: `Tasa ahorro ${(m.tasaAhorro * 100).toFixed(0)}%` },
            { label: 'Prom. diario',value: formatMoney(promDiario), color: T1, sub: `Proyectado ${formatMoney(proyectado)}` },
          ].map(({ label, value, color, sub }) => (
            <Box key={label} sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 1.75 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>{label}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</Typography>
              {sub && <Typography sx={{ fontSize: 10.5, color: T2, mt: 0.4 }}>{sub}</Typography>}
            </Box>
          ))}
        </Box>

        {/* Gasto acumulado */}
        {dailySpend.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <SectionLabel>Gasto acumulado — {mesName}</SectionLabel>
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden' }}>
              <Box sx={{ px: 2, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: T2 }}>Total acumulado</Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: RED, letterSpacing: '-0.5px' }}>{formatMoney(m.eg)}</Typography>
                </Box>
                {gastoHoy > 0 && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 10, color: T2 }}>Hoy</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{formatMoney(gastoHoy)}</Typography>
                  </Box>
                )}
              </Box>
              <ReactApexChart
                type="area" height={160}
                series={[
                  { name: 'Gasto acumulado', data: dailySpend },
                  ...(m.ing > 0 ? [{ name: 'Ritmo esperado', data: dailyTarget }] : []),
                ]}
                options={chartBase({
                  colors: [RED, GREEN],
                  fill: { type: ['gradient', 'solid'], gradient: { opacityFrom: 0.2, opacityTo: 0.02 }, opacity: [1, 0] },
                  stroke: { width: [2.5, 1.5], curve: 'smooth', dashArray: [0, 4] },
                  xaxis: { categories: xDays, labels: { show: true, formatter: v => (v % 5 === 0 || v === 1 ? v : ''), style: { fontSize: '10px', colors: '#637381' } } },
                  yaxis: { labels: { formatter: v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v), style: { colors: '#919EAB', fontSize: '10px' } } },
                  tooltip: { theme: 'dark', intersect: false, y: { formatter: v => formatMoney(v) } },
                  markers: { size: [0, 0] },
                })}
              />
            </Box>
          </Box>
        )}

        {/* Gastos por categoría */}
        {catData.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <SectionLabel>Dónde va el dinero</SectionLabel>
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, px: 2, py: 2 }}>
              {catData.slice(0, 8).map(([cat, val]) => {
                const pct = (val / catTotal) * 100;
                return (
                  <Box key={cat} sx={{ mb: 1.75, '&:last-child': { mb: 0 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: 15, lineHeight: 1 }}>{CAT_ICONS[cat] || '·'}</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{cat}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 11, color: T2 }}>{pct.toFixed(0)}%</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>{formatMoney(val)}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ height: 5, borderRadius: 3, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: T1, borderRadius: 3, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Tendencia anual */}
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Tendencia anual</SectionLabel>
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden' }}>
            <Box sx={{ px: 2, mb: 1, display: 'flex', gap: 2.5 }}>
              {[{ label: 'Ingresos', color: GREEN }, { label: 'Egresos', color: RED }, { label: 'Neto', color: T2 }].map(l => (
                <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: l.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, color: T2 }}>{l.label}</Typography>
                </Box>
              ))}
            </Box>
            <ReactApexChart
              type="bar" height={200}
              series={[
                { name: 'Ingresos', data: ingSeries },
                { name: 'Egresos',  data: egSeries  },
                { name: 'Neto',     data: netoSeries },
              ]}
              options={chartBase({
                colors: [GREEN, RED, '#9CA3AF'],
                stroke: { width: 0 },
                plotOptions: { bar: { borderRadius: 3, columnWidth: '60%', borderRadiusApplication: 'end' } },
                xaxis: { categories: MES_NAMES, labels: { style: { fontSize: '10px' } } },
                yaxis: { labels: { formatter: v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v, style: { colors: '#919EAB', fontSize: '10px' } } },
                tooltip: { theme: 'dark', intersect: false, shared: true, y: { formatter: v => formatMoney(v) } },
                legend: { show: false },
                states: { hover: { filter: { type: 'darken', value: 0.88 } } },
              })}
            />
          </Box>
        </Box>

        {/* Saldo acumulado + proyección */}
        {saldoAcumReal.some(v => v !== null) && (
          <Box sx={{ mb: 3 }}>
            <SectionLabel>Evolución del saldo</SectionLabel>
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden' }}>
              <Box sx={{ px: 2, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: T2 }}>Saldo acumulado</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: (saldoAcumReal.filter(v => v !== null).at(-1) ?? 0) >= 0 ? GREEN : RED, letterSpacing: '-0.4px' }}>
                    {formatMoney(Math.abs(saldoAcumReal.filter(v => v !== null).at(-1) ?? 0))}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {[{ label: 'Real', color: GREEN }, { label: 'Proyección', color: '#C7D2FE' }].map(l => (
                    <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: l.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 10, color: T2 }}>{l.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <ReactApexChart
                type="line" height={150}
                series={[
                  { name: 'Real',       data: saldoAcumReal },
                  { name: 'Proyección', data: saldoAcumProy },
                ]}
                options={chartBase({
                  colors: [GREEN, '#818CF8'],
                  stroke: { width: [2.5, 1.5], curve: 'smooth', dashArray: [0, 5] },
                  fill: { type: ['solid', 'solid'], opacity: [1, 0.5] },
                  xaxis: { categories: MES_NAMES, labels: { style: { fontSize: '10px' } } },
                  yaxis: { labels: { formatter: v => v == null ? '' : v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v, style: { colors: '#919EAB', fontSize: '10px' } } },
                  tooltip: { theme: 'dark', y: { formatter: v => v != null ? formatMoney(v) : '—' } },
                  markers: { size: 3 },
                })}
              />
            </Box>
          </Box>
        )}

        {/* Resumen mensual */}
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Resumen mensual</SectionLabel>
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            {MESES.map((m2, i) => {
              const mt = allMetrics[i];
              if (!mt.hasData) return null;
              const isActive = m2 === mes;
              const pct = Math.min((mt.eg / (mt.ing || 1)) * 100, 100);
              const barColor = mt.tasaAhorro >= 0.2 ? GREEN : mt.tasaAhorro >= 0 ? '#D97706' : RED;
              return (
                <Box key={m2} onClick={() => setMes(m2)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2, py: 1.25, cursor: 'pointer',
                  bgcolor: isActive ? alpha(GREEN, 0.04) : 'transparent',
                  borderBottom: `1px solid ${BORDER}`,
                  '&:last-child': { borderBottom: 'none' },
                  '&:active': { opacity: 0.7 },
                }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, width: 28, color: isActive ? T1 : T2, flexShrink: 0 }}>
                    {MES_NAMES[i]}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography sx={{ fontSize: 11, color: T2 }}>{formatMoney(mt.eg)} / {formatMoney(mt.ing)}</Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: mt.neto >= 0 ? GREEN : RED }}>
                        {mt.neto >= 0 ? '+' : ''}{formatMoney(mt.neto)}
                      </Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: barColor, borderRadius: 2, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                  <StatusBadge rate={mt.tasaAhorro} />
                </Box>
              );
            })}
          </Box>
        </Box>

      </Box>
    </Box>
  );
}

export default function Dashboard() {
  return <ErrorBoundary><DashboardInner /></ErrorBoundary>;
}
