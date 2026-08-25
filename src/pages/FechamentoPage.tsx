import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Input';
import { PermissionState } from '../components/ui/PermissionState';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { relatoriosService, type DREPeriodo } from '../services/relatoriosService';
import { fechamentoService } from '../services/fechamentoService';
import { sociosService } from '../services/sociosService';
import { formatCurrency, mesAtual, nomeDoMes, primeiroDiaDoMes, ultimoDiaDoMes } from '../utils/formatters';
import type { FechamentoMensal, Socio } from '../types/database';

export const FechamentoPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = useCapabilities();
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState<DREPeriodo | null>(null);
  const [fechamentoAtual, setFechamentoAtual] = useState<FechamentoMensal | null>(null);
  const [historico, setHistorico] = useState<FechamentoMensal[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
        sociosService.listarAtivos(),
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

  const fechar = async () => {
    if (!user) return;
    setErro(null);
    setMsg(null);
    try {
      await fechamentoService.fecharMes(mes, user.id);
      setMsg('Mês fechado. O resultado de cada sócio foi creditado na conta corrente.');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const nomeDoSocio = (id: string) => socios.find((s) => s.id === id)?.nome ?? id;

  if (!can('view_closing')) return <PermissionState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fechamento Mensal & DRE</h1>
          <p className="text-sm text-slate-500 capitalize">{nomeDoMes(mes)}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          {fechamentoAtual?.status === 'fechado' ? (
            <Badge tone="success">Fechado em {new Date(fechamentoAtual.fechado_em ?? '').toLocaleDateString('pt-BR')}</Badge>
          ) : can('close_period') ? (
            <Button onClick={fechar} disabled={carregando}>
              Fechar mês
            </Button>
          ) : (
            <Badge tone="neutral">Aberto — só admin/financeiro pode fechar</Badge>
          )}
        </div>
      </div>

      {msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}
      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      {dre && (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">DRE Gerencial</h2>
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
      )}

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900">Histórico de fechamentos</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {historico.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 text-sm">
              <span className="capitalize">{nomeDoMes(f.competencia.slice(0, 7))}</span>
              <Badge tone={f.status === 'fechado' ? 'success' : 'neutral'}>{f.status}</Badge>
            </div>
          ))}
          {historico.length === 0 && <p className="py-2 text-sm text-slate-500">Nenhum fechamento ainda.</p>}
        </div>
      </Card>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; negative?: boolean; strong?: boolean }> = ({ label, value, negative, strong }) => (
  <div className="flex justify-between">
    <dt className="text-slate-500">{label}</dt>
    <dd className={`font-medium ${negative ? 'text-red-600' : ''} ${strong ? 'text-base font-bold text-slate-900' : ''}`}>{value}</dd>
  </div>
);
