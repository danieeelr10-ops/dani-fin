// Utilidades de flujo de caja real
// Separadas de metrics.js porque trabajan con proyecciones y estados de cobro

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function diasHasta(fechaStr) {
  if (!fechaStr) return null;
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const dest = new Date(fechaStr.split('T')[0] + 'T00:00:00');
  return Math.round((dest - hoy) / 86400000);
}

// Dinero real disponible hoy:
// carryOver (saldo del mes anterior) + ingresos ya recibidos − egresos cash ya realizados
export function computeDisponibleHoy(transacciones, mes, carryOver = 0) {
  const hoy = todayStr();
  const txsMes = transacciones.filter(t => t.mes === mes);

  const ingRecibidos = txsMes
    .filter(t =>
      t.movimiento === 'Ingreso' &&
      t.categoria  !== 'Pago TC' &&
      t.estado     !== 'pendiente' &&
      !t.esFuturo
    )
    .reduce((s, t) => s + Math.abs(t.total), 0);

  const egCash = txsMes
    .filter(t =>
      t.movimiento === 'Egreso' &&
      t.cuenta     !== 'T.C' &&
      t.categoria  !== 'Pago TC' &&
      !t.esFuturo
    )
    .reduce((s, t) => s + Math.abs(t.total), 0);

  const pagoTC = txsMes
    .filter(t => t.movimiento === 'Egreso' && t.categoria === 'Pago TC' && !t.esFuturo)
    .reduce((s, t) => s + Math.abs(t.total), 0);

  return carryOver + ingRecibidos - egCash - pagoTC;
}

// Ingresos pendientes de cobro (estado: pendiente | parcial, o esFuturo=true)
export function computePorCobrar(transacciones) {
  const hoy = todayStr();
  const pendientes = transacciones.filter(t =>
    t.movimiento === 'Ingreso' &&
    (t.esFuturo || t.estado === 'pendiente' || t.estado === 'parcial')
  );

  const total = pendientes.reduce((s, t) => {
    const base = Math.abs(t.total);
    const pagado = t.montoPagado || 0;
    return s + (base - pagado);
  }, 0);

  const vencidos = pendientes.filter(t =>
    t.fechaVencimiento && t.fechaVencimiento < hoy
  );
  const totalVencido = vencidos.reduce((s, t) => s + (Math.abs(t.total) - (t.montoPagado || 0)), 0);

  // Próximos 7 días
  const proximos7d = pendientes.filter(t => {
    const d = diasHasta(t.fechaVencimiento || t.fecha);
    return d !== null && d >= 0 && d <= 7;
  });

  return { total, totalVencido, pendientes, vencidos, proximos7d };
}

// Egresos programados futuros
export function computeProximosPagos(transacciones, dias = 30) {
  const hoy = todayStr();
  const futuros = transacciones.filter(t =>
    t.movimiento === 'Egreso' &&
    t.esFuturo === true &&
    t.fecha &&
    t.fecha.split('T')[0] > hoy
  );

  const enRango = futuros.filter(t => {
    const d = diasHasta(t.fecha);
    return d !== null && d >= 0 && d <= dias;
  });

  const total = enRango.reduce((s, t) => s + Math.abs(t.total), 0);
  const total7d = enRango.filter(t => diasHasta(t.fecha) <= 7).reduce((s, t) => s + Math.abs(t.total), 0);

  return { total, total7d, items: enRango.sort((a, b) => a.fecha.localeCompare(b.fecha)) };
}

// Estadísticas de ingresos variables: promedios, tendencia, rangos
export function computeIngresoStats(transacciones, mesActual) {
  const mesIdx = parseInt(mesActual.replace('M', '')) - 1;

  const getIng = (mes) => transacciones
    .filter(t =>
      t.mes === mes &&
      t.movimiento === 'Ingreso' &&
      t.estado !== 'pendiente' &&
      !t.esFuturo &&
      t.categoria !== 'Pago TC'
    )
    .reduce((s, t) => s + Math.abs(t.total), 0);

  // Meses anteriores al actual (excluye el mes en curso)
  const mkMeses = (n) => Array.from({ length: n }, (_, i) => `M${mesIdx - i}`)
    .filter(m => { const idx = parseInt(m.replace('M','')); return idx >= 1 && idx <= 12; });

  const meses3  = mkMeses(3);
  const meses6  = mkMeses(6);
  const meses12 = mkMeses(12);

  const vals3  = meses3.map(m => getIng(m)).filter(v => v > 0);
  const vals6  = meses6.map(m => getIng(m)).filter(v => v > 0);
  const vals12 = meses12.map(m => getIng(m)).filter(v => v > 0);

  const avg  = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const desv = arr => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };

  const prom3  = avg(vals3);
  const prom6  = avg(vals6);
  const prom12 = avg(vals12);
  const d = desv(vals6);

  let tendencia = 'insuficiente';
  if (vals3.length >= 2) {
    const reciente  = vals3[0];
    const anterior  = vals3[1];
    if (reciente > anterior * 1.05)      tendencia = 'crecimiento';
    else if (reciente < anterior * 0.95) tendencia = 'caida';
    else                                  tendencia = 'estabilidad';
  }

  return {
    prom3, prom6, prom12,
    minEsperado:       Math.max(0, prom3 - d),
    probableEsperado:  prom3,
    optimistaEsperado: vals6.length > 0 ? Math.max(...vals6) : 0,
    tendencia,
    mesesConDatos: vals12.length,
  };
}

// Motor de alertas — devuelve array ordenado por nivel de urgencia
export function computeAlertas(transacciones, mes, carryOver = 0) {
  const alertas = [];
  const disponible     = computeDisponibleHoy(transacciones, mes, carryOver);
  const porCobrar      = computePorCobrar(transacciones);
  const proximosPagos  = computeProximosPagos(transacciones, 30);
  const proyectado30d  = disponible + porCobrar.total - proximosPagos.total;

  if (proyectado30d < 0) {
    alertas.push({
      nivel: 'critico', icono: '🔴',
      msg: 'Saldo proyectado negativo en 30 días',
      monto: Math.abs(proyectado30d),
    });
  }

  if (porCobrar.totalVencido > 0) {
    alertas.push({
      nivel: 'alto', icono: '⚠️',
      msg: 'Tienes cobros vencidos sin recibir',
      monto: porCobrar.totalVencido,
    });
  }

  const pagos3d = proximosPagos.items.filter(t => {
    const d = diasHasta(t.fecha);
    return d !== null && d <= 3;
  });
  pagos3d.forEach(t => {
    const d = diasHasta(t.fecha);
    alertas.push({
      nivel: 'info', icono: '📅',
      msg: `${t.concepto || t.categoria}`,
      detalle: d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`,
      monto: Math.abs(t.total),
    });
  });

  const ORDEN = { critico: 0, alto: 1, medio: 2, info: 3 };
  return alertas.sort((a, b) => (ORDEN[a.nivel] ?? 9) - (ORDEN[b.nivel] ?? 9));
}

export { diasHasta };
