import { createContext, useContext, useState, useRef, useEffect } from 'react';
import {
  DEFAULT_METAS, DEFAULT_INVERSIONES, MESES,
  CATEGORIAS_EGRESO_FIJO, CATEGORIAS_EGRESO_VARIABLE,
  CATEGORIAS_INGRESO, CUENTAS,
} from 'src/constants';
import { supabase } from 'src/lib/supabase';
import { useAuth } from 'src/context/AuthContext';
import { getMesActual } from 'src/utils/format';

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
      const { state: s1, changed: c1 } = fixIngresosFijos(prev);
      const { state: s2, changed: c2 } = migrateMercadoOrphans(s1);
      const { state: s3, changed: c3 } = seedNuAbril(s2);
      const { state: s4, changed: c4 } = seedNuMarzo(s3);
      if (!c1 && !c2 && !c3 && !c4) return prev;
      persistLocal(s4);
      if (userRef.current) persistRemote(s4, userRef.current.id);
      return s4;
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

    // Suscripción en tiempo real
    const channel = supabase
      .channel(`user_data:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        if (payload.new?.data) {
          const loaded = mergeWithDefaults(payload.new.data);
          setState(loaded);
          persistLocal(loaded);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
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
  const deleteTransaccion = (id)   => update(prev => ({ ...prev, transacciones: prev.transacciones.filter(t => t.id !== id) }));
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

  // Marca un item de presupuesto como pagado y crea la transacción en un solo update
  // montoCustom permite sobrescribir el monto del item (p.ej. cuando el usuario recibe un pago parcial)
  const pagarPresupuestoItem = (mes, id, cuenta, tarjeta = null, montoCustom = null) =>
    update(prev => {
      const detalles = prev.presupuestosDetalle[mes] || [];
      const item = detalles.find(d => d.id === id);
      if (!item || item.pagadoCon) return prev;
      const esIngreso = (prev.categoriasIngreso || []).includes(item.categoria);
      const montoFinal = montoCustom ?? item.monto;
      // Evitar duplicado: si ya existe tx con mismo concepto+mes+movimiento, solo vincula
      const mov = esIngreso ? 'Ingreso' : 'Egreso';
      const existing = prev.transacciones.find(t =>
        t.mes === mes && t.movimiento === mov &&
        t.concepto?.toLowerCase() === item.concepto?.toLowerCase()
      );
      if (existing) {
        const updated = detalles.map(d => d.id === id ? { ...d, pagadoCon: cuenta, tarjetaPago: tarjeta || null, txId: existing.id } : d);
        return { ...prev, presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: updated } };
      }
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
      const updated = detalles.map(d => d.id === id ? { ...d, pagadoCon: cuenta, tarjetaPago: tarjeta || null, txId } : d);
      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: updated },
        transacciones: [tx, ...prev.transacciones],
      };
    });

  // Deshace el pago: elimina la transacción vinculada y limpia el item
  const despagarPresupuestoItem = (mes, id) =>
    update(prev => {
      const detalles = prev.presupuestosDetalle[mes] || [];
      const item = detalles.find(d => d.id === id);
      if (!item?.pagadoCon) return prev;
      const updated = detalles.map(d => d.id === id ? { ...d, pagadoCon: null, tarjetaPago: null, txId: null } : d);
      return {
        ...prev,
        presupuestosDetalle: { ...prev.presupuestosDetalle, [mes]: updated },
        transacciones: item.txId ? prev.transacciones.filter(t => t.id !== item.txId) : prev.transacciones,
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

  // Borra todos los datos financieros pero conserva la configuración
  function resetAll() {
    update(prev => {
      const fresh = {
        ...prev,
        transacciones:       [],
        mercado:             [],
        presupuestos:        { ...EMPTY_PRESUPUESTOS },
        presupuestosDetalle: { ...EMPTY_DETALLE },
        metas:      JSON.parse(JSON.stringify(DEFAULT_METAS)),
        inversiones: JSON.parse(JSON.stringify(DEFAULT_INVERSIONES)),
        habitos:       [],
        habitosChecks: {},
        habitosFrozen: {},
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
    }}>
      {children}
    </FinanzasContext.Provider>
  );
}

export const useFinanzas = () => useContext(FinanzasContext);
