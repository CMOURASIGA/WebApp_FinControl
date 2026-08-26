import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Profile } from '../types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  demoModeAtivo: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Raia de demonstração/desenvolvimento sem Supabase provisionado: quando
// VITE_SKIP_AUTH=true, pula a tela de login e libera o app com identidade
// sintética de administrador. Isso permite que os fluxos funcionais que
// dependem de user.id também operem sobre os mocks locais.
const demoModeAtivo = import.meta.env.VITE_SKIP_AUTH === 'true';

const DEMO_USER_ID = 'demo-user-admin';

const USUARIO_DEMO: User = {
  id: DEMO_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@7finance.local',
  app_metadata: {},
  user_metadata: { nome: 'Visitante da demonstração' },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const PERFIL_DEMO: Profile = {
  id: DEMO_USER_ID,
  nome: 'Visitante (modo demonstração)',
  cpf: null,
  chave_pix: null,
  papel: 'admin',
  ativo: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(demoModeAtivo ? PERFIL_DEMO : null);
  const [loading, setLoading] = useState(!demoModeAtivo);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (demoModeAtivo) return; // sem chamada de auth nenhuma nesta raia

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    if (demoModeAtivo) return { error: 'Modo demonstração: login desabilitado, o acesso já está liberado.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    if (demoModeAtivo) return { error: 'Modo demonstração: cadastro desabilitado.' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (demoModeAtivo) return; // nada a encerrar, não existe sessão real
    await supabase.auth.signOut();
  };

  const currentUser = demoModeAtivo ? USUARIO_DEMO : session?.user ?? null;

  return (
    <AuthContext.Provider
      value={{ session, user: currentUser, profile, loading, demoModeAtivo, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
