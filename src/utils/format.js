import { periodoActual } from 'src/utils/periodo';

// Clave de periodo del mes en curso: 'M10' en 2026, '2027-M1' en enero 2027
// (ver utils/periodo.js).
export const getMesActual = () => periodoActual();

export const formatMoney = (n) => '$' + Math.abs(n).toLocaleString('es-CO');

export const formatMoneyShort = (n) => '$' + Math.abs(n).toLocaleString('es-CO');

export const formatFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatFechaShort = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
