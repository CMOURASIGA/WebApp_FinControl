import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { orionService, type OrionAnswer, type OrionSnapshot } from '../services/orionService';

type Message = { id: number; autor: 'orion' | 'usuario'; texto: string; answer?: OrionAnswer };
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const sugestoes = [
  'Como está a situação financeira deste mês?',
  'Quanto da reserva pode ser avaliado para investimento?',
  'Qual é o valor previsto de impostos?',
  'Posso fazer uma retirada sem comprometer o caixa?',
];

export const OrionPage = () => {
  const [dados, setDados] = useState<OrionSnapshot | null>(null);
  const [pergunta, setPergunta] = useState('');
  const [processando, setProcessando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [vozAtiva, setVozAtiva] = useState(true);
  const [mensagens, setMensagens] = useState<Message[]>([{ id: 1, autor: 'orion', texto: 'Olá, sou o Orion. Analiso o caixa, as projeções e os compromissos financeiros da empresa para apoiar suas decisões.' }]);
  const reconhecimento = useRef<SpeechRecognitionLike | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  useEffect(() => { orionService.carregarSnapshot().then(setDados).catch(() => setDados(null)); }, []);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens, processando]);

  const falar = (texto: string) => {
    if (!vozAtiva || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const enviar = async (texto: string) => {
    const limpa = texto.trim();
    if (!limpa || !dados || processando) return;
    setMensagens((atuais) => [...atuais, { id: Date.now(), autor: 'usuario', texto: limpa }]);
    setPergunta('');
    setProcessando(true);
    const answer = await orionService.perguntar(limpa, dados);
    setMensagens((atuais) => [...atuais, { id: Date.now() + 1, autor: 'orion', texto: answer.texto, answer }]);
    setProcessando(false);
    falar(answer.texto);
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void enviar(pergunta); };
  const alternarMicrofone = () => {
    if (ouvindo) { reconhecimento.current?.stop(); setOuvindo(false); return; }
    const SpeechRecognitionApi = (window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) return;
    const instance = new SpeechRecognitionApi();
    instance.lang = 'pt-BR'; instance.continuous = false; instance.interimResults = false;
    instance.onresult = (event) => { const transcricao = event.results[0]?.[0]?.transcript ?? ''; setPergunta(transcricao); if (transcricao) void enviar(transcricao); };
    instance.onend = () => setOuvindo(false); instance.onerror = () => setOuvindo(false);
    reconhecimento.current = instance; setOuvindo(true); instance.start();
  };

  return <div className="space-y-5">
    <Card className="border-0 bg-gradient-to-br from-slate-950 via-[#003b73] to-cyan-800 text-white">
      <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950 shadow-lg"><Sparkles className="h-7 w-7" /></span><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Inteligência financeira</p><h2 className="mt-1 text-2xl font-bold">Orion Room</h2><p className="mt-2 max-w-2xl text-sm text-cyan-50">Converse sobre caixa, reserva, impostos, retiradas, projeções e decisões financeiras. O Orion usa os números do 7Finance e identifica quando apresenta um dado, projeção ou orientação.</p></div></div>
        <button onClick={() => { setVozAtiva((valor) => !valor); window.speechSynthesis?.cancel(); }} className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15">{vozAtiva ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{vozAtiva ? 'Resposta por voz ativa' : 'Resposta por voz desativada'}</button>
      </div>
    </Card>
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="flex min-h-[570px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {mensagens.map((msg) => <div key={msg.id} className={`flex ${msg.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${msg.autor === 'usuario' ? 'bg-[var(--primary-brand)] text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
            {msg.autor === 'orion' && <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--primary-brand)]"><Bot className="h-4 w-4" />Orion{msg.answer && <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] text-cyan-800">{msg.answer.tipo}</span>}</div>}<p>{msg.texto}</p>
            {msg.answer && <p className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-500">Base da análise: {msg.answer.fontes.join(' · ')}</p>}
          </div></div>)}
          {processando && <div className="flex items-center gap-2 text-sm text-slate-500"><Sparkles className="h-4 w-4 animate-pulse text-cyan-600" />Orion está analisando os dados...</div>}<div ref={fim} />
        </div>
        <form onSubmit={submit} className="border-t border-slate-200 bg-white p-4"><div className="flex gap-2"><button type="button" onClick={alternarMicrofone} title="Conversar por voz" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${ouvindo ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{ouvindo ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button><input value={pergunta} onChange={(event) => setPergunta(event.target.value)} placeholder={dados ? 'Pergunte ao Orion sobre as finanças da empresa...' : 'Carregando dados financeiros...'} disabled={!dados || processando} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[var(--primary-brand)] focus:ring-2 focus:ring-cyan-100" /><Button type="submit" disabled={!pergunta.trim() || !dados || processando}><Send className="mr-2 h-4 w-4" />Enviar</Button></div></form>
      </Card>
      <div className="space-y-4"><Card><div className="p-5"><h3 className="text-sm font-bold text-slate-900">Perguntas sugeridas</h3><div className="mt-3 space-y-2">{sugestoes.map((item) => <button key={item} onClick={() => void enviar(item)} disabled={!dados || processando} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs leading-5 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 disabled:opacity-50">{item}</button>)}</div></div></Card><Card><div className="p-5"><h3 className="text-sm font-bold text-slate-900">Limites do Orion</h3><p className="mt-2 text-xs leading-5 text-slate-600">O Orion apoia a gestão de caixa e apresenta cenários. Ele não executa investimentos, não garante rentabilidade e não substitui contador ou consultor registrado.</p></div></Card></div>
    </div>
  </div>;
};
