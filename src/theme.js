import { createTheme, alpha } from '@mui/material/styles';

const PRIMARY   = { main: '#00A76F', light: '#5BE49B', dark: '#007867', darker: '#004B50', lighter: '#C8FAD6', contrastText: '#fff' };
const WARNING   = { main: '#FFAB00', light: '#FFD666', dark: '#B76E00', lighter: '#FFF5CC', contrastText: '#1C252E' };
const INFO      = { main: '#00B8D9', light: '#61F3F3', dark: '#006C9C', lighter: '#CAFDF5', contrastText: '#fff' };
const SUCCESS   = { main: '#22C55E', light: '#77ED8B', dark: '#118D57', lighter: '#D3FCD2', contrastText: '#fff' };
const ERROR     = { main: '#FF5630', light: '#FFAC82', dark: '#B71D18', lighter: '#FFE9D5', contrastText: '#fff' };
const SECONDARY = { main: '#8E33FF', light: '#C684FF', dark: '#5119B7', lighter: '#EFD6FF', contrastText: '#fff' };

const GREY = {
  100: '#F9FAFB', 200: '#F4F6F8', 300: '#DFE3E8', 400: '#C4CDD5', 500: '#919EAB',
  600: '#637381', 700: '#454F5B', 800: '#1C252E', 900: '#141A21',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: PRIMARY,
    secondary: SECONDARY,
    info: INFO,
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    grey: GREY,
    background: { default: '#F4F6F8', paper: '#FFFFFF' },
    text: { primary: '#1C252E', secondary: '#637381', disabled: alpha('#919EAB', 0.6) },
    divider: alpha('#919EAB', 0.2),
    action: {
      hover: alpha('#919EAB', 0.08),
      selected: alpha('#919EAB', 0.12),
      disabled: alpha('#919EAB', 0.48),
      disabledBackground: alpha('#919EAB', 0.16),
    },
  },
  typography: {
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', sans-serif",
    h3: { fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' },
    h4: { fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' },
    h5: { fontSize: 20, fontWeight: 700 },
    h6: { fontSize: 18, fontWeight: 600 },
    subtitle1: { fontSize: 16, fontWeight: 600 },
    subtitle2: { fontSize: 14, fontWeight: 600 },
    body2: { fontSize: 14 },
    caption: { fontSize: 12 },
    overline: { fontSize: 12, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' },
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(145,158,171,0.16)',
    '0 2px 4px 0 rgba(145,158,171,0.16)',
    '0 4px 8px 0 rgba(145,158,171,0.16)',
    '0 8px 16px 0 rgba(145,158,171,0.16)',
    '0 12px 24px -4px rgba(145,158,171,0.16)',
    '0 16px 32px -4px rgba(145,158,171,0.16)',
    '0 20px 40px -4px rgba(145,158,171,0.16)',
    '0 24px 48px 0 rgba(145,158,171,0.16)',
    ...Array(16).fill('none'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { overscrollBehavior: 'none', WebkitTapHighlightColor: 'transparent', backgroundColor: '#F4F6F8' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 0 2px rgba(145,158,171,0.2), 0 12px 24px rgba(145,158,171,0.12)',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 0 2px rgba(145,158,171,0.2), 0 12px 24px rgba(145,158,171,0.12)',
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: 24 },
        title: { fontSize: 18, fontWeight: 600 },
        subheader: { fontSize: 14, color: '#637381', marginTop: 4 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#919EAB', 0.06),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#919EAB', 0.2) },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#919EAB', 0.4) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00A76F' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: { icon: { color: '#919EAB' } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: '#637381',
          '&.Mui-selected': { color: '#1C252E' },
          minWidth: 'auto',
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: '100%', borderRadius: 8, backgroundColor: alpha('#00A76F', 0.12), zIndex: 0 },
        root: { minHeight: 40, padding: 4, backgroundColor: alpha('#919EAB', 0.08), borderRadius: 12 },
        flexContainer: { position: 'relative', zIndex: 1 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, borderRadius: 10, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        containedPrimary: {
          background: 'linear-gradient(135deg, #5BE49B 0%, #00A76F 100%)',
          color: '#fff',
          '&:hover': { background: 'linear-gradient(135deg, #4DC77E 0%, #007867 100%)' },
        },
      },
      variants: [
        { props: { variant: 'soft', color: 'primary' }, style: { backgroundColor: alpha('#00A76F', 0.12), color: '#007867', '&:hover': { backgroundColor: alpha('#00A76F', 0.2) } } },
        { props: { variant: 'soft', color: 'warning' }, style: { backgroundColor: alpha('#FFAB00', 0.12), color: '#B76E00', '&:hover': { backgroundColor: alpha('#FFAB00', 0.2) } } },
        { props: { variant: 'soft', color: 'info'    }, style: { backgroundColor: alpha('#00B8D9', 0.12), color: '#006C9C', '&:hover': { backgroundColor: alpha('#00B8D9', 0.2) } } },
        { props: { variant: 'soft', color: 'error'   }, style: { backgroundColor: alpha('#FF5630', 0.12), color: '#B71D18', '&:hover': { backgroundColor: alpha('#FF5630', 0.2) } } },
        { props: { variant: 'soft', color: 'success' }, style: { backgroundColor: alpha('#22C55E', 0.12), color: '#118D57', '&:hover': { backgroundColor: alpha('#22C55E', 0.2) } } },
        { props: { variant: 'soft', color: 'inherit' }, style: { backgroundColor: alpha('#919EAB', 0.1), color: '#1C252E', '&:hover': { backgroundColor: alpha('#919EAB', 0.18) } } },
      ],
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: '#FFFFFF', borderRadius: '16px 16px 0 0', margin: 0, width: '100%', maxWidth: '100%', position: 'fixed', bottom: 0 },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: alpha('#919EAB', 0.2), borderStyle: 'dashed' } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 8, borderRadius: 4, backgroundColor: alpha('#919EAB', 0.12) },
        bar: { borderRadius: 4 },
      },
    },
  },
});
