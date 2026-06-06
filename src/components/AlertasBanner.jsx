import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { formatMoneyShort } from 'src/utils/format';

const NIVEL_STYLES = {
  critico: { bg: '#FEF2F2', border: '#FECACA', txt: '#991B1B', bar: '#DC2626' },
  alto:    { bg: '#FFF7ED', border: '#FED7AA', txt: '#92400E', bar: '#F59E0B' },
  medio:   { bg: '#FFFBEB', border: '#FDE68A', txt: '#78350F', bar: '#D97706' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', txt: '#1E40AF', bar: '#3B82F6' },
};

function AlertaItem({ alerta }) {
  const s = NIVEL_STYLES[alerta.nivel] || NIVEL_STYLES.info;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25,
      px: 1.5, py: 1, borderRadius: '10px',
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderLeft: `3px solid ${s.bar}`,
    }}>
      <Typography sx={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{alerta.icono}</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: s.txt, lineHeight: 1.2 }}>
          {alerta.msg}
          {alerta.detalle && (
            <Typography component="span" sx={{ fontWeight: 400, opacity: 0.85, ml: 0.5 }}>
              · {alerta.detalle}
            </Typography>
          )}
        </Typography>
      </Box>
      {alerta.monto > 0 && (
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.txt, flexShrink: 0 }}>
          {formatMoneyShort(alerta.monto)}
        </Typography>
      )}
    </Box>
  );
}

export default function AlertasBanner({ alertas = [] }) {
  const [expanded, setExpanded] = useState(false);
  if (alertas.length === 0) return null;

  const VISIBLE = 2;
  const visibles = expanded ? alertas : alertas.slice(0, VISIBLE);
  const ocultas  = alertas.length - VISIBLE;

  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {visibles.map((a, i) => <AlertaItem key={i} alerta={a} />)}
      {!expanded && ocultas > 0 && (
        <Box onClick={() => setExpanded(true)} sx={{ cursor: 'pointer', textAlign: 'center', py: 0.5, '&:active': { opacity: 0.6 } }}>
          <Typography sx={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
            +{ocultas} alerta{ocultas > 1 ? 's' : ''} más
          </Typography>
        </Box>
      )}
    </Box>
  );
}
