import { Box, Typography } from '@mui/material';

const T1     = '#111318';
const T2     = '#6B7280';
const BORDER = '#E5E7EB';
const CARD   = '#FFFFFF';

// Selector de año que va junto a las píldoras de mes. Recorre solo los años
// de `anios` (los que tienen datos + el actual), así nunca se cae en un año
// vacío por accidente. Mismo componente en PC y celular.
export default function AnioSelector({ anio, anios, onChange, sx }) {
  const lista = anios?.includes(anio) ? anios : [...(anios || []), anio].sort((a, b) => a - b);
  const idx   = lista.indexOf(anio);
  const prev  = idx > 0 ? lista[idx - 1] : null;
  const next  = idx < lista.length - 1 ? lista[idx + 1] : null;

  const flecha = (destino, label, simbolo) => (
    <Box
      component="button"
      type="button"
      aria-label={label}
      disabled={destino == null}
      onClick={() => destino != null && onChange(destino)}
      sx={{
        border: 'none', bgcolor: 'transparent', p: 0, width: 26, height: '100%',
        fontSize: 16, lineHeight: 1, fontFamily: 'inherit',
        color: destino == null ? BORDER : T1,
        cursor: destino == null ? 'default' : 'pointer',
      }}
    >
      {simbolo}
    </Box>
  );

  return (
    <Box
      role="group"
      aria-label="Año"
      sx={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0, height: 30,
        border: `1px solid ${BORDER}`, borderRadius: '20px', bgcolor: CARD, ...sx,
      }}
    >
      {flecha(prev, 'Año anterior', '‹')}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: lista.length > 1 ? T1 : T2, minWidth: 32, textAlign: 'center' }}>
        {anio}
      </Typography>
      {flecha(next, 'Año siguiente', '›')}
    </Box>
  );
}
