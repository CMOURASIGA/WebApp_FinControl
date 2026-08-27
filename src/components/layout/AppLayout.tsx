import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  CircleDollarSign,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBrand } from '../../contexts/BrandContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { resetDemoData } from '../../lib/demoSupabase';

const NAV_ITEMS = [
  { section: 'Visão financeira', to: '/', label: 'Visão Geral', icon: LayoutDashboard, end: true },
  { section: 'Visão financeira', to: '/projetos', label: 'Projetos e Receitas', icon: Briefcase },
  { section: 'Visão financeira', to: '/despesas', label: 'Custos e Despesas', icon: ReceiptText },
  { section: 'Sociedade', to: '/socios', label: 'Sócios', icon: Users },
  { section: 'Sociedade', to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { section: 'Gestão', to: '/simulador', label: 'Simulador Tributário', icon: CircleDollarSign },
  { section: 'Gestão', to: '/fechamento', label: 'Fechamento e DRE', icon: CalendarCheck },
  { section: 'Inteligência', to: '/orion', label: 'Orion Room', icon: Sparkles },
  { section: 'Gestão', to: '/parametros', label: 'Parâmetros', icon: SlidersHorizontal },
];

const TITULOS: Record<string, string> = {
  '/': 'Visão Geral',
  '/projetos': 'Projetos e Receitas',
  '/despesas': 'Custos e Despesas',
  '/socios': 'Gestão de Sócios',
  '/investimentos': 'Investimentos',
  '/simulador': 'Simulador Tributário',
  '/fechamento': 'Fechamento e DRE',
  '/orion': 'Orion Room',
  '/parametros': 'Parâmetros',
};

export const AppLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { brand } = useBrand();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [userMenuAberto, setUserMenuAberto] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const titulo = pathname.startsWith('/projetos/') ? 'Detalhes do Projeto' : TITULOS[pathname] ?? 'Workspace financeiro';
  const sections = Array.from(new Set(NAV_ITEMS.map((item) => item.section)));
  const nomeUsuario = profile?.nome ?? 'Usuário';
  const papelUsuario = profile?.papel ?? 'usuário';
  const iniciais = nomeUsuario.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuAberto(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] md:flex">
      {menuAberto && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/45 md:hidden" onClick={() => setMenuAberto(false)} />}

      <aside className={`sidebar-shell fixed inset-y-0 left-0 z-40 flex w-[256px] flex-col overflow-hidden transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative border-b border-white/15 px-3 pb-6 pt-4">
          <div className="flex h-[144px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-white px-1 py-1 shadow-sm ring-1 ring-black/5">
            <img src={brand.logo_url} alt={brand.company_name} className="max-h-[128px] max-w-[92%] object-contain object-center" />
          </div>
          <button className="absolute right-3 top-3 rounded-full p-2 text-white/80 hover:bg-white/10 md:hidden" onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>

          <div className="mt-6 px-2">
            <div className="flex items-center gap-2">
              <p className="brand-highlight-text text-[11px] font-black uppercase tracking-[0.22em]">{brand.product_name}</p>
              <span className="rounded-md border border-amber-300/50 bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-200">Demo</span>
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-5 text-white">{brand.product_subtitle}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/65">{section}</p>
              <div className="space-y-1">
                {NAV_ITEMS.filter((item) => item.section === section).map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => setMenuAberto(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'brand-highlight-bg text-slate-950 shadow-sm' : 'text-slate-100 hover:bg-white/10 hover:text-white'}`}>
                    <Icon className="h-4 w-4 shrink-0" /><span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-xl border border-slate-200 p-2 text-slate-600 md:hidden" onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0">
              <p className="brand-highlight-text truncate text-[10px] font-black uppercase tracking-[0.2em]">Workspace financeiro</p>
              <h1 className="truncate text-base font-semibold text-slate-900">{titulo}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setConfirmarReset(true)} className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 lg:inline-flex"><RotateCcw className="h-3.5 w-3.5" />Restaurar demo</button>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 sm:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Sistema online</span>
            <button type="button" className="hidden rounded-full p-2 text-slate-500 hover:bg-slate-100 sm:inline-flex" aria-label="Notificações"><Bell className="h-4 w-4" /></button>

            <div ref={userMenuRef} className="relative">
              <button type="button" onClick={() => setUserMenuAberto((aberto) => !aberto)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-slate-100 sm:px-2" aria-expanded={userMenuAberto} aria-haspopup="menu">
                <span className="brand-highlight-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-950">{iniciais || 'US'}</span>
                <span className="hidden min-w-0 text-left md:block"><span className="block max-w-40 truncate text-sm font-semibold text-slate-900">{nomeUsuario}</span><span className="block text-[10px] uppercase tracking-wide text-slate-500">{papelUsuario}</span></span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
              </button>

              {userMenuAberto && (
                <div role="menu" className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-4"><p className="truncate text-sm font-semibold text-slate-900">{nomeUsuario}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{papelUsuario}</p></div>
                  <div className="p-2">
                    <button type="button" onClick={() => setConfirmarReset(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 lg:hidden"><FlaskConical className="h-4 w-4" />Restaurar demonstração</button>
                    <button type="button" onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sair</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-6"><div className="mx-auto max-w-7xl"><Outlet /></div></main>
      </div>

      <Modal aberto={confirmarReset} titulo="Restaurar dados da demonstração?" descricao="Todos os testes feitos neste navegador serão apagados e os dados fictícios iniciais voltarão." onClose={() => setConfirmarReset(false)}>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmarReset(false)}>Cancelar</Button><Button variant="danger" onClick={resetDemoData}>Restaurar dados</Button></div>
      </Modal>
    </div>
  );
};
