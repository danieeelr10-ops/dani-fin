import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { theme } from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanzasProvider, useFinanzas } from './context/FinanzasContext';
import { FeaturesProvider } from './context/FeaturesContext';
import { SnackbarProvider } from './context/SnackbarContext';
import Layout from './components/Layout';
import Onboarding, { needsOnboarding } from './components/Onboarding';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Registrar from './pages/Registrar';
import Dashboard from './pages/Dashboard';
import Historial from './pages/Historial';
import Metas from './pages/Metas';
import IA from './pages/IA';
import Configuracion from './pages/Configuracion';
import Presupuesto from './pages/Presupuesto';
import TC from './pages/TC';
import Mercado from './pages/Mercado';
import Habitos from './pages/Habitos';
import Seed from './pages/Seed';
import Inversiones from './pages/Inversiones';
import FlujoDeCaja from './pages/FlujoDeCaja';
import Reportes from './pages/Reportes';
import Deudas from './pages/Deudas';
import Apuntes from './pages/Apuntes';
import Analisis from './pages/Analisis';
import Ahorro from './pages/Ahorro';
import Admin from './pages/Admin';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user) return <Login />;

  // Limpiar datos de otro usuario si el ID no coincide
  const storedUid = localStorage.getItem('dani_fin_uid')
  if (storedUid && storedUid !== user.id) {
    localStorage.removeItem('dani_fin_v2')
    localStorage.removeItem('dani_fin_onboarding_done')
    // dani_fin_new_user NO se toca: pertenece al usuario nuevo que acaba de registrarse
  }
  localStorage.setItem('dani_fin_uid', user.id)

  return (
    <FeaturesProvider>
      <FinanzasProvider key={user.id}>
        <SnackbarProvider>
          <AuthenticatedApp />
        </SnackbarProvider>
      </FinanzasProvider>
    </FeaturesProvider>
  );
}

function AuthenticatedApp() {
  const [showOnboarding, setShowOnboarding] = useState(() => needsOnboarding())
  const [landingPath, setLandingPath]       = useState('/inicio')

  if (showOnboarding) return (
    <Onboarding onComplete={(path) => {
      setLandingPath(path || '/inicio')
      setShowOnboarding(false)
    }} />
  );

  return (
    <Layout>
      <Routes>
            <Route path="/" element={<Navigate to={landingPath} replace />} />
            <Route path="/inicio"      element={<Inicio />} />
            <Route path="/registro"    element={<Registrar />} />
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/historial"   element={<Historial />} />
            <Route path="/metas"       element={<Metas />} />
            <Route path="/ia"          element={<IA />} />
            <Route path="/tc"          element={<TC />} />
            <Route path="/mercado"     element={<Mercado />} />
            <Route path="/habitos"     element={<Habitos />} />
            <Route path="/presupuesto" element={<Presupuesto />} />
            <Route path="/config"       element={<Configuracion />} />
            <Route path="/inversiones" element={<Inversiones />} />
            <Route path="/flujo"       element={<FlujoDeCaja />} />
            <Route path="/reportes"    element={<Reportes />} />
            <Route path="/deudas"      element={<Deudas />} />
            <Route path="/apuntes"     element={<Apuntes />} />
            <Route path="/analisis"    element={<Analisis />} />
            <Route path="/ahorro"      element={<Ahorro />} />
            <Route path="/admin"       element={<Admin />} />
            <Route path="/seed"        element={<Seed />} />
          </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
