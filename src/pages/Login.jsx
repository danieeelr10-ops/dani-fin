import { useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useAuth } from 'src/context/AuthContext';

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  px: 1.5, py: 1.25, borderRadius: 1.5,
  border: '1px solid', borderColor: 'divider',
  bgcolor: alpha('#919EAB', 0.06),
  fontSize: 14, fontFamily: 'inherit', color: 'text.primary',
  outline: 'none', transition: 'border-color 0.15s',
};

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState('login'); // 'login' | 'register'
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setMsg('');
    if (!email || !password) { setError('Completa todos los campos'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
      } else {
        const { error } = await signUp(email, password);
        if (error) setError(error.message);
        else setMsg('Revisa tu correo para confirmar la cuenta, luego inicia sesión.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default', px: 2,
    }}>
      <Box sx={{ width: '100%', maxWidth: 380 }}>

        {/* Logo + tagline */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center', mb: 1.5 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 1.5,
              background: 'linear-gradient(135deg, #5BE49B 0%, #00A76F 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
            </Box>
            <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Dani Fin</Typography>
          </Box>
          {mode === 'register' && (
            <Box>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>
                Tu plata, bajo control. Sin complicaciones.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                {['💰 Ingresos y gastos', '📊 Presupuesto', '🎯 Metas de ahorro'].map(f => (
                  <Typography key={f} sx={{ fontSize: 12, color: 'text.secondary', bgcolor: 'action.hover', px: 1.25, py: 0.4, borderRadius: '20px' }}>
                    {f}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Card */}
        <Box sx={{
          p: 3, borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: '0 0 2px rgba(0,0,0,0.24), 0 16px 32px rgba(0,0,0,0.24)',
        }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 0.5 }}>
            {mode === 'login' ? 'Iniciar sesión' : '¡Bienvenido! Crea tu cuenta'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {mode === 'login' ? 'Ingresa para ver tus finanzas' : 'Solo toma 2 minutos configurar todo'}
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
                Email
              </Typography>
              <Box
                component="input" type="email" placeholder="tu@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                sx={{ ...inputStyle, '&:focus': { borderColor: 'primary.main' } }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
                Contraseña
              </Typography>
              <Box
                component="input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                sx={{ ...inputStyle, '&:focus': { borderColor: 'primary.main' } }}
              />
            </Box>

            {error && (
              <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: alpha('#FF5630', 0.1), border: '1px solid', borderColor: alpha('#FF5630', 0.25) }}>
                <Typography sx={{ fontSize: 13, color: '#FF5630' }}>{error}</Typography>
              </Box>
            )}
            {msg && (
              <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: alpha('#00A76F', 0.1), border: '1px solid', borderColor: alpha('#00A76F', 0.25) }}>
                <Typography sx={{ fontSize: 13, color: '#00A76F' }}>{msg}</Typography>
              </Box>
            )}

            <Box
              component="button" type="submit" disabled={loading}
              sx={{
                mt: 0.5, py: 1.5, borderRadius: 1.5, border: 'none', cursor: loading ? 'wait' : 'pointer',
                background: 'linear-gradient(135deg, #5BE49B 0%, #00A76F 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </Box>
          </Box>
        </Box>

        {/* Toggle */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <Box
              component="span"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMsg(''); }}
              sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
