import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Send, Sparkles, X } from 'lucide-react';
import { orionService, type OrionMensagem } from '../../services/orionService';
import { mesAtual, nomeDoMes } from '../../utils/formatters';

const SUGESTOES = [
  'Como estamos este mês?',
  'Quais são os principais riscos?',
  'Estamos acima do ponto de equilíbrio?',
  'Qual projeto apresenta menor margem?',
  'Como está nosso MRR?',
  'Algum investimento está abaixo da meta?',
  'Estamos prontos para fechar o mês?',
];

interface Props {
  aberto: boolean;
  onClose: () => void;
}

interface MensagemExibida extends OrionMensagem {
  id: string;
  toolsUsadas?: string[];
}

export const OrionPanel: React.FC<Props> = ({ aberto, onClose }) => {
  const [mensagens, setMensagens] = useState<MensagemExibida[]>([]);
  const [entrada, setEntrada] = useState('');
  const [competencia, setCompetencia] = useState(mesAtual());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimDaListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  const enviar = async (texto: string) => {
    const conteudo = texto.trim();
    if (!conteudo || carregando) return;
    setErro(null);
    setEntrada('');
    const minhaMsg: MensagemExibida = { id: crypto.randomUUID(), role: 'user', content: conteudo };
    const historicoParaEnvio: OrionMensagem[] = mensagens.map(({ role, content }) => ({ role, content }));
    setMensagens((atual) => [...atual, minhaMsg]);
    setCarregando(true);
    try {
      const resposta = await orionService.perguntar({ mensagem: conteudo, historico: historicoParaEnvio, competencia: `${competencia}-01` });
      setMensagens((atual) => [...atual, { id: crypto.randomUUID(), role: 'assistant', content: resposta.resposta, toolsUsadas: resposta.toolsUsadas }]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Orion" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><Sparkles className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold leading-none">Orion</p>
              <p className="mt-0.5 text-[11px] text-slate-300">IA financeira do 7Finance · somente leitura</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Fechar Orion">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
          <span>Competência de referência</span>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mensagens.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Pergunte sobre os dados financeiros que você tem acesso — competência {nomeDoMes(competencia)}. A Orion explica o que o sistema já calculou; ela não inventa números nem executa ações.
              </p>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sugestões</p>
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {mensagens.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {m.content}
                  {m.toolsUsadas && m.toolsUsadas.length > 0 && (
                    <p className="mt-2 border-t border-slate-200 pt-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                      Baseado em: {m.toolsUsadas.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando os dados...
                </div>
              </div>
            )}
            <div ref={fimDaListaRef} />
          </div>
        </div>

        {erro && (
          <div className="mx-5 mb-2 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {erro}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); enviar(entrada); }}
          className="flex items-center gap-2 border-t border-slate-200 px-4 py-3"
        >
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="Pergunte à Orion..."
            maxLength={2000}
            disabled={carregando}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50"
          />
          <button type="submit" disabled={carregando || !entrada.trim()} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
};
