import { createContext, useContext, useState, useRef, useEffect } from 'react';
import {
  DEFAULT_METAS, DEFAULT_INVERSIONES, MESES,
  CATEGORIAS_EGRESO_FIJO, CATEGORIAS_EGRESO_VARIABLE,
  CATEGORIAS_INGRESO, CUENTAS,
} from 'src/constants';
import { supabase } from 'src/lib/supabase';
import { useAuth } from 'src/context/AuthContext';
import { getMesActual } from 'src/utils/format';
import { computeMetrics } from 'src/utils/metrics';

const EMPTY_PRESUPUESTOS = Object.fromEntries(MESES.map(m => [m, {}]));
const EMPTY_DETALLE      = Object.fromEntries(MESES.map(m => [m, []]));

const INITIAL_STATE = {
  transacciones: [],
  mercado: [],
  sheetId: '',
  scriptUrl: '',
  metas:      JSON.parse(JSON.stringify(DEFAULT_METAS)),
  inversiones: JSON.parse(JSON.stringify(DEFAULT_INVERSIONES)),
  presupuestos:        { ...EMPTY_PRESUPUESTOS },
  presupuestosDetalle: { ...EMPTY_DETALLE },
  categoriasEgresoFijo:     [...CATEGORIAS_EGRESO_FIJO],
  categoriasEgresoVariable: [...CATEGORIAS_EGRESO_VARIABLE],
  categoriasIngreso:        [...CATEGORIAS_INGRESO],
  cuentas:                  [...CUENTAS],
  tarjetas: [],
  habitos: [],
  habitosChecks: {},
  habitosFrozen: {},
  saldosIniciales: {},
  plantilla: {},
  cierresMensuales: {},
  perfilIngresos: 'variable',
  metasPersonalizadas: [],
  nombreUsuario: '',
  lastModified: 0,
};

function mergeWithDefaults(p) {
  const presupuestos = (p.presupuestos && typeof p.presupuestos === 'object')
    ? { ...EMPTY_PRESUPUESTOS, ...p.presupuestos }
    : { ...EMPTY_PRESUPUESTOS };
  const presupuestosDetalle = (p.presupuestosDetalle && typeof p.presupuestosDetalle === 'object')
    ? { ...EMPTY_DETALLE, ...p.presupuestosDetalle }
    : { ...EMPTY_DETALLE };
  return {
    transacciones:            p.transacciones            || [],
    mercado:                  p.mercado                  || [],
    sheetId:                  p.sheetId                  || '',
    scriptUrl:                p.scriptUrl                || '',
    metas:                    p.metas                    || JSON.parse(JSON.stringify(DEFAULT_METAS)),
    inversiones:              p.inversiones?.length      ? p.inversiones : JSON.parse(JSON.stringify(DEFAULT_INVERSIONES)),
    presupuestos,
    presupuestosDetalle,
    categoriasEgresoFijo:     p.categoriasEgresoFijo     || [...CATEGORIAS_EGRESO_FIJO],
    categoriasEgresoVariable: p.categoriasEgresoVariable || [...CATEGORIAS_EGRESO_VARIABLE],
    categoriasIngreso:        p.categoriasIngreso        || [...CATEGORIAS_INGRESO],
    cuentas:                  p.cuentas                  || [...CUENTAS],
    tarjetas:                 p.tarjetas                 || [],
    presupuestoTarjetas:      p.presupuestoTarjetas      || {},
    habitos:                  p.habitos                  || [],
    habitosChecks:            p.habitosChecks            || {},
    habitosFrozen:            p.habitosFrozen            || {},
    saldosIniciales:          p.saldosIniciales          || {},
    plantilla:                p.plantilla                || {},
    cierresMensuales:         p.cierresMensuales         || {},
    perfilIngresos:           p.perfilIngresos           || 'variable',
    metasPersonalizadas:      p.metasPersonalizadas      || [],
    nombreUsuario:            p.nombreUsuario            || '',
    lastModified:             p.lastModified             || 0,
  };
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('dani_fin_v2');
    if (saved) return mergeWithDefaults(JSON.parse(saved));
  } catch (e) { /* ignore */ }
  return { ...INITIAL_STATE };
}

function persistLocal(state) {
  localStorage.setItem('dani_fin_v2', JSON.stringify(state));
}

// Backup independiente — se actualiza solo cuando hay datos reales
function persistBackup(state) {
  try {
    if ((state.transacciones?.length || 0) > 0 ||
        Object.values(state.presupuestosDetalle || {}).some(a => a?.length > 0)) {
      localStorage.setItem('dani_fin_backup', JSON.stringify({ ...state, backupAt: Date.now() }));
    }
  } catch {}
}

const IS_DEV = import.meta.env.DEV;

async function persistRemote(state, userId) {
  if (IS_DEV) return; // Dev: nunca escribir a Supabase de producción
  try {
    await supabase.from('user_data').upsert({
      user_id: userId,
      data: state,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Supabase sync error:', e);
  }
}

// Migración v2: elimina transacciones de ingreso creadas por PagarView (tipo='Fijo')
// ya que distorsionan el balance. Deja solo las registradas manualmente (tipo='Ingreso').
// SOLO corre una vez por dispositivo (flag en localStorage).
function fixIngresosFijos(s) {
  const FLAG = 'fix_ingresos_fijos_v1_done';
  try { if (localStorage.getItem(FLAG)) return { state: s, changed: false }; } catch(e) {}

  const { transacciones, presupuestosDetalle } = s;

  // Solo elimina ingresos Fijo que estén vinculados a un item de presupuesto (creados por pagarPresupuestoItem)
  const linkedTxIds = new Set();
  Object.values(presupuestosDetalle || {}).forEach(items =>
    (items || []).forEach(i => { if (i.txId) linkedTxIds.add(String(i.txId)); })
  );

  // Transacciones problemáticas: Ingreso + tipo=Fijo + vinculadas a presupuesto
  const badIds = new Set(
    transacciones
      .filter(t => t.movimiento === 'Ingreso' && t.tipo === 'Fijo' && linkedTxIds.has(String(t.id)))
      .map(t => t.id)
  );

  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
  if (badIds.size === 0) return { state: s, changed: false };

  // Limpiar pagadoCon en items cuyo txId apunta a una tx eliminada
  const newDetalle = {};
  Object.entries(presupuestosDetalle || {}).forEach(([mes, items]) => {
    newDetalle[mes] = (items || []).map(item =>
      badIds.has(item.txId)
        ? { ...item, pagadoCon: null, tarjetaPago: null, txId: null }
        : item
    );
  });

  console.log(`[fixIngresosFijos] Eliminadas ${badIds.size} txs Ingreso/Fijo incorrectas`);
  return {
    state: {
      ...s,
      transacciones: transacciones.filter(t => !badIds.has(t.id)),
      presupuestosDetalle: newDetalle,
    },
    changed: true,
  };
}

// Migración v1: crea transacciones individuales para items de mercado que solo
// tienen una transacción bulk "Mercado" (creados antes del fix del 17-abr-2026).
function migrateMercadoOrphans(s) {
  const { mercado, transacciones } = s;
  if (!mercado?.length) return { state: s, changed: false };

  // Items sin transacción individual (por nombre + fecha)
  const orphaned = mercado.filter(item => {
    const day = item.fecha?.split('T')[0];
    return !transacciones.some(t =>
      (t.id === `mig_${item.id}` ||
        (t.concepto === item.nombre && t.categoria === 'Mercado' && t.fecha?.split('T')[0] === day))
    );
  });

  if (!orphaned.length) return { state: s, changed: false };

  // Agrupar orphans por día
  const byDay = {};
  orphaned.forEach(item => {
    const day = item.fecha?.split('T')[0];
    (byDay[day] = byDay[day] || []).push(item);
  });

  let newTxs = [...transacciones];
  Object.entries(byDay).forEach(([day, items]) => {
    // Quitar la transacción bulk "Mercado" de ese día (evita doble conteo)
    newTxs = newTxs.filter(t => !(t.concepto === 'Mercado' && t.fecha?.split('T')[0] === day));
    // Agregar una transacción por item
    items.forEach(item => {
      newTxs.push({
        id: `mig_${item.id}`,
        concepto: item.nombre,
        total: -(item.precio * (item.cantidad || 1)),
        pago:  -(item.precio * (item.cantidad || 1)),
        saldo: 0,
        categoria: 'Mercado',
        movimiento: 'Egreso',
        tipo: 'Variable',
        cuenta: 'Efectivo',
        fecha: item.fecha,
        mes: item.mes,
        cantidad: item.cantidad || 1,
      });
    });
  });

  return { state: { ...s, transacciones: newTxs }, changed: true };
}

// Elimina transacciones duplicadas: mismo concepto + mes + movimiento, queda la más antigua
// o la que está vinculada via txId en presupuestosDetalle
function deduplicateTransacciones(s) {
  const { transacciones, presupuestosDetalle } = s;

  // Ids vinculados desde presupuesto (tienen prioridad para mantenerse)
  const linkedIds = new Set();
  Object.values(presupuestosDetalle || {}).forEach(items =>
    (items || []).forEach(i => { if (i.txId) linkedIds.add(String(i.txId)); })
  );

  const key = t => `${t.mes}|${t.movimiento}|${(t.concepto || '').toLowerCase().trim()}`;
  const seen = {};
  const toDelete = new Set();

  // Primer paso: agrupar
  transacciones.forEach(t => {
    const k = key(t);
    (seen[k] = seen[k] || []).push(t);
  });

  // Segundo paso: por cada grupo con duplicados, marcar los sobrantes para borrar
  Object.values(seen).forEach(group => {
    if (group.length < 2) return;
    // Ordenar: primero los vinculados, luego por id más pequeño (más antiguo)
    const sorted = [...group].sort((a, b) => {
      const aLinked = linkedIds.has(String(a.id)) ? 0 : 1;
      const bLinked = linkedIds.has(String(b.id)) ? 0 : 1;
      if (aLinked !== bLinked) return aLinked - bLinked;
      return String(a.id).localeCompare(String(b.id));
    });
    // El primero se queda, el resto se borra
    sorted.slice(1).forEach(t => toDelete.add(t.id));
  });

  if (toDelete.size === 0) return { state: s, changed: false };

  const cleaned = transacciones.filter(t => !toDelete.has(t.id));
  console.log(`[dedup] Eliminadas ${toDelete.size} transacciones duplicadas`);
  return { state: { ...s, transacciones: cleaned }, changed: true };
}

// Migración v3: carga extracto Nu Abril 2026
const NU_ABRIL = [
  { fecha: '2026-04-16', concepto: 'Rappi Colombia',         monto: 15000,  categoria: 'Salidas' },
  { fecha: '2026-04-16', concepto: 'Delicias Del Campo Sup', monto: 38500,  categoria: 'Mercado' },
  { fecha: '2026-04-15', concepto: 'Angela Milena Gil',      monto: 37100,  categoria: 'Hogar'   },
  { fecha: '2026-04-15', concepto: 'Rappi Colombia',         monto: 47600,  categoria: 'Salidas' },
  { fecha: '2026-04-14', concepto: 'Rappi Colombia',         monto: 24900,  categoria: 'Salidas' },
  { fecha: '2026-04-12', concepto: 'Eds Las Vegas',          monto: 100000, categoria: 'Extras'  },
  { fecha: '2026-04-11', concepto: 'Tiendas Ara',            monto: 15406,  categoria: 'Mercado' },
  { fecha: '2026-04-11', concepto: 'Rappi Colombia',         monto: 26900,  categoria: 'Salidas' },
  { fecha: '2026-04-09', concepto: 'Pws Serv Integrales',    monto: 30252,  categoria: 'Hogar'   },
  { fecha: '2026-04-08', concepto: 'Rappi Colombia',         monto: 16800,  categoria: 'Salidas' },
  { fecha: '2026-04-07', concepto: 'Organizacion Hercada',   monto: 15481,  categoria: 'Mercado' },
  { fecha: '2026-04-07', concepto: 'Jcarnes San Rafael',     monto: 29850,  categoria: 'Mercado' },
  { fecha: '2026-04-05', concepto: 'Rappi Colombia',         monto: 66364,  categoria: 'Salidas' },
  { fecha: '2026-04-05', concepto: 'Rappi Colombia',         monto: 12500,  categoria: 'Salidas' },
  { fecha: '2026-04-04', concepto: 'Passaro Charcuteria',    monto: 41300,  categoria: 'Mercado' },
  { fecha: '2026-04-04', concepto: 'Passaro Charcuteria',    monto: 146000, categoria: 'Mercado' },
  { fecha: '2026-04-04', concepto: 'Eds Primax Las Margari', monto: 100000, categoria: 'Extras'  },
];
function seedNuAbril(s) {
  const FLAG = 'nu_abril_2026_loaded';
  try { if (localStorage.getItem(FLAG)) return { state: s, changed: false }; } catch(e) {}
  const yaExiste = s.transacciones.some(t => t.mes === 'M4' && t.cuenta === 'T.C' && t.tarjeta === 'Nu');
  if (yaExiste) {
    try { localStorage.setItem(FLAG, '1'); } catch(e) {}
    return { state: s, changed: false };
  }
  const nuevas = NU_ABRIL.map((item, i) => ({
    id: `nu_abr_${i}`, concepto: item.concepto, total: -item.monto, pago: -item.monto, saldo: 0,
    categoria: item.categoria, movimiento: 'Egreso', tipo: 'Variable',
    cuenta: 'T.C', tarjeta: 'Nu', fecha: item.fecha + 'T12:00:00', mes: 'M4',
  }));
  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
  return { state: { ...s, transacciones: [...s.transacciones, ...nuevas] }, changed: true };
}


// Migración v4: carga extracto Nu Marzo 2026
const NU_MARZO = [
  { fecha: '2026-03-31', concepto: 'Rappi Colombia',        monto: 30900, categoria: 'Salidas' },
  { fecha: '2026-03-29', concepto: 'Paseo Parking',         monto: 8600,  categoria: 'Extras'  },
  { fecha: '2026-03-29', concepto: 'Dollarcity Paseo San R',monto: 18500, categoria: 'Extras'  },
  { fecha: '2026-03-28', concepto: 'Uber Rides',            monto: 20850, categoria: 'Salidas' },
  { fecha: '2026-03-28', concepto: 'Dlo Didi',              monto: 20300, categoria: 'Salidas' },
  { fecha: '2026-03-28', concepto: 'Dlo Didi',              monto: 21000, categoria: 'Salidas' },
  { fecha: '2026-03-27', concepto: 'Rappi Colombia',        monto: 13500, categoria: 'Salidas' },
  { fecha: '2026-03-27', concepto: 'Rappi Colombia',        monto: 28650, categoria: 'Salidas' },
  { fecha: '2026-03-24', concepto: 'Angela Milena Gil',     monto: 19800, categoria: 'Hogar'   },
  { fecha: '2026-03-24', concepto: 'Angela Milena Gil',     monto: 12550, categoria: 'Hogar'   },
  { fecha: '2026-03-23', concepto: 'Rappi Colombia',        monto: 60700, categoria: 'Salidas' },
];
function seedNuMarzo(s) {
  const FLAG = 'nu_marzo_2026_loaded';
  try { if (localStorage.getItem(FLAG)) return { state: s, changed: false }; } catch(e) {}
  const yaExiste = s.transacciones.some(t => t.mes === 'M3' && t.cuenta === 'T.C' && t.tarjeta === 'Nu');
  if (yaExiste) {
    try { localStorage.setItem(FLAG, '1'); } catch(e) {}
    return { state: s, changed: false };
  }
  const nuevas = NU_MARZO.map((item, i) => ({
    id: `nu_mar_${i}`, concepto: item.concepto, total: -item.monto, pago: -item.monto, saldo: 0,
    categoria: item.categoria, movimiento: 'Egreso', tipo: 'Variable',
    cuenta: 'T.C', tarjeta: 'Nu', fecha: item.fecha + 'T12:00:00', mes: 'M3',
  }));
  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
  return { state: { ...s, transacciones: [...s.transacciones, ...nuevas] }, changed: true };
}

function recalcPresupuestoFromDetalle(mesData, detalles) {
  const next = { ...mesData };
  const cats = [...new Set(detalles.map(d => d.categoria))];
  cats.forEach(c => { next[c] = 0; });
  detalles.forEach(d => { next[d.categoria] = (next[d.categoria] || 0) + d.monto; });
  return next;
}

const FinanzasContext = createContext(null);

// Seed completo Enero–Junio 2026
function seedLocal2026(s) {
  const FLAG = 'seed_local_2026_v1';
  try { if (localStorage.getItem(FLAG)) return { state: s, changed: false }; } catch(e) {}
  if ((s.transacciones?.length || 0) > 30) return { state: s, changed: false };

  const fijo = (id, mes, fecha, cat, concepto, total, cuenta = 'Efectivo') =>
    ({ id, mes, fecha, tipo: 'Fijo', movimiento: 'Egreso', categoria: cat, concepto, total, pago: total, saldo: 0, cuenta })
  const vari = (id, mes, fecha, cat, concepto, total, cuenta = 'T.C') =>
    ({ id, mes, fecha, tipo: 'Variable', movimiento: 'Egreso', categoria: cat, concepto, total, pago: total, saldo: 0, cuenta })
  const ing = (id, mes, fecha, cat, concepto, total, cuenta = 'Nequi') =>
    ({ id, mes, fecha, tipo: 'Fijo', movimiento: 'Ingreso', categoria: cat, concepto, total, pago: total, saldo: 0, cuenta })

  let id = 2000
  const next = () => ++id

  const txs = [
    // ── ENERO (M1) ─────────────────────────────────────────────
    ing(next(),'M1','2026-01-05','Sueldo','Lau y Javi',480000),
    ing(next(),'M1','2026-01-05','Sueldo','Vittoria',1476000),
    ing(next(),'M1','2026-01-05','Sueldo','Julio',200000),
    ing(next(),'M1','2026-01-05','Sueldo','Laurent',700000),
    ing(next(),'M1','2026-01-05','Sueldo','Vero',840000),
    ing(next(),'M1','2026-01-10','Trabajo extra','Sesiones extra',350000),
    fijo(next(),'M1','2026-01-05','Hogar','Arriendo',1700000),
    fijo(next(),'M1','2026-01-05','Hogar','Internet',53800),
    fijo(next(),'M1','2026-01-05','Hogar','Luz',42000),
    fijo(next(),'M1','2026-01-05','Hogar','Gas',27000),
    fijo(next(),'M1','2026-01-05','Hogar','Agua',37000),
    fijo(next(),'M1','2026-01-05','Hogar','Servicios Mazuren',220000),
    fijo(next(),'M1','2026-01-05','Familia','Papa',400000),
    fijo(next(),'M1','2026-01-05','Salud','Compensar',537100),
    fijo(next(),'M1','2026-01-05','Trabajo','Arriendo GYM',300000,'Nequi'),
    fijo(next(),'M1','2026-01-05','Ahorro','Ahorro mensual',300000,'Nequi'),
    fijo(next(),'M1','2026-01-05','Entretenimiento','Apple',44900,'T.C'),
    fijo(next(),'M1','2026-01-05','Entretenimiento','DIRECTV',80000,'T.C'),
    fijo(next(),'M1','2026-01-05','Trabajo','Claude',76000,'T.C'),
    fijo(next(),'M1','2026-01-05','Trabajo','Canva',23000,'T.C'),
    fijo(next(),'M1','2026-01-05','Extras','Celu',46400,'T.C'),
    vari(next(),'M1','2026-01-08','Mercado','Mercado semana 1',185000),
    vari(next(),'M1','2026-01-15','Mercado','Mercado semana 2',162000),
    vari(next(),'M1','2026-01-22','Mercado','Mercado semana 3',143000),
    vari(next(),'M1','2026-01-10','Transporte','Ubers semana',45000),
    vari(next(),'M1','2026-01-18','Salidas','Comida fuera',65000),
    vari(next(),'M1','2026-01-25','Entretenimiento','Cine',32000),

    // ── FEBRERO (M2) ───────────────────────────────────────────
    ing(next(),'M2','2026-02-05','Sueldo','Lau y Javi',480000),
    ing(next(),'M2','2026-02-05','Sueldo','Vittoria',1476000),
    ing(next(),'M2','2026-02-05','Sueldo','Julio',200000),
    ing(next(),'M2','2026-02-05','Sueldo','Laurent',700000),
    ing(next(),'M2','2026-02-05','Sueldo','Felipe y Juana',760000),
    ing(next(),'M2','2026-02-05','Sueldo','Diego O',110000),
    ing(next(),'M2','2026-02-14','Trabajo extra','Consultoría',500000),
    fijo(next(),'M2','2026-02-05','Hogar','Arriendo',1700000),
    fijo(next(),'M2','2026-02-05','Hogar','Internet',53800),
    fijo(next(),'M2','2026-02-05','Hogar','Luz',39000),
    fijo(next(),'M2','2026-02-05','Hogar','Gas',25000),
    fijo(next(),'M2','2026-02-05','Hogar','Agua',37000),
    fijo(next(),'M2','2026-02-05','Hogar','Servicios Mazuren',220000),
    fijo(next(),'M2','2026-02-05','Familia','Papa',400000),
    fijo(next(),'M2','2026-02-05','Salud','Compensar',537100),
    fijo(next(),'M2','2026-02-05','Trabajo','Arriendo GYM',300000,'Nequi'),
    fijo(next(),'M2','2026-02-05','Ahorro','Ahorro mensual',400000,'Nequi'),
    fijo(next(),'M2','2026-02-05','Inversion','VOO',200000,'Nequi'),
    fijo(next(),'M2','2026-02-05','Entretenimiento','Apple',44900,'T.C'),
    fijo(next(),'M2','2026-02-05','Entretenimiento','DIRECTV',80000,'T.C'),
    fijo(next(),'M2','2026-02-05','Trabajo','Claude',76000,'T.C'),
    fijo(next(),'M2','2026-02-05','Trabajo','Canva',23000,'T.C'),
    fijo(next(),'M2','2026-02-05','Extras','Celu',46400,'T.C'),
    vari(next(),'M2','2026-02-07','Mercado','Mercado semana 1',172000),
    vari(next(),'M2','2026-02-14','Mercado','Mercado semana 2',155000),
    vari(next(),'M2','2026-02-21','Mercado','Mercado semana 3',180000),
    vari(next(),'M2','2026-02-14','Salidas','San Valentín salida',95000),
    vari(next(),'M2','2026-02-10','Transporte','Ubers',38000),
    vari(next(),'M2','2026-02-20','Regalos','Regalo San Valentín',120000,'T.C'),

    // ── MARZO (M3) ─────────────────────────────────────────────
    ing(next(),'M3','2026-03-05','Sueldo','Lau y Javi',480000),
    ing(next(),'M3','2026-03-05','Sueldo','Vittoria',1576000),
    ing(next(),'M3','2026-03-05','Sueldo','Julio',200000),
    ing(next(),'M3','2026-03-05','Sueldo','Laurent',700000),
    ing(next(),'M3','2026-03-05','Sueldo','Vero',840000),
    ing(next(),'M3','2026-03-05','Sueldo','Felipe y Juana',760000),
    ing(next(),'M3','2026-03-05','Sueldo','Diego O',110000),
    ing(next(),'M3','2026-03-15','Trabajo extra','Coaching online',800000),
    fijo(next(),'M3','2026-03-05','Hogar','Arriendo',1700000),
    fijo(next(),'M3','2026-03-05','Hogar','Internet',53800),
    fijo(next(),'M3','2026-03-05','Hogar','Luz',44000),
    fijo(next(),'M3','2026-03-05','Hogar','Gas',28000),
    fijo(next(),'M3','2026-03-05','Hogar','Agua',37000),
    fijo(next(),'M3','2026-03-05','Hogar','Servicios Mazuren',220000),
    fijo(next(),'M3','2026-03-05','Familia','Papa',400000),
    fijo(next(),'M3','2026-03-05','Salud','Compensar',537100),
    fijo(next(),'M3','2026-03-05','Trabajo','Arriendo GYM',300000,'Nequi'),
    fijo(next(),'M3','2026-03-05','Ahorro','Ahorro mensual',600000,'Nequi'),
    fijo(next(),'M3','2026-03-05','Inversion','VOO',200000,'Nequi'),
    fijo(next(),'M3','2026-03-05','Entretenimiento','Apple',44900,'T.C'),
    fijo(next(),'M3','2026-03-05','Entretenimiento','DIRECTV',80000,'T.C'),
    fijo(next(),'M3','2026-03-05','Trabajo','Claude',76000,'T.C'),
    fijo(next(),'M3','2026-03-05','Trabajo','Canva',23000,'T.C'),
    fijo(next(),'M3','2026-03-05','Extras','Celu',46400,'T.C'),
    vari(next(),'M3','2026-03-07','Mercado','Mercado semana 1',195000),
    vari(next(),'M3','2026-03-14','Mercado','Mercado semana 2',168000),
    vari(next(),'M3','2026-03-21','Mercado','Mercado semana 3',175000),
    vari(next(),'M3','2026-03-10','Transporte','Ubers',52000),
    vari(next(),'M3','2026-03-22','Salidas','Cena cumpleaños',85000),
    vari(next(),'M3','2026-03-28','Vacaciones','Paseo Girardot',350000,'T.C'),

    // ── MAYO (M5) ──────────────────────────────────────────────
    ing(next(),'M5','2026-05-05','Sueldo','Lau y Javi',480000),
    ing(next(),'M5','2026-05-05','Sueldo','Vittoria',1476000),
    ing(next(),'M5','2026-05-05','Sueldo','Julio',200000),
    ing(next(),'M5','2026-05-05','Sueldo','Laurent',700000),
    ing(next(),'M5','2026-05-05','Sueldo','Vero',840000),
    ing(next(),'M5','2026-05-05','Sueldo','Felipe y Juana',760000),
    fijo(next(),'M5','2026-05-05','Hogar','Arriendo',1700000),
    fijo(next(),'M5','2026-05-05','Hogar','Internet',53800),
    fijo(next(),'M5','2026-05-05','Hogar','Luz',47000),
    fijo(next(),'M5','2026-05-05','Hogar','Gas',29000),
    fijo(next(),'M5','2026-05-05','Hogar','Agua',37000),
    fijo(next(),'M5','2026-05-05','Hogar','Servicios Mazuren',220000),
    fijo(next(),'M5','2026-05-05','Familia','Papa',400000),
    fijo(next(),'M5','2026-05-05','Salud','Compensar',537100),
    fijo(next(),'M5','2026-05-05','Trabajo','Arriendo GYM',300000,'Nequi'),
    fijo(next(),'M5','2026-05-05','Ahorro','Ahorro mensual',300000,'Nequi'),
    fijo(next(),'M5','2026-05-05','Entretenimiento','Apple',44900,'T.C'),
    fijo(next(),'M5','2026-05-05','Entretenimiento','DIRECTV',80000,'T.C'),
    fijo(next(),'M5','2026-05-05','Trabajo','Claude',76000,'T.C'),
    fijo(next(),'M5','2026-05-05','Trabajo','Canva',23000,'T.C'),
    fijo(next(),'M5','2026-05-05','Extras','Celu',46400,'T.C'),
    vari(next(),'M5','2026-05-08','Mercado','Mercado semana 1',188000),
    vari(next(),'M5','2026-05-15','Mercado','Mercado semana 2',165000),
    vari(next(),'M5','2026-05-22','Mercado','Mercado semana 3',192000),
    vari(next(),'M5','2026-05-12','Transporte','Ubers',43000),
    vari(next(),'M5','2026-05-18','Salidas','Salida amigos',78000),
    vari(next(),'M5','2026-05-25','Regalos','Día de la madre',180000,'T.C'),
    vari(next(),'M5','2026-05-20','Salud','Médico',85000,'Nequi'),
    vari(next(),'M5','2026-05-28','Extras','Compra ropa',245000,'T.C'),

    // ── JUNIO (M6) ─────────────────────────────────────────────
    ing(next(),'M6','2026-06-02','Sueldo','Lau y Javi',480000),
    ing(next(),'M6','2026-06-02','Sueldo','Vittoria',1576000),
    ing(next(),'M6','2026-06-02','Sueldo','Julio',200000),
    ing(next(),'M6','2026-06-02','Sueldo','Laurent',700000),
    ing(next(),'M6','2026-06-02','Sueldo','Vero',840000),
    ing(next(),'M6','2026-06-02','Sueldo','Felipe y Juana',760000),
    ing(next(),'M6','2026-06-02','Sueldo','Diego O',110000),
    fijo(next(),'M6','2026-06-02','Hogar','Arriendo',1700000),
    fijo(next(),'M6','2026-06-02','Hogar','Internet',53800),
    fijo(next(),'M6','2026-06-02','Hogar','Luz',41000),
    fijo(next(),'M6','2026-06-02','Hogar','Gas',26000),
    fijo(next(),'M6','2026-06-02','Hogar','Agua',37000),
    fijo(next(),'M6','2026-06-02','Hogar','Servicios Mazuren',220000),
    fijo(next(),'M6','2026-06-02','Familia','Papa',400000),
    fijo(next(),'M6','2026-06-02','Salud','Compensar',537100),
    fijo(next(),'M6','2026-06-02','Trabajo','Arriendo GYM',300000,'Nequi'),
    fijo(next(),'M6','2026-06-02','Ahorro','Ahorro mensual',400000,'Nequi'),
    fijo(next(),'M6','2026-06-02','Inversion','VOO',200000,'Nequi'),
    fijo(next(),'M6','2026-06-02','Entretenimiento','Apple',44900,'T.C'),
    fijo(next(),'M6','2026-06-02','Entretenimiento','DIRECTV',80000,'T.C'),
    fijo(next(),'M6','2026-06-02','Trabajo','Claude',76000,'T.C'),
    fijo(next(),'M6','2026-06-02','Trabajo','Canva',23000,'T.C'),
    fijo(next(),'M6','2026-06-02','Extras','Celu',46400,'T.C'),
    vari(next(),'M6','2026-06-02','Mercado','Mercado semana 1',178000),
    vari(next(),'M6','2026-06-02','Transporte','Ubers',35000),
  ]

  // Tarjeta "Nu" con día de pago 15
  const tarjetas = (s.tarjetas?.length > 0) ? s.tarjetas : [
    { id: 9001, nombre: 'Nu', diaPago: 15 }
  ]

  // Asignar tarjeta 'Nu' a todas las tx TC del seed
  const txsConTarjeta = txs.map(t => t.cuenta === 'T.C' ? { ...t, tarjeta: 'Nu' } : t)

  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
  return {
    state: { ...s, tarjetas, transacciones: [...(s.transacciones || []), ...txsConTarjeta] },
    changed: true,
  }
}

// Migración: asigna tarjeta 'Nu' a txs TC sin tarjeta y agrega la tarjeta si no existe
function addTarjetaNu(s) {
  const FLAG = 'add_tarjeta_nu_v1';
  try { if (localStorage.getItem(FLAG)) return { state: s, changed: false }; } catch(e) {}

  let changed = false;
  // Agregar Nu si no hay tarjetas
  let tarjetas = s.tarjetas || [];
  if (tarjetas.length === 0) {
    tarjetas = [{ id: 9001, nombre: 'Nu', diaPago: 15 }];
    changed = true;
  }
  // Asignar 'Nu' a txs TC sin tarjeta
  const txs = (s.transacciones || []).map(t => {
    if (t.cuenta === 'T.C' && !t.tarjeta) { changed = true; return { ...t, tarjeta: 'Nu' }; }
    return t;
  });

  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
  if (!changed) return { state: s, changed: false };
  return { state: { ...s, tarjetas, transacciones: txs }, changed: true };
}

// Seed: agrega cierres mensuales de prueba si no hay ninguno (solo en local/dev)
function seedCierresPrueba(s) {
  const FLAG = 'seed_cierres_prueba_v1';
  try { if (localStorage.getItem(FLAG)) return { state: s, changed: false }; } catch(e) {}
  if (Object.keys(s.cierresMensuales || {}).length > 0) {
    try { localStorage.setItem(FLAG, '1'); } catch(e) {}
    return { state: s, changed: false };
  }
  const cierres = {
    'M4': { mes: 'M4', year: 2026, total_income: 4200000, total_expenses: 3600000, closing_balance: 600000,  carry_over_amount: 600000,  created_at: '2026-04-30T23:59:00.000Z' },
    'M5': { mes: 'M5', year: 2026, total_income: 3800000, total_expenses: 4100000, closing_balance: -300000, carry_over_amount: 0,        created_at: '2026-05-31T23:59:00.000Z' },
    'M6': { mes: 'M6', year: 2026, total_income: 3000000, total_expenses: 2400000, closing_balance: 600000,  carry_over_amount: 600000,  created_at: '2026-06-30T23:59:00.000Z' },
  };
  try { localStorage.setItem(FLAG, '1'); } catch(e) {}
  return { state: { ...s, cierresMensuales: cierres }, changed: true };
}

export function FinanzasProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(loadFromStorage);
  const [syncing, setSyncing] = useState(false);
  const [mesActivo, setMesActivo] = useState(getMesActual());
  const historyRef = useRef([]);
  const [historyLen, setHistoryLen] = useState(0);
  const userRef = useRef(user);
  const migrationDoneRef = useRef(false);

  useEffect(() => { userRef.current = user; }, [user]);

  // Migraciones al montar
  useEffect(() => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    setState(prev => {
      // Migraciones reales (corren en todos los entornos)
      const { state: s1, changed: c1 } = fixIngresosFijos(prev);
      const { state: s2, changed: c2 } = migrateMercadoOrphans(s1);
      const { state: s2b, changed: c2b } = addTarjetaNu(s2);

      // Seeds solo en desarrollo local — NUNCA en producción para no sobreescribir datos reales
      const { state: s3, changed: c3 } = IS_DEV ? seedNuAbril(s2b)       : { state: s2b, changed: false };
      const { state: s4, changed: c4 } = IS_DEV ? seedNuMarzo(s3)        : { state: s3,  changed: false };
      const { state: s5, changed: c5 } = IS_DEV ? seedLocal2026(s4)      : { state: s4,  changed: false };
      const { state: s6, changed: c6 } = IS_DEV ? seedCierresPrueba(s5)  : { state: s5,  changed: false };

      if (!c1 && !c2 && !c2b && !c3 && !c4 && !c5 && !c6) return prev;
      persistLocal(s6);
      // NO escribir a Supabase aquí: el sync remoto (useEffect siguiente) compara
      // timestamps y decide qué fuente es la más reciente. Si las migraciones
      // empujaran a Supabase antes de que lleguen los datos remotos, sobreescriben
      // la data real del usuario en otros dispositivos.
      return s6;
    });
  }, []);

  // Cargar desde Supabase cuando el usuario inicia sesión
  useEffect(() => {
    if (!user) return;
    if (IS_DEV) return; // Dev: usar solo localStorage, nunca tocar Supabase
    setSyncing(true);
    supabase
      .from('user_data')
      .select('data')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (data?.data) {
          const remote = mergeWithDefaults(data.data);
          const local  = loadFromStorage();
          // Elegir el más reciente usando lastModified; en caso de empate, el que tiene más datos
          const remoteTs = remote.lastModified || 0;
          const localTs  = local.lastModified  || 0;
          const remoteCount = (remote.transacciones?.length || 0) + Object.values(remote.presupuestosDetalle || {}).reduce((s, a) => s + (a?.length || 0), 0);
          const localCount  = (local.transacciones?.length  || 0) + Object.values(local.presupuestosDetalle  || {}).reduce((s, a) => s + (a?.length || 0), 0);
          const useRemote = remoteTs > localTs || (remoteTs === localTs && remoteCount >= localCount);
          if (useRemote) {
            persistBackup(remote); // guardar backup antes de sobrescribir local
            setState(remote);
            persistLocal(remote);
          } else {
            // Local es más reciente — subir local a Supabase
            persistBackup(local);
            persistRemote(local, user.id);
          }
        } else if (error?.code === 'PGRST116') {
          // No existe fila aún — subir datos locales
          const local = loadFromStorage();
          persistBackup(local);
          persistRemote(local, user.id);
        }
        setSyncing(false);
      });

    // Suscripción en tiempo real — escucha INSERT y UPDATE
    const channel = supabase
      .channel(`user_data:${user.id}`)
      .on('postgres_changes', {
        event: '*',           // INSERT + UPDATE + DELETE
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        const incoming = payload.new?.data;
        if (!incoming) return;
        const loaded    = mergeWithDefaults(incoming);
        const current   = loadFromStorage();
        // Solo aplicar si el dato remoto es más reciente que lo que ya tenemos
        if ((loaded.lastModified || 0) > (current.lastModified || 0)) {
          setState(loaded);
          persistLocal(loaded);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Supabase RT] canal con error, reconectando...');
        }
      });

    // Reconectar cuando el usuario vuelve a la pestaña / app (mobile background)
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      supabase
        .from('user_data')
        .select('data')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data?.data) return;
          const remote  = mergeWithDefaults(data.data);
          const local   = loadFromStorage();
          if ((remote.lastModified || 0) > (local.lastModified || 0)) {
            setState(remote);
            persistLocal(remote);
          }
        });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  function update(updater) {
    setState(prev => {
      historyRef.current = [...historyRef.current.slice(-14), prev];
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      const next = { ...updated, lastModified: Date.now() };
      persistLocal(next);
      persistBackup(next);
      if (userRef.current) persistRemote(next, userRef.current.id);
      return next;
    });
    setHistoryLen(n => Math.min(n + 1, 15));
  }

  function undo() {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setState(prev);
    persistLocal(prev);
    if (userRef.current) persistRemote(prev, userRef.current.id);
    setHistoryLen(historyRef.current.length);
  }

  const addTransaccion    = (tx)   => update(prev => ({ ...prev, transacciones: [tx, ...prev.transacciones] }));
  const deleteTransaccion = (id) => update(prev => {
    const txsFiltradas = prev.transacciones.filter(t => t.id !== id);
    const newDetalle = {};
    Object.entries(prev.presupuestosDetalle || {}).forEach(([mes, items]) => {
      newDetalle[mes] = (items || []).map(item => {
        const nuevosPagos = (item.pagos || []).filter(p => String(p.txId) !== String(id));
        const eraEnPagos  = nuevosPagos.length !== (item.pagos || []).length;
        const eraLegacy   = !item.pagos?.length && String(item.txId) === String(id);
        if (!eraEnPagos && !eraLegacy) return item;
        // Recalcular si sigue pagado con los pagos restantes
        const montoPagado = nuevosPagos.reduce((s, p) => {
          const tx = txsFiltradas.find(t => t.id === p.txId);
          return s + (tx ? Math.abs(tx.total) : 0);
        }, 0);
        const estaPagado = montoPagado >= item.monto;
        const ultimoPago = nuevosPagos[nuevosPagos.length - 1] || null;
        return {
          ...item,
          pagos: nuevosPagos,
          txId: ultimoPago?.txId || null,
          pagadoCon:   estaPagado ? (ultimoPago?.cuenta || null)   : null,
          tarjetaPago: estaPagado ? (ultimoPago?.tarjeta || null)  : null,
        };
      });
    });
    return {
      ...prev,
      transacciones: txsFiltradas,
      presupuestosDetalle: newDetalle,
    };
  });
  const updateTransaccion = (id, changes) => update(prev => ({ ...prev, transacciones: prev.transacciones.map(t => t.id === id ? { ...t, ...changes } : t) }));
  // Asignar tarjeta en bloque a todas las tx de T.C sin tarjeta asignada
  const bulkAssignTarjeta = (nombreTarjeta) => update(prev => ({
    ...prev,
    transacciones: prev.transacciones.map(t =>
      t.cuenta === 'T.C' && !t.tarjeta ? { ...t, tarjeta: nombreTarjeta } : t
    ),
  }));
  const addMercado        = (item) => update(prev => ({ ...prev, mercado: [item, ...prev.mercado] }));
  const deleteMercado     = (id)   => update(prev => ({ ...prev, mercado: prev.mercado.filter(m => m.id !== id) }));

  // Cambia la cuenta (y opcionalmente la tarjeta) de todas las transacciones de mercado de un día dado
  const updateMercadoCuenta = (dateKey, cuenta, tarjeta = null) => update(prev => ({
    ...prev,
    transacciones: prev.transacciones.map(t =>
      t.categoria === 'Mercado' && t.fecha?.split('T')[0] === dateKey
        ? { ...t, cuenta, tarjeta: tarjeta || null }
        : t
    ),
  }));

  // Elimina todos los items de mercado + transacciones de mercado de un día dado
  const deleteMercadoDia  = (dateKey) => update(prev => ({
    ...prev,
    mercado:       prev.mercado.filter(m => m.fecha?.split('T')[0] !== dateKey),
    transacciones: prev.transacciones.filter(t =>
      !(t.categoria === 'Mercado' && t.fecha?.split('T')[0] === dateKey)
    ),
  }));

  // Registra todos los items de mercado + sus transacciones en un solo update atómico
  // (evita la condición de carrera de múltiples persistRemote sobreescribiéndose)
  const registrarMercado  = (mercadoItems, transacciones) => update(prev => ({
    ...prev,
    mercado:       [...mercadoItems, ...prev.mercado],
    transacciones: [...transacciones, ...prev.transacciones],
  }));
  const updateMeta        = (mes, meta) => update(prev => ({ ...prev, metas: { ...prev.metas, [mes]: meta } }));
  const saveInversiones   = (inv)  => update(prev => ({ ...prev, inversiones: inv }));
  const saveSheetConfig   = (sheetId, scriptUrl) => update(prev => ({ ...prev, sheetId, scriptUrl }));

  const saveConfig = ({ categoriasEgresoFijo, categoriasEgresoVariable, categoriasIngreso, cuentas }) =>
    update(prev => ({ ...prev, categoriasEgresoFijo, categoriasEgresoVariable, categoriasIngreso, cuentas }));

  const savePresupuestoMes = (mes, data) =>
    update(prev => ({ ...prev, presupuestos: { ...prev.presupuestos, [mes]: data } }));

  const savePlantilla = (vals) =>
    update(prev => ({ ...prev, plantilla: { ...vals } }));

  const applyPlantilla = (mes) =>
    update(prev => ({
      ...prev,
      presupuestos: { ...prev.presupuestos, [mes]: { ...prev.plantilla } },
    }));

  const copiarPresupuesto = (mesOrigen, mesDestino) =>
    update(prev => ({
      ...prev,
      presupuestos:        { ...prev.presupuestos,        [mesDestino]: { ...prev.presupuestos[mesOrigen] } },
      presupuestosDetalle: { ...prev.presupuestosDetalle, [mesDestino]:
        (prev.presupuestosDetalle[mesOrigen] || []).map((item, i) => ({
          ...item,
          id: Date.now() + i,
          pagadoCon:   null,
          tarjetaPago: null,
          txId:        null,
        })),
      },
    }));

  const addPresupuestoItem = (mes, { concepto, categoria, monto }) =>
    update(prev => {
      const item     = { id: Date.now(), concepto, categoria, monto };
      const detalles = [...(prev.presupuestosDetalle[mes] || []), item];
      const mesData  = recalcPresupuestoFromDetalle(prev.presupuestos[mes] || {}, detalles);
      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: detalles },
        presupuestos:        { ...prev.presupuestos,        [mes]: mesData  },
      };
    });

  const deletePresupuestoItem = (mes, id) =>
    update(prev => {
      const item     = (prev.presupuestosDetalle[mes] || []).find(d => d.id === id);
      const detalles = (prev.presupuestosDetalle[mes] || []).filter(d => d.id !== id);
      const mesData  = recalcPresupuestoFromDetalle(prev.presupuestos[mes] || {}, detalles);
      // Si tenía transacción vinculada, la eliminamos también
      const transacciones = item?.txId
        ? prev.transacciones.filter(t => t.id !== item.txId)
        : prev.transacciones;
      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: detalles },
        presupuestos:        { ...prev.presupuestos,        [mes]: mesData  },
        transacciones,
      };
    });

  // Helpers para leer pagos de un item (soporta modelo viejo txId y nuevo pagos:[])
  function getItemPagos(item) {
    if (item.pagos?.length) return item.pagos;
    if (item.txId) return [{ txId: item.txId, cuenta: item.pagadoCon, tarjeta: item.tarjetaPago || null }];
    return [];
  }
  function getItemMontoPagado(item, transacciones) {
    return getItemPagos(item).reduce((s, p) => {
      const tx = transacciones.find(t => t.id === p.txId);
      return s + (tx ? Math.abs(tx.total) : 0);
    }, 0);
  }

  // Agrega un pago (parcial o total) al item. Permite múltiples llamadas hasta cubrir el monto.
  const pagarPresupuestoItem = (mes, id, cuenta, tarjeta = null, montoCustom = null) =>
    update(prev => {
      const detalles = prev.presupuestosDetalle[mes] || [];
      const item = detalles.find(d => d.id === id);
      if (!item) return prev;

      const esIngreso = (prev.categoriasIngreso || []).includes(item.categoria);
      const montoPagadoAntes = getItemMontoPagado(item, prev.transacciones);
      const restante = item.monto - montoPagadoAntes;
      if (restante <= 0) return prev; // ya completamente pagado

      const montoFinal = Math.min(montoCustom ?? item.monto, restante);
      if (montoFinal <= 0) return prev;

      const txId = Date.now();
      const tx = {
        id: txId,
        concepto: item.concepto,
        total: esIngreso ? montoFinal : -montoFinal,
        pago:  esIngreso ? montoFinal : -montoFinal,
        saldo: 0,
        categoria: item.categoria,
        movimiento: esIngreso ? 'Ingreso' : 'Egreso',
        tipo: 'Fijo',
        cuenta,
        ...(cuenta === 'T.C' && tarjeta ? { tarjeta } : {}),
        fecha: new Date().toISOString(),
        mes,
      };

      const nuevosPagos = [...getItemPagos(item), { txId, cuenta, tarjeta: tarjeta || null, monto: montoFinal }];
      const montoPagadoTotal = montoPagadoAntes + montoFinal;
      const estaPagado = montoPagadoTotal >= item.monto;

      const updated = detalles.map(d => d.id === id ? {
        ...d,
        pagos: nuevosPagos,
        txId: txId, // último txId para compat con deleteTransaccion viejo
        pagadoCon: estaPagado ? cuenta : null,
        tarjetaPago: estaPagado ? (tarjeta || null) : null,
      } : d);

      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: updated },
        transacciones: [tx, ...prev.transacciones],
      };
    });

  // Deshace TODOS los pagos del item: elimina todas las transacciones vinculadas y limpia el item
  // Marca como pagados todos los items del plan de una tarjeta en un mes
  function liquidarTC(mes, tarjetaNombre, cuentaPago) {
    update(prev => {
      const detalles = prev.presupuestosDetalle[mes] || [];
      const updated = detalles.map(item => {
        if (item.tarjeta !== tarjetaNombre) return item;
        if (item.pagadoCon) return item; // ya pagado
        return { ...item, pagadoCon: cuentaPago, tarjetaPago: tarjetaNombre };
      });
      return { ...prev, presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: updated } };
    });
  }

  const despagarPresupuestoItem = (mes, id) =>
    update(prev => {
      const detalles = prev.presupuestosDetalle[mes] || [];
      const item = detalles.find(d => d.id === id);
      if (!item) return prev;
      const pagos = getItemPagos(item);
      const txIdsAEliminar = new Set(pagos.map(p => p.txId).filter(Boolean));
      const updated = detalles.map(d => d.id === id ? { ...d, pagadoCon: null, tarjetaPago: null, txId: null, pagos: [] } : d);
      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: updated },
        transacciones: txIdsAEliminar.size > 0
          ? prev.transacciones.filter(t => !txIdsAEliminar.has(t.id))
          : prev.transacciones,
      };
    });

  const updatePresupuestoItem = (mes, id, changes) =>
    update(prev => {
      const detalles = (prev.presupuestosDetalle[mes] || []).map(d => d.id === id ? { ...d, ...changes } : d);
      const mesData  = recalcPresupuestoFromDetalle(prev.presupuestos[mes] || {}, detalles);
      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: detalles },
        presupuestos:        { ...prev.presupuestos,        [mes]: mesData  },
      };
    });

  function saveSaldoInicial(cuenta, monto) {
    update(prev => ({ ...prev, saldosIniciales: { ...prev.saldosIniciales, [cuenta]: monto } }));
  }

  function saveTarjetas(tarjetas) {
    update(prev => ({ ...prev, tarjetas }));
  }

  function savePresupuestoTarjetas(map) {
    update(prev => ({ ...prev, presupuestoTarjetas: map }));
  }

  function saveHabitos(habitos) {
    update(prev => ({ ...prev, habitos }));
  }

  function toggleHabitoCheck(dateKey, habitoId) {
    update(prev => {
      const current = prev.habitosChecks[dateKey] || [];
      const next = current.includes(habitoId)
        ? current.filter(id => id !== habitoId)
        : [...current, habitoId];
      return { ...prev, habitosChecks: { ...prev.habitosChecks, [dateKey]: next } };
    });
  }

  function usarFreeze(dateKey, habitoId) {
    update(prev => {
      const current = prev.habitosFrozen[dateKey] || [];
      if (current.includes(habitoId)) return prev;
      return { ...prev, habitosFrozen: { ...prev.habitosFrozen, [dateKey]: [...current, habitoId] } };
    });
  }

  // ── Cierre mensual y saldo trasladado ────────────────────────
  function closeMonth(mes) {
    update(prev => {
      const m = computeMetrics(prev.transacciones || [], mes);
      const balance = m.neto;
      const carry_over = balance > 0 ? balance : 0;
      const cierre = {
        mes,
        year: new Date().getFullYear(),
        total_income:    m.ing,
        total_expenses:  m.egCash,
        closing_balance: balance,
        carry_over_amount: carry_over,
        created_at: new Date().toISOString(),
      };
      return { ...prev, cierresMensuales: { ...prev.cierresMensuales, [mes]: cierre } };
    });
  }

  function getCarryOver(mes) {
    const idx = parseInt(mes.replace('M', ''));
    if (idx <= 1) return 0;
    const prevMes = `M${idx - 1}`;
    return state.cierresMensuales?.[prevMes]?.carry_over_amount || 0;
  }

  function getCierre(mes) {
    return state.cierresMensuales?.[mes] || null;
  }

  function deleteCierre(mes) {
    update(prev => {
      const next = { ...prev.cierresMensuales };
      delete next[mes];
      return { ...prev, cierresMensuales: next };
    });
  }

  function savePerfilIngresos(perfil) {
    update(prev => ({ ...prev, perfilIngresos: perfil }));
  }

  function saveNombreUsuario(nombre) {
    update(prev => ({ ...prev, nombreUsuario: nombre }));
  }

  function addMetaPersonalizada(meta) {
    update(prev => ({ ...prev, metasPersonalizadas: [...(prev.metasPersonalizadas || []), { ...meta, id: Date.now() }] }));
  }

  function updateMetaPersonalizada(id, changes) {
    update(prev => ({ ...prev, metasPersonalizadas: (prev.metasPersonalizadas || []).map(m => m.id === id ? { ...m, ...changes } : m) }));
  }

  function deleteMetaPersonalizada(id) {
    update(prev => ({ ...prev, metasPersonalizadas: (prev.metasPersonalizadas || []).filter(m => m.id !== id) }));
  }

  // Recuperar desde backup local
  function restoreFromBackup() {
    try {
      const raw = localStorage.getItem('dani_fin_backup');
      if (!raw) return false;
      const backup = mergeWithDefaults(JSON.parse(raw));
      const withTs = { ...backup, lastModified: Date.now() };
      setState(withTs);
      persistLocal(withTs);
      if (userRef.current) persistRemote(withTs, userRef.current.id);
      return true;
    } catch { return false; }
  }

  // Borra todos los datos financieros pero conserva categorías, cuentas y perfil
  function resetAll() {
    // Marcar todas las migraciones/seeds como ejecutadas para que no vuelvan a correr
    try {
      const flags = [
        'seed_local_2026_v1', 'nu_abril_2026_loaded', 'nu_marzo_2026_loaded',
        'add_tarjeta_nu_v1', 'fix_ingresos_fijos_v1_done', 'seed_cierres_prueba_v1',
      ];
      flags.forEach(f => localStorage.setItem(f, '1'));
      // Limpiar datos de inversiones e hábitos que viven en localStorage propio
      ['inv_aportes', 'inv_portfolio', 'inv_precios', 'hab_habitos', 'hab_done'].forEach(k => localStorage.removeItem(k));
    } catch {}

    update(prev => {
      const fresh = {
        ...prev,
        transacciones:       [],
        mercado:             [],
        presupuestos:        { ...EMPTY_PRESUPUESTOS },
        presupuestosDetalle: { ...EMPTY_DETALLE },
        metas:               JSON.parse(JSON.stringify(DEFAULT_METAS)),
        inversiones:         [],
        habitos:             [],
        habitosChecks:       {},
        habitosFrozen:       {},
        cierresMensuales:    {},
        saldosIniciales:     {},
        metasPersonalizadas: [],
        tarjetas:            [],
        plantilla:           {},
      };
      persistLocal(fresh);
      if (userRef.current) persistRemote(fresh, userRef.current.id);
      return fresh;
    });
  }

  return (
    <FinanzasContext.Provider value={{
      state, syncing,
      undo, historyLen,
      addTransaccion, deleteTransaccion, updateTransaccion,
      addMercado, deleteMercado, deleteMercadoDia, updateMercadoCuenta,
      updateMeta, saveInversiones, saveSheetConfig,
      saveConfig, savePresupuestoMes, copiarPresupuesto, savePlantilla, applyPlantilla,
      addPresupuestoItem, deletePresupuestoItem, updatePresupuestoItem,
      pagarPresupuestoItem, despagarPresupuestoItem,
      saveTarjetas, bulkAssignTarjeta, savePresupuestoTarjetas, registrarMercado,
      saveHabitos, toggleHabitoCheck, usarFreeze,
      saveSaldoInicial,
      mesActivo, setMesActivo,
      resetAll, restoreFromBackup,
      closeMonth, getCarryOver, getCierre, deleteCierre,
      liquidarTC,
      savePerfilIngresos, saveNombreUsuario,
      addMetaPersonalizada, updateMetaPersonalizada, deleteMetaPersonalizada,
    }}>
      {children}
    </FinanzasContext.Provider>
  );
}

export const useFinanzas = () => useContext(FinanzasContext);
