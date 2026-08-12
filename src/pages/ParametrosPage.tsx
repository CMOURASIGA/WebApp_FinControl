import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { SplitSociosEditor, splitValido } from '../components/SplitSociosEditor';
import { useAuth } from '../contexts/AuthContext';
import { parametrosService } from '../services/parametrosService';
import { profilesService } from '../services/profilesService';
import { resolveVigente } from '../lib/motorCalculo';
import { formatDate, hoje } from '../utils/formatters';
import type { ParametroTributario, Profile, RegraDistribuicao, SplitSocio } from '../types/database';

export const ParametrosPage: React.FC = () => {
  const { user } = useAuth();
  const [tributarios, setTributarios] = useState<ParametroTributario[]>([]);
  const [regras, setRegras] = useState<RegraDistribuicao[]>([]);
  const [socios, setSocios] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = async () => {
    const [t, r, s] = await Promise.all([
      parametrosService.listarTodosTributarios(),
      parametrosService.listarRegrasDistribuicao(),
      profilesService.listarSocios(),
    ]);
    setTributarios(t);
    setRegras(r);
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
  const [percentualEmpresa, setPercentualEmpresa] = useState(30);
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
        percentualEmpresa,
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

  const nomeDoSocio = (id: string) => socios.find((s) => s.id === id)?.nome ?? id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parâmetros Configuráveis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nada aqui é fixo no código: alíquota e regra de distribuição valem por vigência. Ao salvar um novo valor, o
          anterior é encerrado automaticamente e o histórico é preservado.
        </p>
      </div>

      {msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}
      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      {socios.length === 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Nenhum sócio cadastrado ainda — cadastre-se ou peça para o(s) outro(s) sócio(s) se cadastrarem na tela de login
          antes de definir a regra de distribuição.
        </p>
      )}

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
              ? `${regraDefaultVigente.percentual_empresa}% empresa / ${regraDefaultVigente.split_socios
                  .map((s) => `${nomeDoSocio(s.socio_id)} ${s.percentual}%`)
                  .join(' + ')}`
              : 'nenhuma regra cadastrada'}
          </p>
          <form onSubmit={salvarRegraDefault} className="mt-4 space-y-3">
            <SplitSociosEditor
              socios={socios}
              percentualEmpresa={percentualEmpresa}
              onChangePercentualEmpresa={setPercentualEmpresa}
              splits={splits}
              onChangeSplits={setSplits}
            />
            <Field label="Vigente a partir de">
              <Input type="date" required value={novaVigenciaRegra} onChange={(e) => setNovaVigenciaRegra(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" disabled={!splitValido(percentualEmpresa, splits) || socios.length === 0}>
              Registrar nova regra
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
