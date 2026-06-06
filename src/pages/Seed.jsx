import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEED_M4 } from 'src/dev/seedData';
import { MESES, CATEGORIAS_EGRESO_FIJO, CATEGORIAS_EGRESO_VARIABLE, CATEGORIAS_INGRESO, CUENTAS, DEFAULT_METAS } from 'src/constants';
import { Box, Typography, CircularProgress } from '@mui/material';

export default function Seed() {
  const navigate = useNavigate();

  useEffect(() => {
    // Construir estado completo en el formato esperado por FinanzasContext
    const presupuestos = Object.fromEntries(MESES.map(m => [m, {}]));
    presupuestos['M4'] = SEED_M4.presupuesto || {};
    presupuestos['M5'] = SEED_M4.presupuesto || {};

    const presupuestosDetalle = Object.fromEntries(MESES.map(m => [m, []]));

    const state = {
      transacciones:            SEED_M4.transacciones || [],
      mercado:                  SEED_M4.mercado || [],
      sheetId:                  '',
      scriptUrl:                '',
      metas:                    SEED_M4.metas || DEFAULT_METAS,
      inversiones:              SEED_M4.inversiones || [],
      presupuestos,
      presupuestosDetalle,
      categoriasEgresoFijo:     CATEGORIAS_EGRESO_FIJO,
      categoriasEgresoVariable: CATEGORIAS_EGRESO_VARIABLE,
      categoriasIngreso:        CATEGORIAS_INGRESO,
      cuentas:                  CUENTAS,
      tarjetas:                 [],
      presupuestoTarjetas:      {},
      habitos:                  [],
      habitosChecks:            {},
      habitosFrozen:            {},
      saldosIniciales:          {},
      plantilla:                {},
      lastModified:             Date.now(),
    };

    localStorage.setItem('dani_fin_v2', JSON.stringify(state));
    setTimeout(() => navigate('/registro', { replace: true }), 800);
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <CircularProgress color="primary" />
      <Typography variant="body2" color="text.secondary">Cargando datos de prueba...</Typography>
    </Box>
  );
}
