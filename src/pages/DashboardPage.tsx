import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { relatoriosService, type DREPeriodo } from '../services/relatoriosService';
import { assinaturasService } from '../services/assinaturasService';
import { sociosService } from '../services/sociosService';
import { socioService, reservaEmpresaService } from '../services/socioService';
import { calcularARR, calcularMRR } from '../lib/motorCalculo';
import { formatCurrency, mesAtual, primeiroDiaDoMes, ultimoDiaDoMes, nomeDoMes, hoje } from '../utils/formatters';
import type { Assinatura, Socio, SocioLancamento } from '../types/database';

export const DashboardPage: React.FC = () => {
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState<DREPeriodo | null>(null);
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
      assinaturasService.listar(),
      sociosService.listarAtivos(),
      socioService.listarTodos(),
      reservaEmpresaService.listar(),
    ])
      .then(([dreData, assData, sociosData, lancData, reservaData]) => {
        if (!ativo) return;
        setDre(dreData);
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

  const margem = dre && dre.consolidadoProjetos.receitaBruta > 0
    ? (dre.consolidadoProjetos.resultadoLiquido / dre.consolidadoProjetos.receitaBruta) * 100
    : 0;

  if (carregando) return <p className="text-sm text-slate-500">Carregando painel...</p>;
  if (erro) return <p className="text-sm text-red-600">Erro ao carregar dashboard: {erro}</p>;
  if (!dre) return null;

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
          <StatCard label="Resultado líquido" value={formatCurrency(dre.consolidadoProjetos.resultadoLiquido - dre.despesasCorporativas)} tone="positive" />
          <StatCard label="Margem líquida" value={`${margem.toFixed(1)}%`} />
          <StatCard label="Retido pela empresa (líquido)" value={formatCurrency(dre.valorEmpresaLiquido)} />
          <StatCard label="Reserva Consult Services" value={formatCurrency(reservaEmpresa)} />
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
