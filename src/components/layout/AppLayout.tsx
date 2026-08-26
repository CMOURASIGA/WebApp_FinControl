import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, ReceiptText, Users, TrendingUp, SlidersHorizontal, CalendarCheck, LogOut, Menu, X, CircleDollarSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBrand } from '../../contexts/BrandContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import type { Capability } from '../../lib/capabilities';
import { OrionLauncher } from '../orion/OrionLauncher';

const NAV_ITEMS: Array<{ section: string; to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; capability: Capability }> = [
  { section: 'Visão financeira', to: '/', label: 'Visão Geral', icon: LayoutDashboard, end: true, capability: 'view_dashboard' },
  { section: 'Visão financeira', to: '/projetos', label: 'Projetos e Receitas', icon: Briefcase, capability: 'view_projects' },
  { section: 'Visão financeira', to: '/despesas', label: 'Custos e Despesas', icon: ReceiptText, capability: 'view_expenses' },
  { section: 'Sociedade', to: '/socios', label: 'Sócios', icon: Users, capability: 'view_partners' },
  { section: 'Sociedade', to: '/investimentos', label: 'Investimentos', icon: TrendingUp, capability: 'view_investments' },
  { section: 'Gestão', to: '/simulador', label: 'Simulador Tributário', icon: CircleDollarSign, capability: 'view_simulator' },
  { section: 'Gestão', to: '/fechamento', label: 'Fechamento e DRE', icon: CalendarCheck, capability: 'view_closing' },
  { section: 'Gestão', to: '/parametros', label: 'Parâmetros', icon: SlidersHorizontal, capability: 'view_parameters' },
];

const TITULOS: Record<string, string> = { '/': 'Visão Geral', '/projetos': 'Projetos e Receitas', '/despesas': 'Custos e Despesas', '/socios': 'Gestão de Sócios', '/investimentos': 'Investimentos', '/simulador': 'Simulador Tributário', '/fechamento': 'Fechamento e DRE', '/parametros': 'Parâmetros' };

export const AppLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { brand } = useBrand();
  const { can } = useCapabilities();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const titulo = pathname.startsWith('/projetos/') ? 'Detalhes do Projeto' : TITULOS[pathname] ?? 'Workspace financeiro';
  const itensVisiveis = NAV_ITEMS.filter((item) => can(item.capability));
  const sections = Array.from(new Set(itensVisiveis.map((item) => item.section)));
  const iniciais = (profile?.nome ?? 'Usuário').split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] md:flex">
      {menuAberto && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/45 md:hidden" onClick={() => setMenuAberto(false)} />}
      <aside className={`sidebar-shell fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col overflow-hidden transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="sidebar-brand-panel relative"><div className="brand-logo-frame h-[90px] max-w-[210px] px-2 py-1"><img src={brand.logo_url} alt={brand.company_name} className="sidebar-brand-logo" /></div><button className="absolute right-3 top-3 rounded-full p-2 text-slate-500 md:hidden" onClick={() => setMenuAberto(false)}><X className="h-5 w-5" /></button></div>
        <div className="border-b border-white/15 px-5 py-4"><p className="brand-highlight-text text-[10px] font-black uppercase tracking-[0.24em]">{brand.product_name}</p><p className="mt-1 text-sm font-semibold text-white">{brand.product_subtitle}</p><p className="mt-1 text-[10px] text-cyan-100">Uma plataforma {brand.company_name}</p></div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => <div key={section} className="mb-5"><p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/80">{section}</p><div className="space-y-1">{itensVisiveis.filter((item) => item.section === section).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuAberto(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'brand-highlight-bg text-slate-950 shadow-sm' : 'text-slate-100 hover:bg-white/10 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</div></div>)}
        </nav>
        <div className="border-t border-white/15 p-4"><div className="flex items-center gap-3"><span className="brand-highlight-bg flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-slate-950">{iniciais}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{profile?.nome ?? '...'}</p><p className="text-[10px] uppercase tracking-wide text-cyan-200">{profile?.papel ?? 'usuário'}</p></div><button onClick={() => signOut()} className="rounded-lg p-2 text-cyan-100 hover:bg-white/10 hover:text-white" title="Sair"><LogOut className="h-4 w-4" /></button></div></div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6"><div className="flex items-center gap-3"><button className="rounded-xl border border-slate-200 p-2 text-slate-600 md:hidden" onClick={() => setMenuAberto(true)}><Menu className="h-5 w-5" /></button><div><p className="brand-highlight-text text-[10px] font-black uppercase tracking-[0.2em]">Workspace financeiro</p><h1 className="text-base font-semibold text-slate-900">{titulo}</h1></div></div><span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 sm:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Operação online</span></header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6"><div className="mx-auto max-w-7xl"><Outlet /></div></main>
      </div>
      <OrionLauncher />
    </div>
  );
};
