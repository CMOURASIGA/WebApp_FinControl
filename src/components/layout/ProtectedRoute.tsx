import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading, demoModeAtivo } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Carregando...</div>;
  }

  // Raia de demo/desenvolvimento sem Supabase provisionado (VITE_SKIP_AUTH):
  // libera o acesso sem sessão real. Nunca ativo em produção — ver AuthContext.
  if (!session && !demoModeAtivo) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
