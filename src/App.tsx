import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BrandProvider } from './contexts/BrandContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ParametrosPage = lazy(() => import('./pages/ParametrosPage').then((m) => ({ default: m.ParametrosPage })));
const ProjetosPage = lazy(() => import('./pages/ProjetosPage').then((m) => ({ default: m.ProjetosPage })));
const ProjetoDetalhePage = lazy(() => import('./pages/ProjetoDetalhePage').then((m) => ({ default: m.ProjetoDetalhePage })));
const DespesasPage = lazy(() => import('./pages/DespesasPage').then((m) => ({ default: m.DespesasPage })));
const SociosPage = lazy(() => import('./pages/SociosPage').then((m) => ({ default: m.SociosPage })));
const InvestimentosPage = lazy(() => import('./pages/InvestimentosPage').then((m) => ({ default: m.InvestimentosPage })));
const SimuladorPage = lazy(() => import('./pages/SimuladorPage').then((m) => ({ default: m.SimuladorPage })));
const FechamentoPage = lazy(() => import('./pages/FechamentoPage').then((m) => ({ default: m.FechamentoPage })));

function App() {
  return (
    <BrandProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Carregando 7Finance...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projetos" element={<ProjetosPage />} />
            <Route path="/projetos/:id" element={<ProjetoDetalhePage />} />
            <Route path="/despesas" element={<DespesasPage />} />
            <Route path="/socios" element={<SociosPage />} />
            <Route path="/investimentos" element={<InvestimentosPage />} />
            <Route path="/simulador" element={<SimuladorPage />} />
            <Route path="/fechamento" element={<FechamentoPage />} />
            <Route path="/parametros" element={<ParametrosPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </BrandProvider>
  );
}

export default App;
