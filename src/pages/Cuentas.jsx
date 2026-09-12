import { useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';

const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

const CUENTA_ICONS = { 'T.C': '💳', Efectivo: '💵' };

export default function Cuentas() {
  const { state, saveConfig } = useFinanzas();
  const { showSnackbar } = useSnackbar();
  const cuentas = state.cuentas || [];
  const [nombre, setNombre] = useState('');

  function saveCuentas(next) {
    saveConfig({
      categoriasEgresoFijo:     state.categoriasEgresoFijo,
      categoriasEgresoVariable: state.categoriasEgresoVariable,
      categoriasIngreso:        state.categoriasIngreso,
      cuentas: next,
    });
  }

  function addCuenta() {
    const v = nombre.trim();
    if (!v) return;
    if (cuentas.some(c => c.toLowerCase() === v.toLowerCase())) {
      showSnackbar('Esa cuenta ya existe', 'error');
      return;
    }
    saveCuentas([...cuentas, v]);
    setNombre('');
    showSnackbar('Cuenta agregada', 'success');
  }

  function delCuenta(v) {
    saveCuentas(cuentas.filter(c => c !== v));
    showSnackbar('Cuenta eliminada', 'success');
  }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 700, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Cuentas bancarias</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Agrega o elimina las cuentas donde recibes y guardas tu dinero</Typography>
        </Box>

        {/* Formulario nueva cuenta */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5, mb: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, mb: 1.25 }}>Nueva cuenta</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box component="input" type="text" placeholder="Ej: Bancolombia, Ahorros, Efectivo…"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCuenta(); }}
              sx={{
                flex: 1, bgcolor: BG, border: `1px solid ${BORDER}`, borderRadius: '10px',
                px: 1.5, py: 1, fontSize: 14, fontFamily: 'inherit', color: T1, outline: 'none',
                boxSizing: 'border-box', '&:focus': { borderColor: GREEN },
              }} />
            <Box component="button" onClick={addCuenta}
              disabled={!nombre.trim()}
              sx={{
                px: 2.5, py: 1, borderRadius: '10px', border: 'none', fontFamily: 'inherit',
                fontWeight: 700, fontSize: 14, cursor: nombre.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                bgcolor: nombre.trim() ? T1 : alpha('#919EAB', 0.16),
                color: nombre.trim() ? '#fff' : T2, transition: 'all 0.15s',
              }}>
              + Agregar
            </Box>
          </Box>
        </Box>

        {/* Lista de cuentas */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>Tus cuentas</Typography>
            <Typography sx={{ fontSize: 12, color: T2, mt: 0.2 }}>{cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'} · pasa el cursor para eliminar</Typography>
          </Box>

          {cuentas.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: T2 }}>Aún no tienes cuentas. Agrega la primera arriba.</Typography>
            </Box>
          ) : (
            cuentas.map(c => (
              <Box key={c} sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                px: 2.5, py: 1.25, borderBottom: `1px solid ${BORDER}`,
                '&:last-child': { borderBottom: 'none' },
                '&:hover .del-btn': { opacity: 1 },
              }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '9px', flexShrink: 0, bgcolor: '#F3F4F6', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {CUENTA_ICONS[c] || '🏦'}
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: T1, flex: 1 }}>{c}</Typography>
                <Box className="del-btn" onClick={() => delCuenta(c)} sx={{
                  width: 30, height: 30, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: T2, opacity: 0, transition: 'opacity 0.15s',
                  '&:hover': { bgcolor: alpha(RED, 0.08), color: RED },
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </Box>
              </Box>
            ))
          )}
        </Box>

      </Box>
    </Box>
  );
}
