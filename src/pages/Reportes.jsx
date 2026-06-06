import { useState, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import ReactApexChart from 'react-apexcharts';
import { useFinanzas } from 'src/context/FinanzasContext';
import { computeMetrics } from 'src/utils/metrics';
import { computeIngresoStats } from 'src/utils/cashflow';
import { formatMoney, formatMoneyShort, getMesActual } from 'src/utils/format';
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

const PERIODOS = ['Semana', 'Mes', 'Trimestre', 'Año'];

function chartBase(overrides = {}) {
  return {
    chart: { background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "'Inter Variable', sans-serif", foreColor: '#919EAB', animations: { speed: 250 } },
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

function KpiCard({ label, value, color, sub }) {
  return (
    <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 1.75 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: T2, mt: 0.3 }}>{sub}</Typography>}
    </Box>
  );
}

function CatBar({ cat, val, total, color }) {
  const pct = total > 0 ? (val / total) * 100 : 0;
  return (
    <Box sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.375 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: 14 }}>{CAT_ICONS[cat] || '·'}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{cat}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontSize: 11, color: T2 }}>{pct.toFixed(0)}%</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T1 }}>{formatMoneyShort(val)}</Typography>
        </Box>
      </Box>
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </Box>
    </Box>
  );
}

// ── Vista Semanal ──────────────────────────────────────────────
function VistaSemanaTx({ txs }) {
  const hoy = new Date();
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const porDia = useMemo(() => {
    const m = {};
    dias.forEach(d => { m[d] = { ing: 0, eg: 0, txs: [] }; });
    txs.filter(t => !t.esFuturo && t.estado !== 'pendiente').forEach(t => {
      const d = t.fecha?.split('T')[0];
      if (m[d]) {
        if (t.movimiento === 'Ingreso') m[d].ing += Math.abs(t.total);
        else                            m[d].eg  += Math.abs(t.total);
        m[d].txs.push(t);
      }
    });
    return m;
  }, [txs]);

  const totalIng = dias.reduce((s, d) => s + porDia[d].ing, 0);
  const totalEg  = dias.reduce((s, d) => s + porDia[d].eg,  0);
  const neto     = totalIng - totalEg;

  const ingArr = dias.map(d => porDia[d].ing);
  const egArr  = dias.map(d => porDia[d].eg);
  const labels = dias.map(d => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  });

  const hayDatos = totalIng > 0 || totalEg > 0;

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 3 }}>
        <KpiCard label="Ingresos"  value={formatMoneyShort(totalIng)} color={GREEN} />
        <KpiCard label="Egresos"   value={formatMoneyShort(totalEg)}  color={RED}   />
        <KpiCard label="Neto"      value={(neto >= 0 ? '+' : '') + formatMoneyShort(neto)} color={neto >= 0 ? GREEN : RED} />
      </Box>

      {hayDatos ? (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden', mb: 3 }}>
          <Typography sx={{ px: 2, fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
            Día a día — últimos 7 días
          </Typography>
          <ReactApexChart
            type="bar" height={160}
            series={[
              { name: 'Ingresos', data: ingArr },
              { name: 'Egresos',  data: egArr  },
            ]}
            options={chartBase({
              colors: [GREEN, RED],
              stroke: { width: 0 },
              plotOptions: { bar: { borderRadius: 3, columnWidth: '55%', borderRadiusApplication: 'end' } },
              xaxis: { categories: labels, labels: { style: { fontSize: '9px' } } },
              yaxis: { labels: { formatter: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v, style: { colors: '#919EAB', fontSize: '10px' } } },
              tooltip: { theme: 'dark', y: { formatter: v => formatMoney(v) } },
            })}
          />
        </Box>
      ) : (
        <Box sx={{ bgcolor: CARD, borderRadius: '12px', p: 3, textAlign: 'center', border: `1px solid ${BORDER}`, mb: 3 }}>
          <Typography sx={{ fontSize: 14, color: T2 }}>Sin movimientos esta semana</Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Vista Mensual ──────────────────────────────────────────────
function VistaMensual({ state, mes }) {
  const m       = computeMetrics(state.transacciones, mes);
  const mesIdx  = MESES.indexOf(mes);
  const mesName = MES_NAMES[mesIdx];

  const catData = Object.entries(m.byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const catTotal = catData.reduce((s, [, v]) => s + v, 0) || 1;

  const ingData = Object.entries(m.byIngresoCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const ingTotal = ingData.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
        <KpiCard label="Ingresos"     value={formatMoneyShort(m.ing)}        color={GREEN} sub={`${mesName}`} />
        <KpiCard label="Egresos"      value={formatMoneyShort(m.eg)}         color={RED} />
        <KpiCard label="Neto"         value={(m.neto >= 0 ? '+' : '') + formatMoneyShort(m.neto)} color={m.neto >= 0 ? GREEN : RED} />
        <KpiCard label="Tasa ahorro"  value={`${(m.tasaAhorro * 100).toFixed(0)}%`} color={m.tasaAhorro >= 0.2 ? GREEN : AMBER}
          sub={`Ahorro ${formatMoneyShort(m.ahorroReal)}`} />
      </Box>

      {catData.length > 0 && (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, px: 2, py: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
            Gastos por categoría
          </Typography>
          {catData.map(([cat, val]) => <CatBar key={cat} cat={cat} val={val} total={catTotal} color={T1} />)}
        </Box>
      )}

      {ingData.length > 0 && (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, px: 2, py: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
            Ingresos por categoría
          </Typography>
          {ingData.map(([cat, val]) => <CatBar key={cat} cat={cat} val={val} total={ingTotal} color={GREEN} />)}
        </Box>
      )}

      {!m.hasData && (
        <Box sx={{ bgcolor: CARD, borderRadius: '12px', p: 3, textAlign: 'center', border: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 14, color: T2 }}>Sin datos para {mesName}</Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Vista Trimestral ───────────────────────────────────────────
function VistaTrimestral({ state }) {
  const mesActual = getMesActual();
  const mesIdx    = MESES.indexOf(mesActual);
  const meses3    = [MESES[mesIdx - 2], MESES[mesIdx - 1], MESES[mesIdx]].filter(Boolean);

  const metricas  = meses3.map(m => ({ mes: m, ...computeMetrics(state.transacciones, m) }));
  const totIng    = metricas.reduce((s, mt) => s + mt.ing, 0);
  const totEg     = metricas.reduce((s, mt) => s + mt.eg, 0);
  const totNeto   = totIng - totEg;
  const totAhorro = metricas.reduce((s, mt) => s + mt.ahorroReal, 0);

  // Categorías acumuladas del trimestre
  const catAcum = {};
  metricas.forEach(mt => {
    Object.entries(mt.byCat).forEach(([c, v]) => { catAcum[c] = (catAcum[c] || 0) + v; });
  });
  const catData  = Object.entries(catAcum).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const catTotal = catData.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
        <KpiCard label="Ingresos 3m"  value={formatMoneyShort(totIng)}   color={GREEN} sub="Acumulado" />
        <KpiCard label="Egresos 3m"   value={formatMoneyShort(totEg)}    color={RED} />
        <KpiCard label="Neto 3m"      value={(totNeto >= 0 ? '+' : '') + formatMoneyShort(totNeto)} color={totNeto >= 0 ? GREEN : RED} />
        <KpiCard label="Ahorro 3m"    value={formatMoneyShort(totAhorro)} color={GREEN}
          sub={totIng > 0 ? `${((totAhorro/totIng)*100).toFixed(0)}% del ingreso` : ''} />
      </Box>

      {/* Comparativa mensual */}
      <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden', mb: 3 }}>
        <Typography sx={{ px: 2, fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
          Ingresos vs egresos
        </Typography>
        <ReactApexChart
          type="bar" height={160}
          series={[
            { name: 'Ingresos', data: metricas.map(mt => mt.ing) },
            { name: 'Egresos',  data: metricas.map(mt => mt.eg)  },
          ]}
          options={chartBase({
            colors: [GREEN, RED],
            stroke: { width: 0 },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', borderRadiusApplication: 'end' } },
            xaxis: { categories: meses3.map(m => MES_NAMES[MESES.indexOf(m)]), labels: { style: { fontSize: '11px' } } },
            yaxis: { labels: { formatter: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v, style: { colors: '#919EAB', fontSize: '10px' } } },
            tooltip: { theme: 'dark', y: { formatter: v => formatMoney(v) } },
          })}
        />
      </Box>

      {catData.length > 0 && (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, px: 2, py: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
            Top gastos del trimestre
          </Typography>
          {catData.map(([cat, val]) => <CatBar key={cat} cat={cat} val={val} total={catTotal} color={T1} />)}
        </Box>
      )}
    </Box>
  );
}

// ── Vista Anual ────────────────────────────────────────────────
function VistaAnual({ state }) {
  const allM    = MESES.map(m => computeMetrics(state.transacciones, m));
  const conDatos = allM.filter(m => m.hasData);

  const totIng   = conDatos.reduce((s, m) => s + m.ing, 0);
  const totEg    = conDatos.reduce((s, m) => s + m.eg, 0);
  const totNeto  = totIng - totEg;
  const tasaMed  = totIng > 0 ? conDatos.reduce((s, m) => s + m.tasaAhorro, 0) / (conDatos.length || 1) : 0;

  const ingArr  = allM.map(m => m.ing);
  const egArr   = allM.map(m => m.eg);

  // Saldo acumulado
  const saldoAcum = allM.reduce((acc, m, i) => {
    acc.push(Math.round((acc[i - 1] || 0) + m.neto));
    return acc;
  }, []);

  // Categorías acumuladas anual
  const catAcum = {};
  allM.forEach(m => {
    Object.entries(m.byCat).forEach(([c, v]) => { catAcum[c] = (catAcum[c] || 0) + v; });
  });
  const catData  = Object.entries(catAcum).filter(([,v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const catTotal = catData.reduce((s, [, v]) => s + v, 0) || 1;

  const mejorMes = conDatos.reduce((best, m, i) => m.neto > (best?.neto ?? -Infinity) ? m : best, null);
  const peorMes  = conDatos.reduce((worst, m) => m.neto < (worst?.neto ?? Infinity) ? m : worst, null);

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
        <KpiCard label="Ingresos año"  value={formatMoneyShort(totIng)}  color={GREEN} sub={`${conDatos.length} meses`} />
        <KpiCard label="Egresos año"   value={formatMoneyShort(totEg)}   color={RED} />
        <KpiCard label="Neto año"      value={(totNeto >= 0 ? '+' : '') + formatMoneyShort(totNeto)} color={totNeto >= 0 ? GREEN : RED} />
        <KpiCard label="Tasa ahorro"   value={`${(tasaMed * 100).toFixed(0)}%`} color={tasaMed >= 0.2 ? GREEN : AMBER} sub="Promedio mensual" />
      </Box>

      {/* Mejor / peor mes */}
      {mejorMes && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
          <Box sx={{ bgcolor: 'rgba(0,167,111,0.06)', borderRadius: '12px', p: 1.75, border: '1px solid rgba(0,167,111,0.2)' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', mb: 0.25 }}>Mejor mes</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: T1 }}>{MES_NAMES[MESES.indexOf(MESES.find((_, i) => allM[i] === mejorMes))]}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>+{formatMoneyShort(mejorMes.neto)}</Typography>
          </Box>
          {peorMes && peorMes !== mejorMes && (
            <Box sx={{ bgcolor: 'rgba(220,38,38,0.04)', borderRadius: '12px', p: 1.75, border: '1px solid rgba(220,38,38,0.15)' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', mb: 0.25 }}>Mes más bajo</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T1 }}>{MES_NAMES[MESES.indexOf(MESES.find((_, i) => allM[i] === peorMes))]}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: peorMes.neto >= 0 ? T2 : RED }}>{peorMes.neto >= 0 ? '+' : ''}{formatMoneyShort(peorMes.neto)}</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Gráfica anual */}
      {conDatos.length > 0 && (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden', mb: 3 }}>
          <Typography sx={{ px: 2, fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
            Ingresos vs egresos
          </Typography>
          <ReactApexChart
            type="bar" height={160}
            series={[
              { name: 'Ingresos', data: ingArr },
              { name: 'Egresos',  data: egArr  },
            ]}
            options={chartBase({
              colors: [GREEN, RED],
              stroke: { width: 0 },
              plotOptions: { bar: { borderRadius: 3, columnWidth: '60%', borderRadiusApplication: 'end' } },
              xaxis: { categories: MES_NAMES, labels: { style: { fontSize: '9px' } } },
              yaxis: { labels: { formatter: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v, style: { colors: '#919EAB', fontSize: '10px' } } },
              tooltip: { theme: 'dark', y: { formatter: v => formatMoney(v) } },
            })}
          />
        </Box>
      )}

      {/* Saldo acumulado */}
      {conDatos.length > 1 && (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, pt: 2, pb: 0, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ px: 2, mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saldo acumulado</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: saldoAcum[saldoAcum.length - 1] >= 0 ? GREEN : RED, letterSpacing: '-0.4px' }}>
              {formatMoneyShort(saldoAcum[saldoAcum.length - 1])}
            </Typography>
          </Box>
          <ReactApexChart
            type="area" height={130}
            series={[{ name: 'Saldo', data: saldoAcum }]}
            options={chartBase({
              colors: [saldoAcum[saldoAcum.length - 1] >= 0 ? GREEN : RED],
              fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
              xaxis: { categories: MES_NAMES, labels: { style: { fontSize: '9px' } } },
              yaxis: { labels: { formatter: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v, style: { colors: '#919EAB', fontSize: '10px' } } },
              tooltip: { theme: 'dark', y: { formatter: v => formatMoney(v) } },
            })}
          />
        </Box>
      )}

      {catData.length > 0 && (
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, px: 2, py: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
            Top gastos del año
          </Typography>
          {catData.map(([cat, val]) => <CatBar key={cat} cat={cat} val={val} total={catTotal} color={T1} />)}
        </Box>
      )}
    </Box>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function Reportes() {
  const { state, mesActivo, setMesActivo } = useFinanzas();
  const [periodo, setPeriodo] = useState(1); // 0=Semana 1=Mes 2=Trimestre 3=Año
  const txs = state.transacciones || [];

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Reportes</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Análisis financiero por período</Typography>
        </Box>

        {/* Tabs de período */}
        <Box sx={{ display: 'flex', gap: 0, p: '3px', mb: 2.5, borderRadius: '10px', bgcolor: '#EBEBEB' }}>
          {PERIODOS.map((l, i) => (
            <Box key={l} onClick={() => setPeriodo(i)} sx={{
              flex: 1, py: 0.625, borderRadius: '8px', textAlign: 'center',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              bgcolor: periodo === i ? '#fff' : 'transparent',
              color:   periodo === i ? T1 : T2,
              boxShadow: periodo === i ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{l}</Box>
          ))}
        </Box>

        {/* Selector de mes (solo en vista Mes) */}
        {periodo === 1 && (
          <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 2.5, pb: 0.5 }}>
            {MESES.map((m, i) => {
              const met = computeMetrics(txs, m);
              return (
                <Box key={m} onClick={() => setMesActivo(m)} sx={{
                  px: 1.75, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
                  borderColor: m === mesActivo ? T1 : BORDER,
                  bgcolor:     m === mesActivo ? T1 : CARD,
                  color:       m === mesActivo ? '#fff' : met.hasData ? T1 : T2,
                }}>
                  {MES_NAMES[i]}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Contenido */}
        {periodo === 0 && <VistaSemanaTx txs={txs} />}
        {periodo === 1 && <VistaMensual state={state} mes={mesActivo} />}
        {periodo === 2 && <VistaTrimestral state={state} />}
        {periodo === 3 && <VistaAnual state={state} />}

      </Box>
    </Box>
  );
}
