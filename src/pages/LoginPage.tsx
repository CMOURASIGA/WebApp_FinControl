import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { PRODUCT_DESCRIPTION } from '../lib/brand';
import { useBrand } from '../contexts/BrandContext';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, demoModeAtivo } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Raia de demo/desenvolvimento sem Supabase (VITE_SKIP_AUTH): não há o
  // que logar, o ProtectedRoute já libera o acesso — evita mostrar um
  // formulário de login que não serve para nada nesse cenário.
  if (demoModeAtivo) return <Navigate to="/" replace />;

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setCarregando(true);

    const resultado = modo === 'login' ? await signIn(email, senha) : await signUp(email, senha, nome);

    setCarregando(false);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }

    if (modo === 'cadastro') {
      setAviso('Conta criada. Verifique seu e-mail para confirmar o acesso (se a confirmação estiver ativa no projeto Supabase) e depois faça login.');
      setModo('login');
      return;
    }

    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(0,174,239,0.22),transparent_32%),linear-gradient(135deg,#003b73,#001f3d)] px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <img src={brand.logo_url} alt={brand.company_name} className="mx-auto h-28 w-full object-contain" />
        <div className="mt-5 text-center"><p className="brand-highlight-text text-[10px] font-black uppercase tracking-[0.24em]">{brand.product_name}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{brand.product_subtitle}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{PRODUCT_DESCRIPTION}</p></div>
        <p className="mt-2 text-sm text-slate-500">
          {modo === 'login' ? 'Entre com sua conta de sócio.' : 'Crie sua conta de sócio.'}
        </p>

        <form onSubmit={submeter} className="mt-6 space-y-4">
          {modo === 'cadastro' && (
            <Field label="Nome">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Christian" />
            </Field>
          )}
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@empresa.com" />
          </Field>
          <Field label="Senha">
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          </Field>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {aviso && <p className="text-sm text-green-600">{aviso}</p>}

          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-xs font-medium text-slate-500 hover:text-blue-600"
          onClick={() => {
            setErro(null);
            setAviso(null);
            setModo(modo === 'login' ? 'cadastro' : 'login');
          }}
        >
          {modo === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </Card>
    </div>
  );
};
