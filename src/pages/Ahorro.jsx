import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, alpha } from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { computeMetrics } from 'src/utils/metrics';
import { formatMoney, formatMoneyShort, formatFechaShort } from 'src/utils/format';
import { MESES, MES_NAMES } from 'src/constants';

const BG      = '#F7F7F8';
const CARD    = '#FFFFFF';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)';
const T1      = '#111318';
const T2      = '#6B7280';
const GREEN   = '#00A76F';
const BORDER  = '#E5E7EB';

function parseAmt(str) {
  const n = parseInt(String(str).replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function fmtInput(n) {
  const x = parseInt(String(n).replace(/\D/g, ''), 10);
  return isNaN(x) || x === 0 ? '' : x.toLocaleString('es-CO');
}

export default function Ahorro() {
  const navigate = useNavigate();
  const { state, mesActivo, setMesActivo, updateMeta } = useFinanzas();
  const { showSnackbar } = useSnackbar();
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput]       = useState('');

  const mes       = mesActivo;
  const mesIdx    = MESES.indexOf(mes);
  const mesNombre = MES_NAMES[mesIdx];

  // ── Ahorro real por mes = transacciones categoría "Ahorro" ──────────
  function ahorroDeMes(m) {
    const meta = state.metas?.[m] || {};
    if (meta.ahorroRegistrado != null && meta.ahorroRegistrado > 0) return meta.ahorroRegistrado;
    return computeMetrics(state.transacciones || [], m).ahorroReal;
  }

  const metaMes      = state.metas?.[mes]?.ahorro || 0;
  const ahorradoMes  = ahorroDeMes(mes);
  const pctMes       = metaMes > 0 ? Math.min(ahorradoMes / metaMes, 1) : 0;
  const faltaMes     = Math.max(metaMes - ahorradoMes, 0);
  const superaMeta   = metaMes > 0 && ahorradoMes >= metaMes;

  // ── Historial mes a mes (solo meses con meta o movimiento) ──────────
  const historial = useMemo(() => {
    return MESES.map((m, i) => {
      const meta = state.metas?.[m]?.ahorro || 0;
      const real = ahorroDeMes(m);
      return { mes: m, nombre: MES_NAMES[i], meta, real };
    }).filter(h => h.meta > 0 || h.real > 0);
  }, [state.metas, state.transacciones]);

  const totalAhorrado = useMemo(() =>
    MESES.reduce((s, m) => s + ahorroDeMes(m), 0),
    [state.metas, state.transacciones]
  );
  const totalMeta = useMemo(() =>
    MESES.reduce((s, m) => s + (state.metas?.[m]?.ahorro || 0), 0),
    [state.metas]
  );

  // ── Racha: meses consecutivos cumpliendo la meta, hacia atrás desde el mes activo ──
  const racha = useMemo(() => {
    let streak = 0;
    for (let i = mesIdx; i >= 0; i--) {
      const m = MESES[i];
      const meta = state.metas?.[m]?.ahorro || 0;
      if (meta === 0) break;
      if (ahorroDeMes(m) >= meta) streak++; else break;
    }
    return streak;
  }, [state.metas, state.transacciones, mesIdx]);

  // ── Ledger: movimientos reales de "Ahorro" del mes activo ───────────
  const movimientos = useMemo(() =>
    (state.transacciones || [])
      .filter(t => t.categoria === 'Ahorro' && t.mes === mes)
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
    [state.transacciones, mes]
  );

  function abrirEditarMeta() {
    setMetaInput(fmtInput(metaMes));
    setEditandoMeta(true);
  }
  function guardarMeta() {
    const actual = state.metas?.[mes] || {};
    updateMeta(mes, { ...actual, ahorro: parseAmt(metaInput) });
    setEditandoMeta(false);
    showSnackbar('Meta de ahorro actualizada', 'success');
  }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            Ahorro
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>
            Cuánto estás guardando mes a mes
          </Typography>
        </Box>

        {/* Selector de mes */}
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 2.5, pb: 0.5 }}>
          {MESES.map((m, i) => {
            const activo = m === mes;
            return (
              <Box key={m} onClick={() => setMesActivo(m)} sx={{
                px: 1.75, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
                borderColor: activo ? T1 : BORDER,
                bgcolor:     activo ? T1 : CARD,
                color:       activo ? '#fff' : T2,
              }}>
                {MES_NAMES[i]}
              </Box>
            );
          })}
        </Box>

        {/* ── Hero: progreso del mes activo ── */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ahorrado en {mesNombre}
            </Typography>
            {superaMeta && (
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: GREEN, bgcolor: alpha(GREEN, 0.1), px: 1, py: 0.25, borderRadius: '20px' }}>
                ✓ Meta cumplida
              </Typography>
            )}
          </Box>

          <Typography sx={{ fontSize: 38, fontWeight: 800, color: T1, letterSpacing: '-1.5px', lineHeight: 1 }}>
            {formatMoney(ahorradoMes)}
          </Typography>

          {metaMes > 0 ? (
            <>
              <Typography sx={{ fontSize: 12, color: T2, mt: 0.5 }}>
                de {formatMoney(metaMes)} · {Math.round(pctMes * 100)}%
                {!superaMeta && ` · falta ${formatMoneyShort(faltaMes)}`}
              </Typography>
              <Box sx={{ height: 7, borderRadius: 4, bgcolor: '#F3F4F6', overflow: 'hidden', mt: 1 }}>
                <Box sx={{
                  height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                  width: `${pctMes * 100}%`, bgcolor: superaMeta ? GREEN : T1,
                }} />
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: 12, color: T2, mt: 0.5 }}>
              Sin meta para {mesNombre} — ponle una para ver tu progreso
            </Typography>
          )}

          {racha > 1 && (
            <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 600, mt: 1 }}>
              🔥 {racha} meses seguidos cumpliendo tu meta de ahorro
            </Typography>
          )}

          {/* Editar meta */}
          {!editandoMeta ? (
            <Box onClick={abrirEditarMeta} sx={{ mt: 1.5, display: 'inline-flex', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: T2 }}>
                {metaMes > 0 ? `Cambiar meta de ${mesNombre} →` : `Poner meta para ${mesNombre} →`}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75 }}>
              <Box component="input" type="text" inputMode="numeric" autoFocus
                placeholder="Ej: 400.000"
                value={metaInput}
                onChange={e => setMetaInput(fmtInput(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && guardarMeta()}
                sx={{
                  flex: 1, bgcolor: BG, border: `1px solid ${BORDER}`, borderRadius: '10px',
                  px: 1.5, py: 0.875, fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none',
                  boxSizing: 'border-box', '&:focus': { borderColor: GREEN },
                }} />
              <Box component="button" onClick={guardarMeta} sx={{
                px: 2, py: 0.875, borderRadius: '10px', border: 'none', bgcolor: GREEN, color: '#fff',
                fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Guardar</Box>
              <Box component="button" onClick={() => setEditandoMeta(false)} sx={{
                px: 1.5, py: 0.875, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: 'transparent',
                color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              }}>✕</Box>
            </Box>
          )}
        </Box>

        {/* ── Total acumulado del año ── */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>
            Total ahorrado este año
          </Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: GREEN, letterSpacing: '-0.5px', lineHeight: 1 }}>
            {formatMoney(totalAhorrado)}
          </Typography>
          {totalMeta > 0 && (
            <Typography sx={{ fontSize: 12, color: T2, mt: 0.4 }}>
              de {formatMoney(totalMeta)} planeados · {Math.round(Math.min(totalAhorrado / totalMeta, 1) * 100)}%
            </Typography>
          )}
        </Box>

        {/* ── Historial mes a mes ── */}
        {historial.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
              Mes a mes
            </Typography>
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {historial.map((h, i) => {
                const pct = h.meta > 0 ? Math.min(h.real / h.meta, 1) : (h.real > 0 ? 1 : 0);
                const ok  = h.meta > 0 && h.real >= h.meta;
                return (
                  <Box key={h.mes} onClick={() => setMesActivo(h.mes)} sx={{
                    px: 2, py: 1.25, cursor: 'pointer',
                    borderBottom: i < historial.length - 1 ? `1px solid ${BORDER}` : 'none',
                    bgcolor: h.mes === mes ? alpha(GREEN, 0.04) : 'transparent',
                    '&:active': { opacity: 0.7 },
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: h.mes === mes ? 700 : 600, color: T1 }}>
                        {h.nombre}{ok && ' ✓'}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: ok ? GREEN : T1 }}>
                        {formatMoneyShort(h.real)}{h.meta > 0 && <span style={{ color: T2, fontWeight: 500 }}> / {formatMoneyShort(h.meta)}</span>}
                      </Typography>
                    </Box>
                    <Box sx={{ height: 5, borderRadius: 3, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct * 100}%`, bgcolor: ok ? GREEN : T1, borderRadius: 3, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* ── Movimientos del mes ── */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
            Movimientos de {mesNombre}
          </Typography>
          {movimientos.length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: T2, mb: 1.25 }}>
                Aún no has registrado ningún ahorro este mes
              </Typography>
              <Box onClick={() => navigate('/finanzas/registro')} sx={{
                display: 'inline-block', px: 2, py: 0.875, borderRadius: '10px',
                bgcolor: GREEN, cursor: 'pointer', '&:active': { opacity: 0.85 },
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Registrar ahorro</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {movimientos.map((t, i) => (
                <Box key={t.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25,
                  borderBottom: i < movimientos.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, bgcolor: alpha(GREEN, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                    💰
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.concepto || 'Ahorro'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: T2, mt: 0.15 }}>
                      {formatFechaShort(t.fecha)}{t.cuenta ? ` · ${t.cuenta}` : ''}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: GREEN, flexShrink: 0 }}>
                    +{formatMoneyShort(Math.abs(t.total))}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ── Metas de ahorro personalizadas ── */}
        <Box onClick={() => navigate('/finanzas/metas')} sx={{
          bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`,
          p: 2, display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer', '&:active': { opacity: 0.7 },
        }}>
          <Typography sx={{ fontSize: 20 }}>🎯</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>Metas de ahorro</Typography>
            <Typography sx={{ fontSize: 11, color: T2 }}>Fondo de emergencia, viajes, compras…</Typography>
          </Box>
          <Box sx={{ color: T2, display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </Box>
        </Box>

      </Box>
    </Box>
  );
}
