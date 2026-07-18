export function computeMetrics(transacciones, mes) {
  const txs = transacciones.filter(t => t.mes === mes);

  // Excluir 'Pago TC' de ingresos y egresos base — son transferencias internas
  const ing  = txs.filter(t => t.movimiento === 'Ingreso' && t.categoria !== 'Pago TC').reduce((s, t) => s + Math.abs(t.total), 0);
  const eg   = txs.filter(t => t.movimiento === 'Egreso'  && t.categoria !== 'Pago TC').reduce((s, t) => s + Math.abs(t.total), 0);
  // Ingresos ya recibidos (excluye pendientes y futuros)
  const ingRecibidos = txs.filter(t => t.movimiento === 'Ingreso' && t.categoria !== 'Pago TC' && t.estado !== 'pendiente' && !t.esFuturo).reduce((s, t) => s + Math.abs(t.total), 0);

  // TC expenses are excluded from cash balance — they're debt until paid
  const tcEg   = txs.filter(t => t.movimiento === 'Egreso' && t.cuenta === 'T.C').reduce((s, t) => s + Math.abs(t.total), 0);

  // Pago del corte TC: sale de cuenta de ahorros → SÍ reduce el balance de caja
  const pagoTC = txs.filter(t => t.movimiento === 'Egreso' && t.categoria === 'Pago TC').reduce((s, t) => s + Math.abs(t.total), 0);

  const egCash   = eg - tcEg + pagoTC;  // cash out: sin cargos TC pero con el pago del corte
  const netoCash = ing - egCash;

  const fijos = txs.filter(t => t.movimiento === 'Egreso' && t.cuenta !== 'T.C' && t.categoria !== 'Pago TC' && t.tipo === 'Fijo').reduce((s, t) => s + Math.abs(t.total), 0);
  const vars  = txs.filter(t => t.movimiento === 'Egreso' && t.cuenta !== 'T.C' && t.categoria !== 'Pago TC' && t.tipo === 'Variable').reduce((s, t) => s + Math.abs(t.total), 0);
  const ahorroReal = txs.filter(t => t.categoria === 'Ahorro').reduce((s, t) => s + Math.abs(t.total), 0);
  const invReal    = txs.filter(t => t.categoria === 'Inversion').reduce((s, t) => s + Math.abs(t.total), 0);
  const tasaAhorro = ing > 0 ? ahorroReal / ing : 0;
  // Balance del mes: ingresos recibidos vs todos los egresos (incluyendo TC)
  const flujoMes = ingRecibidos - eg;
  const nequiIng = txs.filter(t => t.movimiento === 'Ingreso' && t.cuenta === 'Nequi').reduce((s, t) => s + Math.abs(t.total), 0);
  const nequiEg  = txs.filter(t => t.movimiento === 'Egreso'  && t.cuenta === 'Nequi').reduce((s, t) => s + Math.abs(t.total), 0);
  const otrosEg  = egCash - nequiEg;

  // byCat: cash only (for cash balance display)
  const byCat = {};
  txs.filter(t => t.movimiento === 'Egreso' && t.cuenta !== 'T.C').forEach(t => {
    byCat[t.categoria] = (byCat[t.categoria] || 0) + Math.abs(t.total);
  });
  // byCatAll: includes TC (for budget progress) but NOT Pago TC (that's a transfer, not spending)
  const byCatAll = {};
  txs.filter(t => t.movimiento === 'Egreso' && t.categoria !== 'Pago TC').forEach(t => {
    byCatAll[t.categoria] = (byCatAll[t.categoria] || 0) + Math.abs(t.total);
  });
  const byIngresoCat = {};
  txs.filter(t => t.movimiento === 'Ingreso').forEach(t => {
    byIngresoCat[t.categoria] = (byIngresoCat[t.categoria] || 0) + Math.abs(t.total);
  });
  const hasData = ing > 0 || eg > 0;
  return { ing, eg, egCash, tcEg, pagoTC, neto: netoCash, flujoMes, ingRecibidos, fijos, vars, ahorroReal, invReal, tasaAhorro, nequiIng, nequiEg, otrosEg, byCat, byCatAll, byIngresoCat, hasData };
}
