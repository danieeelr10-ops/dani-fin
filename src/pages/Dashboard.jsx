import { useState, useMemo, Component } from 'react';
import {
  Box, Card, CardHeader, Typography, Divider,
  Tab, Tabs, Grid, Button, LinearProgress, alpha,
} from '@mui/material';
import ReactApexChart from 'react-apexcharts';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip as RTooltip,
} from 'recharts';
import MesPills from 'src/components/MesPills';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { computeMetrics } from 'src/utils/metrics';
import { formatMoney, formatMoneyShort, getMesActual } from 'src/utils/format';
import { MESES, MES_NAMES, CAT_ICONS, CAT_COLORS } from 'src/constants';


// ── Chart config base ─────────────────────────────────────────
function chartBase(overrides = {}) {
  return {
    chart: { background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "'Inter Variable', sans-serif", foreColor: '#919EAB', animations: { speed: 360 } },
    dataLabels: { enabled: false },
    stroke: { width: 2.5, curve: 'smooth', lineCap: 'round' },
    grid: { strokeDashArray: 3, borderColor: 'rgba(145,158,171,0.24)', padding: { top: 0, right: 0, bottom: 0 }, xaxis: { lines: { show: false } } },
    xaxis: { axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { tickAmount: 5 },
    markers: { size: 0 },
    legend: { show: false },
    tooltip: { theme: 'dark', fillSeriesColor: false },
    states: { hover: { filter: { type: 'darken', value: 0.88 } }, active: { filter: { type: 'darken', value: 0.88 } } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '48%', borderRadiusApplication: 'end' } },
    ...overrides,
  };
}

// ── Label chip ────────────────────────────────────────────────
function StatusChip({ color, children }) {
  const map = { success: ['#22C55E', '#D3FCD2'], error: ['#FF5630', '#FFE9D5'], warning: ['#FFAB00', '#FFF5CC'], info: ['#00B8D9', '#CAFDF5'] };
  const [fg, bg] = map[color] || map.info;
  return (
    <Box component="span" sx={{ px: 1, py: 0.375, borderRadius: 0.75, fontSize: 12, fontWeight: 700, bgcolor: alpha(fg, 0.16), color: fg, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  );
}

// ── Error boundary ────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 4 }}>
          <Typography color="error.main" fontWeight={700} sx={{ mb: 1 }}>Error en Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error.message}
          </Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
function DashboardInner() {
  const { state } = useFinanzas();
  const { showToast } = useSnackbar();
  const [mes, setMes] = useState(getMesActual());
  const [tabOverview, setTabOverview] = useState(0);
  const [tabStats, setTabStats] = useState(0);
  const [mesExport, setMesExport] = useState(getMesActual());

  const m = useMemo(() => computeMetrics(state.transacciones, mes), [state.transacciones, mes]);
  const mesName = MES_NAMES[MESES.indexOf(mes)];
  const allMetrics = useMemo(() => MESES.map(ms => computeMetrics(state.transacciones, ms)), [state.transacciones]);

  const txsMes = useMemo(() => state.transacciones.filter(t => t.mes === mes), [state.transacciones, mes]);

  const today = mes === getMesActual() ? new Date().getDate() : new Date(2026, MESES.indexOf(mes) + 1, 0).getDate();

  const netoDisplay = m.netoCash;

  // ── Chart: barras mensuales ───────────────────────────────
  const monthlyBar = useMemo(() => ({
    monthly: {
      cats: MES_NAMES,
      ing: allMetrics.map(mt => mt.ing),
      eg:  allMetrics.map(mt => mt.eg),
    },
  }), [allMetrics]);

  // ── Categorías ────────────────────────────────────────────
  const catData = useMemo(() => Object.entries(m.byCat).sort((a, b) => b[1] - a[1]), [m.byCat]);


  // ── Donut: egresos por categoría ─────────────────────────
  const donutData = useMemo(() =>
    catData.filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
    [catData]
  );

  function exportarCSV(tipo) {
    const txs = state.transacciones.filter(t => t.mes === mesExport);
    let csv, fn;
    if (tipo === 'transacciones') {
      csv = 'Fecha,Mes,Tipo,Movimiento,Categoría,Concepto,Total,Cuenta\n' +
        txs.map(t => [new Date(t.fecha).toLocaleDateString('es-CO'), t.mes, t.tipo, t.movimiento, t.categoria, `"${t.concepto}"`, t.total, t.cuenta].join(',')).join('\n');
      fn = `transacciones_${mesExport}.csv`;
    } else {
      const items = state.mercado.filter(i => i.mes === mesExport);
      csv = 'Fecha,Concepto,Monto,Cuenta\n' + items.map(i => [new Date(i.fecha).toLocaleDateString('es-CO'), `"${i.concepto}"`, i.monto, i.cuenta].join(',')).join('\n');
      fn = `mercado_${mesExport}.csv`;
    }
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(csv);
    a.download = fn; a.click();
    showToast('✓ CSV descargado', 'success');
  }

  // ══════════════════════════════════════════════════════════
  // 1. OVERVIEW CARD
  // ══════════════════════════════════════════════════════════
  const OverviewCard = () => {
    const netColor = netoDisplay >= 0 ? '#00A76F' : '#FF5630';

    return (
      <Card sx={{ p: 3 }}>
        {/* Header: balance neto + stats */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.5 }}>
              Balance neto · {mesName}
            </Typography>
            <Typography variant="h3" sx={{ color: netColor, letterSpacing: '-1px' }}>
              {netoDisplay >= 0 ? '+' : ''}{formatMoney(netoDisplay)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
              Tasa ahorro
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: m.tasaAhorro >= 0.1 ? '#22C55E' : '#FF5630' }}>
              {(m.tasaAhorro * 100).toFixed(0)}%
            </Typography>
          </Box>
        </Box>

        {/* Ingresos / Egresos / TC pills */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
          {[
            { label: '↑ Ingresos',   value: m.ing,    color: '#00A76F', bg: alpha('#00A76F', 0.1) },
            { label: '↓ Cash gasto', value: m.egCash, color: '#FF5630', bg: alpha('#FF5630', 0.08) },
          ].map(s => (
            <Box key={s.label} sx={{ flex: 1, px: 2, py: 1.25, borderRadius: 2, bgcolor: s.bg, border: '1px solid', borderColor: alpha(s.color, 0.2) }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: s.color, mb: 0.25 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: s.color }}>{formatMoneyShort(s.value)}</Typography>
            </Box>
          ))}
        </Box>
        {/* TC debt indicator */}
        {m.tcEg > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, mb: 2.5, borderRadius: 2, bgcolor: alpha('#9C27B0', 0.08), border: '1px solid', borderColor: alpha('#9C27B0', 0.2) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 16 }}>💳</Typography>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#CE93D8', mb: 0 }}>Deuda T.C (pendiente de pago)</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>No afecta tu cash hasta que la pagues</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#CE93D8' }}>{formatMoneyShort(m.tcEg)}</Typography>
          </Box>
        )}

        {/* KPIs secundarios */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          {[
            { label: 'Fijos',    value: formatMoneyShort(m.fijos), color: '#00B8D9' },
            { label: 'Variables', value: formatMoneyShort(m.vars),  color: '#FFAB00' },
          ].map(k => (
            <Box key={k.label} sx={{ flex: 1, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: alpha('#919EAB', 0.06), border: '1px solid', borderColor: alpha('#919EAB', 0.1) }}>
              <Typography sx={{ fontSize: 10, color: 'text.disabled', fontWeight: 600, mb: 0.25 }}>{k.label}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</Typography>
            </Box>
          ))}
        </Box>

        {/* ── Donut: egresos por categoría ── */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.7px', mt: 3, mb: 1.5 }}>
          Egresos por categoría
        </Typography>
        {donutData.length > 0 ? (() => {
          const total = donutData.reduce((s, d) => s + d.value, 0);
          const COLORS = donutData.map(({ name }) => CAT_COLORS[name] || '#919EAB');
          return (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(145,158,171,0.2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(val, name) => [formatMoney(val), name]}
                />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(name, entry) => (
                    <span style={{ color: '#919EAB', fontSize: 11 }}>
                      {CAT_ICONS[name] || '📦'} {name} · {((entry.payload.value / total) * 100).toFixed(0)}%
                    </span>
                  )}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          );
        })() : (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.disabled" variant="body2">Sin egresos este mes</Typography>
          </Box>
        )}
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════
  // 2. BALANCE STATISTICS (BankingBalanceStatistics style)
  // ══════════════════════════════════════════════════════════
  const BalanceStatistics = () => {
    const d = monthlyBar.monthly;
    const barOpts = chartBase({
      colors: ['#00A76F', '#FFAB00', '#00B8D9'],
      stroke: { width: 2, colors: ['transparent'] },
      xaxis: { categories: d.cats, labels: { style: { fontSize: '10px', colors: '#919EAB' } } },
      yaxis: { labels: { formatter: v => formatMoneyShort(v), style: { colors: '#919EAB' } } },
      tooltip: { y: { formatter: v => formatMoney(v) } },
      legend: { show: true, position: 'top', labels: { colors: '#fff' } },
    });

    const legends = [
      { name: 'Ingresos', color: '#00A76F', val: formatMoneyShort(m.ing) },
      { name: 'Egresos',  color: '#FFAB00', val: formatMoneyShort(m.eg)  },
      { name: 'Ahorro',   color: '#00B8D9', val: formatMoneyShort(Math.max(0, m.netoCash)) },
    ];

    return (
      <Card>
        <CardHeader
          title="Estadísticas de balance"
          subheader="Evolución mensual de tus finanzas"
          action={
            <Tabs value={tabStats} onChange={(_, v) => setTabStats(v)} sx={{ minHeight: 32, '& .MuiTabs-root': { p: 0.5 } }}>
              <Tab label="Mensual" sx={{ fontSize: 12, minHeight: 32, py: 0.5 }} />
              <Tab label="Semanal" sx={{ fontSize: 12, minHeight: 32, py: 0.5 }} />
            </Tabs>
          }
          sx={{ pb: 0 }}
        />

        {/* Legends */}
        <Box sx={{ px: 3, pt: 2, pb: 1, display: 'flex', gap: 3 }}>
          {legends.map(l => (
            <Box key={l.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: l.color, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">{l.name}</Typography>
                <Typography variant="subtitle2">{l.val}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <ReactApexChart
          type="bar" height={280}
          series={[{ name: 'Ingresos', data: d.ing }, { name: 'Egresos', data: d.eg }, { name: 'Ahorro', data: allMetrics.map(mt => Math.max(0, mt.netoCash)) }]}
          options={barOpts}
        />
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════
  // 3. EXPENSES CATEGORIES (BankingExpensesCategories style)
  // ══════════════════════════════════════════════════════════
  const ExpensesCategories = () => {
    const total = catData.reduce((s, [, v]) => s + v, 0) || 1;
    const polarOpts = chartBase({
      colors: catData.map(([c]) => CAT_COLORS[c] || '#919EAB'),
      labels: catData.map(([c]) => c),
      legend: { show: true, position: 'bottom', labels: { colors: '#fff' } },
      fill: { opacity: 0.9 },
      stroke: { width: 0 },
      plotOptions: { polarArea: { rings: { strokeColor: 'rgba(145,158,171,0.24)' }, spokes: { connectorColors: 'rgba(145,158,171,0.24)' } } },
      tooltip: { y: { formatter: v => formatMoney(v) } },
    });

    return (
      <Card>
        <CardHeader title="Gastos por categoría" subheader={`${catData.length} categorías · ${formatMoney(total)} total`} />

        <Box sx={{ px: 3, pb: 1 }}>
          {catData.length > 0
            ? <ReactApexChart type="polarArea" height={260} series={catData.map(([, v]) => v)} options={polarOpts} />
            : <Box sx={{ py: 5, textAlign: 'center' }}><Typography color="text.secondary" variant="body2">Sin egresos este mes</Typography></Box>
          }
        </Box>

        {/* Leyenda custom */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, px: 3, pb: 2 }}>
          {catData.slice(0, 6).map(([cat, val]) => (
            <Box key={cat} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px dashed', borderColor: 'divider', '&:nth-of-type(odd)': { pr: 2 }, '&:nth-of-type(even)': { pl: 2, borderLeft: '1px dashed', borderLeftColor: 'divider' } }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: CAT_COLORS[cat] || '#919EAB', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatMoneyShort(val)}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{(val / total * 100).toFixed(0)}%</Typography>
            </Box>
          ))}
        </Box>

        <Divider />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center' }}>
          <Box sx={{ py: 2, borderRight: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" display="block">Categorías</Typography>
            <Typography variant="h4">{catData.length}</Typography>
          </Box>
          <Box sx={{ py: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
            <Typography variant="h4">{formatMoneyShort(total)}</Typography>
          </Box>
        </Box>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════
  // 4. RECENT TRANSACTIONS (BankingRecentTransitions style)
  // ══════════════════════════════════════════════════════════
  const RecentTransactions = () => {
    const recent = txsMes.slice(0, 6);
    return (
      <Card>
        <CardHeader
          title="Transacciones recientes"
          action={<Button size="small" variant="soft" color="inherit" sx={{ fontSize: 12 }}>Ver todo</Button>}
        />

        <Box sx={{ pb: 1 }}>
          {recent.map((t, i) => {
            const esIng = t.movimiento === 'Ingreso';
            return (
              <Box key={t.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5 }}>
                  {/* Avatar con badge */}
                  <Box sx={{ position: 'relative', flexShrink: 0 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: alpha('#919EAB', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {CAT_ICONS[t.categoria] || '💳'}
                    </Box>
                    <Box sx={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', bgcolor: esIng ? 'success.main' : 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, border: '2px solid', borderColor: 'background.paper' }}>
                      {esIng ? '↙' : '↗'}
                    </Box>
                  </Box>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>{t.concepto}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.categoria} · {new Date(t.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      {t.cuenta ? ` · ${t.cuenta}` : ''}
                    </Typography>
                  </Box>

                  {/* Monto + status */}
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography variant="subtitle2" sx={{ color: esIng ? 'success.main' : 'error.main' }}>
                      {esIng ? '+' : '-'}{formatMoneyShort(Math.abs(t.total))}
                    </Typography>
                    <StatusChip color={esIng ? 'success' : t.tipo === 'Fijo' ? 'info' : 'warning'}>
                      {esIng ? 'Ingreso' : t.tipo === 'Fijo' ? 'Fijo' : 'Variable'}
                    </StatusChip>
                  </Box>
                </Box>
                {i < recent.length - 1 && <Divider sx={{ mx: 3 }} />}
              </Box>
            );
          })}
        </Box>

        <Divider />
        <Box sx={{ p: 2, textAlign: 'right' }}>
          <Button size="small" color="inherit" sx={{ fontWeight: 600, opacity: 0.72 }}>Ver historial completo →</Button>
        </Box>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════
  // 5. MES TABLE + ESTADO (sidebar card)
  // ══════════════════════════════════════════════════════════
  const MesResumen = () => (
    <Card>
      <CardHeader title="Resumen anual" subheader="Todos los meses de 2026" />
      <Box sx={{ pb: 1 }}>
        {MESES.map((m2, i) => {
          const met = computeMetrics(state.transacciones, m2);
          const ok = met.hasData && met.tasaAhorro >= 0.1;
          const warn = met.hasData && met.tasaAhorro < 0.1;
          return (
            <Box key={m2} onClick={() => setMes(m2)} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.25, cursor: 'pointer', bgcolor: m2 === mes ? alpha('#00A76F', 0.08) : 'transparent', '&:hover': { bgcolor: alpha('#919EAB', 0.08) } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, width: 32, color: m2 === mes ? 'primary.main' : 'text.secondary' }}>{MES_NAMES[i]}</Typography>
              <Box sx={{ flex: 1 }}>
                {met.hasData ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{formatMoneyShort(met.egCash)} / {formatMoneyShort(met.ing)}</Typography>
                      <Typography variant="caption" sx={{ color: met.netoCash >= 0 ? 'success.main' : 'error.main' }}>{formatMoneyShort(met.netoCash)}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={Math.min((met.egCash / (met.ing || 1)) * 100, 100)}
                      sx={{ height: 4, bgcolor: alpha('#919EAB', 0.16), '& .MuiLinearProgress-bar': { bgcolor: ok ? 'success.main' : warn ? 'warning.main' : 'error.main' } }} />
                  </>
                ) : (
                  <Typography variant="caption" color="text.disabled">Sin datos</Typography>
                )}
              </Box>
              <Box sx={{ fontSize: 14, flexShrink: 0 }}>{ok ? '✅' : warn ? '⚠️' : met.hasData ? '❌' : '·'}</Box>
            </Box>
          );
        })}
      </Box>
    </Card>
  );

  // ══════════════════════════════════════════════════════════
  // 6. PRESUPUESTO CARD (sidebar)
  // ══════════════════════════════════════════════════════════
  const PresupuestoCard = () => {
    const cats = Object.entries(state.presupuestos[mes] || {}).filter(([, v]) => v > 0);
    return (
      <Card>
        <CardHeader
          title="Presupuesto vs Real"
          subheader={`${mesName} 2026`}
        />
        <Box sx={{ px: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {cats.map(([cat, lim]) => {
            const gastado = m.byCat[cat] || 0;
            const pct = Math.min((gastado / lim) * 100, 100);
            const color = pct >= 100 ? 'error.main' : pct >= 80 ? 'warning.main' : 'success.main';
            return (
              <Box key={cat}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography sx={{ fontSize: 14 }}>{CAT_ICONS[cat] || '💳'}</Typography>
                    <Typography variant="subtitle2">{cat}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">{formatMoneyShort(gastado)} / {formatMoneyShort(lim)}</Typography>
                    <StatusChip color={pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success'}>{Math.round(pct)}%</StatusChip>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={pct}
                  sx={{ height: 6, bgcolor: alpha('#919EAB', 0.16), '& .MuiLinearProgress-bar': { bgcolor: color } }} />
              </Box>
            );
          })}
        </Box>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════
  // 7. EXPORT CARD
  // ══════════════════════════════════════════════════════════
  const ExportCard = () => {
    const rows = [
      { icon: '📊', bg: alpha('#22C55E', 0.12), color: '#22C55E', name: 'Transacciones (CSV)', desc: 'Exportar para Google Sheets', action: () => exportarCSV('transacciones') },
      { icon: '🛒', bg: alpha('#FFAB00', 0.12), color: '#FFAB00', name: 'Mercado (CSV)',        desc: 'Hoja de compras del mes',   action: () => exportarCSV('mercado') },
      { icon: '📋', bg: alpha('#00B8D9', 0.12), color: '#00B8D9', name: 'Copiar JSON',          desc: 'Todo el mes al portapapeles', action: () => { const data = { transacciones: state.transacciones.filter(t => t.mes === mesExport), mercado: state.mercado.filter(i => i.mes === mesExport) }; navigator.clipboard.writeText(JSON.stringify(data, null, 2)); showToast('✓ JSON copiado'); } },
    ];
    return (
      <Card>
        <CardHeader title="Exportar datos" subheader="Descarga o comparte tu información"
          action={<Box sx={{ pt: 0.5 }}><MesPills mesActivo={mesExport} onChange={setMesExport} sx={{ px: 0, pb: 0 }} /></Box>}
          sx={{ pb: 1 }} />
        <Box sx={{ pb: 2 }}>
          {rows.map((row, i) => (
            <Box key={i}>
              <Box onClick={row.action} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: alpha('#919EAB', 0.08) } }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, bgcolor: row.bg }}>{row.icon}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">{row.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.desc}</Typography>
                </Box>
                <Typography color="text.secondary" sx={{ fontSize: 18 }}>›</Typography>
              </Box>
              {i < rows.length - 1 && <Divider sx={{ mx: 3 }} />}
            </Box>
          ))}
        </Box>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <Box sx={{ pb: 3 }}>
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 1.5 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">{mesName} 2026</Typography>
      </Box>

      <MesPills mesActivo={mes} onChange={setMes} />

      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <OverviewCard />
        <BalanceStatistics />
        <ExpensesCategories />
        <RecentTransactions />
        <MesResumen />
        <PresupuestoCard />
        <ExportCard />
      </Box>

    </Box>
  );
}

export default function Dashboard() {
  return <ErrorBoundary><DashboardInner /></ErrorBoundary>;
}
