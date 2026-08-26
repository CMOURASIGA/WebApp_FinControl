import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { PermissionState } from '../components/ui/PermissionState';
import { useCapabilities } from '../hooks/useCapabilities';
import { relatoriosService, type DREPeriodo } from '../services/relatoriosService';
import { assinaturasService } from '../services/assinaturasService';
import { sociosService } from '../services/sociosService';
import { socioService, reservaEmpresaService } from '../services/socioService';
import { investimentosService } from '../services/investimentosService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { calcularARR, calcularMRR, calcularBreakEven, calcularResultadoProjeto, calcularROI } from '../lib/motorCalculo';
import { formatCurrency, mesAtual, primeiroDiaDoMes, ultimoDiaDoMes, nomeDoMes, hoje } from '../utils/formatters';
import type { Assinatura, SocioDiretorio, SocioLancamento } from '../types/database';

export const DashboardPage: React.FC = () => {
  const { can } = useCapabilities();
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState<DREPeriodo | null>(null);
  const [dreRealizada, setDreRealizada] = useState<DREPeriodo | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [socios, setSocios] = useState<SocioDiretorio[]>([]);
  const [lancamentos, setLancamentos] = useState<SocioLancamento[]>([]);
  const [reservaEmpresa, setReservaEmpresa] = useState(0);
  const [resumoROI, setResumoROI] = useState({ capital: 0, resultado: 0, roi: 0, projetos: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    const inicio = primeiroDiaDoMes(mes);
    const fim = ultimoDiaDoMes(mes);

    Promise.all([
      relatoriosService.montarDRE(inicio, fim),
      relatoriosService.montarDRE(inicio, fim, true),
      assinaturasService.listar(),
      sociosService.listarDiretorioAtivos(),
      socioService.listarTodos(),
      reservaEmpresaService.listar(),
      carregarResumoROI(),
    ])
      .then(([dreData, dreRealizadaData, assData, sociosData, lancData, reservaData, roiData]) => {
        if (!ativo) return;
        setDre(dreData);
        setDreRealizada(dreRealizadaData);
        setAssinaturas(assData);
        setSocios(sociosData);
        setLancamentos(lancData);
        setReservaEmpresa(reservaEmpresaService.calcularSaldo(reservaData));
        setResumoROI(roiData);
      })
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));

    return () => {
      ativo = false;
    };
  }, [mes]);

  const mrr = useMemo(() => calcularMRR(assinaturas, hoje()), [assinaturas]);
  const arr = useMemo(() => calcularARR(mrr), [mrr]);
  const clientesAtivos = useMemo(() => new Set(assinaturas.filter((a) => a.status === 'ativa').map((a) => a.cliente_id)).size, [assinaturas]);
  const ticketMedio = clientesAtivos > 0 ? mrr / clientesAtivos : 0;

  // "Todos os lançamentos" (dre) inclui previsto/provisionado; usado para
  // a leitura ampla da competência e para a comparação previsto x realizado.
  const resultadoLiquidoEmpresa = dre
    ? dre.consolidadoProjetos.resultadoLiquido - dre.despesasCorporativas
    : 0;

  // Leitura executiva (hero): só o que já entrou/saiu de fato — mesma
  // fórmula acima, aplicada ao DRE somente-realizado já calculado pelo
  // motor (relatoriosService.montarDRE(..., true)). Não é um cálculo
  // novo, é o mesmo resultado líquido/margem lidos da base realizada.
  const resultadoLiquidoRealizado = dreRealizada
    ? dreRealizada.consolidadoProjetos.resultadoLiquido - dreRealizada.despesasCorporativas
    : 0;
  const margemRealizada = dreRealizada && dreRealizada.consolidadoProjetos.receitaBruta > 0
    ? (resultadoLiquidoRealizado / dreRealizada.consolidadoProjetos.receitaBruta) * 100
    : 0;

  const breakEven = dre && dreRealizada ? calcularBreakEven({
    despesasFixasMensais: dre.despesasCorporativasFixas,
    receitaBruta: dreRealizada.consolidadoProjetos.receitaBruta,
    tributos: dreRealizada.consolidadoProjetos.tributoProvisionado,
    custosVariaveis: dreRealizada.despesasVariaveisTotais,
  }) : { faturamentoMinimo: 0, margemContribuicaoPercentual: 0 };
  const margemSeguranca = Number.isFinite(breakEven.faturamentoMinimo) && dreRealizada
    ? dreRealizada.consolidadoProjetos.receitaBruta - breakEven.faturamentoMinimo : 0;

  // Riscos do período: leitura textual de números já calculados acima —
  // nenhuma regra financeira nova, só destaque do que já está na tela.
  const riscos = useMemo(() => {
    if (!dre || !dreRealizada) return [];
    const lista: string[] = [];
    if (Number.isFinite(breakEven.faturamentoMinimo) && margemSeguranca < 0) {
      lista.push(`Faturamento realizado está abaixo do ponto de equilíbrio em ${formatCurrency(Math.abs(margemSeguranca))}.`);
    }
    const receitaPendente = dre.consolidadoProjetos.receitaBruta - dreRealizada.consolidadoProjetos.receitaBruta;
    if (receitaPendente > 0) {
      lista.push(`${formatCurrency(receitaPendente)} em receita lançada ainda não foi recebida nesta competência.`);
    }
    if (resumoROI.capital > 0 && resumoROI.roi < 0) {
      lista.push(`ROI consolidado dos projetos com investimento está negativo (${resumoROI.roi.toFixed(1)}%).`);
    }
    if (resultadoLiquidoRealizado < 0) {
      lista.push(`Resultado líquido realizado do período é negativo (${formatCurrency(resultadoLiquidoRealizado)}).`);
    }
    return lista;
  }, [dre, dreRealizada, breakEven.faturamentoMinimo, margemSeguranca, resumoROI, resultadoLiquidoRealizado]);

  if (!can('view_dashboard')) return <PermissionState />;
  if (carregando) return <LoadingState label="Carregando painel..." />;
  if (erro) return <ErrorState message={`Erro ao carregar dashboard: ${erro}`} />;
  if (!dre || !dreRealizada) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Visão Geral"
        description={<span className="capitalize">{nomeDoMes(mes)}</span>}
        action={
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        }
      />

      {/* Leitura executiva: responde de cara faturamento / entrou / sobrou / margem. */}
      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <HeroStat label="Faturamos" value={formatCurrency(dreRealizada.consolidadoProjetos.receitaBruta)} hint="Receita realizada (recebida)" />
          <HeroStat label="Efetivamente entrou" value={formatCurrency(dreRealizada.consolidadoProjetos.receitaBruta - dreRealizada.consolidadoProjetos.tributoProvisionado)} hint="Receita líquida, após impostos" />
          <HeroStat
            label="Sobrou"
            value={formatCurrency(resultadoLiquidoRealizado)}
            hint="Resultado líquido realizado"
            tone={resultadoLiquidoRealizado >= 0 ? 'positive' : 'negative'}
          />
          <HeroStat
            label="Margem"
            value={`${margemRealizada.toFixed(1)}%`}
            hint="Sobre a receita realizada"
            tone={margemRealizada >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </section>

      {/* Riscos: leitura rápida do que merece atenção antes de entrar no detalhe. */}
      <section>
        <Card className={`p-5 ${riscos.length > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
          <div className="flex items-start gap-3">
            {riscos.length > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />}
            <div>
              <p className="text-sm font-semibold text-slate-800">{riscos.length > 0 ? 'Riscos do período' : 'Nenhum risco relevante identificado no período'}</p>
              {riscos.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {riscos.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Previsto versus realizado</h2>
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Indicador</span><span className="text-right">Previsto</span><span className="text-right">Realizado</span><span className="text-right">Diferença</span></div>
          <ComparisonRow label="Receitas" previsto={dre.consolidadoProjetos.receitaBruta} realizado={dreRealizada.consolidadoProjetos.receitaBruta}/>
          <ComparisonRow label="Custos e despesas" previsto={dre.consolidadoProjetos.custosDiretos+dre.consolidadoProjetos.despesasAtribuidas+dre.despesasCorporativas} realizado={dreRealizada.consolidadoProjetos.custosDiretos+dreRealizada.consolidadoProjetos.despesasAtribuidas+dreRealizada.despesasCorporativas} menorMelhor/>
          <ComparisonRow label="Resultado líquido" previsto={resultadoLiquidoEmpresa} realizado={resultadoLiquidoRealizado}/>
        </Card>
        <p className="mt-2 text-xs leading-5 text-slate-500">Previsto considera lançamentos provisionados. Realizado considera somente receitas recebidas e saídas pagas.</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Reserva & retenção</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Retido pela empresa (líquido)" value={formatCurrency(dre.valorEmpresaLiquido)} />
          <StatCard label="Reserva Consult Services" value={formatCurrency(reservaEmpresa)} />
          <StatCard label="Impostos provisionados" value={formatCurrency(dre.consolidadoProjetos.tributoProvisionado)} tone="negative" />
          <StatCard label="Custos + despesas (total lançado)" value={formatCurrency(dre.consolidadoProjetos.custosDiretos + dre.consolidadoProjetos.despesasAtribuidas + dre.despesasCorporativas)} tone="negative" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Custos diretos de projetos" value={formatCurrency(dre.consolidadoProjetos.custosDiretos)} tone="negative" />
          <StatCard label="Despesas atribuídas a projetos" value={formatCurrency(dre.consolidadoProjetos.despesasAtribuidas)} tone="negative" />
          <StatCard label="Despesas corporativas" value={formatCurrency(dre.despesasCorporativas)} tone="negative" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Receita recorrente</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="MRR" value={formatCurrency(mrr)} />
          <StatCard label="ARR" value={formatCurrency(arr)} />
          <StatCard label="Clientes ativos" value={String(clientesAtivos)} />
          <StatCard label="Ticket médio" value={formatCurrency(ticketMedio)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Retorno & ponto de equilíbrio</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Capital investido ativo" value={formatCurrency(resumoROI.capital)} />
          <StatCard label="ROI consolidado" value={resumoROI.capital > 0 ? `${resumoROI.roi.toFixed(1)}%` : 'Sem investimento ativo'} tone={resumoROI.capital > 0 ? (resumoROI.roi >= 0 ? 'positive' : 'negative') : undefined} />
          <StatCard label="Faturamento mínimo (breakeven)" value={Number.isFinite(breakEven.faturamentoMinimo)?formatCurrency(breakEven.faturamentoMinimo):'Não atingível'} />
          <StatCard label="Margem de segurança" value={formatCurrency(margemSeguranca)} tone={margemSeguranca >= 0 ? 'positive' : 'negative'} />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Investimentos cancelados não participam do ROI. Margem de contribuição atual: {breakEven.margemContribuicaoPercentual.toFixed(1)}%.</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Sócios</h2>
        {socios.length === 0 ? (
          <EmptyState title="Nenhum sócio cadastrado ainda" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {socios.map((socio) => {
              const resultadoAtribuivel = dre.consolidadoProjetos.porSocio[socio.id] ?? 0;
              const lancamentosSocio = lancamentos.filter((l) => l.socio_id === socio.id);
              const recebidoNoMes = lancamentosSocio
                .filter((l) => l.tipo === 'retirada' && l.data >= primeiroDiaDoMes(mes) && l.data <= ultimoDiaDoMes(mes))
                .reduce((acc, l) => acc + l.valor, 0);
              const saldoConta = socioService.calcularSaldo(lancamentosSocio);

              return (
                <Card key={socio.id} className="p-5">
                  <p className="font-semibold text-slate-900">{socio.nome}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-slate-500">Resultado atribuível no mês</dt>
                    <dd className="text-right font-medium">{formatCurrency(resultadoAtribuivel)}</dd>
                    <dt className="text-slate-500">Disponível (saldo conta corrente)</dt>
                    <dd className="text-right font-medium">{formatCurrency(saldoConta)}</dd>
                    <dt className="text-slate-500">Retirado no mês</dt>
                    <dd className="text-right font-medium">{formatCurrency(recebidoNoMes)}</dd>
                  </dl>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

async function carregarResumoROI(): Promise<{ capital: number; resultado: number; roi: number; projetos: number }> {
  const investimentos = (await investimentosService.listar()).filter((item) => item.status !== 'cancelado' && Boolean(item.projeto_id));
  const projetoIds = [...new Set(investimentos.map((item) => item.projeto_id).filter((id): id is string => Boolean(id)))];
  if (projetoIds.length === 0) return { capital: 0, resultado: 0, roi: 0, projetos: 0 };

  let capital = 0;
  let capitalNaoConsiderado = 0;
  let resultado = 0;
  const despesasTodas = await despesasService.listar();

  for (const projetoId of projetoIds) {
    const investimentosProjeto = investimentos.filter((item) => item.projeto_id === projetoId);
    const inicio = investimentosProjeto.map((item) => item.data).sort()[0];
    const [receitas, custos] = await Promise.all([
      receitasService.listarPorProjeto(projetoId),
      custosProjetoService.listarPorProjeto(projetoId),
    ]);
    const despesas = despesasTodas.filter((item) => item.projeto_id === projetoId);
    const realizado = calcularResultadoProjeto(
      receitas.filter((item) => item.status === 'recebido' && Boolean(item.data_recebimento) && item.data_recebimento! >= inicio),
      custos.filter((item) => item.status === 'pago' && Boolean(item.data_pagamento) && item.data_pagamento! >= inicio),
      despesas.filter((item) => item.status === 'pago' && Boolean(item.data_pagamento) && item.data_pagamento! >= inicio),
    );
    capital += investimentosProjeto.reduce((total, item) => total + item.valor, 0);
    capitalNaoConsiderado += investimentosProjeto.filter((item) => !item.considerado_no_resultado).reduce((total, item) => total + item.valor, 0);
    resultado += realizado.resultadoLiquido;
  }

  return { capital, resultado, roi: calcularROI(capital, resultado, capitalNaoConsiderado), projetos: projetoIds.length };
}

const ComparisonRow: React.FC<{label:string;previsto:number;realizado:number;menorMelhor?:boolean}> = ({label,previsto,realizado,menorMelhor=false}) => { const diferenca=realizado-previsto; const favoravel=menorMelhor?diferenca<=0:diferenca>=0; return <div className="grid grid-cols-4 border-t border-slate-100 px-4 py-3 text-sm"><span className="font-medium text-slate-700">{label}</span><span className="text-right text-slate-600">{formatCurrency(previsto)}</span><span className="text-right font-medium text-slate-800">{formatCurrency(realizado)}</span><span className={`text-right font-medium ${favoravel?'text-emerald-600':'text-red-600'}`}>{formatCurrency(diferenca)}</span></div>; };

const HeroStat: React.FC<{ label: string; value: string; hint?: string; tone?: 'positive' | 'negative' }> = ({ label, value, hint, tone }) => (
  <Card className="p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </Card>
);
