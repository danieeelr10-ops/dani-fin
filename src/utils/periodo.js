// Periodos (mes + año) de los datos financieros.
//
// Antes de existir el año, todo se guardaba solo con el mes: las transacciones
// con `mes: 'M1'…'M12'` y los mapas por mes (presupuestos, presupuestosDetalle,
// metas, cierresMensuales) con claves 'M1'…'M12'. Todo eso es de 2026.
//
// Para no migrar nada (la sincronización es un blob "el último que escribe
// gana" y una migración podría pisar datos de otro dispositivo), el año se
// interpreta al leer:
//
// - Clave de periodo: 'M1'…'M12' sigue significando 2026 (ANIO_BASE); los
//   demás años usan '2027-M1'. Así 2026 conserva exactamente las mismas claves
//   y un dispositivo con la versión vieja sigue leyendo y escribiendo 2026 igual.
// - Transacciones: conservan `mes: 'M1'` y las nuevas llevan además `anio`.
//   Si no tienen `anio`, se deduce de `fecha` (ver anioInferido) y, sin fecha
//   válida, se asume ANIO_BASE.
//
// En el resto de la app "mes"/"periodo" es esta clave, no solo el mes.
import { MES_NAMES } from '../constants.js';

export const ANIO_BASE = 2026;

const RE_PERIODO = /^(?:(\d{4})-)?M(\d{1,2})$/;

export function periodoDe(anio, mes) {
  const mesNum = typeof mes === 'number' ? mes : parseInt(String(mes).replace(/^.*M/, ''), 10);
  return anio === ANIO_BASE ? `M${mesNum}` : `${anio}-M${mesNum}`;
}

export function parsePeriodo(periodo) {
  const m = RE_PERIODO.exec(periodo || '');
  if (!m) return null;
  const mesNum = parseInt(m[2], 10);
  if (mesNum < 1 || mesNum > 12) return null;
  return { anio: m[1] ? parseInt(m[1], 10) : ANIO_BASE, mesNum, mes: `M${mesNum}` };
}

// '2026-M3' (no canónico) → 'M3'. Devuelve null si no es un periodo válido.
export function normalizarPeriodo(periodo) {
  const p = parsePeriodo(periodo);
  return p ? periodoDe(p.anio, p.mesNum) : null;
}

export const anioDePeriodo   = (periodo) => parsePeriodo(periodo)?.anio ?? ANIO_BASE;
export const mesNumDePeriodo = (periodo) => parsePeriodo(periodo)?.mesNum ?? 1;
export const nombreMes       = (periodo) => MES_NAMES[mesNumDePeriodo(periodo) - 1];
export const etiquetaPeriodo = (periodo) => `${nombreMes(periodo)} ${anioDePeriodo(periodo)}`;

const indice = (p) => p.anio * 12 + (p.mesNum - 1);

export function sumarMeses(periodo, n) {
  const total = indice(parsePeriodo(periodo)) + n;
  return periodoDe(Math.floor(total / 12), (total % 12) + 1);
}

export function compararPeriodos(a, b) {
  return indice(parsePeriodo(a)) - indice(parsePeriodo(b));
}

// Los 12 periodos de un año, en orden
export function periodosDelAnio(anio) {
  return Array.from({ length: 12 }, (_, i) => periodoDe(anio, i + 1));
}

export function periodoActual(fecha = new Date()) {
  return periodoDe(fecha.getFullYear(), fecha.getMonth() + 1);
}

// Periodo calendario de una fecha 'YYYY-MM-DD' (o ISO que empiece así)
export function periodoDeFecha(fechaStr) {
  const [y, m] = String(fechaStr).split('-');
  return periodoDe(parseInt(y, 10), parseInt(m, 10));
}

// Periodo al que va una compra con tarjeta: después del día de corte entra al
// extracto del mes siguiente (en diciembre, al enero del año siguiente).
export function periodoParaTC(fechaStr, tarjeta) {
  const base  = periodoDeFecha(fechaStr);
  const corte = tarjeta?.fechaCorte != null ? parseInt(tarjeta.fechaCorte, 10) : 0;
  if (!corte || corte < 1) return base;
  const day = parseInt(String(fechaStr).split('-')[2], 10);
  return day > corte ? sumarMeses(base, 1) : base;
}

// Primer día del periodo, en el formato que usan las transacciones movidas de mes
export function fechaInicioPeriodo(periodo) {
  const { anio, mesNum } = parsePeriodo(periodo);
  return `${anio}-${String(mesNum).padStart(2, '0')}-01T12:00:00`;
}

// Campos a guardar en una transacción (o ítem de mercado) del periodo:
// `mes` igual que siempre (lo que entiende la versión vieja) + `anio`.
export function camposPeriodo(periodo) {
  const { anio, mes } = parsePeriodo(periodo);
  return { mes, anio };
}

// Año de un registro sin `anio`: el de su fecha. El mes guardado puede no
// coincidir con el de la fecha (compra de TC después del corte, cobro movido
// al mes siguiente, fecha ISO en UTC que ya cayó al día siguiente), así que
// si están a más de 6 meses de distancia se cruza el cambio de año: fecha de
// diciembre 2026 con mes M1 es enero 2027.
function anioInferido(fecha, mesNum) {
  const m = /^(\d{4})-(\d{2})/.exec(typeof fecha === 'string' ? fecha : '');
  if (!m) return ANIO_BASE;
  const anioFecha = parseInt(m[1], 10);
  const mesFecha  = parseInt(m[2], 10);
  if (mesNum - mesFecha > 6) return anioFecha - 1;
  if (mesFecha - mesNum > 6) return anioFecha + 1;
  return anioFecha;
}

// Periodo de una transacción (o cualquier registro con mes/anio/fecha).
// null si no tiene un mes válido — igual que antes, no cae en ningún mes.
export function periodoDeRegistro(r) {
  const mesNum = parseInt(String(r?.mes ?? '').replace(/^M/, ''), 10);
  if (!(mesNum >= 1 && mesNum <= 12)) return null;
  const anio = Number.isInteger(r.anio) ? r.anio : anioInferido(r.fecha, mesNum);
  return periodoDe(anio, mesNum);
}

// Filtra los registros de un periodo. Acepta claves no canónicas ('2026-M1').
export function filtrarPeriodo(registros, periodo) {
  const p = normalizarPeriodo(periodo);
  return (registros || []).filter(r => periodoDeRegistro(r) === p);
}

export function esDelPeriodo(registro, periodo) {
  return periodoDeRegistro(registro) === normalizarPeriodo(periodo);
}

// Años que tienen algún dato financiero, más el actual y el del mes siguiente
// (en diciembre ya se puede planear enero). Ordenados ascendente.
export function aniosConDatos(state, hoy = new Date()) {
  const anios = new Set([hoy.getFullYear(), anioDePeriodo(sumarMeses(periodoActual(hoy), 1))]);
  (state?.transacciones || []).forEach(t => {
    const p = periodoDeRegistro(t);
    if (p) anios.add(anioDePeriodo(p));
  });
  const conContenido = (v) => Array.isArray(v) ? v.length > 0
    : (v && typeof v === 'object') ? Object.values(v).some(x => x) : !!v;
  ['presupuestos', 'presupuestosDetalle', 'metas', 'cierresMensuales'].forEach(campo => {
    Object.entries(state?.[campo] || {}).forEach(([clave, valor]) => {
      const p = parsePeriodo(clave);
      if (p && conContenido(valor)) anios.add(p.anio);
    });
  });
  return [...anios].sort((a, b) => a - b);
}
