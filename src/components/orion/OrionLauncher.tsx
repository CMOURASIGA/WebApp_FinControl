import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useCapabilities } from '../../hooks/useCapabilities';
import { OrionPanel } from './OrionPanel';

/**
 * Launcher global da Orion — botão flutuante persistente, montado uma
 * única vez no AppLayout (fora do <Outlet>) para ficar disponível em
 * qualquer tela. Só aparece para quem tem a capability 'use_orion';
 * lembrar que isso é UX — a Edge Function reforça a mesma checagem no
 * backend antes de responder qualquer coisa.
 */
export const OrionLauncher: React.FC = () => {
  const { can } = useCapabilities();
  const [aberto, setAberto] = useState(false);

  if (!can('use_orion')) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5 hover:bg-slate-800"
        aria-label="Abrir Orion"
        title="Orion — IA financeira"
      >
        <Sparkles className="h-6 w-6" />
      </button>
      <OrionPanel aberto={aberto} onClose={() => setAberto(false)} />
    </>
  );
};
