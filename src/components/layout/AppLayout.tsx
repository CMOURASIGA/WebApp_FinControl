import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  Users,
  TrendingUp,
  SlidersHorizontal,
  CalendarCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Visão Geral', icon: LayoutDashboard, end: true },
  { to: '/projetos', label: 'Projetos & Receitas', icon: Briefcase },
  { to: '/despesas', label: 'Despesas', icon: Receipt },
  { to: '/socios', label: 'Sócios', icon: Users },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/simulador', label: 'Simulador Tributário', icon: SlidersHorizontal },
  { to: '/fechamento', label: 'Fechamento & DRE', icon: CalendarCheck },
  { to: '/parametros', label: 'Parâmetros', icon: SlidersHorizontal },
];

export const AppLayout: React.FC = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="text-lg font-bold text-slate-900">Consult Services</p>
          <p className="text-xs text-slate-500">Finance 2027</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="truncate text-sm font-medium text-slate-800">{profile?.nome ?? '...'}</p>
          <button
            onClick={() => signOut()}
            className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
