export function computeMetrics(transacciones, mes) {
  const txs = transacciones.filter(t => t.mes === mes);
  const ing  = txs.filter(t => t.movimiento === 'Ingreso').reduce((s, t) => s + Math.abs(t.total), 0);
  const eg   = txs.filter(t => t.movimiento === 'Egreso').reduce((s, t) => s + Math.abs(t.total), 0);
  const fijos = txs.filter(t => t.movimiento === 'Egreso' && t.tipo === 'Fijo').reduce((s, t) => s + Math.abs(t.total), 0);
  const vars  = txs.filter(t => t.movimiento === 'Egreso' && t.tipo === 'Variable').reduce((s, t) => s + Math.abs(t.total), 0);
  const ahorroReal = txs.filter(t => t.categoria === 'Ahorro').reduce((s, t) => s + Math.abs(t.total), 0);
  const invReal    = txs.filter(t => t.categoria === 'Inversion').reduce((s, t) => s + Math.abs(t.total), 0);
  const tasaAhorro = ing > 0 ? ahorroReal / ing : 0;
  const nequiIng = txs.filter(t => t.movimiento === 'Ingreso' && t.cuenta === 'Nequi').reduce((s, t) => s + Math.abs(t.total), 0);
  const nequiEg  = txs.filter(t => t.movimiento === 'Egreso'  && t.cuenta === 'Nequi').reduce((s, t) => s + Math.abs(t.total), 0);
  const tcEg     = txs.filter(t => t.movimiento === 'Egreso'  && t.cuenta === 'T.C').reduce((s, t) => s + Math.abs(t.total), 0);
  const otrosEg  = eg - nequiEg - tcEg;
  const byCat = {};
  txs.filter(t => t.movimiento === 'Egreso').forEach(t => {
    byCat[t.categoria] = (byCat[t.categoria] || 0) + Math.abs(t.total);
  });
  const byIngresoCat = {};
  txs.filter(t => t.movimiento === 'Ingreso').forEach(t => {
    byIngresoCat[t.categoria] = (byIngresoCat[t.categoria] || 0) + Math.abs(t.total);
  });
  const egCash   = eg - tcEg;
  const netoCash = ing - egCash;
  const hasData = ing > 0 || eg > 0;
  return { ing, eg, neto: ing - eg, egCash, netoCash, fijos, vars, ahorroReal, invReal, tasaAhorro, nequiIng, nequiEg, tcEg, otrosEg, byCat, byIngresoCat, hasData };
}
