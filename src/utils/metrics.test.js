// Ejecutar con: npm test  (node --test, sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics } from './metrics.js';
import { computeIngresoStats } from './cashflow.js';
import {
  periodoDeRegistro, periodoParaTC, sumarMeses, periodoDe, aniosConDatos, camposPeriodo,
} from './periodo.js';

const tx = (over) => ({ movimiento: 'Egreso', categoria: 'Mercado', cuenta: 'Nequi', tipo: 'Variable', total: -1000, ...over });

// Enero 2026 en formato viejo (sin anio) y enero 2027 en formato nuevo
const datos = [
  tx({ id: 1, mes: 'M1', fecha: '2026-01-08T17:00:00.000Z', total: -100 }),
  tx({ id: 2, mes: 'M1', total: -200 }),                                    // viejo sin fecha → 2026
  tx({ id: 3, mes: 'M1', anio: 2027, fecha: '2027-01-08T17:00:00.000Z', total: -5000 }),
  tx({ id: 4, mes: 'M1', fecha: '2027-01-09T17:00:00.000Z', total: -7000 }), // escrito por la versión vieja en 2027
  tx({ id: 5, mes: 'M1', anio: 2027, movimiento: 'Ingreso', categoria: 'Sueldo', total: 9000 }),
];

test('computeMetrics separa enero 2026 de enero 2027', () => {
  const m2026 = computeMetrics(datos, 'M1');
  assert.equal(m2026.eg, 300);
  assert.equal(m2026.ing, 0);

  const m2027 = computeMetrics(datos, '2027-M1');
  assert.equal(m2027.eg, 12000);
  assert.equal(m2027.ing, 9000);

  // Forma (mes, anio) equivalente
  assert.deepEqual(computeMetrics(datos, 'M1', 2027), m2027);
  assert.deepEqual(computeMetrics(datos, 'M1', 2026), m2026);
  // Clave no canónica de 2026
  assert.deepEqual(computeMetrics(datos, '2026-M1'), m2026);
});

test('ningún registro se pierde ni se cuenta dos veces', () => {
  const total = datos.filter(t => t.movimiento === 'Egreso').reduce((s, t) => s + Math.abs(t.total), 0);
  assert.equal(computeMetrics(datos, 'M1').eg + computeMetrics(datos, '2027-M1').eg, total);
});

test('año de registros viejos: fecha manda, cruzando diciembre/enero', () => {
  assert.equal(periodoDeRegistro({ mes: 'M3' }), 'M3');                                         // sin fecha → 2026
  assert.equal(periodoDeRegistro({ mes: 'M3', fecha: '2026-03-05' }), 'M3');
  assert.equal(periodoDeRegistro({ mes: 'M1', fecha: '2026-12-20T17:00:00Z' }), '2027-M1');     // TC después del corte
  assert.equal(periodoDeRegistro({ mes: 'M12', fecha: '2027-01-01T03:00:00Z' }), 'M12');        // UTC ya en el día siguiente
  assert.equal(periodoDeRegistro({ mes: 'M6', anio: 2026, fecha: '2027-01-10' }), 'M6');        // anio explícito manda
  assert.equal(periodoDeRegistro({ fecha: '2026-03-05' }), null);                               // sin mes: en ningún mes, como antes
});

test('periodos: suma de meses, corte de TC y campos guardados', () => {
  assert.equal(sumarMeses('M12', 1), '2027-M1');
  assert.equal(sumarMeses('2027-M1', -1), 'M12');
  assert.equal(periodoDe(2026, 4), 'M4');
  assert.equal(periodoParaTC('2026-12-20', { fechaCorte: 15 }), '2027-M1');
  assert.equal(periodoParaTC('2026-12-10', { fechaCorte: 15 }), 'M12');
  assert.deepEqual(camposPeriodo('2027-M1'), { mes: 'M1', anio: 2027 });
  assert.deepEqual(camposPeriodo('M10'), { mes: 'M10', anio: 2026 });
});

test('promedios de ingresos cruzan el cambio de año', () => {
  const txs = [
    { mes: 'M11', anio: 2026, movimiento: 'Ingreso', categoria: 'Sueldo', total: 100 },
    { mes: 'M12', anio: 2026, movimiento: 'Ingreso', categoria: 'Sueldo', total: 300 },
    { mes: 'M12', anio: 2025, movimiento: 'Ingreso', categoria: 'Sueldo', total: 9999 }, // otro año, no cuenta
  ];
  const stats = computeIngresoStats(txs, '2027-M1');
  assert.equal(stats.prom3, 200);
  assert.equal(stats.tendencia, 'crecimiento');
});

test('años disponibles salen de los datos', () => {
  const anios = aniosConDatos({
    transacciones: datos,
    presupuestos: { M1: {}, '2028-M3': { Mercado: 100 } },
  }, new Date(2026, 9, 28));
  assert.deepEqual(anios, [2026, 2027, 2028]);
});
