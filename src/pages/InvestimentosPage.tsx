import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { investimentosService } from '../services/investimentosService';
import { projetosService } from '../services/projetosService';
import { profilesService } from '../services/profilesService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { calcularResultadoProjeto, calcularROI } from '../lib/motorCalculo';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { Investimento, Profile, Projeto } from '../types/database';

export const InvestimentosPage: React.FC = () => {
  const { user } = useAuth();
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [socios, setSocios] = useState<Profile[]>([]);
  const [roiPorProjeto, setRoiPorProjeto] = useState<Record<string, { investido: number; retorno: number; roi: number }>>({});
  const [erro, setErro] = useState<string | null>(null);

  const [investidorTipo, setInvestidorTipo] = useState<Investimento['investidor_tipo']>('socio');
  const [socioId, setSocioId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('aporte');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hoje());

  const carregar = async () => {
    const [inv, proj, soc] = await Promise.all([investimentosService.listar(), projetosService.listar(), profilesService.listarSocios()]);
    setInvestimentos(inv);
    setProjetos(proj);
    setSocios(soc);

    const projetosComInvestimento = [...new Set(inv.map((i) => i.projeto_id).filter((x): x is string => !!x))];
    const roi: Record<string, { investido: number; retorno: number; roi: number }> = {};
    for (const pid of projetosComInvestimento) {
      const [receitas, custos, despesasTodas] = await Promise.all([
        receitasService.listarPorProjeto(pid),
        custosProjetoService.listarPorProjeto(pid),
        despesasService.listar(),
      ]);
      const despesas = despesasTodas.filter((d) => d.projeto_id === pid);
      const resultado = calcularResultadoProjeto(receitas, custos, despesas);
      const investido = inv.filter((i) => i.projeto_id === pid).reduce((acc, i) => acc + i.valor, 0);
      roi[pid] = { investido, retorno: resultado.resultadoLiquido, roi: calcularROI(investido, resultado.resultadoLiquido) };
    }
    setRoiPorProjeto(roi);
  };

  useEffect(() => {
    carregar();
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    try {
      await investimentosService.criar({
        investidorTipo,
        socioId: investidorTipo === 'socio' ? socioId : undefined,
        projetoId: projetoId || undefined,
        valor: Number(valor),
        data,
        tipo,
        descricao,
        createdBy: user.id,
      });
      setValor('');
      setDescricao('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const nomeDoSocio = (id: string | null) => (id ? socios.find((s) => s.id === id)?.nome ?? id : '—');
  const nomeDoProjeto = (id: string | null) => (id ? projetos.find((p) => p.id === id)?.nome ?? id : '—');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Investimentos & ROI</h1>
        <p className="text-sm text-slate-500">Despesa ≠ investimento: aqui você registra capital aportado e acompanha o retorno.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={criar} className="grid gap-3 sm:grid-cols-3">
          <Field label="Investidor">
            <Select value={investidorTipo} onChange={(e) => setInvestidorTipo(e.target.value as Investimento['investidor_tipo'])}>
              <option value="socio">Sócio</option>
              <option value="empresa">Consult Services</option>
            </Select>
          </Field>
          {investidorTipo === 'socio' && (
            <Field label="Qual sócio">
              <Select value={socioId} onChange={(e) => setSocioId(e.target.value)} required>
                <option value="">Selecione</option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Projeto (opcional)">
            <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
              <option value="">— geral —</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor (R$)">
            <Input type="number" step="0.01" min="0" required value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="aporte, desenvolvimento..." />
          </Field>
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Descrição" className="sm:col-span-3">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Field>
          {erro && <p className="text-sm text-red-600 sm:col-span-3">{erro}</p>}
          <Button type="submit" className="sm:col-span-3">Registrar investimento</Button>
        </form>
      </Card>

      {Object.keys(roiPorProjeto).length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">ROI por projeto</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {Object.entries(roiPorProjeto).map(([pid, r]) => (
              <div key={pid} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-800">{nomeDoProjeto(pid)}</span>
                <span className="text-slate-500">
                  investido {formatCurrency(r.investido)} · retorno {formatCurrency(r.retorno)}
                </span>
                <span className={`font-semibold ${r.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>ROI {r.roi.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {investimentos.map((i) => (
          <div key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">{i.descricao || i.tipo}</p>
              <p className="text-xs text-slate-500">
                {i.investidor_tipo === 'socio' ? nomeDoSocio(i.socio_id) : 'Consult Services'} · {nomeDoProjeto(i.projeto_id)} ·{' '}
                {formatDate(i.data)}
              </p>
            </div>
            <span className="font-medium">{formatCurrency(i.valor)}</span>
          </div>
        ))}
        {investimentos.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Nenhum investimento registrado.</p>}
      </div>
    </div>
  );
};
