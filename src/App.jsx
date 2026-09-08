import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { theme } from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanzasProvider, useFinanzas } from './context/FinanzasContext';
import { FeaturesProvider } from './context/FeaturesContext';
import { SnackbarProvider } from './context/SnackbarContext';
import Layout from './components/Layout';
import UpdateBanner from './components/UpdateBanner';
import Onboarding, { needsOnboarding } from './components/Onboarding';
import Login from './pages/Login';
import InicioGeneral from './pages/InicioGeneral';
import FinanzasLayout from './pages/FinanzasLayout';
import FinanzasResumen from './pages/FinanzasResumen';
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
import Ritual from './pages/Ritual';
import Planificador from './pages/Planificador';
import MetasVida from './pages/MetasVida';
import RuedaDeVida from './pages/RuedaDeVida';
import Notas from './pages/Notas';

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

  // Si el usuario logueado no coincide con el último visto en este navegador,
  // no mezclamos sus datos — pero tampoco los borramos: los guardamos aparte
  // (por si vuelve a entrar esa cuenta, o si el "cambio" fue solo un hipo de
  // sesión/login y en realidad es la misma persona) y limpiamos solo la clave
  // activa para que esta sesión arranque en blanco y se sincronice desde Supabase.
  const storedUid = localStorage.getItem('dani_fin_uid')
  if (storedUid && storedUid !== user.id) {
    try {
      const datosAnteriores = localStorage.getItem('dani_fin_v2')
      if (datosAnteriores) localStorage.setItem(`dani_fin_v2_prev_${storedUid}`, datosAnteriores)
    } catch (e) { /* ignore */ }
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

  if (showOnboarding) return <Onboarding onComplete={() => setShowOnboarding(false)} />;

  return (
    <Layout>
      <Routes>
            <Route path="/" element={<Navigate to="/inicio" replace />} />
            <Route path="/inicio"      element={<InicioGeneral />} />

            {/* Finanzas — todo lo financiero vive bajo una sola sección con pestañas internas */}
            <Route path="/finanzas" element={<FinanzasLayout />}>
              <Route index              element={<FinanzasResumen />} />
              <Route path="registro"    element={<Registrar />} />
              <Route path="historial"   element={<Historial />} />
              <Route path="presupuesto" element={<Presupuesto />} />
              <Route path="tc"          element={<TC />} />
              <Route path="deudas"      element={<Deudas />} />
              <Route path="ahorro"      element={<Ahorro />} />
              <Route path="analisis"    element={<Analisis />} />
              <Route path="inversiones" element={<Inversiones />} />
              <Route path="mercado"     element={<Mercado />} />
              <Route path="flujo"       element={<FlujoDeCaja />} />
              <Route path="dashboard"   element={<Dashboard />} />
              <Route path="reportes"    element={<Reportes />} />
              <Route path="metas"       element={<Metas />} />
              <Route path="apuntes"     element={<Apuntes />} />
            </Route>

            <Route path="/habitos"     element={<Habitos />} />
            <Route path="/ritual"        element={<Ritual />} />
            <Route path="/planificador"  element={<Planificador />} />
            <Route path="/metas-vida"    element={<MetasVida />} />
            <Route path="/rueda-vida"    element={<RuedaDeVida />} />
            <Route path="/notas"         element={<Notas />} />

            <Route path="/ia"          element={<IA />} />
            <Route path="/config"       element={<Configuracion />} />
            <Route path="/apuntes"     element={<Apuntes />} />
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
        <UpdateBanner />
      </ThemeProvider>
    </BrowserRouter>
  );
}
