import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  onClose: () => void;
  largura?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({ aberto, titulo, descricao, children, onClose, largura = 'md' }) => {
  useEffect(() => {
    if (!aberto) return;
    const fechar = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', fechar);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', fechar); document.body.style.overflow = ''; };
  }, [aberto, onClose]);

  if (!aberto) return null;
  const larguras = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`max-h-[90vh] w-full ${larguras[largura]} overflow-y-auto rounded-3xl border border-white/60 bg-white shadow-2xl`}>
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div><p className="brand-highlight-text text-[10px] font-black uppercase tracking-[0.22em]">Informações necessárias</p><h2 id="modal-title" className="mt-1 text-xl font-semibold text-slate-900">{titulo}</h2>{descricao && <p className="mt-1 text-sm leading-5 text-slate-500">{descricao}</p>}</div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
};
