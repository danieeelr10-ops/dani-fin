import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import Dashboard from './Dashboard';
import Reportes from './Reportes';

const T1 = '#111318';
const T2 = '#6B7280';
const CARD = '#FFFFFF';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)';

export default function Analisis() {
  const [tab, setTab] = useState('graficas');

  return (
    <Box sx={{ bgcolor: '#F8F9FA', minHeight: '100%' }}>
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Box sx={{ px: '20px', pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', mb: 1.5 }}>
            Análisis
          </Typography>
          <Box sx={{ display: 'flex', bgcolor: '#EBEBEB', borderRadius: '10px', p: '3px' }}>
            {[['graficas', 'Gráficas'], ['reportes', 'Reportes']].map(([id, label]) => (
              <Box key={id} onClick={() => setTab(id)} sx={{
                flex: 1, py: 0.75, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                bgcolor: tab === id ? CARD : 'transparent',
                boxShadow: tab === id ? CARD_SH : 'none',
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? T1 : T2, lineHeight: 1 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        {tab === 'graficas'  && <Dashboard />}
        {tab === 'reportes'  && <Reportes />}
      </Box>
    </Box>
  );
}
