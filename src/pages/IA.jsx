import { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFinanzas } from 'src/context/FinanzasContext';
import { computeMetrics } from 'src/utils/metrics';
import { computeDisponibleHoy, computePorCobrar, computeProximosPagos, computeIngresoStats, computeAlertas } from 'src/utils/cashflow';
import { formatMoney, formatMoneyShort, getMesActual } from 'src/utils/format';
import { MESES, MES_NAMES } from 'src/constants';

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const BORDER  = '#E5E7EB'

const SUGERENCIAS = [
  { label: '📊 Análisis completo',  prompt: null },
  { label: '💸 ¿Dónde gasto más?',  prompt: '¿En qué estoy gastando más este mes? Dame el top 3 con montos exactos y dime si hay alguna categoría fuera de lo normal.' },
  { label: '💧 Liquidez',           prompt: 'Analiza mi liquidez actual: ¿cuánto tengo disponible hoy, qué cobros me faltan y qué pagos se vienen? ¿Hay riesgo de quedarme corto?' },
  { label: '📈 Tendencia ingresos', prompt: 'Analiza la tendencia de mis ingresos de los últimos meses. ¿Estoy creciendo, estable o bajando? ¿Qué recomiendas?' },
  { label: '✂️ Recortar gastos',    prompt: '¿En qué puedo recortar gastos este mes sin afectar mi calidad de vida? Dame 3 acciones concretas con montos estimados.' },
  { label: '📅 Próximo mes',        prompt: 'Con base en mi historial, ¿cómo debería planear el próximo mes? ¿Cuánto esperar de ingresos, qué presupuestar y qué metas poner?' },
  { label: '🔄 Comparar meses',     prompt: 'Compara mis últimos 3 meses: ingresos, egresos, tasa de ahorro. ¿Estoy mejorando o empeorando? ¿Qué cambió?' },
  { label: '🎯 Metas ahorro',       prompt: '¿Voy bien con mis metas de ahorro? ¿A este ritmo cuándo las cumplo? Dame un plan de acción si estoy atrasado.' },
];


function buildContext(state, carryOver = 0) {
  const mes     = getMesActual();
  const m       = computeMetrics(state.transacciones, mes);
  const mesName = MES_NAMES[MESES.indexOf(mes)];
  const txs     = state.transacciones || [];

  const mesesConDatos = MESES.filter(ms => computeMetrics(txs, ms).hasData);
  const resumenMeses  = mesesConDatos.map(ms => {
    const met = computeMetrics(txs, ms);
    return `${MES_NAMES[MESES.indexOf(ms)]}: Ing ${formatMoneyShort(met.ing)}, Eg ${formatMoneyShort(met.eg)}, Neto ${formatMoneyShort(met.neto)}, Ahorro ${(met.tasaAhorro * 100).toFixed(1)}%`;
  }).join('\n');

  const catsByCat    = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `  ${c}: ${formatMoney(v)}`).join('\n');
  const presupMes    = state.presupuestos?.[mes] || {};
  const presupStatus = Object.entries(presupMes).filter(([, lim]) => lim > 0).map(([c, lim]) => {
    const g   = m.byCat[c] || 0;
    const pct = lim > 0 ? Math.round(g / lim * 100) : 0;
    return `  ${c}: ${formatMoneyShort(g)} / ${formatMoneyShort(lim)} (${pct}%)`;
  }).join('\n');

  const metaMes  = state.metas[mes] || { ahorro: 0, inversion: 0 };
  const metaTotal = (metaMes.ahorro || 0) + (metaMes.inversion || 0);
  const realMeta  = m.ahorroReal + m.invReal;

  // Flujo de caja
  const disponible    = computeDisponibleHoy(txs, mes, carryOver);
  const porCobrar     = computePorCobrar(txs);
  const proximosPagos = computeProximosPagos(txs, 30);
  const proyectado30d = disponible + porCobrar.total - proximosPagos.total;
  const ingStats      = computeIngresoStats(txs, mes);
  const alertas       = computeAlertas(txs, mes, carryOver);

  const alertasStr = alertas.length > 0
    ? alertas.map(a => `  ${a.icono} ${a.msg}${a.monto ? ` (${formatMoneyShort(a.monto)})` : ''}`).join('\n')
    : '  Sin alertas activas';

  const tendenciaLabels = { crecimiento: 'Creciendo ↑', estabilidad: 'Estable →', caida: 'Bajando ↓', insuficiente: 'Sin datos suficientes' };

  return `DATOS FINANCIEROS — ${mesName} 2026

LIQUIDEZ ACTUAL:
- Disponible hoy: ${formatMoney(disponible)}
- Por cobrar (pendiente): ${formatMoneyShort(porCobrar.total)}${porCobrar.totalVencido > 0 ? ` (${formatMoneyShort(porCobrar.totalVencido)} VENCIDO)` : ''}
- Pagos programados 30d: ${formatMoneyShort(proximosPagos.total)}
- Proyectado 30 días: ${formatMoney(proyectado30d)}

MES ACTUAL (${mesName}):
- Ingresos recibidos: ${formatMoney(m.ing)}
- Egresos: ${formatMoney(m.eg)}
- Neto: ${formatMoney(m.neto)}
- Gastos fijos: ${formatMoneyShort(m.fijos)} | Variables: ${formatMoneyShort(m.vars)}
- Tasa de ahorro: ${(m.tasaAhorro * 100).toFixed(1)}%
- Ahorro real: ${formatMoneyShort(m.ahorroReal)} | Inversión: ${formatMoneyShort(m.invReal)}

TENDENCIA DE INGRESOS:
- Promedio 3 meses: ${ingStats.prom3 > 0 ? formatMoneyShort(ingStats.prom3) : 'sin datos'}
- Promedio 6 meses: ${ingStats.prom6 > 0 ? formatMoneyShort(ingStats.prom6) : 'sin datos'}
- Tendencia: ${tendenciaLabels[ingStats.tendencia] || 'Sin datos'}
- Rango esperado: ${formatMoneyShort(ingStats.minEsperado)} – ${formatMoneyShort(ingStats.optimistaEsperado)}

GASTOS POR CATEGORÍA (${mesName}):
${catsByCat || '  Sin egresos aún'}

PRESUPUESTO VS REAL (${mesName}):
${presupStatus || '  Sin presupuesto configurado'}

META DE AHORRO (${mesName}): ${realMeta >= 0 ? formatMoneyShort(realMeta) : '$0'} de ${formatMoneyShort(metaTotal)} (${metaTotal > 0 ? Math.round(realMeta / metaTotal * 100) : 0}%)

ALERTAS ACTIVAS:
${alertasStr}

HISTORIAL MENSUAL:
${resumenMeses || 'Sin historial aún'}

NEQUI: Ing ${formatMoneyShort(m.nequiIng)} | Eg ${formatMoneyShort(m.nequiEg)}
T.C (cargos): ${formatMoneyShort(m.tcEg)}`;
}

export default function IA() {
  const { state, getCarryOver } = useFinanzas();
  const carryOver = getCarryOver(getMesActual());

  // Insights automáticos (sin API)
  const insights = useMemo(() => {
    const mes   = getMesActual();
    const m     = computeMetrics(state.transacciones || [], mes);
    const txs   = state.transacciones || [];
    const stats = computeIngresoStats(txs, mes);
    const cobra = computePorCobrar(txs);
    const items = [];

    if (cobra.totalVencido > 0)
      items.push({ tipo: 'alerta', texto: `Tienes ${formatMoneyShort(cobra.totalVencido)} en cobros vencidos sin recibir.` });

    if (stats.tendencia === 'caida' && stats.mesesConDatos >= 2)
      items.push({ tipo: 'alerta', texto: `Tus ingresos llevan 2 meses bajando. Promedio 3m: ${formatMoneyShort(stats.prom3)}.` });

    if (m.tasaAhorro > 0 && m.tasaAhorro < 0.1 && m.hasData)
      items.push({ tipo: 'alerta', texto: `Tasa de ahorro este mes: ${(m.tasaAhorro*100).toFixed(0)}%. Tu meta habitual es ≥20%.` });

    if (m.tasaAhorro >= 0.2)
      items.push({ tipo: 'positivo', texto: `Tasa de ahorro este mes: ${(m.tasaAhorro*100).toFixed(0)}%. Vas bien. ✓` });

    if (stats.tendencia === 'crecimiento' && stats.mesesConDatos >= 2)
      items.push({ tipo: 'positivo', texto: `Tus ingresos están creciendo. Último mes vs anterior: tendencia al alza. ✓` });

    const topCat = Object.entries(m.byCat).sort((a,b)=>b[1]-a[1])[0];
    if (topCat && m.eg > 0)
      items.push({ tipo: 'info', texto: `Mayor gasto: ${topCat[0]} con ${formatMoneyShort(topCat[1])} (${((topCat[1]/m.eg)*100).toFixed(0)}% del total).` });

    return items;
  }, [state.transacciones, carryOver]);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hola Dani, tengo acceso a todos tus registros. Puedo ayudarte a analizar tus gastos, revisar tus metas y darte recomendaciones personalizadas. ¿Qué quieres saber?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function enviar(promptOverride) {
    const text = (promptOverride ?? input).trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    try {
      const context = buildContext(state, carryOver);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), context }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.text || data.error || 'Error al obtener respuesta' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Verifica tu internet.' }]);
    } finally {
      setLoading(false);
    }
  }

  function analizarFinanzas() {
    const ctx = buildContext(state, carryOver);
    enviar(`Analiza mis finanzas con todos estos datos y dame un diagnóstico completo:\n\n${ctx}`);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: BG }}>

      {/* Header */}
      <Box sx={{ px: '20px', pt: 2.5, pb: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, bgcolor: BG }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Asistente IA</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Pregúntale sobre tus finanzas</Typography>
        </Box>
        <Box onClick={() => setMessages([{ role: 'assistant', content: 'Chat limpiado. ¿En qué te ayudo?' }])}
          sx={{ fontSize: 12, color: T2, cursor: 'pointer', mt: 0.5, '&:active': { opacity: 0.6 } }}>
          Limpiar
        </Box>
      </Box>

      {/* Insights automáticos */}
      {insights.length > 0 && (
        <Box sx={{ px: '20px', pb: 1, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0.625 }}>
          {insights.map((ins, i) => {
            const cfg = ins.tipo === 'alerta'
              ? { bg: '#FFF7ED', border: '#FED7AA', bar: '#F59E0B', txt: '#92400E' }
              : ins.tipo === 'positivo'
              ? { bg: 'rgba(0,167,111,0.06)', border: 'rgba(0,167,111,0.25)', bar: '#00A76F', txt: '#065F46' }
              : { bg: '#EFF6FF', border: '#BFDBFE', bar: '#3B82F6', txt: '#1E40AF' };
            return (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75,
                borderRadius: '8px', bgcolor: cfg.bg, border: `1px solid ${cfg.border}`,
                borderLeft: `3px solid ${cfg.bar}`,
              }}>
                <Typography sx={{ fontSize: 12, color: cfg.txt, lineHeight: 1.35, flex: 1 }}>{ins.texto}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Sugerencias rápidas */}
      <Box sx={{ px: '20px', pb: 1.25, display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, flexShrink: 0 }}>
        {SUGERENCIAS.map((s, i) => (
          <Box key={i} onClick={() => s.prompt ? enviar(s.prompt) : analizarFinanzas()}
            sx={{
              px: 1.5, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
              borderColor: i === 0 ? T1 : BORDER,
              bgcolor: i === 0 ? T1 : CARD,
              color: i === 0 ? '#fff' : T2,
              '&:active': { opacity: 0.8 },
            }}>
            {s.label}
          </Box>
        ))}
      </Box>

      {/* Mensajes */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: '20px', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 1.5 }}>
        {messages.map((msg, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Box sx={{
              p: 1.75, maxWidth: '88%',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              bgcolor: msg.role === 'user' ? T1 : CARD,
              border: `1px solid ${msg.role === 'user' ? T1 : BORDER}`,
              boxShadow: CARD_SH,
            }}>
              {msg.role === 'assistant' && (
                <Typography sx={{ fontSize: 10, color: GREEN, fontWeight: 700, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>DANI FIN</Typography>
              )}
              <Box sx={{
                fontSize: 14, lineHeight: 1.6, color: msg.role === 'user' ? '#fff' : T1,
                '& p': { m: 0, mb: 0.5 }, '& ul, & ol': { pl: 2 }, '& li': { mb: 0.25 },
                '& strong': { fontWeight: 700 },
                '& code': { bgcolor: '#F3F4F6', px: 0.75, py: 0.25, borderRadius: '4px', fontSize: 12, fontFamily: 'monospace', color: T1 },
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </Box>
            </Box>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Box sx={{ p: 1.75, borderRadius: '16px 16px 16px 4px', border: `1px solid ${BORDER}`, bgcolor: CARD, boxShadow: CARD_SH }}>
              <Typography sx={{ fontSize: 10, color: GREEN, fontWeight: 700, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>DANI FIN</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                {[0, 1, 2].map(j => (
                  <Box key={j} sx={{
                    width: 6, height: 6, borderRadius: '50%', bgcolor: T2,
                    animation: 'bounce 1.2s infinite', animationDelay: `${j * 0.2}s`,
                    '@keyframes bounce': { '0%,80%,100%': { transform: 'scale(0.8)', opacity: 0.5 }, '40%': { transform: 'scale(1.2)', opacity: 1 } }
                  }} />
                ))}
              </Box>
            </Box>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box sx={{ flexShrink: 0, px: '20px', py: 1.5, borderTop: `1px solid ${BORDER}`, bgcolor: CARD, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <Box component="textarea"
          placeholder="Pregunta algo sobre tus finanzas..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          disabled={loading}
          rows={1}
          sx={{
            flex: 1, resize: 'none', bgcolor: BG, border: `1px solid ${BORDER}`, borderRadius: '10px',
            px: 1.5, py: 1, fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none',
            '&:focus': { borderColor: GREEN }, lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
            '&::placeholder': { color: T2 },
          }}
        />
        <Box onClick={() => enviar()} sx={{
          width: 42, height: 42, borderRadius: '10px', flexShrink: 0, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          bgcolor: loading || !input.trim() ? '#F3F4F6' : T1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          '&:active': { opacity: 0.8 },
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={loading || !input.trim() ? T2 : '#fff'} strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </Box>
      </Box>

    </Box>
  );
}
