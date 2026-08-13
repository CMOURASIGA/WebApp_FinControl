import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { investimentosService } from '../services/investimentosService';
import { projetosService } from '../services/projetosService';
import { sociosService } from '../services/sociosService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { calcularResultadoProjeto, calcularROI, calcularPaybackMeses } from '../lib/motorCalculo';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { Investimento, Socio, Projeto } from '../types/database';

export const InvestimentosPage: React.FC = () => {
  const { user } = useAuth();
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [roiPorProjeto, setRoiPorProjeto] = useState<Record<string, { investido: number; retorno: number; roi: number; payback: number | null; meta: number | null }>>({});
  const [erro, setErro] = useState<string | null>(null);

  const [investidorTipo, setInvestidorTipo] = useState<Investimento['investidor_tipo']>('socio');
  const [socioId, setSocioId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('aporte');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hoje());
  const [retornoEsperado, setRetornoEsperado] = useState('');
  const [prazoEsperado, setPrazoEsperado] = useState('');
  const [roiMeta, setRoiMeta] = useState('');
  const [consideradoNoResultado, setConsideradoNoResultado] = useState(false);

  const carregar = async () => {
    const [inv, proj, soc] = await Promise.all([investimentosService.listar(), projetosService.listar(), sociosService.listarAtivos()]);
    setInvestimentos(inv);
    setProjetos(proj);
    setSocios(soc);

    const projetosComInvestimento = [...new Set(inv.map((i) => i.projeto_id).filter((x): x is string => !!x))];
    const roi: Record<string, { investido: number; retorno: number; roi: number; payback: number | null; meta: number | null }> = {};
    for (const pid of projetosComInvestimento) {
      const [receitas, custos, despesasTodas] = await Promise.all([
        receitasService.listarPorProjeto(pid),
        custosProjetoService.listarPorProjeto(pid),
        despesasService.listar(),
      ]);
      const despesas = despesasTodas.filter((d) => d.projeto_id === pid);
      const investimentosProjeto = inv.filter((i) => i.projeto_id === pid);
      const inicioInvestimento = investimentosProjeto.map((i) => i.data).sort()[0] ?? hoje();
      const receitasRealizadas = receitas.filter((r) => r.status === 'recebido' && Boolean(r.data_recebimento) && r.data_recebimento! >= inicioInvestimento);
      const custosRealizados = custos.filter((c) => c.status === 'pago' && Boolean(c.data_pagamento) && c.data_pagamento! >= inicioInvestimento);
      const despesasRealizadas = despesas.filter((d) => d.status === 'pago' && Boolean(d.data_pagamento) && d.data_pagamento! >= inicioInvestimento);
      const resultado = calcularResultadoProjeto(receitasRealizadas, custosRealizados, despesasRealizadas);
      const investido = investimentosProjeto.reduce((acc, i) => acc + i.valor, 0);
      const capitalNaoConsiderado = investimentosProjeto.filter((i) => !i.considerado_no_resultado).reduce((acc, i) => acc + i.valor, 0);
      const meses = mesesEntre(inicioInvestimento, hoje());
      const retornosMensais = meses.map((mes) => calcularResultadoProjeto(
        receitasRealizadas.filter((r) => r.data_recebimento?.slice(0, 7) === mes),
        custosRealizados.filter((c) => c.data_pagamento?.slice(0, 7) === mes),
        despesasRealizadas.filter((d) => d.data_pagamento?.slice(0, 7) === mes),
      ).resultadoLiquido);
      const metas = investimentosProjeto.map((i) => i.roi_meta_percentual).filter((v): v is number => typeof v === 'number');
      roi[pid] = { investido, retorno: resultado.resultadoLiquido, roi: calcularROI(investido, resultado.resultadoLiquido, capitalNaoConsiderado), payback: calcularPaybackMeses(investido, retornosMensais), meta: metas.length ? Math.max(...metas) : null };
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
        retornoEsperado: retornoEsperado ? Number(retornoEsperado) : null,
        prazoEsperadoMeses: prazoEsperado ? Number(prazoEsperado) : null,
        roiMetaPercentual: roiMeta ? Number(roiMeta) : null,
        consideradoNoResultado,
        createdBy: user.id,
      });
      setValor('');
      setDescricao('');
      setRetornoEsperado(''); setPrazoEsperado(''); setRoiMeta(''); setConsideradoNoResultado(false);
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
          <Field label="Retorno esperado (R$)"><Input type="number" min="0" step="0.01" value={retornoEsperado} onChange={(e)=>setRetornoEsperado(e.target.value)}/></Field>
          <Field label="Prazo esperado (meses)"><Input type="number" min="1" step="1" value={prazoEsperado} onChange={(e)=>setPrazoEsperado(e.target.value)}/></Field>
          <Field label="Meta de ROI (%)"><Input type="number" min="0" step="0.01" value={roiMeta} onChange={(e)=>setRoiMeta(e.target.value)}/></Field>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:col-span-3"><input type="checkbox" className="mt-1" checked={consideradoNoResultado} onChange={(e)=>setConsideradoNoResultado(e.target.checked)}/><span><strong className="block text-slate-800">Este capital já foi lançado como custo ou despesa</strong><span className="text-xs leading-5 text-slate-500">Marque apenas para impedir que o investimento seja descontado novamente no ROI.</span></span></label>
          {erro && <p className="text-sm text-red-600 sm:col-span-3">{erro}</p>}
          <Button type="submit" className="sm:col-span-3">Registrar investimento</Button>
        </form>
      </Card>

      {Object.keys(roiPorProjeto).length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">ROI por projeto</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {Object.entries(roiPorProjeto).map(([pid, r]) => (
              <div key={pid} className="grid gap-2 py-3 text-sm sm:grid-cols-[1.2fr_2fr_1fr] sm:items-center">
                <span className="font-medium text-slate-800">{nomeDoProjeto(pid)}</span>
                <span className="text-slate-500">investido {formatCurrency(r.investido)} · resultado operacional realizado {formatCurrency(r.retorno)} · payback {r.payback ? `${r.payback} meses` : 'ainda não atingido'}</span>
                <span className={`font-semibold sm:text-right ${r.roi >= (r.meta ?? 0) ? 'text-green-600' : 'text-amber-600'}`}>ROI {r.roi.toFixed(1)}%{r.meta !== null ? ` / meta ${r.meta.toFixed(1)}%` : ''}</span>
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

function mesesEntre(inicio: string, fim: string): string[] {
  const atual = new Date(`${inicio.slice(0, 7)}-01T00:00:00Z`); const limite = new Date(`${fim.slice(0, 7)}-01T00:00:00Z`); const meses: string[] = [];
  while (atual <= limite && meses.length < 120) { meses.push(`${atual.getUTCFullYear()}-${String(atual.getUTCMonth()+1).padStart(2,'0')}`); atual.setUTCMonth(atual.getUTCMonth()+1); }
  return meses;
}
