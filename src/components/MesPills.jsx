import { Box } from '@mui/material';
import { MESES, MES_NAMES } from 'src/constants';

export default function MesPills({ mesActivo, onChange, sx }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, px: 2, pb: 1.5, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, ...sx }}>
      {MESES.map((m, i) => (
        <Box
          key={m}
          onClick={() => onChange(m)}
          sx={{
            px: 1.75, py: 0.75, borderRadius: 20, fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid',
            borderColor: m === mesActivo ? 'primary.main' : 'divider',
            bgcolor: m === mesActivo ? 'primary.main' : '#22263a',
            color: m === mesActivo ? '#fff' : 'text.secondary',
            transition: 'all 0.15s',
          }}
        >
          {MES_NAMES[i]}
        </Box>
      ))}
    </Box>
  );
}
