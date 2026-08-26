import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PermissionState } from '../components/ui/PermissionState';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { relatoriosService, type DREPeriodo } from '../services/relatoriosService';
import { fechamentoService } from '../services/fechamentoService';
import { sociosService } from '../services/sociosService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { formatCurrency, mesAtual, nomeDoMes, primeiroDiaDoMes, ultimoDiaDoMes } from '../utils/formatters';
import type { FechamentoMensal, SocioDiretorio } from '../types/database';

interface Inconsistencia {
  nivel: 'bloqueio' | 'atencao';
  mensagem: string;
}

interface ResumoFechamento {
  competencia: string;
  dreRealizado: DREPeriodo;
  inconsistencias: Inconsistencia[];
}

export const FechamentoPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = useCapabilities();
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState<DREPeriodo | null>(null);
  const [fechamentoAtual, setFechamentoAtual] = useState<FechamentoMensal | null>(null);
  const [historico, setHistorico] = useState<FechamentoMensal[]>([]);
  const [socios, setSocios] = useState<SocioDiretorio[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Fluxo de fechamento: preparar -> validar/resumo (modal) -> confirmar.
  const [preparando, setPreparando] = useState(false);
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const inicio = primeiroDiaDoMes(mes);
      const fim = ultimoDiaDoMes(mes);
      const [dreData, fechData, hist, soc] = await Promise.all([
        relatoriosService.montarDRE(inicio, fim),
        fechamentoService.obterPorCompetencia(mes),
        fechamentoService.listar(),
        sociosService.listarDiretorioTodos(),
      ]);
      setDre(dreData);
      setFechamentoAtual(fechData);
      setHistorico(hist);
      setSocios(soc);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const nomeDoSocio = (id: string) => socios.find((s) => s.id === id)?.nome ?? id;

  /**
   * "Preparar fechamento": monta o resumo com os MESMOS números que
   * fechamentoService.fecharMes vai gravar (DRE somente realizado — ver
   * relatoriosService.montarDRE(..., true), a mesma chamada usada
   * internamente pelo fechar_mes) e sinaliza inconsistências antes de
   * pedir confirmação. Não recalcula nada: só lê o que os services já
   * calculam e os agrega em avisos/bloqueios.
   */
  const prepararFechamento = async () => {
    setErro(null);
    setPreparando(true);
    try {
      const inicio = primeiroDiaDoMes(mes);
      const fim = ultimoDiaDoMes(mes);

      const [dreRealizado, existente, sociosAtuais, receitasPeriodo, custosPeriodo, despesasPeriodo] = await Promise.all([
        relatoriosService.montarDRE(inicio, fim, true),
        fechamentoService.obterPorCompetencia(mes),
        sociosService.listarDiretorioTodos(),
        receitasService.listarPorPeriodo(inicio, fim),
        custosProjetoService.listarPorPeriodo(inicio, fim),
        despesasService.listarPorPeriodo(inicio, fim),
      ]);

      const inconsistencias: Inconsistencia[] = [];

      if (existente?.status === 'fechado') {
        inconsistencias.push({
          nivel: 'bloqueio',
          mensagem: `Esta competência já foi fechada em ${new Date(existente.fechado_em ?? '').toLocaleDateString('pt-BR')}.`,
        });
      }

      const sociosAtivosPorId = new Map(sociosAtuais.filter((s) => s.ativo).map((s) => [s.id, s]));
      for (const socioId of Object.keys(dreRealizado.consolidadoProjetos.porSocio)) {
        if (!sociosAtivosPorId.has(socioId)) {
          const nome = sociosAtuais.find((s) => s.id === socioId)?.nome ?? socioId;
          inconsistencias.push({
            nivel: 'bloqueio',
            mensagem: `${nome} está inativo ou não existe mais e não pode receber crédito de resultado. Reative o cadastro em Sócios ou ajuste a regra de distribuição antes de fechar.`,
          });
        }
      }

      const receitasPendentes = receitasPeriodo.filter((r) => r.status !== 'recebido' && r.status !== 'cancelado');
      if (receitasPendentes.length > 0) {
        const total = receitasPendentes.reduce((acc, r) => acc + r.valor_bruto, 0);
        inconsistencias.push({
          nivel: 'atencao',
          mensagem: `${receitasPendentes.length} receita(s) somando ${formatCurrency(total)} ainda não foram recebidas nesta competência — não entram no valor fechado.`,
        });
      }

      const custosPendentes = custosPeriodo.filter((c) => c.status === 'provisionado');
      const despesasPendentes = despesasPeriodo.filter((d) => d.status === 'provisionado');
      const pendentesPagar = custosPendentes.length + despesasPendentes.length;
      if (pendentesPagar > 0) {
        const total = custosPendentes.reduce((acc, c) => acc + c.valor, 0) + despesasPendentes.reduce((acc, d) => acc + d.valor, 0);
        inconsistencias.push({
          nivel: 'atencao',
          mensagem: `${pendentesPagar} custo(s)/despesa(s) somando ${formatCurrency(total)} ainda estão provisionados (não pagos) nesta competência — não entram no valor fechado.`,
        });
      }

      if (dreRealizado.consolidadoProjetos.receitaBruta === 0) {
        inconsistencias.push({ nivel: 'atencao', mensagem: 'Nenhuma receita recebida nesta competência.' });
      }

      setResumo({ competencia: mes, dreRealizado, inconsistencias });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPreparando(false);
    }
  };

  const confirmarFechamento = async () => {
    if (!user || !resumo) return;
    setConfirmando(true);
    setErro(null);
    setMsg(null);
    try {
      await fechamentoService.fecharMes(mes, user.id);
      setResumo(null);
      setMsg('Mês fechado. O resultado de cada sócio foi creditado na conta corrente.');
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  };

  const bloqueios = resumo?.inconsistencias.filter((i) => i.nivel === 'bloqueio') ?? [];

  const colunasHistorico: DataTableColumn<FechamentoMensal>[] = [
    { header: 'Competência', className: 'font-medium text-slate-800', render: (f) => <span className="capitalize">{nomeDoMes(f.competencia.slice(0, 7))}</span> },
    { header: 'Status', render: (f) => <Badge tone={f.status === 'fechado' ? 'success' : 'neutral'}>{f.status}</Badge> },
    { header: 'Fechado em', render: (f) => (f.fechado_em ? new Date(f.fechado_em).toLocaleDateString('pt-BR') : '—') },
  ];

  if (!can('view_closing')) return <PermissionState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fechamento Mensal & DRE"
        description={<span className="capitalize">{nomeDoMes(mes)}</span>}
        action={
          <div className="flex items-center gap-3">
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
            {fechamentoAtual?.status === 'fechado' ? (
              <Badge tone="success">Fechado em {new Date(fechamentoAtual.fechado_em ?? '').toLocaleDateString('pt-BR')}</Badge>
            ) : can('close_period') ? (
              <Button onClick={prepararFechamento} disabled={carregando || preparando}>
                {preparando ? 'Validando...' : 'Preparar fechamento'}
              </Button>
            ) : (
              <Badge tone="neutral">Aberto — só admin/financeiro pode fechar</Badge>
            )}
          </div>
        }
      />

      {msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}
      {erro && <ErrorState message={erro} />}

      {carregando && !dre ? (
        <LoadingState label="Carregando dados da competência..." />
      ) : dre ? (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">DRE Gerencial (todos os lançamentos da competência)</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Receita bruta" value={formatCurrency(dre.consolidadoProjetos.receitaBruta)} />
            <Row label="(-) Tributos provisionados" value={`-${formatCurrency(dre.consolidadoProjetos.tributoProvisionado)}`} negative />
            <Row label="(-) Custos diretos" value={`-${formatCurrency(dre.consolidadoProjetos.custosDiretos)}`} negative />
            <Row label="(-) Despesas atribuídas a projetos" value={`-${formatCurrency(dre.consolidadoProjetos.despesasAtribuidas)}`} negative />
            <Row label="= Resultado líquido (projetos)" value={formatCurrency(dre.consolidadoProjetos.resultadoLiquido)} strong />
            <Row label="  Empresa (antes de despesas corporativas)" value={formatCurrency(dre.consolidadoProjetos.valorEmpresa)} />
            {Object.entries(dre.consolidadoProjetos.porSocio).map(([id, valor]) => (
              <Row key={id} label={`  ${nomeDoSocio(id)}`} value={formatCurrency(valor)} />
            ))}
            <Row label="(-) Despesas corporativas" value={`-${formatCurrency(dre.despesasCorporativas)}`} negative />
            <Row label="= Retido líquido pela empresa" value={formatCurrency(dre.valorEmpresaLiquido)} strong />
          </dl>
          <p className="mt-3 text-xs text-slate-400">Inclui receitas/custos/despesas ainda não recebidos ou pagos. O fechamento usa somente o que foi efetivamente realizado — confira em "Preparar fechamento".</p>

          {dre.porProjeto.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium uppercase text-slate-500">Por projeto</p>
              <div className="mt-2 divide-y divide-slate-100">
                {dre.porProjeto.map(({ projeto, resultado }) => (
                  <div key={projeto.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-slate-800">{projeto.nome}</span>
                    <span>{formatCurrency(resultado.resultadoLiquido)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-3 font-semibold text-slate-900">Histórico de fechamentos</h2>
        <DataTable
          columns={colunasHistorico}
          rows={historico}
          rowKey={(f) => f.id}
          emptyTitle="Nenhum fechamento ainda"
          emptyDescription="Quando um mês for fechado, ele aparece aqui."
        />
      </Card>

      <Modal
        aberto={Boolean(resumo)}
        titulo="Confirmar fechamento"
        descricao={resumo ? `Competência: ${nomeDoMes(resumo.competencia)}` : undefined}
        onClose={() => setResumo(null)}
        largura="lg"
      >
        {resumo && (
          <div className="space-y-5">
            {resumo.inconsistencias.length > 0 && (
              <div className="space-y-2">
                {resumo.inconsistencias.map((inc, i) => (
                  <div
                    key={i}
                    className={`rounded-md px-4 py-2 text-sm ${inc.nivel === 'bloqueio' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    <strong className="mr-1">{inc.nivel === 'bloqueio' ? 'Impede o fechamento:' : 'Atenção:'}</strong>
                    {inc.mensagem}
                  </div>
                ))}
              </div>
            )}

            <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
              <Row label="Receita bruta (realizada)" value={formatCurrency(resumo.dreRealizado.consolidadoProjetos.receitaBruta)} />
              <Row label="(-) Impostos" value={`-${formatCurrency(resumo.dreRealizado.consolidadoProjetos.tributoProvisionado)}`} negative />
              <Row label="(-) Custos diretos" value={`-${formatCurrency(resumo.dreRealizado.consolidadoProjetos.custosDiretos)}`} negative />
              <Row label="(-) Despesas atribuídas" value={`-${formatCurrency(resumo.dreRealizado.consolidadoProjetos.despesasAtribuidas)}`} negative />
              <Row label="(-) Despesas corporativas" value={`-${formatCurrency(resumo.dreRealizado.despesasCorporativas)}`} negative />
              <Row label="= Resultado líquido" value={formatCurrency(resumo.dreRealizado.consolidadoProjetos.resultadoLiquido - resumo.dreRealizado.despesasCorporativas)} strong />
              <Row label="Valor retido pela empresa" value={formatCurrency(resumo.dreRealizado.valorEmpresaLiquido)} />
              {Object.entries(resumo.dreRealizado.consolidadoProjetos.porSocio).map(([id, valor]) => (
                <Row key={id} label={`Distribuição — ${nomeDoSocio(id)}`} value={formatCurrency(valor)} />
              ))}
              {Object.keys(resumo.dreRealizado.consolidadoProjetos.porSocio).length === 0 && (
                <Row label="Distribuição por sócio" value="Nenhum crédito a distribuir" />
              )}
            </dl>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setResumo(null)}>Voltar</Button>
              <Button type="button" onClick={confirmarFechamento} disabled={bloqueios.length > 0 || confirmando}>
                {confirmando ? 'Fechando...' : 'Confirmar fechamento'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; negative?: boolean; strong?: boolean }> = ({ label, value, negative, strong }) => (
  <div className="flex justify-between">
    <dt className="text-slate-500">{label}</dt>
    <dd className={`font-medium ${negative ? 'text-red-600' : ''} ${strong ? 'text-base font-bold text-slate-900' : ''}`}>{value}</dd>
  </div>
);
