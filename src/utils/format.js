export const getMesActual = () => 'M' + (new Date().getMonth() + 1);

export const formatMoney = (n) => '$' + Math.abs(n).toLocaleString('es-CO');

export const formatMoneyShort = (n) => '$' + Math.abs(n).toLocaleString('es-CO');

export const formatFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatFechaShort = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
