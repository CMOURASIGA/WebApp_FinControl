import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { SplitSociosEditor, splitValido } from '../components/SplitSociosEditor';
import { useAuth } from '../contexts/AuthContext';
import { projetosService } from '../services/projetosService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { parametrosService } from '../services/parametrosService';
import { profilesService } from '../services/profilesService';
import { calcularResultadoProjeto, resolveRegraDistribuicaoVigente } from '../lib/motorCalculo';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { CustoProjeto, Despesa, Profile, Projeto, Receita, RegraDistribuicao, SplitSocio } from '../types/database';

const STATUS_TONE: Record<Receita['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  previsto: 'neutral',
  faturado: 'warning',
  recebido: 'success',
  vencido: 'danger',
  cancelado: 'danger',
};

export const ProjetoDetalhePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [custos, setCustos] = useState<CustoProjeto[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [regras, setRegras] = useState<RegraDistribuicao[]>([]);
  const [socios, setSocios] = useState<Profile[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    if (!id) return;
    const [proj, rec, cus, desp, reg, soc] = await Promise.all([
      projetosService.obter(id),
      receitasService.listarPorProjeto(id),
      custosProjetoService.listarPorProjeto(id),
      despesasService.listar(),
      parametrosService.listarRegrasDistribuicao(),
      profilesService.listarSocios(),
    ]);
    setProjeto(proj);
    setReceitas(rec);
    setCustos(cus);
    setDespesas(desp.filter((d) => d.projeto_id === id));
    setRegras(reg);
    setSocios(soc);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const regraVigente = useMemo(
    () => (id ? resolveRegraDistribuicaoVigente(regras, hoje(), id) : null),
    [regras, id]
  );

  const resultado = useMemo(() => calcularResultadoProjeto(receitas, custos, despesas), [receitas, custos, despesas]);

  // --- form: nova receita ---
  const [descricao, setDescricao] = useState('');
  const [valorBruto, setValorBruto] = useState('');
  const [tipoReceita, setTipoReceita] = useState<Receita['tipo']>('pontual');
  const [dataFato, setDataFato] = useState(hoje());

  const criarReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setErro(null);
    try {
      await receitasService.criar({
        projetoId: id,
        descricao,
        tipo: tipoReceita,
        valorBruto: Number(valorBruto),
        dataPrevista: dataFato,
        dataFatoGerador: dataFato,
        createdBy: user.id,
      });
      setDescricao('');
      setValorBruto('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // --- form: novo custo ---
  const [custoDescricao, setCustoDescricao] = useState('');
  const [custoCategoria, setCustoCategoria] = useState('infraestrutura');
  const [custoValor, setCustoValor] = useState('');
  const [custoData, setCustoData] = useState(hoje());

  const criarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setErro(null);
    try {
      await custosProjetoService.criar({
        projetoId: id,
        descricao: custoDescricao,
        categoria: custoCategoria,
        valor: Number(custoValor),
        data: custoData,
        createdBy: user.id,
      });
      setCustoDescricao('');
      setCustoValor('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // --- form: regra específica do projeto ---
  const [percentualEmpresaProjeto, setPercentualEmpresaProjeto] = useState(30);
  const [splitsProjeto, setSplitsProjeto] = useState<SplitSocio[]>([]);
  const [vigenciaRegraProjeto, setVigenciaRegraProjeto] = useState(hoje());
  const [mostrarFormRegra, setMostrarFormRegra] = useState(false);

  useEffect(() => {
    if (socios.length > 0 && splitsProjeto.length === 0) {
      const percentualIgual = Math.round((70 / socios.length) * 100) / 100;
      setSplitsProjeto(socios.map((s) => ({ socio_id: s.id, percentual: percentualIgual })));
    }
  }, [socios]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarRegraProjeto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setErro(null);
    try {
      await parametrosService.definirNovaRegraDistribuicao({
        escopo: 'projeto',
        projetoId: id,
        percentualEmpresa: percentualEmpresaProjeto,
        splitSocios: splitsProjeto,
        vigenciaInicio: vigenciaRegraProjeto,
        createdBy: user.id,
      });
      setMostrarFormRegra(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const nomeDoSocio = (idSocio: string) => socios.find((s) => s.id === idSocio)?.nome ?? idSocio;

  if (!projeto) return <p className="text-sm text-slate-500">Carregando projeto...</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/projetos" className="text-xs font-medium text-blue-600 hover:underline">
          ← Projetos
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{projeto.nome}</h1>
        <p className="text-sm text-slate-500">{projeto.origem_economica}</p>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      {/* Resultado / DRE do projeto */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900">Resultado do projeto (todas as receitas lançadas)</h2>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <dt className="text-slate-500">Receita bruta</dt>
          <dd className="text-right font-medium sm:text-left">{formatCurrency(resultado.receitaBruta)}</dd>
          <dt className="text-slate-500">Tributos provisionados</dt>
          <dd className="text-right font-medium text-red-600 sm:text-left">-{formatCurrency(resultado.tributoProvisionado)}</dd>
          <dt className="text-slate-500">Custos diretos</dt>
          <dd className="text-right font-medium text-red-600 sm:text-left">-{formatCurrency(resultado.custosDiretos)}</dd>
          <dt className="text-slate-500">Despesas atribuídas</dt>
          <dd className="text-right font-medium text-red-600 sm:text-left">-{formatCurrency(resultado.despesasAtribuidas)}</dd>
          <dt className="font-semibold text-slate-700">Resultado líquido</dt>
          <dd className="text-right font-semibold text-green-700 sm:text-left">{formatCurrency(resultado.resultadoLiquido)}</dd>
          <dt className="text-slate-500">Empresa</dt>
          <dd className="text-right font-medium sm:text-left">{formatCurrency(resultado.valorEmpresa)}</dd>
          {Object.entries(resultado.porSocio).map(([socioId, valor]) => (
            <React.Fragment key={socioId}>
              <dt className="text-slate-500">{nomeDoSocio(socioId)}</dt>
              <dd className="text-right font-medium sm:text-left">{formatCurrency(valor)}</dd>
            </React.Fragment>
          ))}
        </dl>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            Regra de distribuição vigente:{' '}
            {regraVigente
              ? `${regraVigente.percentual_empresa}% empresa / ${regraVigente.split_socios.map((s) => `${nomeDoSocio(s.socio_id)} ${s.percentual}%`).join(' + ')} ${regraVigente.escopo === 'projeto' ? '(específica deste projeto)' : '(default da empresa)'}`
              : 'nenhuma regra vigente'}
          </p>
          <button className="mt-2 text-xs font-medium text-blue-600 hover:underline" onClick={() => setMostrarFormRegra((v) => !v)}>
            {mostrarFormRegra ? 'Cancelar' : 'Definir regra específica para este projeto'}
          </button>
          {mostrarFormRegra && (
            <form onSubmit={salvarRegraProjeto} className="mt-3 max-w-md space-y-3">
              <SplitSociosEditor
                socios={socios}
                percentualEmpresa={percentualEmpresaProjeto}
                onChangePercentualEmpresa={setPercentualEmpresaProjeto}
                splits={splitsProjeto}
                onChangeSplits={setSplitsProjeto}
              />
              <Field label="Vigente a partir de">
                <Input type="date" value={vigenciaRegraProjeto} onChange={(e) => setVigenciaRegraProjeto(e.target.value)} />
              </Field>
              <Button type="submit" size="sm" disabled={!splitValido(percentualEmpresaProjeto, splitsProjeto)}>
                Salvar regra do projeto
              </Button>
            </form>
          )}
        </div>
      </Card>

      {/* Receitas */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900">Receitas</h2>
        <form onSubmit={criarReceita} className="mt-4 grid gap-3 sm:grid-cols-5 sm:items-end">
          <Field label="Descrição" className="sm:col-span-2">
            <Input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Implantação CRM Empresa A" />
          </Field>
          <Field label="Valor bruto (R$)">
            <Input type="number" step="0.01" min="0" required value={valorBruto} onChange={(e) => setValorBruto(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={tipoReceita} onChange={(e) => setTipoReceita(e.target.value as Receita['tipo'])}>
              <option value="pontual">Pontual</option>
              <option value="recorrente">Recorrente</option>
            </Select>
          </Field>
          <Field label="Data do fato gerador">
            <Input type="date" value={dataFato} onChange={(e) => setDataFato(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" className="sm:col-span-5">Lançar receita</Button>
        </form>

        <div className="mt-4 divide-y divide-slate-100">
          {receitas.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">{r.descricao}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(r.data_fato_gerador)} · alíquota aplicada {r.aliquota_aplicada}%
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatCurrency(r.valor_bruto)}</span>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                {r.status !== 'recebido' && r.status !== 'cancelado' && (
                  <button
                    className="text-xs font-medium text-blue-600 hover:underline"
                    onClick={async () => {
                      await receitasService.marcarRecebida(r.id, hoje());
                      carregar();
                    }}
                  >
                    marcar recebida
                  </button>
                )}
              </div>
            </div>
          ))}
          {receitas.length === 0 && <p className="py-2 text-sm text-slate-500">Nenhuma receita lançada.</p>}
        </div>
      </Card>

      {/* Custos diretos */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900">Custos diretos do projeto</h2>
        <form onSubmit={criarCusto} className="mt-4 grid gap-3 sm:grid-cols-5 sm:items-end">
          <Field label="Descrição" className="sm:col-span-2">
            <Input required value={custoDescricao} onChange={(e) => setCustoDescricao(e.target.value)} placeholder="Vercel / OpenAI / freelancer..." />
          </Field>
          <Field label="Categoria">
            <Input value={custoCategoria} onChange={(e) => setCustoCategoria(e.target.value)} />
          </Field>
          <Field label="Valor (R$)">
            <Input type="number" step="0.01" min="0" required value={custoValor} onChange={(e) => setCustoValor(e.target.value)} />
          </Field>
          <Field label="Data">
            <Input type="date" value={custoData} onChange={(e) => setCustoData(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" className="sm:col-span-5">Lançar custo</Button>
        </form>
        <div className="mt-4 divide-y divide-slate-100">
          {custos.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">{c.descricao}</p>
                <p className="text-xs text-slate-500">{c.categoria} · {formatDate(c.data)}</p>
              </div>
              <span className="font-medium text-red-600">-{formatCurrency(c.valor)}</span>
            </div>
          ))}
          {custos.length === 0 && <p className="py-2 text-sm text-slate-500">Nenhum custo lançado.</p>}
        </div>
      </Card>
    </div>
  );
};
