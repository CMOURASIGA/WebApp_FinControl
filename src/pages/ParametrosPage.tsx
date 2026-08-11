import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { parametrosService } from '../services/parametrosService';
import { profilesService } from '../services/profilesService';
import { resolveVigente } from '../lib/motorCalculo';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { ParametroPessoal, ParametroTributario, Profile, RegraDistribuicao, SplitSocio } from '../types/database';

export const ParametrosPage: React.FC = () => {
  const { user } = useAuth();
  const [tributarios, setTributarios] = useState<ParametroTributario[]>([]);
  const [regras, setRegras] = useState<RegraDistribuicao[]>([]);
  const [metas, setMetas] = useState<ParametroPessoal[]>([]);
  const [socios, setSocios] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = async () => {
    const [t, r, m, s] = await Promise.all([
      parametrosService.listarTodosTributarios(),
      parametrosService.listarRegrasDistribuicao(),
      parametrosService.listarMetasPessoais(),
      profilesService.listarSocios(),
    ]);
    setTributarios(t);
    setRegras(r);
    setMetas(m);
    setSocios(s);
  };

  useEffect(() => {
    recarregar();
  }, []);

  const tributoVigente = useMemo(() => resolveVigente(tributarios, hoje()), [tributarios]);
  const regraDefaultVigente = useMemo(
    () => resolveVigente(regras.filter((r) => r.escopo === 'default'), hoje()),
    [regras]
  );

  // ---- formulário: nova alíquota ----
  const [novaAliquota, setNovaAliquota] = useState('');
  const [novaVigenciaTributo, setNovaVigenciaTributo] = useState(hoje());

  const salvarAliquota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    setMsg(null);
    try {
      await parametrosService.definirNovaAliquota({
        aliquotaPercentual: Number(novaAliquota),
        regime: 'Simples Nacional',
        vigenciaInicio: novaVigenciaTributo,
        createdBy: user.id,
      });
      setNovaAliquota('');
      setMsg('Nova alíquota registrada.');
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // ---- formulário: nova regra de distribuição default ----
  const [percentualEmpresa, setPercentualEmpresa] = useState('30');
  const [splits, setSplits] = useState<SplitSocio[]>([]);
  const [novaVigenciaRegra, setNovaVigenciaRegra] = useState(hoje());

  useEffect(() => {
    if (socios.length > 0 && splits.length === 0) {
      const percentualIgual = Math.round((70 / socios.length) * 100) / 100;
      setSplits(socios.map((s) => ({ socio_id: s.id, percentual: percentualIgual })));
    }
  }, [socios]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarRegraDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    setMsg(null);
    try {
      await parametrosService.definirNovaRegraDistribuicao({
        escopo: 'default',
        percentualEmpresa: Number(percentualEmpresa),
        splitSocios: splits,
        vigenciaInicio: novaVigenciaRegra,
        createdBy: user.id,
      });
      setMsg('Nova regra de distribuição default registrada.');
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // ---- formulário: meta pessoal ----
  const [socioMeta, setSocioMeta] = useState('');
  const [valorMeta, setValorMeta] = useState('');
  const [vigenciaMeta, setVigenciaMeta] = useState(hoje());

  const salvarMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !socioMeta) return;
    setErro(null);
    setMsg(null);
    try {
      await parametrosService.definirNovaMetaPessoal({
        socioId: socioMeta,
        metaLiquidaMensal: Number(valorMeta),
        vigenciaInicio: vigenciaMeta,
        createdBy: user.id,
      });
      setMsg('Nova meta pessoal registrada.');
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const somaSplits = splits.reduce((acc, s) => acc + s.percentual, 0);
  const totalRegra = Number(percentualEmpresa || 0) + somaSplits;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parâmetros Configuráveis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nada aqui é fixo no código: alíquota, regra de distribuição e meta pessoal valem por vigência. Ao salvar um novo
          valor, o anterior é encerrado automaticamente e o histórico é preservado.
        </p>
      </div>

      {msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}
      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tributação */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Tributação vigente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hoje: {tributoVigente ? `${tributoVigente.aliquota_percentual}% (desde ${formatDate(tributoVigente.vigencia_inicio)})` : 'nenhuma regra cadastrada'}
          </p>
          <form onSubmit={salvarAliquota} className="mt-4 space-y-3">
            <Field label="Nova alíquota (%)">
              <Input type="number" step="0.001" min="0" max="100" required value={novaAliquota} onChange={(e) => setNovaAliquota(e.target.value)} />
            </Field>
            <Field label="Vigente a partir de">
              <Input type="date" required value={novaVigenciaTributo} onChange={(e) => setNovaVigenciaTributo(e.target.value)} />
            </Field>
            <Button type="submit" size="sm">Registrar nova alíquota</Button>
          </form>
          <ul className="mt-4 space-y-1 text-xs text-slate-500">
            {tributarios.slice(0, 5).map((t) => (
              <li key={t.id}>
                {t.aliquota_percentual}% — {formatDate(t.vigencia_inicio)} a {t.vigencia_fim ? formatDate(t.vigencia_fim) : 'atual'}
              </li>
            ))}
          </ul>
        </Card>

        {/* Distribuição default */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Regra de distribuição (default)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hoje: {regraDefaultVigente
              ? `${regraDefaultVigente.percentual_empresa}% empresa / ${regraDefaultVigente.split_socios.map((s) => `${s.percentual}%`).join(' + ')} sócios`
              : 'nenhuma regra cadastrada'}
          </p>
          <form onSubmit={salvarRegraDefault} className="mt-4 space-y-3">
            <Field label="% retido pela empresa">
              <Input type="number" step="0.01" min="0" max="100" required value={percentualEmpresa} onChange={(e) => setPercentualEmpresa(e.target.value)} />
            </Field>
            {socios.map((socio) => (
              <Field key={socio.id} label={`% ${socio.nome}`}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={splits.find((s) => s.socio_id === socio.id)?.percentual ?? ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSplits((prev) => {
                      const copia = [...prev];
                      const i = copia.findIndex((s) => s.socio_id === socio.id);
                      if (i >= 0) copia[i] = { ...copia[i], percentual: val };
                      else copia.push({ socio_id: socio.id, percentual: val });
                      return copia;
                    });
                  }}
                />
              </Field>
            ))}
            <p className={`text-xs ${Math.abs(totalRegra - 100) > 0.01 ? 'text-red-600' : 'text-slate-500'}`}>
              Soma atual: {totalRegra.toFixed(2)}% (precisa ser 100%)
            </p>
            <Field label="Vigente a partir de">
              <Input type="date" required value={novaVigenciaRegra} onChange={(e) => setNovaVigenciaRegra(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" disabled={Math.abs(totalRegra - 100) > 0.01}>
              Registrar nova regra
            </Button>
          </form>
        </Card>

        {/* Meta pessoal */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Meta líquida mensal por sócio</h2>
          <p className="mt-1 text-sm text-slate-500">
            Referência de acompanhamento — não obriga a empresa a pagar o valor independentemente do resultado.
          </p>
          <form onSubmit={salvarMeta} className="mt-4 grid gap-3 sm:grid-cols-4 sm:items-end">
            <Field label="Sócio">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={socioMeta}
                onChange={(e) => setSocioMeta(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Meta mensal (R$)">
              <Input type="number" step="0.01" min="0" required value={valorMeta} onChange={(e) => setValorMeta(e.target.value)} />
            </Field>
            <Field label="Vigente a partir de">
              <Input type="date" required value={vigenciaMeta} onChange={(e) => setVigenciaMeta(e.target.value)} />
            </Field>
            <Button type="submit" size="sm">Registrar meta</Button>
          </form>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {socios.map((socio) => {
              const meta = resolveVigente(metas.filter((m) => m.socio_id === socio.id), hoje());
              return (
                <div key={socio.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <span>{socio.nome}</span>
                  <span className="font-medium">{meta ? formatCurrency(meta.meta_liquida_mensal) : 'sem meta definida'}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
