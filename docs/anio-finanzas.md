# Año en los datos financieros

Los meses se guardaban como `M1`…`M12`, sin año. En enero de 2027 se habrían
mezclado los movimientos de enero 2026 y 2027 en todo lo financiero.

## Diseño: sin migración, el año se interpreta al leer

- **Clave de periodo** (`src/utils/periodo.js`): `'M1'`…`'M12'` sigue siendo
  2026; los otros años usan `'2027-M1'`. Así 2026 conserva exactamente las
  mismas claves en `presupuestos`, `presupuestosDetalle`, `metas` y
  `cierresMensuales`, y un dispositivo con la versión vieja sigue leyendo y
  escribiendo 2026 sin cambios.
- **Transacciones**: conservan `mes: 'M1'` y las nuevas llevan además
  `anio: 2027` (`camposPeriodo`). Sin `anio`, el año sale de `fecha`; si el
  mes guardado está a más de 6 meses del de la fecha se cruza el cambio de año
  (compra con TC del 20-dic con `mes: 'M1'` → enero del año siguiente). Sin
  fecha válida, 2026.
- `getMesActual()`, `mesActivo` y el parámetro `mes` de `computeMetrics`,
  `cashflow.js` y las funciones del contexto ahora son claves de periodo.
  `computeMetrics(txs, 'M1', 2027)` también funciona.
- No se escribe nada al cargar: no hay migración y no cambia la cantidad de
  registros.

## Inventario de lugares que usaban el mes sin año

| Lugar | Qué hacía | Cambio |
|---|---|---|
| `utils/metrics.js` `computeMetrics` | filtraba `t.mes === mes` | filtra por periodo |
| `utils/cashflow.js` (disponible hoy, proyección, alertas, stats de ingresos) | `t.mes === mes`; promedios cortados en enero | por periodo; los promedios cruzan el año |
| `FinanzasContext` `closeMonth` | `Math.min(mes+1, 12)`: diciembre no pasaba a enero; año = año actual | dic → ene del año siguiente; año del periodo |
| `FinanzasContext` `getCarryOver` | enero nunca heredaba saldo | enero hereda del diciembre anterior |
| `FinanzasContext` pagos de ítems de presupuesto, ítems con TC | `tx.mes === mes`, tx sin año | por periodo, tx con `anio` |
| `FinanzasContext` `fixCierresIngresosPendientes`, `deduplicateTransacciones`, `migrateMercadoOrphans` | ordenaban/agrupaban por `M#` | por periodo |
| `FinanzasContext` `updateTransaccion` | — | al cambiar solo la fecha de una tx vieja, fija el año que tenía |
| Resumen, Presupuesto, Registrar (Mis pagos), Historial, TC, Ahorro, Dashboard, Reportes, Metas | selector de 12 meses sin año; "2026" fijo en Presupuesto | selector de año (`AnioSelector`) junto al de mes |
| Presupuesto "Copiar de mes anterior", Registrar "mover al siguiente mes", Cobros "Sig. mes" | no cruzaban el año (o se quedaban en diciembre) | cruzan el año |
| Registro manual, voz (Layout), foto de mercado, pago de TC | `mes` calculado sin año; corte de TC en dic → `M1` del mismo año | guardan `mes` + `anio`; corte de dic → enero siguiente |
| IA (contexto del chat) | "— Mes 2026" fijo; historial de los 12 `M#` | mes con año; últimos 12 meses reales |
| Metas | metas anuales y aportes de inversión de todos los años juntos | por año seleccionado |
| Inicio general, Flujo de caja, Cobros | `'M' + mes actual` | periodo actual |

No cambian: hábitos y planificador (ya usan fechas completas), semillas de
desarrollo (son datos de 2026, válidos como claves heredadas), `MesPills.jsx`
(no se usa).

## Sincronización

`pareceSerPerdidaDeDatos` además rechaza un candidato que:
- tenga menos del 20 % de los ítems de presupuesto (si había ≥ 5), o
- no traiga ningún dato con año (tx con `anio` o claves `'2027-M#'`) cuando el
  otro lado ya tiene ≥ 5: es un estado viejo de antes de esta versión.
