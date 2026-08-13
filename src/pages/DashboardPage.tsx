import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { relatoriosService, type DREPeriodo } from '../services/relatoriosService';
import { assinaturasService } from '../services/assinaturasService';
import { sociosService } from '../services/sociosService';
import { socioService, reservaEmpresaService } from '../services/socioService';
import { calcularARR, calcularMRR, calcularBreakEven } from '../lib/motorCalculo';
import { formatCurrency, mesAtual, primeiroDiaDoMes, ultimoDiaDoMes, nomeDoMes, hoje } from '../utils/formatters';
import type { Assinatura, Socio, SocioLancamento } from '../types/database';

export const DashboardPage: React.FC = () => {
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState<DREPeriodo | null>(null);
  const [dreRealizada, setDreRealizada] = useState<DREPeriodo | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [lancamentos, setLancamentos] = useState<SocioLancamento[]>([]);
  const [reservaEmpresa, setReservaEmpresa] = useState(0);
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
      sociosService.listarAtivos(),
      socioService.listarTodos(),
      reservaEmpresaService.listar(),
    ])
      .then(([dreData, dreRealizadaData, assData, sociosData, lancData, reservaData]) => {
        if (!ativo) return;
        setDre(dreData);
        setDreRealizada(dreRealizadaData);
        setAssinaturas(assData);
        setSocios(sociosData);
        setLancamentos(lancData);
        setReservaEmpresa(reservaEmpresaService.calcularSaldo(reservaData));
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

  const resultadoLiquidoEmpresa = dre
    ? dre.consolidadoProjetos.resultadoLiquido - dre.despesasCorporativas
    : 0;
  const margem = dre && dre.consolidadoProjetos.receitaBruta > 0
    ? (resultadoLiquidoEmpresa / dre.consolidadoProjetos.receitaBruta) * 100
    : 0;
  const breakEven = dre && dreRealizada ? calcularBreakEven({
    despesasFixasMensais: dre.despesasCorporativasFixas,
    receitaBruta: dreRealizada.consolidadoProjetos.receitaBruta,
    tributos: dreRealizada.consolidadoProjetos.tributoProvisionado,
    custosVariaveis: dreRealizada.despesasVariaveisTotais,
  }) : { faturamentoMinimo: 0, margemContribuicaoPercentual: 0 };
  const margemSeguranca = Number.isFinite(breakEven.faturamentoMinimo) && dreRealizada
    ? dreRealizada.consolidadoProjetos.receitaBruta - breakEven.faturamentoMinimo : 0;

  if (carregando) return <p className="text-sm text-slate-500">Carregando painel...</p>;
  if (erro) return <p className="text-sm text-red-600">Erro ao carregar dashboard: {erro}</p>;
  if (!dre || !dreRealizada) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
          <p className="text-sm text-slate-500 capitalize">{nomeDoMes(mes)}</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Consult Services</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Faturamento" value={formatCurrency(dre.consolidadoProjetos.receitaBruta)} />
          <StatCard
            label="Receita líquida"
            value={formatCurrency(dre.consolidadoProjetos.receitaBruta - dre.consolidadoProjetos.tributoProvisionado)}
          />
          <StatCard label="Impostos provisionados" value={formatCurrency(dre.consolidadoProjetos.tributoProvisionado)} tone="negative" />
          <StatCard label="Custos + despesas" value={formatCurrency(dre.consolidadoProjetos.custosDiretos + dre.consolidadoProjetos.despesasAtribuidas + dre.despesasCorporativas)} tone="negative" />
          <StatCard label="Resultado líquido" value={formatCurrency(resultadoLiquidoEmpresa)} tone="positive" />
          <StatCard label="Margem líquida" value={`${margem.toFixed(1)}%`} />
          <StatCard label="Retido pela empresa (líquido)" value={formatCurrency(dre.valorEmpresaLiquido)} />
          <StatCard label="Reserva Consult Services" value={formatCurrency(reservaEmpresa)} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Custos diretos de projetos" value={formatCurrency(dre.consolidadoProjetos.custosDiretos)} tone="negative" />
          <StatCard label="Despesas atribuídas a projetos" value={formatCurrency(dre.consolidadoProjetos.despesasAtribuidas)} tone="negative" />
          <StatCard label="Despesas corporativas" value={formatCurrency(dre.despesasCorporativas)} tone="negative" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Previsto versus realizado</h2>
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Indicador</span><span className="text-right">Previsto</span><span className="text-right">Realizado</span><span className="text-right">Diferença</span></div>
          <ComparisonRow label="Receitas" previsto={dre.consolidadoProjetos.receitaBruta} realizado={dreRealizada.consolidadoProjetos.receitaBruta}/>
          <ComparisonRow label="Custos e despesas" previsto={dre.consolidadoProjetos.custosDiretos+dre.consolidadoProjetos.despesasAtribuidas+dre.despesasCorporativas} realizado={dreRealizada.consolidadoProjetos.custosDiretos+dreRealizada.consolidadoProjetos.despesasAtribuidas+dreRealizada.despesasCorporativas} menorMelhor/>
          <ComparisonRow label="Resultado líquido" previsto={resultadoLiquidoEmpresa} realizado={dreRealizada.consolidadoProjetos.resultadoLiquido-dreRealizada.despesasCorporativas}/>
        </Card>
        <p className="mt-2 text-xs leading-5 text-slate-500">Previsto considera lançamentos provisionados. Realizado considera somente receitas recebidas e saídas pagas.</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ponto de equilíbrio</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Faturamento mínimo" value={Number.isFinite(breakEven.faturamentoMinimo)?formatCurrency(breakEven.faturamentoMinimo):'Não atingível'} />
          <StatCard label="Margem de contribuição" value={`${breakEven.margemContribuicaoPercentual.toFixed(1)}%`} />
          <StatCard label="Faturamento realizado" value={formatCurrency(dreRealizada.consolidadoProjetos.receitaBruta)} />
          <StatCard label="Margem de segurança" value={formatCurrency(margemSeguranca)} tone={margemSeguranca >= 0 ? 'positive' : 'negative'} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Receita Recorrente</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="MRR" value={formatCurrency(mrr)} />
          <StatCard label="ARR" value={formatCurrency(arr)} />
          <StatCard label="Clientes ativos" value={String(clientesAtivos)} />
          <StatCard label="Ticket médio" value={formatCurrency(ticketMedio)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Sócios</h2>
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
          {socios.length === 0 && <p className="text-sm text-slate-500">Nenhum sócio cadastrado ainda.</p>}
        </div>
      </section>
    </div>
  );
};

const ComparisonRow: React.FC<{label:string;previsto:number;realizado:number;menorMelhor?:boolean}> = ({label,previsto,realizado,menorMelhor=false}) => { const diferenca=realizado-previsto; const favoravel=menorMelhor?diferenca<=0:diferenca>=0; return <div className="grid grid-cols-4 border-t border-slate-100 px-4 py-3 text-sm"><span className="font-medium text-slate-700">{label}</span><span className="text-right text-slate-600">{formatCurrency(previsto)}</span><span className="text-right font-medium text-slate-800">{formatCurrency(realizado)}</span><span className={`text-right font-medium ${favoravel?'text-emerald-600':'text-red-600'}`}>{formatCurrency(diferenca)}</span></div>; };
