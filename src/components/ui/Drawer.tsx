import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  onClose: () => void;
  largura?: 'sm' | 'md' | 'lg';
}

/**
 * Painel lateral para cadastros/edições curtos (até ~8-10 campos, sem
 * navegação interna) — nova despesa, novo investimento, novo sócio,
 * novo projeto, nova receita/custo. Ver docs/02-design/DESIGN_SYSTEM.md
 * §3 "Drawer lateral".
 *
 * Fluxos extensos com múltiplas seções continuam em página dedicada
 * (ex.: detalhe do projeto) — não usar Drawer para isso.
 */
export const Drawer: React.FC<DrawerProps> = ({ aberto, titulo, descricao, children, onClose, largura = 'md' }) => {
  useEffect(() => {
    if (!aberto) return;
    const fechar = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', fechar);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', fechar); document.body.style.overflow = ''; };
  }, [aberto, onClose]);

  if (!aberto) return null;
  const larguras = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`flex h-full w-full ${larguras[largura]} flex-col border-l border-slate-200 bg-white shadow-2xl`}>
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="brand-highlight-text text-[10px] font-black uppercase tracking-[0.22em]">Novo registro</p>
            <h2 id="drawer-title" className="mt-1 text-xl font-semibold text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-1 text-sm leading-5 text-slate-500">{descricao}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
};
