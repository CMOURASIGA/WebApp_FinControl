import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ParametrosPage } from './pages/ParametrosPage';
import { ProjetosPage } from './pages/ProjetosPage';
import { ProjetoDetalhePage } from './pages/ProjetoDetalhePage';
import { DespesasPage } from './pages/DespesasPage';
import { SociosPage } from './pages/SociosPage';
import { InvestimentosPage } from './pages/InvestimentosPage';
import { SimuladorPage } from './pages/SimuladorPage';
import { FechamentoPage } from './pages/FechamentoPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
