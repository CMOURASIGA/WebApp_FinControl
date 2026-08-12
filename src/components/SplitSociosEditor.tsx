import React from 'react';
import { Plus, X } from 'lucide-react';
import { Field, Input, Select } from './ui/Input';
import type { Profile, SplitSocio } from '../types/database';

interface SplitSociosEditorProps {
  socios: Profile[];
  percentualEmpresa: number;
  onChangePercentualEmpresa: (valor: number) => void;
  splits: SplitSocio[];
  onChangeSplits: (splits: SplitSocio[]) => void;
}

/**
 * Editor de regra de distribuição: percentual da empresa + N linhas
 * "Sócio (qual) + %". Cada linha escolhe, entre os sócios cadastrados,
 * quem ela representa — não é um campo fixo por nome, então a regra
 * comporta 2, 3 ou quantos sócios a operação tiver.
 */
export const SplitSociosEditor: React.FC<SplitSociosEditorProps> = ({
  socios,
  percentualEmpresa,
  onChangePercentualEmpresa,
  splits,
  onChangeSplits,
}) => {
  const somaSplits = splits.reduce((acc, s) => acc + (Number.isFinite(s.percentual) ? s.percentual : 0), 0);
  const total = percentualEmpresa + somaSplits;

  const socioDisponivel = (excluirIndex: number) => {
    const escolhidos = new Set(splits.filter((_, i) => i !== excluirIndex).map((s) => s.socio_id));
    return socios.find((s) => !escolhidos.has(s.id));
  };

  const adicionarLinha = () => {
    const proximo = socioDisponivel(-1);
    onChangeSplits([...splits, { socio_id: proximo?.id ?? '', percentual: 0 }]);
  };

  const atualizarLinha = (index: number, patch: Partial<SplitSocio>) => {
    onChangeSplits(splits.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removerLinha = (index: number) => {
    onChangeSplits(splits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Field label="% retido pela empresa">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={percentualEmpresa}
          onChange={(e) => onChangePercentualEmpresa(Number(e.target.value))}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Sócios</p>
        {splits.map((split, index) => (
          <div key={index} className="flex items-end gap-2">
            <Field label={index === 0 ? 'Sócio' : undefined} className="flex-1">
              <Select value={split.socio_id} onChange={(e) => atualizarLinha(index, { socio_id: e.target.value })}>
                <option value="">Selecione o sócio</option>
                {socios
                  .filter((s) => s.id === split.socio_id || !splits.some((sp, i) => i !== index && sp.socio_id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={index === 0 ? '%' : undefined} className="w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={split.percentual}
                onChange={(e) => atualizarLinha(index, { percentual: Number(e.target.value) })}
              />
            </Field>
            <button
              type="button"
              onClick={() => removerLinha(index)}
              className="mb-0.5 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remover sócio desta regra"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionarLinha}
          disabled={splits.length >= socios.length}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar sócio à regra
        </button>
        {splits.length >= socios.length && (
          <p className="text-xs text-slate-400">Todos os sócios cadastrados já estão nesta regra.</p>
        )}
      </div>

      <p className={`text-xs ${Math.abs(total - 100) > 0.01 ? 'text-red-600' : 'text-slate-500'}`}>
        Soma atual: {total.toFixed(2)}% (precisa ser 100%)
      </p>
    </div>
  );
};

export function splitValido(percentualEmpresa: number, splits: SplitSocio[]): boolean {
  if (splits.some((s) => !s.socio_id)) return false;
  const soma = percentualEmpresa + splits.reduce((acc, s) => acc + s.percentual, 0);
  return Math.abs(soma - 100) <= 0.01;
}
