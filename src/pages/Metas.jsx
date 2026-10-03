import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, alpha, Collapse } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'
import { useSnackbar } from 'src/context/SnackbarContext'
import { computeMetrics } from 'src/utils/metrics'
import { formatMoney, formatMoneyShort } from 'src/utils/format'
import { MESES, MES_NAMES } from 'src/constants'

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const AMBER   = '#D97706'
const BORDER  = '#E5E7EB'

function readLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def }
}

function MiniBar({ pct, color }) {
  return (
    <Box sx={{ height: 4, bgcolor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${Math.min(pct, 1) * 100}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </Box>
  )
}

function Input({ label, value, onChange, type = 'number', helper }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>{label}</Typography>
      <Box component="input" type={type} value={value} onChange={e => onChange(e.target.value)}
        sx={{ width: '100%', bgcolor: '#fff', border: `1px solid ${BORDER}`, borderRadius: '8px', px: 1.5, py: 0.875, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: GREEN } }} />
      {helper && <Typography sx={{ fontSize: 11, color: T2, mt: 0.375, opacity: 0.7 }}>{helper}</Typography>}
    </Box>
  )
}

function StatusBadge({ label, color }) {
  return (
    <Typography sx={{ fontSize: 9, fontWeight: 700, color, bgcolor: `${color}18`, px: 0.75, py: 0.2, borderRadius: '4px', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
  )
}

const TIPOS_META = [
  { key: 'emergencia', label: 'Fondo emergencia', icono: '🛡️', color: '#F59E0B' },
  { key: 'compra',     label: 'Meta de compra',   icono: '🛍️', color: '#3B82F6' },
  { key: 'deuda',      label: 'Pago de deuda',    icono: '📉', color: '#EF4444' },
  { key: 'ahorro',     label: 'Ahorro libre',     icono: '💰', color: '#00A76F' },
  { key: 'ingreso',    label: 'Meta de ingreso',  icono: '💵', color: '#8B5CF6' },
];

const TIPO_MAP = Object.fromEntries(TIPOS_META.map(t => [t.key, t]));

function parseAmt(s) { const n = parseInt(String(s).replace(/\D/g,''),10); return isNaN(n)?0:n; }
function fmtInput(n) { const x = parseInt(String(n).replace(/\D/g,''),10); return isNaN(x)||x===0?'':x.toLocaleString('es-CO'); }

export default function Metas() {
  const navigate = useNavigate()
  const { state, updateMeta, addMetaPersonalizada, updateMetaPersonalizada, deleteMetaPersonalizada } = useFinanzas()
  const { showToast } = useSnackbar()
  const [tab, setTab]           = useState(0)
  const [metaModal, setMetaModal]     = useState(null)
  const [metaAhorro, setMetaAhorro]   = useState('')
  const [metaInvUSD, setMetaInvUSD]   = useState('')
  const [realAhorroM, setRealAhorroM] = useState('')

  // Metas personalizadas
  const [mpModal,      setMpModal]      = useState(null) // null | 'new' | meta_obj
  const [mpNombre,     setMpNombre]     = useState('')
  const [mpTipo,       setMpTipo]       = useState('emergencia')
  const [mpMonto,      setMpMonto]      = useState('')
  const [mpAcumulado,  setMpAcumulado]  = useState('')
  const [mpFecha,      setMpFecha]      = useState('')

  function openMpNew() {
    setMpNombre(''); setMpTipo('emergencia'); setMpMonto(''); setMpAcumulado(''); setMpFecha('');
    setMpModal('new');
  }
  function openMpEdit(m) {
    setMpNombre(m.nombre); setMpTipo(m.tipo); setMpMonto(fmtInput(m.monto));
    setMpAcumulado(fmtInput(m.acumulado || 0)); setMpFecha(m.fechaObjetivo || '');
    setMpModal(m);
  }
  function guardarMp() {
    const data = { nombre: mpNombre.trim(), tipo: mpTipo, monto: parseAmt(mpMonto), acumulado: parseAmt(mpAcumulado), fechaObjetivo: mpFecha, activa: true };
    if (!data.nombre || !data.monto) { showToast('Nombre y monto son requeridos','error'); return; }
    if (mpModal === 'new') addMetaPersonalizada(data);
    else updateMetaPersonalizada(mpModal.id, data);
    setMpModal(null); showToast('Meta guardada', 'success');
  }

  const currentYear = new Date().getFullYear()
  const mesActual   = 'M' + (new Date().getMonth() + 1)

  const invAportes   = useMemo(() => readLS('inv_aportes',   []),   [])
  const invPortfolio = useMemo(() => readLS('inv_portfolio', null), [])
  const invPrecios   = useMemo(() => readLS('inv_precios',   {}),   [])

  const totalInvUSD = useMemo(() => invAportes.reduce((s, a) => s + (a.usd || 0), 0), [invAportes])

  function invUSDForMes(mesKey) {
    const idx = MESES.indexOf(mesKey)
    return invAportes
      .filter(a => { const d = new Date(a.fecha); return d.getFullYear() === currentYear && d.getMonth() === idx })
      .reduce((s, a) => s + (a.usd || 0), 0)
  }

  function ahorroRealDeMes(m) {
    const meta = state.metas[m] || {}
    if (meta.ahorroRegistrado != null && meta.ahorroRegistrado > 0) return meta.ahorroRegistrado
    return computeMetrics(state.transacciones, m).ahorroReal
  }

  const anual = useMemo(() => {
    let metaAhorroAnual = 0, metaInvAnualUSD = 0, realAhorro = 0
    MESES.forEach(m => {
      const meta = state.metas[m] || { ahorro: 0, inversion: 0 }
      metaAhorroAnual += meta.ahorro    || 0
      metaInvAnualUSD += meta.inversion || 0
      realAhorro += ahorroRealDeMes(m)
    })
    return { metaAhorroAnual, metaInvAnualUSD, realAhorro }
  }, [state.transacciones, state.metas])

  const racha = useMemo(() => {
    let streak = 0
    for (let i = MESES.indexOf(mesActual); i >= 0; i--) {
      const m    = MESES[i]
      const meta = state.metas[m] || { ahorro: 0, inversion: 0 }
      const metaA = meta.ahorro    || 0
      const metaI = meta.inversion || 0
      if (metaA === 0 && metaI === 0) break
      const invUSD  = invUSDForMes(m)
      const ahorroR = ahorroRealDeMes(m)
      if ((metaA === 0 || ahorroR >= metaA) && (metaI === 0 || invUSD >= metaI)) streak++
      else break
    }
    return streak
  }, [state.transacciones, state.metas, invAportes])

  const portfolioStats = useMemo(() => {
    if (!invPortfolio || invPortfolio.length === 0) return null
    let costo = 0, valor = 0
    invPortfolio.forEach(p => {
      const px = invPrecios[p.ticker] || p.avgPrice || 0
      costo += p.shares * (p.avgPrice || 0)
      valor += p.shares * px
    })
    const gp    = valor - costo
    const gpPct = costo > 0 ? (gp / costo * 100) : 0
    return { costo, valor, gp, gpPct }
  }, [invPortfolio, invPrecios])

  function openMetaModal(mes) {
    const meta = state.metas[mes] || { ahorro: 0, inversion: 50 }
    setMetaAhorro(String(meta.ahorro || 0))
    setMetaInvUSD(String(meta.inversion != null ? meta.inversion : 50))
    setRealAhorroM(String(meta.ahorroRegistrado || ''))
    setMetaModal(mes)
  }

  function guardarMeta() {
    updateMeta(metaModal, {
      ahorro:           parseFloat(metaAhorro) || 0,
      inversion:        parseFloat(metaInvUSD) || 0,
      ahorroRegistrado: parseFloat(realAhorroM) || 0,
    })
    setMetaModal(null)
    showToast('Meta actualizada', 'success')
  }

  const pctAhorro = anual.metaAhorroAnual > 0 ? Math.min(anual.realAhorro / anual.metaAhorroAnual, 1) : 0
  const pctInv    = anual.metaInvAnualUSD  > 0 ? Math.min(totalInvUSD    / anual.metaInvAnualUSD,  1) : 0

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%' }}>
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: '-0.3px' }}>Metas</Typography>
        <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Ahorro e inversiones {currentYear}</Typography>
      </Box>

      {/* Hero anual */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5 }}>
          {/* Ahorro */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ahorro COP</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: T1, letterSpacing: '-0.4px' }}>
                {Math.round(pctAhorro * 100)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.875 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{formatMoneyShort(anual.realAhorro)}</Typography>
              <Typography sx={{ fontSize: 11, color: T2 }}>meta {formatMoneyShort(anual.metaAhorroAnual)}</Typography>
            </Box>
            <Box sx={{ height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${pctAhorro * 100}%`, bgcolor: GREEN, borderRadius: 3, transition: 'width 0.5s' }} />
            </Box>
            {anual.metaAhorroAnual > 0 && anual.realAhorro < anual.metaAhorroAnual && (
              <Typography sx={{ fontSize: 11, color: T2, mt: 0.5 }}>
                Falta {formatMoney(anual.metaAhorroAnual - anual.realAhorro)} para la meta
              </Typography>
            )}
          </Box>

          {/* Inversión */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inversión USD</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: T1, letterSpacing: '-0.4px' }}>
                {Math.round(pctInv * 100)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.875 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: GREEN }}>${totalInvUSD.toFixed(0)}</Typography>
              <Typography sx={{ fontSize: 11, color: T2 }}>meta ${anual.metaInvAnualUSD.toFixed(0)}</Typography>
            </Box>
            <Box sx={{ height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${pctInv * 100}%`, bgcolor: GREEN, borderRadius: 3, transition: 'width 0.5s' }} />
            </Box>
            {anual.metaInvAnualUSD > 0 && totalInvUSD < anual.metaInvAnualUSD && (
              <Typography sx={{ fontSize: 11, color: T2, mt: 0.5 }}>
                Falta ${(anual.metaInvAnualUSD - totalInvUSD).toFixed(0)} USD para la meta
              </Typography>
            )}
          </Box>

          {/* Racha */}
          <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 12, color: racha > 0 ? T1 : T2, fontWeight: racha > 0 ? 600 : 400 }}>
              {racha > 0
                ? `Racha: ${racha} ${racha === 1 ? 'mes' : 'meses'} consecutivo${racha !== 1 ? 's' : ''} cumpliendo ambas metas`
                : 'Sin meses completos cumplidos aún'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 0, p: '3px', mx: 2, mb: 2, borderRadius: '10px', bgcolor: '#EBEBEB' }}>
        {['Mensual', 'Personalizadas', 'Inversiones'].map((l, i) => (
          <Box key={l} onClick={() => setTab(i)} sx={{
            flex: 1, py: 0.625, borderRadius: '8px', textAlign: 'center',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            bgcolor: tab === i ? '#fff' : 'transparent',
            color:   tab === i ? T1 : T2,
            boxShadow: tab === i ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}>
            {l}
          </Box>
        ))}
      </Box>

      {/* ── Tab Personalizadas ── */}
      {tab === 1 && (
        <Box sx={{ px: 2, pb: 4 }}>
          {/* Botón nueva meta */}
          <Box onClick={openMpNew} sx={{
            mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            py: 1.125, borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH,
            border: `1.5px dashed ${BORDER}`, cursor: 'pointer', '&:active': { opacity: 0.7 },
          }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: GREEN }}>Nueva meta</Typography>
          </Box>

          {/* Lista */}
          {(state.metasPersonalizadas || []).length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', p: 3, textAlign: 'center', border: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 14, color: T2, mb: 0.5 }}>Sin metas personalizadas</Typography>
              <Typography sx={{ fontSize: 12, color: T2 }}>Crea una meta de compra, emergencia, deuda o ahorro</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {(state.metasPersonalizadas || []).map(m => {
                const cfg  = TIPO_MAP[m.tipo] || TIPOS_META[0];
                const pct  = m.monto > 0 ? Math.min((m.acumulado || 0) / m.monto, 1) : 0;
                const falta = m.monto - (m.acumulado || 0);
                // Fecha estimada: si hay ritmo de ahorro mensual (simplificado)
                let fechaEst = null;
                if (m.fechaObjetivo) {
                  const hoy = new Date(); const obj = new Date(m.fechaObjetivo);
                  const dias = Math.round((obj - hoy) / 86400000);
                  if (dias > 0) fechaEst = `${dias}d restantes`;
                  else if (dias === 0) fechaEst = 'Hoy';
                  else fechaEst = 'Vencida';
                }
                return (
                  <Box key={m.id} sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: `${cfg.color}14`, border: `1px solid ${cfg.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {cfg.icono}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{m.nombre}</Typography>
                        <Typography sx={{ fontSize: 11, color: T2 }}>{cfg.label}{fechaEst ? ` · ${fechaEst}` : ''}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 800, color: T1 }}>{Math.round(pct * 100)}%</Typography>
                        <Box onClick={() => openMpEdit(m)} sx={{ width: 28, height: 28, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, '&:hover': { bgcolor: '#F3F4F6' } }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Box>
                        <Box onClick={() => { if(window.confirm('¿Eliminar esta meta?')) deleteMetaPersonalizada(m.id); }} sx={{ width: 28, height: 28, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2, '&:hover': { bgcolor: alpha(RED,0.08), color: RED } }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.625 }}>
                      <Typography sx={{ fontSize: 12, color: T2 }}>
                        {formatMoneyShort(m.acumulado || 0)} <span style={{ opacity: 0.5 }}>/ {formatMoneyShort(m.monto)}</span>
                      </Typography>
                      {falta > 0 && <Typography sx={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>Falta {formatMoneyShort(falta)}</Typography>}
                    </Box>
                    <Box sx={{ height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct * 100}%`, bgcolor: pct >= 1 ? GREEN : cfg.color, borderRadius: 3, transition: 'width 0.4s' }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Modal nueva/editar meta */}
          <Dialog open={!!mpModal} onClose={() => setMpModal(null)} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: T1, pb: 1 }}>
              {mpModal === 'new' ? 'Nueva meta' : 'Editar meta'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Tipo */}
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.75 }}>Tipo de meta</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {TIPOS_META.map(t => (
                      <Box key={t.key} onClick={() => setMpTipo(t.key)} sx={{
                        display: 'flex', alignItems: 'center', gap: 0.625, px: 1.25, py: 0.5, borderRadius: '20px', cursor: 'pointer',
                        border: '1px solid', transition: 'all 0.12s',
                        borderColor: mpTipo === t.key ? t.color : BORDER,
                        bgcolor: mpTipo === t.key ? `${t.color}12` : 'transparent',
                      }}>
                        <Typography sx={{ fontSize: 13 }}>{t.icono}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: mpTipo === t.key ? t.color : T2 }}>{t.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                {/* Nombre */}
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Nombre</Typography>
                  <Box component="input" value={mpNombre} onChange={e => setMpNombre(e.target.value)} placeholder="Ej: Fondo 3 meses, iPhone, Visa..."
                    sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
                </Box>
                {/* Monto objetivo */}
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Monto objetivo ($)</Typography>
                  <Box component="input" type="text" inputMode="numeric" value={mpMonto}
                    onChange={e => { const n = parseInt(e.target.value.replace(/\D/g,''),10); setMpMonto(isNaN(n)?'':n.toLocaleString('es-CO')); }}
                    placeholder="0" sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
                </Box>
                {/* Acumulado */}
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Ya tengo ($) <span style={{ fontWeight: 400 }}>(opcional)</span></Typography>
                  <Box component="input" type="text" inputMode="numeric" value={mpAcumulado}
                    onChange={e => { const n = parseInt(e.target.value.replace(/\D/g,''),10); setMpAcumulado(isNaN(n)?'':n.toLocaleString('es-CO')); }}
                    placeholder="0" sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
                </Box>
                {/* Fecha objetivo */}
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>Fecha objetivo <span style={{ fontWeight: 400 }}>(opcional)</span></Typography>
                  <Box component="input" type="date" value={mpFecha} onChange={e => setMpFecha(e.target.value)}
                    sx={{ width: '100%', boxSizing: 'border-box', px: 1.5, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#fff', fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none', '&:focus': { borderColor: GREEN } }} />
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Box component="button" onClick={() => setMpModal(null)} sx={{ flex: 1, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</Box>
              <Box component="button" onClick={guardarMp} sx={{ flex: 2, py: 1, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>Guardar</Box>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* Tab Mensual */}
      {tab === 0 && (
        <Box sx={{ px: 2, pb: 4, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {MESES.map((m, i) => {
            const meta    = state.metas[m] || { ahorro: 0, inversion: 0 }
            const invUSD  = invUSDForMes(m)
            const metaA   = meta.ahorro    || 0
            const metaI   = meta.inversion || 0
            const hasMeta = metaA > 0 || metaI > 0
            const ahorroR  = ahorroRealDeMes(m)
            const esManual = (meta.ahorroRegistrado || 0) > 0

            const pA = metaA > 0 ? Math.min(ahorroR / metaA, 1) : 0
            const pI = metaI > 0 ? Math.min(invUSD  / metaI, 1) : 0

            const ahorroOk = metaA === 0 || ahorroR >= metaA
            const invOk    = metaI === 0 || invUSD  >= metaI
            const hasData  = ahorroR > 0 || invUSD > 0

            const isCurrent = m === mesActual

            let estadoLabel = '', estadoColor = ''
            if (hasMeta && hasData) {
              if (ahorroOk && invOk)      { estadoLabel = 'Cumplido'; estadoColor = GREEN }
              else if (ahorroOk || invOk) { estadoLabel = 'Parcial';  estadoColor = AMBER }
              else                        { estadoLabel = 'Pendiente'; estadoColor = RED  }
            }

            return (
              <Box key={m} sx={{
                bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH,
                border: `1px solid ${isCurrent ? alpha(GREEN, 0.3) : BORDER}`,
                overflow: 'hidden',
              }}>
                <Box sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: hasMeta ? 1.25 : 0 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                      bgcolor: '#F3F4F6', border: `1px solid ${BORDER}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 900, color: isCurrent ? GREEN : T2 }}>
                        {MES_NAMES[i].slice(0, 3).toUpperCase()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{MES_NAMES[i]}</Typography>
                        {estadoLabel && <StatusBadge label={estadoLabel} color={estadoColor} />}
                        {isCurrent && <StatusBadge label="HOY" color={GREEN} />}
                      </Box>
                      {!hasMeta && <Typography sx={{ fontSize: 11, color: T2 }}>Sin meta configurada</Typography>}
                    </Box>
                    <Box onClick={() => openMetaModal(m)} sx={{
                      width: 28, height: 28, borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: T2, flexShrink: 0,
                      '&:hover': { bgcolor: '#F3F4F6', color: T1 },
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </Box>
                  </Box>

                  {hasMeta && (
                    <Box>
                      {metaA > 0 && (
                        <Box sx={{ mb: metaI > 0 ? 1 : 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ fontSize: 11, color: T2 }}>
                              {formatMoneyShort(ahorroR)}{esManual && <span style={{ opacity: 0.5, fontSize: 9 }}> manual</span>}{' '}
                              <span style={{ opacity: 0.5 }}>/ {formatMoneyShort(metaA)}</span>
                            </Typography>
                            {!ahorroOk && (
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: AMBER }}>
                                −{formatMoneyShort(metaA - ahorroR)}
                              </Typography>
                            )}
                          </Box>
                          <MiniBar pct={pA} color={GREEN} />
                        </Box>
                      )}
                      {metaI > 0 && (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ fontSize: 11, color: T2 }}>
                              ${invUSD.toFixed(0)} USD <span style={{ opacity: 0.5 }}>/ ${metaI}</span>
                            </Typography>
                            {!invOk && (
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: AMBER }}>
                                −${(metaI - invUSD).toFixed(0)} USD
                              </Typography>
                            )}
                          </Box>
                          <MiniBar pct={pI} color={GREEN} />
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Tab Inversiones */}
      {tab === 2 && (
        <Box sx={{ px: 2, pb: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {portfolioStats ? (
            <>
              {/* KPI card */}
              <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>Portafolio</Typography>
                <Box sx={{ display: 'flex', gap: 0, mb: 2 }}>
                  {[
                    { label: 'Invertido',    val: `$${portfolioStats.costo.toFixed(0)}`,                                                       sub: 'USD costo',    color: T1 },
                    { label: 'Valor actual', val: `$${portfolioStats.valor.toFixed(0)}`,                                                       sub: 'USD estimado', color: T1 },
                    { label: 'G/P',          val: `${portfolioStats.gp >= 0 ? '+' : ''}$${Math.abs(portfolioStats.gp).toFixed(0)}`,            sub: `${portfolioStats.gpPct >= 0 ? '+' : ''}${portfolioStats.gpPct.toFixed(2)}%`, color: portfolioStats.gp >= 0 ? GREEN : RED },
                  ].map((k, idx) => (
                    <Box key={k.label} sx={{ flex: 1, borderRight: idx < 2 ? `1px solid ${BORDER}` : 'none', pr: idx < 2 ? 1.5 : 0, pl: idx > 0 ? 1.5 : 0 }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.25 }}>{k.label}</Typography>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.val}</Typography>
                      <Typography sx={{ fontSize: 10, color: k.color, opacity: 0.8 }}>{k.sub}</Typography>
                    </Box>
                  ))}
                </Box>
                <Typography sx={{ fontSize: 11, color: T2, mb: 1.25 }}>
                  Aportes acumulados: <b style={{ color: T1 }}>${totalInvUSD.toFixed(2)} USD</b>
                </Typography>
                <Box component="button" onClick={() => navigate('/inversiones')}
                  sx={{ width: '100%', py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: '#F3F4F6', color: T1, fontWeight: 600, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                  Ver detalle en Inversiones →
                </Box>
              </Box>

              {/* Posiciones */}
              <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.375, borderBottom: `1px solid ${BORDER}`, bgcolor: '#F9FAFB' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Posiciones</Typography>
                </Box>
                {invPortfolio.filter(p => p.shares > 0).map((p, idx, arr) => {
                  const precio = invPrecios[p.ticker] || p.avgPrice || 0
                  const costo  = p.shares * (p.avgPrice || 0)
                  const valor  = p.shares * precio
                  const gp     = valor - costo
                  const gpPct  = costo > 0 ? (gp / costo * 100) : 0
                  return (
                    <Box key={p.ticker} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.375, borderBottom: idx < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#F3F4F6', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: T2, flexShrink: 0 }}>
                        {p.ticker}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>{p.ticker}</Typography>
                        <Typography sx={{ fontSize: 11, color: T2 }}>
                          {p.shares.toFixed(4)} acc · P°C ${(p.avgPrice || 0).toFixed(2)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: T1 }}>${valor.toFixed(0)}</Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: gp >= 0 ? GREEN : RED }}>
                          {gp >= 0 ? '+' : ''}{gpPct.toFixed(1)}%
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </>
          ) : (
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 3.5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, mb: 0.5 }}>Sin portafolio registrado</Typography>
              <Typography sx={{ fontSize: 12, color: T2, mb: 2.5 }}>
                Registra tu primera inversión en la sección Inversiones
              </Typography>
              <Box component="button" onClick={() => navigate('/inversiones')}
                sx={{ px: 3, py: 1, borderRadius: '8px', border: `1px solid ${alpha(GREEN, 0.4)}`, bgcolor: alpha(GREEN, 0.08), color: GREEN, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Ir a Inversiones →
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Modal meta mensual */}
      <Dialog open={!!metaModal} onClose={() => setMetaModal(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, pb: 1, fontSize: 16, color: T1 }}>
          Meta — {metaModal ? MES_NAMES[MESES.indexOf(metaModal)] : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Input label="Meta Ahorro COP ($)" value={metaAhorro} onChange={setMetaAhorro} />
            <Input label="Ahorro real registrado COP ($)" value={realAhorroM} onChange={setRealAhorroM} helper="Opcional — si ya tienes el dato exacto de lo que ahorraste este mes" />
            <Input label="Meta Inversión USD ($)" value={metaInvUSD} onChange={setMetaInvUSD} helper="Cuánto quieres invertir en dólares este mes (default $50)" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Box component="button" onClick={() => setMetaModal(null)}
            sx={{ flex: 1, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancelar
          </Box>
          <Box component="button" onClick={guardarMeta}
            sx={{ flex: 2, py: 1, borderRadius: '8px', border: 'none', bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            Guardar
          </Box>
        </DialogActions>
      </Dialog>

    </Box>
    </Box>
  )
}
