import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Tooltip, Divider, alpha, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { useAuth } from 'src/context/AuthContext';
import { usePWA } from 'src/hooks/usePWA';
import { checkDueReminders, refreshBadge } from 'src/utils/notifications';
import { CAT_ICONS } from 'src/constants';

const QC_GREEN  = '#00A76F';
const QC_RED    = '#DC2626';
const QC_T1     = '#111318';
const QC_T2     = '#6B7280';
const QC_BORDER = '#E5E7EB';

const CATS_EGRESO  = ['Mercado','Salidas','Transporte','Hogar','Extras','Salud','Entretenimiento','Trabajo'];
const CATS_INGRESO = ['Clientes','Sueldo','Freelance','Comisiones','Otros ingresos'];

function QuickCapture({ open, onClose }) {
  const { state, addTransaccion } = useFinanzas();
  const { showToast } = useSnackbar();
  const [tipo,      setTipo]      = useState('Egreso');
  const [monto,     setMonto]     = useState('');
  const [categoria, setCategoria] = useState('');
  const [cuenta,    setCuenta]    = useState('');
  const [fecha,     setFecha]     = useState('');
  const [concepto,  setConcepto]  = useState('');
  const inputRef  = useRef(null);
  const dateRef   = useRef(null);

  const todayStr = () => new Date().toISOString().split('T')[0];
  const ayerStr  = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };

  useEffect(() => {
    if (open) {
      setTipo('Egreso'); setMonto(''); setCategoria(''); setCuenta('');
      setFecha(todayStr()); setConcepto('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const cats          = tipo === 'Egreso' ? CATS_EGRESO : CATS_INGRESO;
  const tarjetas      = state.tarjetas || [];
  const tarjetaNombres = new Set(tarjetas.map(t => t.nombre));
  const cuentas       = (state.cuentas || []).filter(c => c !== 'T.C' && !tarjetaNombres.has(c));

  function guardar() {
    const val = parseInt(monto.replace(/\D/g, ''), 10);
    if (!val || !categoria || !cuenta) return;
    const fechaFinal = fecha || todayStr();
    const mes = 'M' + parseInt(fechaFinal.split('-')[1], 10);
    const esTarjeta = tarjetaNombres.has(cuenta);
    addTransaccion({
      id: Date.now(),
      fecha: new Date(fechaFinal + 'T12:00:00').toISOString(),
      mes,
      tipo: 'Variable', movimiento: tipo,
      categoria, concepto: concepto.trim() || categoria,
      total: tipo === 'Egreso' ? -val : val,
      pago:  tipo === 'Egreso' ? -val : val,
      saldo: 0,
      cuenta: esTarjeta ? 'T.C' : cuenta,
      ...(esTarjeta ? { tarjeta: cuenta } : {}),
      estado: 'realizado', esFuturo: false,
    });
    showToast(`${categoria} guardado`, 'success');
    onClose();
  }

  if (!open) return null;
  const canSave     = monto && categoria && cuenta;
  const accentColor = tipo === 'Egreso' ? QC_RED : QC_GREEN;
  const hoy         = todayStr();
  const ayer        = ayerStr();
  const fechaLabel  = fecha === hoy ? 'Hoy' : fecha === ayer ? 'Ayer'
    : fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'Hoy';

  return (
    <>
      <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 500 }} />
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 501,
        bgcolor: '#fff', borderRadius: '20px 20px 0 0',
        px: 2.5, pt: 1, pb: 'calc(env(safe-area-inset-bottom) + 24px)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
        maxWidth: 600, mx: 'auto',
      }}>
        {/* Handle */}
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: '#E5E7EB', mx: 'auto', mb: 1.75 }} />

        {/* Tipo + Fecha en misma fila */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
          <Box sx={{ flex: 1, display: 'flex', p: '3px', borderRadius: '10px', bgcolor: '#EBEBEB' }}>
            {['Egreso', 'Ingreso'].map(t => (
              <Box key={t} onClick={() => { setTipo(t); setCategoria(''); }} sx={{
                flex: 1, py: 0.75, borderRadius: '8px', textAlign: 'center',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                bgcolor: tipo === t ? '#fff' : 'transparent',
                color:   tipo === t ? (t === 'Egreso' ? QC_RED : QC_GREEN) : QC_T2,
                boxShadow: tipo === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{t}</Box>
            ))}
          </Box>
          {/* Fecha — botón que abre el date input nativo */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Box component="input" ref={dateRef} type="date" value={fecha}
              onChange={e => setFecha(e.target.value)}
              sx={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 1 }}
            />
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.625,
              px: 1.25, py: 0.875, borderRadius: '10px',
              bgcolor: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={QC_T2} strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: QC_T1 }}>{fechaLabel}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Monto */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2, py: 1, borderRadius: '14px', border: '1.5px solid', borderColor: monto ? `${accentColor}55` : QC_BORDER, bgcolor: '#fff', mb: 1.5, transition: 'border-color 0.15s' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: QC_T2, flexShrink: 0, lineHeight: 1 }}>$</Typography>
          <Box component="input" ref={inputRef} type="text" inputMode="numeric" placeholder="0" value={monto}
            onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setMonto(isNaN(n) ? '' : n.toLocaleString('es-CO')); }}
            sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 36, fontWeight: 900, fontFamily: 'inherit', color: accentColor, letterSpacing: '-1px', '&::placeholder': { color: 'rgba(145,158,171,0.25)', fontWeight: 400, fontSize: 32 } }}
          />
          {monto && <Box onClick={() => setMonto('')} sx={{ color: QC_T2, cursor: 'pointer', fontSize: 20, lineHeight: 1, px: 0.5, flexShrink: 0 }}>×</Box>}
        </Box>

        {/* Concepto opcional */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.875, borderRadius: '12px', border: '1.5px solid', borderColor: concepto ? `${accentColor}40` : QC_BORDER, bgcolor: '#FAFAFA', mb: 1.25, transition: 'border-color 0.15s' }}>
          <Box component="input" type="text" placeholder="Concepto (opcional)" value={concepto}
            onChange={e => setConcepto(e.target.value)}
            sx={{ flex: 1, bgcolor: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: QC_T1, '&::placeholder': { color: 'rgba(145,158,171,0.5)' } }}
          />
        </Box>

        {/* Categorías */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625, mb: 1.25 }}>
          {cats.map(c => (
            <Box key={c} onClick={() => setCategoria(c)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1.125, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: '1px solid', transition: 'all 0.1s',
              borderColor: categoria === c ? accentColor : QC_BORDER,
              bgcolor:     categoria === c ? `${accentColor}10` : '#fff',
              color:       categoria === c ? accentColor : QC_T2,
            }}>
              <Typography sx={{ fontSize: 12, lineHeight: 1 }}>{CAT_ICONS[c] || '·'}</Typography>
              {c}
            </Box>
          ))}
        </Box>

        {/* Cuentas y Tarjetas separadas */}
        <Box sx={{ mb: 1.75, display: 'flex', flexDirection: 'column', gap: 0.875 }}>
          {cuentas.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: QC_T2, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.625 }}>Cuenta</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625 }}>
                {cuentas.map(c => (
                  <Box key={c} onClick={() => setCuenta(c)} sx={{
                    px: 1.125, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid', transition: 'all 0.1s',
                    borderColor: cuenta === c ? QC_T1 : QC_BORDER,
                    bgcolor:     cuenta === c ? QC_T1 : '#F9FAFB',
                    color:       cuenta === c ? '#fff' : QC_T2,
                  }}>{c}</Box>
                ))}
              </Box>
            </Box>
          )}
          {tarjetas.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.625 }}>Tarjeta de crédito</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.625 }}>
                {tarjetas.map(t => (
                  <Box key={t.nombre} onClick={() => setCuenta(t.nombre)} sx={{
                    px: 1.125, py: 0.5, borderRadius: '20px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid', transition: 'all 0.1s',
                    borderColor: cuenta === t.nombre ? '#6366F1' : '#E0E7FF',
                    bgcolor:     cuenta === t.nombre ? '#6366F1' : '#EEF2FF',
                    color:       cuenta === t.nombre ? '#fff'    : '#6366F1',
                  }}>{t.nombre}</Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Guardar */}
        <Box component="button" onClick={guardar} disabled={!canSave} sx={{
          width: '100%', py: 1.125, borderRadius: '12px', border: 'none',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
          cursor: canSave ? 'pointer' : 'not-allowed',
          bgcolor: canSave ? QC_GREEN : 'rgba(145,158,171,0.16)',
          color:   canSave ? '#fff'   : QC_T2,
          boxShadow: canSave ? '0 4px 14px rgba(0,167,111,0.3)' : 'none',
          transition: 'all 0.15s',
        }}>
          Guardar {tipo === 'Egreso' ? 'gasto' : 'ingreso'}
        </Box>
      </Box>
    </>
  );
}

const SIDEBAR_W   = 220;
const COLLAPSED_W = 60;

const ALL_TABS = [
  {
    path: '/inicio',
    label: 'Inicio',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>,
  },
  {
    path: '/registro',
    label: 'Registrar',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>,
  },
  {
    path: '/flujo',
    label: 'Flujo',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>,
  },
  {
    path: '/reportes',
    label: 'Reportes',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>,
  },
  {
    path: '/cobros',
    label: 'Cobros',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>,
  },
  {
    path: '/historial',
    label: 'Historial',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>,
  },
  {
    path: '/presupuesto',
    label: 'Presupuesto',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>,
  },
  {
    path: '/tc',
    label: 'T.C',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>,
  },
  {
    path: '/dashboard',
    label: 'Gráficas',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>,
  },
  {
    path: '/inversiones',
    label: 'Inversiones',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>,
  },
  {
    path: '/metas',
    label: 'Metas',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>,
  },
  {
    path: '/mercado',
    label: 'Mercado',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>,
  },
  {
    path: '/habitos',
    label: 'Hábitos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>,
  },
  {
    path: '/deudas',
    label: 'Deudas',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h4"/>
    </svg>,
  },
  {
    path: '/apuntes',
    label: 'Apuntes',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>,
  },
  {
    path: '/ia',
    label: 'IA',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>,
  },
  {
    path: '/config',
    label: 'Config',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>,
  },
];

function NavItem({ tab, active, collapsed, onClick }) {
  const item = (
    <Box onClick={onClick} sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: collapsed ? 0 : 1.5, py: 1.0, mx: 1, borderRadius: 1.5, cursor: 'pointer',
      justifyContent: collapsed ? 'center' : 'flex-start',
      color: active ? 'primary.main' : 'text.secondary',
      bgcolor: active ? alpha('#00A76F', 0.1) : 'transparent',
      transition: 'all 0.15s ease',
      '&:hover': { bgcolor: active ? alpha('#00A76F', 0.14) : 'action.hover', color: active ? 'primary.main' : 'text.primary' },
    }}>
      <Box sx={{ flexShrink: 0, display: 'flex', opacity: active ? 1 : 0.65 }}>{tab.icon}</Box>
      {!collapsed && <Typography sx={{ fontSize: 14, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{tab.label}</Typography>}
    </Box>
  );
  if (collapsed) return <Tooltip title={tab.label} placement="right" arrow>{item}</Tooltip>;
  return item;
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(() => localStorage.getItem('pwa_install_dismissed') === '1');
  const [quickOpen, setQuickOpen] = useState(false);
  const { undo, historyLen } = useFinanzas();
  const { signOut } = useAuth();
  const { installPrompt, isInstalled, isIOS, notifPermission, promptInstall, requestNotifPermission } = usePWA();

  // Revisar recordatorios y actualizar badge al cargar
  useEffect(() => { checkDueReminders(); refreshBadge(); }, []);

  const showInstallBanner = !isInstalled && !installDismissed && (installPrompt || isIOS);

  function dismissInstall() {
    setInstallDismissed(true);
    localStorage.setItem('pwa_install_dismissed', '1');
  }

  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo]);

  const sidebarWidth = collapsed ? COLLAPSED_W : SIDEBAR_W;

  // ── Mobile: bottom nav con drawer "Más" ──────────────────────────────
  const NAV_TABS = ['/inicio', '/historial', '/presupuesto'];
  const moreActive = ALL_TABS.filter(t => !NAV_TABS.includes(t.path)).some(t => t.path === pathname);
  const [moreOpen, setMoreOpen] = useState(false);

  const tabInicio      = ALL_TABS.find(t => t.path === '/inicio');
  const tabHistorial   = ALL_TABS.find(t => t.path === '/historial');
  const tabPresupuesto = ALL_TABS.find(t => t.path === '/presupuesto');

  // Grupos del drawer "Más"
  const DRAWER_GROUPS = [
    {
      label: 'Registrar',
      items: ['/flujo', '/registro', '/cobros', '/tc'],
    },
    {
      label: 'Finanzas',
      items: ['/inversiones', '/metas', '/mercado', '/deudas'],
    },
    {
      label: 'Análisis',
      items: ['/dashboard', '/reportes', '/ia'],
    },
    {
      label: 'Más',
      items: ['/habitos', '/apuntes', '/config'],
    },
  ];

  function goTo(path) { navigate(path); setMoreOpen(false); }

  // active indicator dot at top
  function NavTab({ tab, active }) {
    return (
      <Box onClick={() => goTo(tab.path)} sx={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-end', gap: '3px', pb: '10px', pt: '6px',
        cursor: 'pointer', position: 'relative',
        '&:active': { opacity: 0.6 },
      }}>
        {active && (
          <Box sx={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2.5, borderRadius: '0 0 3px 3px', bgcolor: '#00A76F' }} />
        )}
        <Box sx={{ color: active ? '#00A76F' : '#9CA3AF', display: 'flex' }}>{tab.icon}</Box>
        <Typography sx={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? '#00A76F' : '#9CA3AF', lineHeight: 1 }}>
          {tab.label}
        </Typography>
      </Box>
    );
  }

  if (isMobile) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Banner PWA install */}
        {showInstallBanner && (
          <Box sx={{ flexShrink: 0, px: 1.5, pt: 1, pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 2, bgcolor: alpha('#6366f1', 0.1), border: '1px solid', borderColor: alpha('#6366f1', 0.25) }}>
              <Box sx={{ fontSize: 18, lineHeight: 1 }}>📲</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>Instalar Dani Fin</Typography>
                {isIOS
                  ? <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>Toca <b>Compartir</b> → <b>Agregar a inicio</b></Typography>
                  : <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Acceso rápido + notificaciones</Typography>
                }
              </Box>
              {!isIOS && (
                <Box component="button" onClick={promptInstall}
                  sx={{ px: 1.25, py: 0.5, borderRadius: 1.5, border: 'none', bgcolor: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                  Instalar
                </Box>
              )}
              <Box onClick={dismissInstall} sx={{ cursor: 'pointer', color: 'text.disabled', display: 'flex', p: 0.25, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0, pb: 1 }}>
          {children}
        </Box>

        {/* Bottom nav — 5 ítems: Inicio | Registrar | [+] | Presupuesto | Más */}
        <Box sx={{
          flexShrink: 0,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #F0F0F0',
          display: 'flex', alignItems: 'flex-end',
          pb: 'env(safe-area-inset-bottom)',
          overflow: 'visible',
          position: 'relative',
          zIndex: 100,
        }}>
          {/* Inicio */}
          <NavTab tab={tabInicio} active={pathname === '/inicio'} />

          {/* Historial */}
          <NavTab tab={tabHistorial} active={pathname === '/historial'} />

          {/* Centro [+] CTA */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', pb: '8px' }}>
            <Box onClick={() => setQuickOpen(true)} sx={{
              width: 52, height: 52, borderRadius: '50%',
              bgcolor: '#00A76F',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,167,111,0.40)',
              mt: '-20px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 0.15s, box-shadow 0.15s',
              '&:active': { transform: 'scale(0.91)', boxShadow: '0 2px 8px rgba(0,167,111,0.30)' },
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Box>
          </Box>

          {/* Presupuesto */}
          <NavTab tab={tabPresupuesto} active={pathname === '/presupuesto'} />

          {/* Más */}
          <Box onClick={() => setMoreOpen(o => !o)} sx={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-end', gap: '3px', pb: '10px', pt: '6px',
            cursor: 'pointer', position: 'relative',
            '&:active': { opacity: 0.6 },
          }}>
            {(moreActive || moreOpen) && (
              <Box sx={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2.5, borderRadius: '0 0 3px 3px', bgcolor: '#00A76F' }} />
            )}
            <Box sx={{ color: moreActive || moreOpen ? '#00A76F' : '#9CA3AF', display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: moreActive || moreOpen ? 700 : 400, color: moreActive || moreOpen ? '#00A76F' : '#9CA3AF', lineHeight: 1 }}>
              Más
            </Typography>
          </Box>
        </Box>

        {/* Drawer "Más" — bottom sheet con grupos y grid */}
        {moreOpen && (
          <>
            <Box onClick={() => setMoreOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 300, bgcolor: 'rgba(0,0,0,0.5)' }} />
            <Box sx={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
              backgroundColor: '#FFFFFF',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
              pb: 'calc(env(safe-area-inset-bottom) + 8px)',
              maxHeight: '85dvh',
              overflowY: 'auto',
            }}>
              {/* Handle */}
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 1 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'rgba(145,158,171,0.3)' }} />
              </Box>

              <Box sx={{ px: 2, pb: 1.5 }}>
                {DRAWER_GROUPS.map(group => {
                  const groupTabs = group.items
                    .map(path => ALL_TABS.find(t => t.path === path))
                    .filter(Boolean);
                  if (groupTabs.length === 0) return null;
                  return (
                    <Box key={group.label} sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1.25, px: 0.5 }}>
                        {group.label}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
                        {groupTabs.map(tab => {
                          const active = pathname === tab.path;
                          return (
                            <Box key={tab.path} onClick={() => goTo(tab.path)} sx={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.625,
                              py: 1.25, px: 0.5, borderRadius: '12px', cursor: 'pointer',
                              bgcolor: active ? 'rgba(0,167,111,0.08)' : '#F9FAFB',
                              border: '1px solid', borderColor: active ? 'rgba(0,167,111,0.25)' : '#F3F4F6',
                              '&:active': { opacity: 0.7 },
                            }}>
                              <Box sx={{
                                width: 40, height: 40, borderRadius: '10px',
                                bgcolor: active ? 'rgba(0,167,111,0.12)' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: active ? '#00A76F' : '#6B7280',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                              }}>
                                {tab.icon}
                              </Box>
                              <Typography sx={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#00A76F' : '#374151', textAlign: 'center', lineHeight: 1.2 }}>
                                {tab.label}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        )}

        {historyLen > 0 && (
          <Box onClick={undo} sx={{
            position: 'fixed', bottom: 74, left: 12, zIndex: 200,
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.25, py: 0.75, borderRadius: 20,
            bgcolor: alpha('#00A76F', 0.12), border: '1px solid', borderColor: alpha('#00A76F', 0.3),
            color: 'primary.main', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,167,111,0.15)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>
            </svg>
            <Typography sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>({historyLen})</Typography>
          </Box>
        )}

        <QuickCapture open={quickOpen} onClose={() => setQuickOpen(false)} />
      </Box>
    );
  }

  // ── Desktop: sidebar ─────────────────────────────────────
  return (
    <Box sx={{ height: '100dvh', display: 'flex', bgcolor: 'background.default' }}>
      <Box sx={{
        width: sidebarWidth, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: '1px solid', borderColor: 'divider',
        transition: 'width 0.2s ease',
        overflow: 'hidden', position: 'relative', zIndex: 100,
      }}>
        {/* Logo */}
        <Box sx={{ height: 56, display: 'flex', alignItems: 'center', px: collapsed ? 0 : 2, justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: 1, background: 'linear-gradient(135deg, #5BE49B 0%, #00A76F 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
            </Box>
            {!collapsed && <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>Dani Fin</Typography>}
          </Box>
          {!collapsed && (
            <Box onClick={() => setCollapsed(true)} sx={{ cursor: 'pointer', color: 'text.disabled', display: 'flex', p: 0.5, borderRadius: 1, '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </Box>
          )}
          {collapsed && (
            <Box onClick={() => setCollapsed(false)} sx={{ cursor: 'pointer', color: 'text.disabled', display: 'flex', '&:hover': { color: 'text.primary' } }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Box>
          )}
        </Box>

        <Divider />

        {/* Nav */}
        <Box sx={{ flex: 1, pt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.125, overflowY: 'auto' }}>
          {ALL_TABS.map(tab => (
            <NavItem key={tab.path} tab={tab} active={pathname === tab.path} collapsed={collapsed} onClick={() => navigate(tab.path)} />
          ))}
        </Box>

        <Divider />
        <Box sx={{ p: collapsed ? 1.25 : 1.75, display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Box sx={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #5BE49B 0%, #00A76F 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>D</Typography>
          </Box>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>Dani</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>Personal</Typography>
              </Box>
              <Tooltip title="Cerrar sesión" placement="top">
                <Box onClick={signOut} sx={{ cursor: 'pointer', color: 'text.secondary', display: 'flex', p: 0.5, borderRadius: 1, '&:hover': { color: 'error.main', bgcolor: alpha('#FF5630', 0.08) } }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </Box>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0, position: 'relative' }}>
        {children}
        {historyLen > 0 && (
          <Tooltip title="Deshacer (Ctrl+Z)" placement="left">
            <Box onClick={undo} sx={{
              position: 'fixed', bottom: 20, right: 20, zIndex: 200,
              display: 'flex', alignItems: 'center', gap: 0.75,
              px: 1.5, py: 0.875, borderRadius: 20,
              bgcolor: alpha('#00A76F', 0.1), border: '1px solid', borderColor: alpha('#00A76F', 0.3),
              color: 'primary.main', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,167,111,0.15)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>
              </svg>
              <Typography sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>({historyLen})</Typography>
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
