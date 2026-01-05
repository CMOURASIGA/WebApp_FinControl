
import React from 'react';
import { X, ShieldCheck, PlusCircle, LayoutDashboard, FilePieChart, Save, Database } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuide: React.FC<UserGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: Database,
      title: "Onde meus dados ficam?",
      description: "Seus dados são armazenados localmente no seu navegador (LocalStorage). Isso significa que apenas você tem acesso a eles neste dispositivo, sem necessidade de nuvem ou login.",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      icon: PlusCircle,
      title: "Como cadastrar?",
      description: "Clique em 'Nova Transação'. Você precisará informar o Tipo (Receita/Despesa), Valor, Categoria, Data e uma Descrição curta para identificar o gasto.",
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      icon: LayoutDashboard,
      title: "Gestão e Status",
      description: "Diferencie o que já foi pago do que está previsto usando o campo 'Status'. O sistema calcula seu Saldo Real (o que você tem agora) e seu Saldo Previsto (final do mês).",
      color: "text-orange-600",
      bg: "bg-orange-50"
    },
    {
      icon: FilePieChart,
      title: "Visão Estratégica",
      description: "Use o 'Relatório Anual' para ver o balanço de todos os meses lado a lado. Isso ajuda a identificar meses com mais gastos e planejar seus investimentos.",
      color: "text-purple-600",
      bg: "bg-purple-50"
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-none">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Guia de Orientações</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step, index) => (
              <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                <div className={`p-2 w-fit rounded-lg mb-3 ${step.bg}`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-600 text-white p-5 rounded-xl flex items-start gap-4 shadow-lg shadow-blue-200">
            <Save className="w-8 h-8 shrink-0 opacity-80" />
            <div>
              <h4 className="font-bold mb-1">Dica de Ouro</h4>
              <p className="text-sm text-blue-50">Sempre atualize o status das despesas de "Pendente" para "Pago" assim que realizar o pagamento. Isso manterá seu fluxo de caixa real 100% preciso.</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
          <Button onClick={onClose} size="lg" className="w-full sm:w-auto">
            Entendi, vamos começar!
          </Button>
        </div>
      </Card>
    </div>
  );
};
