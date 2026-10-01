import { useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import Ahorro from './Ahorro';
import Inversiones from './Inversiones';
import Metas from './Metas';

const T1      = '#111318';
const T2      = '#6B7280';
const CARD    = '#FFFFFF';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)';

const TABS = [
  { id: 'ahorro',      label: 'Ahorro' },
  { id: 'inversiones', label: 'Inversiones' },
  { id: 'metas',       label: 'Metas' },
];

export default function Patrimonio() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'ahorro';

  function setTab(id) {
    setParams(id === 'ahorro' ? {} : { tab: id }, { replace: true });
  }

  return (
    <Box sx={{ bgcolor: '#F7F7F8', minHeight: '100%' }}>
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Box sx={{ px: '20px', pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', mb: 0.25 }}>
            Patrimonio
          </Typography>
          <Typography sx={{ fontSize: 13, color: T2, mb: 1.5 }}>
            Ahorro, inversiones y metas en un solo lugar
          </Typography>
          <Box sx={{ display: 'flex', bgcolor: '#EBEBEB', borderRadius: '10px', p: '3px' }}>
            {TABS.map(({ id, label }) => (
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

        {tab === 'ahorro'      && <Ahorro />}
        {tab === 'inversiones' && <Inversiones />}
        {tab === 'metas'       && <Metas />}
      </Box>
    </Box>
  );
}
