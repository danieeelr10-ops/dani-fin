import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { useFinanzas } from 'src/context/FinanzasContext'
import { computeMetrics } from 'src/utils/metrics'
import { computeDisponibleHoy, computeProximosPagos, computeAlertas } from 'src/utils/cashflow'
import AlertasBanner from 'src/components/AlertasBanner'
import { formatMoney, formatMoneyShort, getMesActual } from 'src/utils/format'
import { CAT_ICONS, CAT_COLORS, MES_NAMES, MESES } from 'src/constants'

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

// ── Helpers ───────────────────────────────────────────────────
function ls(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null } }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function getFechaLarga() {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase())
}

function relDate(isoDate) {
  if (!isoDate) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(isoDate); d.setHours(0, 0, 0, 0)
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return `Hace ${diff}d`
}

const QUICK = [
  { icon: '✏️', label: 'Registrar',   path: '/registro'    },
  { icon: '🛒', label: 'Mercado',     path: '/mercado'     },
  { icon: '📊', label: 'Presupuesto', path: '/presupuesto' },
  { icon: '📈', label: 'Inversiones', path: '/inversiones' },
  { icon: '🎯', label: 'Metas',       path: '/metas'       },
  { icon: '💪', label: 'Hábitos',     path: '/habitos'     },
]

// ── Componentes ───────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
      {children}
    </Typography>
  )
}

export default function Inicio() {
  const navigate = useNavigate()
  const { state, mesActivo, setMesActivo, closeMonth, getCarryOver, getCierre, deleteCierre } = useFinanzas()
  const [desglose, setDesglose] = useState(false)
  const [confirmCierre, setConfirmCierre] = useState(false)

  const mes        = mesActivo
  const mesIdx     = parseInt(mes.replace('M', '')) - 1
  const mesNombre  = MES_NAMES[mesIdx]
  const mesActualK = getMesActual()

  const mesesConDatos = useMemo(() =>
    MESES.filter(m => (state.transacciones || []).some(t => t.mes === m) || state.presupuestos?.[m]),
    [state.transacciones, state.presupuestos]
  )

  // Métricas
  const metrics  = useMemo(() => computeMetrics(state.transacciones || [], mes), [state.transacciones, mes])
  const presupMes = state.presupuestos?.[mes] || {}
  const balance   = metrics.neto
  const positivo  = balance >= 0
  const balColor  = positivo ? GREEN : RED

  // Saldo trasladado
  const carryOver    = getCarryOver(mes)
  const cierreMes    = getCierre(mes)
  const hayCarryOver = carryOver !== 0
  const esDeuda      = carryOver < 0

  // Flujo de caja real (después de carryOver para poder usarlo)
  const disponibleHoy = useMemo(
    () => computeDisponibleHoy(state.transacciones || [], mes, carryOver),
    [state.transacciones, mes, carryOver]
  )
  const proximosPagos = useMemo(() => computeProximosPagos(state.transacciones || []),                [state.transacciones])
  const alertas       = useMemo(() => computeAlertas(state.transacciones || [], mes, carryOver),      [state.transacciones, mes, carryOver])

  const egFijoPres = Object.keys(presupMes).filter(k => state.categoriasEgresoFijo?.includes(k)).reduce((s, k) => s + (presupMes[k] || 0), 0)
  const egVarPres  = Object.keys(presupMes).filter(k => state.categoriasEgresoVariable?.includes(k)).reduce((s, k) => s + (presupMes[k] || 0), 0)
  const ingPres    = Object.keys(presupMes).filter(k => state.categoriasIngreso?.includes(k)).reduce((s, k) => s + (presupMes[k] || 0), 0)
  const egPresPlan = egFijoPres + egVarPres
  // Ingresos recibidos: usa presupuestosDetalle para no contar ingresos no presupuestados
  const ingRecibidoPresup = useMemo(() => {
    const txs = state.transacciones || []
    const detalleIngresos = (state.presupuestosDetalle?.[mes] || [])
      .filter(i => state.categoriasIngreso?.includes(i.categoria))
    if (detalleIngresos.length > 0) {
      return detalleIngresos.reduce((total, item) => {
        if (item.pagadoCon) {
          // Ya vinculado: usa el monto de la transacción vinculada
          const tx = item.txId ? txs.find(t => t.id === item.txId) : null
          return total + (tx ? Math.abs(tx.total) : item.monto)
        }
        // Aún no vinculado: busca transacción por concepto exacto, capeado al presupuesto
        const concepto = item.concepto
        if (concepto) {
          const recibido = txs
            .filter(t => t.mes === mes && t.movimiento === 'Ingreso' && t.concepto === concepto)
            .reduce((s, t) => s + Math.abs(t.total), 0)
          return total + Math.min(recibido, item.monto)
        }
        return total
      }, 0)
    }
    // Sin detalle: capeado al presupuesto por categoría
    return Object.keys(presupMes)
      .filter(k => state.categoriasIngreso?.includes(k))
      .reduce((total, cat) => {
        const presupCat = presupMes[cat] || 0
        const recibidoCat = txs
          .filter(t => t.mes === mes && t.movimiento === 'Ingreso' && t.categoria === cat)
          .reduce((s, t) => s + Math.abs(t.total), 0)
        return total + Math.min(recibidoCat, presupCat)
      }, 0)
  }, [state.presupuestosDetalle, state.transacciones, presupMes, mes, state.categoriasIngreso])

  const ingPresDetalle = ingPres
  const margenPlan = ingPres - egPresPlan  // plan puro: ingresos presupuestados - egresos presupuestados
  const pctGastado = egPresPlan > 0 ? Math.min(metrics.eg / egPresPlan, 1) : 0
  const hayPresup  = ingPres > 0 || egPresPlan > 0

  // Proyección fin de mes: disponible hoy + ingresos presupuestados aún no recibidos − gastos que faltan pagar
  const ingresosPendientes = Math.max(ingPres - ingRecibidoPresup, 0)
  const gastosPendientes = Math.max(egPresPlan - metrics.eg, 0)
  const tcPorPagar = Math.max((metrics.tcEg || 0) - (metrics.pagoTC || 0), 0)
  const proyeccionFinMes = disponibleHoy + ingresosPendientes - gastosPendientes - tcPorPagar
  const proyColor = proyeccionFinMes < 0 ? RED : proyeccionFinMes < margenPlan * 0.8 ? '#F59E0B' : GREEN
  const difVsPlan = proyeccionFinMes - margenPlan

  // Flujo por cuenta en el mes activo
  const saldosCuenta = useMemo(() => {
    const txsMes = (state.transacciones || []).filter(t => t.mes === mes)
    const cuentas = (state.cuentas || []).filter(c => c !== 'T.C')
    return cuentas
      .map(c => {
        const ing = txsMes.filter(t => t.movimiento === 'Ingreso' && t.cuenta === c).reduce((s, t) => s + Math.abs(t.total), 0)
        const eg  = txsMes.filter(t => t.movimiento === 'Egreso'  && t.cuenta === c).reduce((s, t) => s + Math.abs(t.total), 0)
        return { cuenta: c, ing, eg, neto: ing - eg }
      })
      .filter(c => c.ing > 0 || c.eg > 0)
  }, [state.transacciones, state.cuentas, mes])

  // Hábitos
  const habitosData = useMemo(() => {
    const hab    = ls('hab_habitos') || []
    const activos = hab.filter(h => h.activo !== false)
    const todayKey = new Date().toISOString().split('T')[0]
    const done   = (ls('hab_done') || {})[todayKey] || []
    return { done: activos.filter(h => done.includes(h.id)).length, total: activos.length }
  }, [])

  // Aporte
  const aporteData = useMemo(() => {
    const hoy    = new Date()
    const prefix = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    return { ok: (ls('inv_aportes') || []).some(a => (a.fecha || '').startsWith(prefix)), dia: hoy.getDate() }
  }, [])

  // Meta
  const metaData = useMemo(() => {
    const m = state.metas?.[mes] || {}
    if (!m.ahorro) return null
    const real = m.ahorroRegistrado ?? metrics.ahorroReal
    return Math.min(Math.round((real / m.ahorro) * 100), 100)
  }, [state.metas, mes, metrics.ahorroReal])

  // Últimos movimientos
  const recientes = useMemo(() => [...(state.transacciones || [])]
    .filter(t => t.categoria !== 'Pago TC')
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    .slice(0, 3), [state.transacciones])

  // Banner (solo negativo)
  const bannerNeg = balance < 0 && metrics.hasData

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: '20px' }}>

        {/* ── Header ── */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            {getGreeting()}{state.nombreUsuario ? `, ${state.nombreUsuario}` : ''}
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>
            {getFechaLarga()}
          </Typography>
        </Box>

        {/* ── Selector de mes ── */}
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, mb: 2.5, pb: 0.5 }}>
          {MESES.map((m, i) => {
            const activo   = m === mes
            const tieneDatos = mesesConDatos.includes(m)
            return (
              <Box key={m} onClick={() => setMesActivo(m)} sx={{
                px: 1.75, py: 0.625, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid', flexShrink: 0, transition: 'all 0.15s',
                borderColor: activo ? T1 : BORDER,
                bgcolor:     activo ? T1 : CARD,
                color:       activo ? '#fff' : tieneDatos ? T1 : T2,
                position: 'relative',
              }}>
                {MES_NAMES[i]}
                {tieneDatos && !activo && (
                  <Box sx={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', bgcolor: GREEN }} />
                )}
              </Box>
            )
          })}
        </Box>

        {/* ── Alertas ── */}
        <AlertasBanner alertas={alertas} />

        {/* ── Hero: Disponible HOY ── */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
            Disponible hoy
          </Typography>
          <Typography sx={{ fontSize: 38, fontWeight: 800, color: disponibleHoy >= 0 ? GREEN : RED, letterSpacing: '-1.5px', lineHeight: 1 }}>
            {disponibleHoy >= 0 ? '' : '−'}{formatMoney(Math.abs(disponibleHoy))}
          </Typography>
          {hayCarryOver && (
            <Typography sx={{ fontSize: 12, color: T2, mt: 0.4 }}>
              Incluye {formatMoneyShort(carryOver)} del mes anterior
            </Typography>
          )}

          {/* Desglose colapsable */}
          <Box onClick={() => setDesglose(d => !d)} sx={{ mt: 1.5, display: 'inline-flex', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: T2 }}>
              {desglose ? 'Ocultar detalle' : `Balance ${mesNombre} →`}
            </Typography>
          </Box>

          <Box sx={{ overflow: 'hidden', maxHeight: desglose ? 240 : 0, transition: 'max-height 0.3s ease' }}>
            <Box sx={{ pt: 1.75, mt: 1.5, borderTop: `1px solid #F0F0F0`, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { label: 'Ingresos recibidos', real: metrics.ing,        pres: 0          },
                { label: 'Egresos fijos',       real: metrics.fijos,     pres: egFijoPres },
                { label: 'Egresos variables',   real: metrics.vars,      pres: egVarPres  },
                { label: 'Ahorro',              real: metrics.ahorroReal,pres: 0          },
                { label: 'Inversión',           real: metrics.invReal,   pres: 0          },
              ].filter(r => r.real > 0 || r.pres > 0).map(({ label, real, pres }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Typography sx={{ fontSize: 13, color: T2 }}>{label}</Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: T1 }}>{formatMoneyShort(real)}</Typography>
                    {pres > 0 && <Typography component="span" sx={{ fontSize: 11, color: T2 }}> / {formatMoneyShort(pres)}</Typography>}
                  </Box>
                </Box>
              ))}
              {metrics.tcEg > 0 && (() => {
                const txsMes = (state.transacciones || []).filter(t => t.mes === mes)
                const tarjetasConCargos = [...new Set(
                  txsMes.filter(t => t.cuenta === 'T.C' && t.movimiento === 'Egreso' && t.categoria !== 'Pago TC')
                        .map(t => t.tarjeta || '(sin asignar)')
                )]
                if (tarjetasConCargos.length === 0) return null
                return tarjetasConCargos.map(nombre => {
                  const cargos  = txsMes.filter(t => t.cuenta === 'T.C' && t.movimiento === 'Egreso' && t.categoria !== 'Pago TC' && (t.tarjeta || '(sin asignar)') === nombre).reduce((s, t) => s + Math.abs(t.total), 0)
                  const pagados = txsMes.filter(t => t.categoria === 'Pago TC' && t.movimiento === 'Egreso' && (t.tarjeta || '') === (nombre === '(sin asignar)' ? '' : nombre)).reduce((s, t) => s + Math.abs(t.total), 0)
                  const pendiente = Math.max(0, cargos - pagados)
                  return (
                    <Box key={nombre} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <Typography sx={{ fontSize: 13, color: T2 }}>TC {nombre}</Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        {pendiente > 0
                          ? <Typography sx={{ fontSize: 14, fontWeight: 600, color: RED }}>−{formatMoneyShort(pendiente)}</Typography>
                          : <Typography sx={{ fontSize: 13, fontWeight: 600, color: GREEN }}>Pagada ✓</Typography>
                        }
                        {pagados > 0 && (
                          <Typography sx={{ fontSize: 11, color: T2 }}>
                            {pendiente > 0 ? 'Pagado ' : ''}{formatMoneyShort(pagados)} de {formatMoneyShort(cargos)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )
                })
              })()}
            </Box>
          </Box>
        </Box>

        {/* ── Saldo Trasladado ── */}
        {(hayCarryOver || metrics.hasData) && (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.75 }}>
              Disponible {mesNombre}
            </Typography>

            {/* Saldo trasladado */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
              <Box>
                <Typography sx={{ fontSize: 13, color: T1, fontWeight: 500 }}>
                  {esDeuda ? 'Deuda trasladada' : 'Saldo trasladado'}
                </Typography>
                {hayCarryOver && (
                  <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>
                    {esDeuda ? '🔴' : '💰'} {esDeuda ? 'Deuda heredada de' : 'Dinero heredado de'} {MES_NAMES[parseInt(mes.replace('M','')) - 2] || 'mes anterior'}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: hayCarryOver ? (esDeuda ? RED : GREEN) : T2 }}>
                {hayCarryOver ? formatMoney(Math.abs(carryOver)) : '$ 0'}
              </Typography>
            </Box>

            {/* Disponible total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>
                  {esDeuda ? 'Deuda pendiente' : 'Disponible total'}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>
                  {esDeuda ? 'Deuda heredada del mes anterior' : 'Saldo heredado del mes anterior'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: hayCarryOver ? (esDeuda ? RED : GREEN) : T2, letterSpacing: '-0.5px' }}>
                {esDeuda ? '−' : ''}{formatMoney(Math.abs(carryOver))}
              </Typography>
            </Box>

            {/* Cerrar mes / cierre existente */}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
              {cierreMes ? (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>✓ Mes cerrado</Typography>
                    <Typography sx={{ fontSize: 11, color: T2 }}>
                      {cierreMes.carry_over_amount >= 0
                        ? `Traslada ${formatMoneyShort(cierreMes.carry_over_amount)} al siguiente mes`
                        : `Deuda de ${formatMoneyShort(Math.abs(cierreMes.carry_over_amount))} trasladada`}
                    </Typography>
                  </Box>
                  <Typography
                    onClick={() => deleteCierre(mes)}
                    sx={{ fontSize: 11, color: T2, cursor: 'pointer', textDecoration: 'underline', '&:hover': { color: RED } }}
                  >
                    Reabrir
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {!confirmCierre ? (
                    <Box
                      onClick={() => setConfirmCierre(true)}
                      sx={{ display: 'inline-flex', cursor: 'pointer', '&:active': { opacity: 0.7 } }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 500, color: T2 }}>
                        Cerrar {mesNombre} →
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography sx={{ fontSize: 12, color: T1 }}>
                        Balance: <strong style={{ color: balance >= 0 ? GREEN : RED }}>{formatMoney(balance)}</strong>
                        {balance > 0
                          ? ` → se trasladan ${formatMoney(balance)} como ahorro`
                          : ` → se traslada deuda de ${formatMoney(Math.abs(balance))}`}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Box
                          onClick={() => { closeMonth(mes); setConfirmCierre(false) }}
                          sx={{ flex: 1, textAlign: 'center', py: 0.75, borderRadius: '8px', bgcolor: T1, cursor: 'pointer' }}
                        >
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Confirmar cierre</Typography>
                        </Box>
                        <Box
                          onClick={() => setConfirmCierre(false)}
                          sx={{ px: 2, py: 0.75, borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}
                        >
                          <Typography sx={{ fontSize: 12, color: T2 }}>Cancelar</Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* ── Flujo por cuenta ── */}
        {saldosCuenta.length > 0 && (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
              Flujo por cuenta · {mesNombre}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {saldosCuenta.map(({ cuenta, ing, eg, neto }, i) => (
                <Box key={cuenta} sx={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  alignItems: 'center', gap: 1, py: 1.25,
                  borderBottom: i < saldosCuenta.length - 1 ? `1px solid #F0F0F0` : 'none',
                }}>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{cuenta}</Typography>
                    <Typography sx={{ fontSize: 11, color: T2, mt: 0.2 }}>
                      +{formatMoneyShort(ing)} entradas · −{formatMoneyShort(eg)} salidas
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: neto >= 0 ? GREEN : RED }}>
                    {neto >= 0 ? '+' : '−'}{formatMoney(Math.abs(neto))}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Margen del presupuesto ── */}
        {!hayPresup && (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
              Margen presupuestado · {mesNombre}
            </Typography>
            <Typography sx={{ fontSize: 14, color: T2, mb: 1.5 }}>
              Sin presupuesto configurado para este mes
            </Typography>
            <Box onClick={() => navigate('/presupuesto')} sx={{ display: 'inline-block', cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: GREEN }}>Ir a Presupuesto →</Typography>
            </Box>
          </Box>
        )}
        {hayPresup && (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                  Margen presupuestado · {mesNombre}
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: margenPlan >= 0 ? GREEN : RED }}>
                  {margenPlan < 0 ? '−' : ''}{formatMoney(Math.abs(margenPlan))}
                </Typography>
                <Typography sx={{ fontSize: 12, color: T2, mt: 0.4 }}>
                  de {formatMoneyShort(ingPres)} ingresos planeados
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: 11, color: T2, mb: 0.25 }}>Gastado</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: T1 }}>{formatMoneyShort(metrics.eg)}</Typography>
                <Typography sx={{ fontSize: 11, color: T2, mt: 0.25 }}>de {formatMoneyShort(egPresPlan)} plan</Typography>
              </Box>
            </Box>

            {/* Barra gastos */}
            <Box sx={{ mb: 1.25 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2 }}>Ejecutado vs plan</Typography>
                <Typography sx={{ fontSize: 11, color: pctGastado > 0.9 ? RED : pctGastado > 0.7 ? '#F59E0B' : T2 }}>
                  Gastado {formatMoneyShort(metrics.eg)} de {formatMoneyShort(egPresPlan)}
                </Typography>
              </Box>
              <Box sx={{ height: 7, borderRadius: 4, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                  width: `${Math.round(pctGastado * 100)}%`,
                  bgcolor: pctGastado > 0.9 ? RED : pctGastado > 0.7 ? '#F59E0B' : GREEN,
                }} />
              </Box>
            </Box>

            {/* Barra ingresos recibidos */}
            {ingPresDetalle > 0 && (() => {
              const pctIng = Math.min(ingRecibidoPresup / ingPresDetalle, 1)
              const falta  = ingPresDetalle - ingRecibidoPresup
              return (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2 }}>Ingresos recibidos vs esperados</Typography>
                    <Typography sx={{ fontSize: 11, color: pctIng >= 1 ? GREEN : T2 }}>
                      Recibido {formatMoneyShort(ingRecibidoPresup)} de {formatMoneyShort(ingPresDetalle)} esperado
                    </Typography>
                  </Box>
                  <Box sx={{ height: 7, borderRadius: 4, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
                    <Box sx={{
                      height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                      width: `${Math.round(pctIng * 100)}%`,
                      bgcolor: GREEN,
                    }} />
                  </Box>
                </Box>
              )
            })()}
          </Box>
        )}

        {/* ── Proyección fin de mes ── */}
        {hayPresup && (
          <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 2.5, mb: 3, border: `1px solid ${proyeccionFinMes < 0 ? '#FCA5A5' : proyeccionFinMes < margenPlan * 0.8 ? '#FDE68A' : BORDER}` }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
              Proyección fin de mes · {mesNombre}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: proyColor }}>
                  {proyeccionFinMes < 0 ? '−' : ''}{formatMoney(Math.abs(proyeccionFinMes))}
                </Typography>
                <Typography sx={{ fontSize: 12, color: T2, mt: 0.4 }}>
                  {difVsPlan >= 0
                    ? `${formatMoneyShort(difVsPlan)} más de lo planeado`
                    : `${formatMoneyShort(Math.abs(difVsPlan))} menos de lo planeado`}
                </Typography>
              </Box>
              <Box sx={{ px: 1.25, py: 0.5, borderRadius: '20px', bgcolor: proyeccionFinMes < 0 ? '#FEE2E2' : proyeccionFinMes < margenPlan * 0.8 ? '#FEF3C7' : '#DCFCE7' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: proyColor }}>
                  {proyeccionFinMes < 0 ? '⚠ En rojo' : proyeccionFinMes < margenPlan * 0.8 ? '⚠ Ajustado' : '✓ En orden'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, borderTop: `1px solid ${BORDER}`, pt: 1.5 }}>
              {[
                { label: 'Disponible hoy', value: disponibleHoy, sign: '' },
                { label: '+ Por recibir', value: ingresosPendientes, sign: '+' },
                { label: '− Por pagar', value: gastosPendientes, sign: '−' },
                ...(tcPorPagar > 0 ? [{ label: '− Pago TC pendiente', value: tcPorPagar, sign: '−' }] : []),
              ].map(({ label, value, sign }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 12, color: T2 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: T1, fontFamily: 'monospace' }}>
                    {sign} {formatMoneyShort(Math.abs(value))}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Estado del día ── */}
        <Box sx={{ mb: 3 }}>
          <SectionLabel>Hoy</SectionLabel>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[
              {
                label: 'Hábitos',
                value: habitosData.total > 0 ? `${habitosData.done}/${habitosData.total}` : '—',
                path: '/habitos',
              },
              {
                label: `Aporte ${mesNombre}`,
                value: aporteData.ok ? 'Listo' : 'Pendiente',
                path: '/inversiones',
              },
              {
                label: 'Meta ahorro',
                value: metaData !== null ? `${metaData}%` : '—',
                path: '/metas',
              },
            ].map(({ label, value, path }) => (
              <Box key={label} onClick={() => navigate(path)} sx={{
                flex: 1, minWidth: 0, bgcolor: '#F3F4F6', borderRadius: '12px',
                px: 1.25, py: 1.25, cursor: 'pointer', '&:active': { opacity: 0.7 },
              }}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: GREEN, lineHeight: 1.2 }}>{value}</Typography>
                <Typography sx={{ fontSize: 11, color: T2, mt: 0.2, lineHeight: 1.2 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── ZONA 2: Últimos movimientos + Accesos rápidos ── */}

        {/* Últimos movimientos */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
            <SectionLabel>Últimos movimientos</SectionLabel>
            {recientes.length > 0 && (
              <Box onClick={() => navigate('/historial')} sx={{ mb: 1.25, cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
                <Typography sx={{ fontSize: 13, color: GREEN, fontWeight: 500 }}>Ver todo →</Typography>
              </Box>
            )}
          </Box>

          {recientes.length === 0 ? (
            <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 14, color: T2, mb: 1.5 }}>Aún no hay movimientos</Typography>
              <Box onClick={() => navigate('/registro')} sx={{
                display: 'inline-block', px: 2.5, py: 1, borderRadius: '10px',
                bgcolor: GREEN, cursor: 'pointer', '&:active': { opacity: 0.85 },
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Registrar primer gasto</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ bgcolor: CARD, borderRadius: '12px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              {recientes.map((tx, i) => {
                const esIngreso = tx.movimiento === 'Ingreso'
                const catColor  = CAT_COLORS[tx.categoria] || '#919EAB'
                const monto     = Math.abs(tx.total || tx.monto || 0)
                return (
                  <Box key={tx.id} onClick={() => navigate('/historial')} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2, py: 1.375, cursor: 'pointer', '&:active': { opacity: 0.8 },
                    borderBottom: i < recientes.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, bgcolor: `${catColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {CAT_ICONS[tx.categoria] || '💸'}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: T1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.concepto || tx.categoria}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: T2, mt: 0.15 }}>{relDate(tx.fecha)}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: esIngreso ? GREEN : T1, flexShrink: 0 }}>
                      {esIngreso ? '+' : '−'}{formatMoneyShort(monto)}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        {/* Accesos rápidos — scroll horizontal */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, pb: 0.5, mx: '-20px', px: '20px' }}>
            {QUICK.map(({ icon, label, path }) => (
              <Box key={path} onClick={() => navigate(path)} sx={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 0.5, px: 1.5, py: 1, cursor: 'pointer', '&:active': { opacity: 0.7 },
              }}>
                <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: CARD, boxShadow: CARD_SH, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {icon}
                </Box>
                <Typography sx={{ fontSize: 10, fontWeight: 500, color: T2, lineHeight: 1, mt: 0.25 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

      </Box>
    </Box>
  )
}
