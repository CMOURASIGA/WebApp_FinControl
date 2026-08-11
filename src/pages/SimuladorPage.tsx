import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Input';
import { profilesService } from '../services/profilesService';
import { parametrosService } from '../services/parametrosService';
import { resolveVigente, simularCenario } from '../lib/motorCalculo';
import { formatCurrency, hoje } from '../utils/formatters';
import type { Profile, SplitSocio } from '../types/database';

const ALIQUOTAS_SUGERIDAS = [6, 8, 10, 12, 15];

export const SimuladorPage: React.FC = () => {
  const [socios, setSocios] = useState<Profile[]>([]);
  const [receitaBruta, setReceitaBruta] = useState('19000');
  const [aliquota, setAliquota] = useState(6);
  const [custos, setCustos] = useState('1500');
  const [despesas, setDespesas] = useState('800');
  const [percentualEmpresa, setPercentualEmpresa] = useState(30);
  const [splits, setSplits] = useState<SplitSocio[]>([]);

  useEffect(() => {
    Promise.all([profilesService.listarSocios(), parametrosService.listarRegrasDistribuicao(), parametrosService.listarTodosTributarios()]).then(
      ([soc, regras, tributos]) => {
        setSocios(soc);
        const regraDefault = resolveVigente(
          regras.filter((r) => r.escopo === 'default'),
          hoje()
        );
        if (regraDefault) {
          setPercentualEmpresa(regraDefault.percentual_empresa);
          setSplits(regraDefault.split_socios);
        } else if (soc.length > 0) {
          const p = Math.round((70 / soc.length) * 100) / 100;
          setSplits(soc.map((s) => ({ socio_id: s.id, percentual: p })));
        }
        const tributoVigente = resolveVigente(
          tributos.filter((t) => t.tipo_receita === 'geral'),
          hoje()
        );
        if (tributoVigente) setAliquota(tributoVigente.aliquota_percentual);
      }
    );
  }, []);

  const resultado = useMemo(
    () =>
      simularCenario({
        receitaBruta: Number(receitaBruta) || 0,
        aliquotaPercentual: aliquota,
        custos: Number(custos) || 0,
        despesas: Number(despesas) || 0,
        percentualEmpresa,
        splitSocios: splits,
      }),
    [receitaBruta, aliquota, custos, despesas, percentualEmpresa, splits]
  );

  const nomeDoSocio = (id: string) => socios.find((s) => s.id === id)?.nome ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Simulador Tributário</h1>
        <p className="text-sm text-slate-500">Testa cenários sem alterar nenhum dado real.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <Field label="Receita bruta (R$)">
            <Input type="number" step="0.01" value={receitaBruta} onChange={(e) => setReceitaBruta(e.target.value)} />
          </Field>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Alíquota (%)</label>
            <div className="flex flex-wrap gap-2">
              {ALIQUOTAS_SUGERIDAS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAliquota(a)}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    aliquota === a ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {a}%
                </button>
              ))}
              <Input
                type="number"
                step="0.001"
                value={aliquota}
                onChange={(e) => setAliquota(Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>

          <Field label="Custos diretos (R$)">
            <Input type="number" step="0.01" value={custos} onChange={(e) => setCustos(e.target.value)} />
          </Field>
          <Field label="Despesas atribuídas (R$)">
            <Input type="number" step="0.01" value={despesas} onChange={(e) => setDespesas(e.target.value)} />
          </Field>
          <Field label="% retido pela empresa">
            <Input type="number" step="0.01" value={percentualEmpresa} onChange={(e) => setPercentualEmpresa(Number(e.target.value))} />
          </Field>
          {socios.map((s) => (
            <Field key={s.id} label={`% ${s.nome}`}>
              <Input
                type="number"
                step="0.01"
                value={splits.find((sp) => sp.socio_id === s.id)?.percentual ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSplits((prev) => {
                    const copia = [...prev];
                    const i = copia.findIndex((sp) => sp.socio_id === s.id);
                    if (i >= 0) copia[i] = { ...copia[i], percentual: val };
                    else copia.push({ socio_id: s.id, percentual: val });
                    return copia;
                  });
                }}
              />
            </Field>
          ))}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Resultado simulado</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Receita bruta" value={formatCurrency(resultado.receitaBruta)} />
            <Row label="Tributo provisionado" value={`-${formatCurrency(resultado.tributoProvisionado)}`} negative />
            <Row label="Custos diretos" value={`-${formatCurrency(resultado.custosDiretos)}`} negative />
            <Row label="Despesas" value={`-${formatCurrency(resultado.despesasAtribuidas)}`} negative />
            <Row label="Resultado líquido" value={formatCurrency(resultado.resultadoLiquido)} strong />
            <Row label="Margem líquida" value={`${resultado.margemLiquida.toFixed(1)}%`} />
            <Row label="Empresa" value={formatCurrency(resultado.valorEmpresa)} />
            {Object.entries(resultado.porSocio).map(([socioId, valor]) => (
              <Row key={socioId} label={nomeDoSocio(socioId)} value={formatCurrency(valor)} />
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; negative?: boolean; strong?: boolean }> = ({ label, value, negative, strong }) => (
  <div className="flex justify-between">
    <dt className="text-slate-500">{label}</dt>
    <dd className={`font-medium ${negative ? 'text-red-600' : ''} ${strong ? 'text-lg font-bold text-green-700' : ''}`}>{value}</dd>
  </div>
);
