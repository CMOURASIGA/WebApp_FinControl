import React, { useState } from 'react';
import { Database, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DEMO_ACK_KEY } from '../../lib/demoSupabase';

export const DemoNotice: React.FC = () => {
  const [aberto, setAberto] = useState(() => localStorage.getItem(DEMO_ACK_KEY) !== 'true');
  const confirmar = () => { localStorage.setItem(DEMO_ACK_KEY, 'true'); setAberto(false); };
  return <Modal aberto={aberto} titulo="Você está entrando em uma demonstração" descricao="Conheça e valide as funcionalidades do 7Finance sem acessar dados reais." onClose={() => undefined}>
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
        Tudo o que você cadastrar ou alterar ficará salvo somente neste navegador, neste computador, tablet ou celular.
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4"><ShieldCheck className="h-5 w-5 text-emerald-600"/><p className="mt-2 text-xs font-semibold text-slate-800">Sem dados reais</p><p className="mt-1 text-xs text-slate-500">A base oficial não é acessada.</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><MonitorSmartphone className="h-5 w-5 text-blue-600"/><p className="mt-2 text-xs font-semibold text-slate-800">Somente neste dispositivo</p><p className="mt-1 text-xs text-slate-500">Outro aparelho terá dados separados.</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><Database className="h-5 w-5 text-violet-600"/><p className="mt-2 text-xs font-semibold text-slate-800">Armazenamento local</p><p className="mt-1 text-xs text-slate-500">Limpar o navegador pode apagar tudo.</p></div>
      </div>
      <p className="text-xs leading-5 text-slate-500">Este ambiente serve exclusivamente para avaliação comercial e funcional. Os lançamentos não possuem validade financeira, fiscal ou contábil.</p>
      <Button className="w-full" onClick={confirmar}>Entendi e quero conhecer o sistema</Button>
    </div>
  </Modal>;
};
