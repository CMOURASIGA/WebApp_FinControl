
import React, { useState } from 'react';
import { Button } from './ui/Button';
import { ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react';
import { UserGuide } from './UserGuide';

interface LandingProps {
  onEnter: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>

      <UserGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Finanças Simplificadas
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 tracking-tight">
            Controle Financeiro <span className="text-blue-600">Simples</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto leading-relaxed">
            Gerencie suas finanças pessoais sem planilhas complicadas. 
            Tenha clareza absoluta sobre para onde vai cada centavo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
          {[
            "Visão mensal e anual",
            "Armazenamento privado",
            "Gestão de pendências"
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-slate-700 bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-slate-200/50">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="font-medium text-sm">{item}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button 
            size="lg" 
            onClick={onEnter}
            className="group w-full sm:w-auto px-10 h-14 text-lg"
          >
            Acessar o Painel
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <Button 
            variant="secondary" 
            size="lg" 
            onClick={() => setIsGuideOpen(true)}
            className="w-full sm:w-auto px-8 h-14 text-lg bg-white border-slate-200"
          >
            <HelpCircle className="mr-2 w-5 h-5 text-blue-600" />
            Como funciona?
          </Button>
        </div>
      </div>
      
      <footer className="absolute bottom-6 text-slate-400 text-sm font-medium">
        &copy; {new Date().getFullYear()} FinControl WebApp • 100% Privado
      </footer>
    </div>
  );
};
