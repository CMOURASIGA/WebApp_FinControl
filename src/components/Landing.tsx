import React from 'react';
import { Button } from './ui/Button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface LandingProps {
  onEnter: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-2xl w-full text-center space-y-8">
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight">
            Controle Financeiro <span className="text-blue-600">Simples</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto">
            Gerencie suas finanças pessoais sem planilhas complicadas. 
            Tenha clareza sobre para onde vai o seu dinheiro.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
          {[
            "Visão mensal clara",
            "Controle de pendências",
            "Fácil de usar no celular"
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-slate-700 bg-white p-3 rounded-lg shadow-sm border border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="font-medium text-sm">{item}</span>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <Button 
            size="lg" 
            onClick={onEnter}
            className="group"
          >
            Acessar o Painel
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
      
      <footer className="absolute bottom-4 text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} FinControl App
      </footer>
    </div>
  );
};