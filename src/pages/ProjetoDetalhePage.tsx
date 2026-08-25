import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { SplitSociosEditor, splitValido } from '../components/SplitSociosEditor';
import { PermissionState } from '../components/ui/PermissionState';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { projetosService } from '../services/projetosService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { parametrosService } from '../services/parametrosService';
import { sociosService } from '../services/sociosService';
import { calcularResultadoProjeto, resolveRegraDistribuicaoVigente } from '../lib/motorCalculo';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { CustoProjeto, Despesa, FinanceiroHistorico, Socio, Projeto, Receita, ReceitaHistorico, RegraDistribuicao, SplitSocio } from '../types/database';

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
  const { can } = useCapabilities();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [custos, setCustos] = useState<CustoProjeto[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [regras, setRegras] = useState<RegraDistribuicao[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    if (!id) return;
    const [proj, rec, cus, desp, reg, soc] = await Promise.all([
      projetosService.obter(id),
      receitasService.listarPorProjeto(id),
      custosProjetoService.listarPorProjeto(id),
      despesasService.listar(),
      parametrosService.listarRegrasDistribuicao(),
      sociosService.listarAtivos(),
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
  const [emiteNota, setEmiteNota] = useState<boolean | null>(null);
  const [temRetencao, setTemRetencao] = useState(false);
  const [percentualRetencao, setPercentualRetencao] = useState('0');
  const [editando, setEditando] = useState<Receita | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editTipo, setEditTipo] = useState<Receita['tipo']>('pontual');
  const [editData, setEditData] = useState(hoje());
  const [motivo, setMotivo] = useState('');
  const [editEmiteNota, setEditEmiteNota] = useState(true);
  const [editTemRetencao, setEditTemRetencao] = useState(false);
  const [editPercentualRetencao, setEditPercentualRetencao] = useState('0');
  const [acaoModal, setAcaoModal] = useState<{ receita: Receita; acao: 'cancelar' | 'estornar' | 'reativar' | 'corrigir' } | null>(null);
  const [valorCorreto, setValorCorreto] = useState('');
  const [historico, setHistorico] = useState<ReceitaHistorico[]>([]);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);
  const [drawerNovaReceitaAberto, setDrawerNovaReceitaAberto] = useState(false);

  const iniciarEdicao = (r: Receita) => {
    setEditando(r); setEditDescricao(r.descricao); setEditValor(String(r.valor_bruto));
    setEditTipo(r.tipo === 'ajuste' ? 'pontual' : r.tipo); setEditData(r.data_fato_gerador); setMotivo('');
    setEditEmiteNota(r.emite_nota); setEditTemRetencao(r.tem_retencao); setEditPercentualRetencao(String(r.percentual_retencao ?? 0));
  };
  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editando) return; setErro(null);
    try { await receitasService.editar(editando, { descricao: editDescricao, tipo: editTipo, valorBruto: Number(editValor), dataPrevista: editData, dataFatoGerador: editData, motivo, emiteNota: editEmiteNota, temRetencao: editTemRetencao, percentualRetencao: Number(editPercentualRetencao) }); setEditando(null); await carregar(); }
    catch (e) { setErro((e as Error).message); }
  };
  const abrirAcao = (receita: Receita, acao: 'cancelar' | 'estornar' | 'reativar' | 'corrigir') => {
    setMotivo(''); setValorCorreto(String(receita.valor_bruto)); setAcaoModal({ receita, acao });
  };
  const confirmarAcao = async (e: React.FormEvent) => {
    e.preventDefault(); if (!acaoModal || !motivo.trim()) return;
    const { receita: r, acao } = acaoModal;
    try {
      if (acao === 'cancelar') await receitasService.cancelar(r.id, motivo);
      if (acao === 'estornar') await receitasService.estornarRecebimento(r.id, motivo);
      if (acao === 'reativar') await receitasService.reativar(r.id, motivo);
      if (acao === 'corrigir') await receitasService.corrigirFechada(r.id, Number(valorCorreto), motivo);
      setAcaoModal(null); await carregar();
    } catch (e) { setErro((e as Error).message); }
  };
  const abrirHistorico = async (r: Receita) => { try { setHistorico(await receitasService.listarHistorico(r.id)); setHistoricoDe(r.id); } catch (e) { setErro((e as Error).message); } };

  const criarReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || emiteNota === null) return;
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
        emiteNota,
        temRetencao,
        percentualRetencao: Number(percentualRetencao),
      });
      setDescricao('');
      setValorBruto('');
      setEmiteNota(null); setTemRetencao(false); setPercentualRetencao('0');
      setDrawerNovaReceitaAberto(false);
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
  const [custoEditando,setCustoEditando]=useState<CustoProjeto|null>(null);
  const [custoAcao,setCustoAcao]=useState<{custo:CustoProjeto;tipo:'pagar'|'estornar'|'cancelar'|'reativar'}|null>(null);
  const [custoMotivo,setCustoMotivo]=useState('');
  const [custoHistorico,setCustoHistorico]=useState<FinanceiroHistorico[]|null>(null);
  const [drawerNovoCustoAberto, setDrawerNovoCustoAberto] = useState(false);

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
      setDrawerNovoCustoAberto(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  const abrirCustoEdicao=(c:CustoProjeto)=>{setCustoEditando(c);setCustoDescricao(c.descricao);setCustoCategoria(c.categoria);setCustoValor(String(c.valor));setCustoData(c.data);setCustoMotivo('');};
  const salvarCusto=async(e:React.FormEvent)=>{e.preventDefault();if(!custoEditando)return;try{await custosProjetoService.editar(custoEditando,{descricao:custoDescricao,categoria:custoCategoria,valor:Number(custoValor),data:custoData,motivo:custoMotivo});setCustoEditando(null);await carregar();}catch(e){setErro((e as Error).message);}};
  const confirmarCustoAcao=async(e:React.FormEvent)=>{e.preventDefault();if(!custoAcao)return;try{await custosProjetoService.alterarStatus(custoAcao.custo.id,custoAcao.tipo,custoMotivo);setCustoAcao(null);await carregar();}catch(e){setErro((e as Error).message);}};

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

  if (!can('view_projects')) return <PermissionState />;
  if (!projeto) return <LoadingState label="Carregando projeto..." />;

  const colunasReceitas: DataTableColumn<Receita>[] = [
    {
      header: 'Receita',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.descricao}</p>
          <p className="text-xs text-slate-500">
            {formatDate(r.data_fato_gerador)} · {r.emite_nota ? `nota fiscal · imposto ${r.aliquota_aplicada}%${r.tem_retencao ? ` · retenção ${r.percentual_retencao}% (${formatCurrency(r.valor_retido)})` : ''}` : 'sem nota fiscal · sem imposto'}{r.receita_origem_id && ' · ajuste de receita anterior'}
          </p>
        </div>
      ),
    },
    { header: 'Valor', className: 'text-right font-medium', render: (r) => formatCurrency(r.valor_bruto) },
    { header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    {
      header: 'Ações',
      render: (r) => (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {r.status !== 'recebido' && r.status !== 'cancelado' && can('manage_revenues') && (
            <button
              className="text-xs font-medium text-blue-600 hover:underline"
              onClick={async () => {
                try { setErro(null); await receitasService.marcarRecebida(r.id, hoje()); await carregar(); }
                catch (e) { setErro((e as Error).message); }
              }}
            >
              marcar recebida
            </button>
          )}
          {r.tipo !== 'ajuste' && r.status !== 'recebido' && r.status !== 'cancelado' && can('manage_revenues') && <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => iniciarEdicao(r)}>editar</button>}
          {r.tipo !== 'ajuste' && r.status !== 'recebido' && r.status !== 'cancelado' && can('manage_revenues') && <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => abrirAcao(r, 'cancelar')}>cancelar</button>}
          {r.tipo !== 'ajuste' && r.status === 'recebido' && can('manage_revenues') && <button className="text-xs font-medium text-amber-600 hover:underline" onClick={() => abrirAcao(r, 'estornar')}>estornar recebimento</button>}
          {r.tipo !== 'ajuste' && r.status === 'cancelado' && can('manage_revenues') && <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => abrirAcao(r, 'reativar')}>reativar</button>}
          {r.tipo !== 'ajuste' && can('manage_revenues') && <button className="text-xs font-medium text-purple-600 hover:underline" onClick={() => abrirAcao(r, 'corrigir')}>corrigir valor fechado</button>}
          <button className="text-xs font-medium text-slate-500 hover:underline" onClick={() => abrirHistorico(r)}>histórico</button>
        </div>
      ),
    },
  ];

  const colunasCustos: DataTableColumn<CustoProjeto>[] = [
    {
      header: 'Custo',
      render: (c) => (
        <div>
          <p className="font-medium text-slate-800">{c.descricao}</p>
          <p className="text-xs text-slate-500">{c.categoria} · {formatDate(c.data)}</p>
        </div>
      ),
    },
    { header: 'Valor', className: 'text-right', render: (c) => <span className={c.status === 'cancelado' ? 'font-medium text-slate-400 line-through' : 'font-medium text-red-600'}>-{formatCurrency(c.valor)}</span> },
    { header: 'Status', render: (c) => <Badge tone={c.status === 'pago' ? 'success' : c.status === 'cancelado' ? 'danger' : 'warning'}>{c.status}</Badge> },
    {
      header: 'Ações',
      render: (c) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {c.status === 'provisionado' && can('manage_expenses') && <>
            <button className="text-xs text-blue-600" onClick={() => abrirCustoEdicao(c)}>editar</button>
            {can('mark_expense_paid') && <button className="text-xs text-green-700" onClick={() => { setCustoMotivo(''); setCustoAcao({ custo: c, tipo: 'pagar' }); }}>marcar pago</button>}
            <button className="text-xs text-red-600" onClick={() => { setCustoMotivo(''); setCustoAcao({ custo: c, tipo: 'cancelar' }); }}>cancelar</button>
          </>}
          {c.status === 'pago' && can('reverse_expense_payment') && <button className="text-xs text-amber-600" onClick={() => { setCustoMotivo(''); setCustoAcao({ custo: c, tipo: 'estornar' }); }}>estornar pagamento</button>}
          {c.status === 'cancelado' && can('manage_expenses') && <button className="text-xs text-blue-600" onClick={() => { setCustoMotivo(''); setCustoAcao({ custo: c, tipo: 'reativar' }); }}>reativar</button>}
          <button className="text-xs text-slate-500" onClick={async () => { try { setCustoHistorico(await custosProjetoService.listarHistorico(c.id)); } catch (e) { setErro((e as Error).message); } }}>histórico</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link to="/projetos" className="text-xs font-medium text-blue-600 hover:underline">
          ← Projetos
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{projeto.nome}</h1>
        <p className="text-sm text-slate-500">{projeto.origem_economica}</p>
      </div>

      {erro && <ErrorState message={erro} />}

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
          {can('manage_financial_parameters') && (
          <button className="mt-2 text-xs font-medium text-blue-600 hover:underline" onClick={() => setMostrarFormRegra((v) => !v)}>
            {mostrarFormRegra ? 'Cancelar' : 'Definir regra específica para este projeto'}
          </button>
          )}
          {mostrarFormRegra && can('manage_financial_parameters') && (
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
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Receitas</h2>
          {can('manage_revenues') && <Button size="sm" onClick={() => { setDescricao(''); setValorBruto(''); setEmiteNota(null); setTemRetencao(false); setPercentualRetencao('0'); setErro(null); setDrawerNovaReceitaAberto(true); }}>Nova receita</Button>}
        </div>

        <Drawer aberto={drawerNovaReceitaAberto} titulo="Nova receita" descricao="Imposto só incide sobre receita com nota fiscal, conforme a regra vigente." onClose={() => setDrawerNovaReceitaAberto(false)}>
          <form onSubmit={criarReceita} className="space-y-4">
            <Field label="Descrição">
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
            <Field label="Emite nota fiscal?">
              <Select required value={emiteNota === null ? '' : String(emiteNota)} onChange={(e) => { const valor = e.target.value === 'true'; setEmiteNota(valor); if (!valor) { setTemRetencao(false); setPercentualRetencao('0'); } }}>
                <option value="" disabled>Selecione</option><option value="true">Sim</option><option value="false">Não</option>
              </Select>
            </Field>
            {emiteNota && <Field label="Possui retenção?"><Select value={String(temRetencao)} onChange={(e) => setTemRetencao(e.target.value === 'true')}><option value="false">Não</option><option value="true">Sim</option></Select></Field>}
            {emiteNota && temRetencao && <Field label="Retenção (%)"><Input type="number" min="0" max="100" step="0.001" required value={percentualRetencao} onChange={(e) => setPercentualRetencao(e.target.value)} /></Field>}
            {erro && <ErrorState message={erro} />}
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setDrawerNovaReceitaAberto(false)}>Cancelar</Button><Button type="submit">Lançar receita</Button></div>
          </form>
        </Drawer>

        <Modal aberto={Boolean(editando)} titulo="Editar receita" descricao="A alteração ficará registrada no histórico financeiro." onClose={() => setEditando(null)} largura="lg">
          <form onSubmit={salvarEdicao} className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição" className="sm:col-span-2"><Input required value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} /></Field>
            <Field label="Valor"><Input type="number" min="0" step="0.01" required value={editValor} onChange={(e) => setEditValor(e.target.value)} /></Field>
            <Field label="Tipo"><Select value={editTipo} onChange={(e) => setEditTipo(e.target.value as Receita['tipo'])}><option value="pontual">Pontual</option><option value="recorrente">Recorrente</option></Select></Field>
            <Field label="Data"><Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} /></Field>
            <Field label="Emite nota fiscal?"><Select value={String(editEmiteNota)} onChange={(e) => { const valor = e.target.value === 'true'; setEditEmiteNota(valor); if (!valor) { setEditTemRetencao(false); setEditPercentualRetencao('0'); } }}><option value="true">Sim</option><option value="false">Não</option></Select></Field>
            {editEmiteNota && <Field label="Possui retenção?"><Select value={String(editTemRetencao)} onChange={(e) => setEditTemRetencao(e.target.value === 'true')}><option value="false">Não</option><option value="true">Sim</option></Select></Field>}
            {editEmiteNota && editTemRetencao && <Field label="Retenção (%)"><Input type="number" min="0" max="100" step="0.001" required value={editPercentualRetencao} onChange={(e) => setEditPercentualRetencao(e.target.value)} /></Field>}
            <Field label="Motivo da correção" className="sm:col-span-2"><Input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: valor digitado incorretamente" /></Field>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setEditando(null)}>Voltar</Button><Button type="submit">Salvar alteração</Button></div>
          </form>
        </Modal>

        <div className="mt-4">
          <DataTable columns={colunasReceitas} rows={receitas} rowKey={(r) => r.id} emptyTitle="Nenhuma receita lançada" />
        </div>
        <Modal aberto={Boolean(historicoDe)} titulo="Histórico da receita" descricao="Registro das alterações e dos responsáveis por cada ação." onClose={() => setHistoricoDe(null)}><div className="divide-y">{historico.map((h) => <div key={h.id} className="py-3 text-sm"><span className="font-medium capitalize">{h.acao.replace(/_/g, ' ')}</span><span className="ml-2 text-xs text-slate-500">{new Date(h.executado_em).toLocaleString('pt-BR')}</span>{h.motivo && <p className="mt-1 text-slate-600">Motivo: {h.motivo}</p>}</div>)}{!historico.length && <p className="text-sm text-slate-500">Ainda não existem alterações.</p>}</div></Modal>
        <Modal aberto={Boolean(acaoModal)} titulo={acaoModal?.acao === 'corrigir' ? 'Corrigir receita fechada' : acaoModal?.acao === 'estornar' ? 'Estornar recebimento' : acaoModal?.acao === 'reativar' ? 'Reativar receita' : 'Cancelar receita'} descricao="Informe os dados abaixo para registrar a ação com segurança." onClose={() => setAcaoModal(null)}>
          <form onSubmit={confirmarAcao} className="space-y-4">
            {acaoModal?.acao === 'corrigir' && <Field label="Valor correto" hint={acaoModal ? `Valor original: ${formatCurrency(acaoModal.receita.valor_bruto)}` : undefined}><Input type="number" step="0.01" min="0" required value={valorCorreto} onChange={(e) => setValorCorreto(e.target.value)} /></Field>}
            <Field label="Motivo"><Input required autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva por que esta ação é necessária" /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAcaoModal(null)}>Voltar</Button><Button type="submit" variant={acaoModal?.acao === 'cancelar' ? 'danger' : 'primary'}>Confirmar</Button></div>
          </form>
        </Modal>
      </Card>

      {/* Custos diretos */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Custos diretos do projeto</h2>
          {can('manage_expenses') && <Button size="sm" onClick={() => { setCustoDescricao(''); setCustoValor(''); setErro(null); setDrawerNovoCustoAberto(true); }}>Novo custo</Button>}
        </div>

        <Drawer aberto={drawerNovoCustoAberto} titulo="Novo custo do projeto" descricao="Custo direto entra no resultado líquido do projeto, antes da distribuição." onClose={() => setDrawerNovoCustoAberto(false)}>
          <form onSubmit={criarCusto} className="space-y-4">
            <Field label="Descrição">
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
            {erro && <ErrorState message={erro} />}
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setDrawerNovoCustoAberto(false)}>Cancelar</Button><Button type="submit">Lançar custo</Button></div>
          </form>
        </Drawer>
        <div className="mt-4">
          <DataTable columns={colunasCustos} rows={custos} rowKey={(c) => c.id} emptyTitle="Nenhum custo lançado" />
        </div>
        <Modal aberto={Boolean(custoEditando)} titulo="Editar custo" descricao="A alteração será registrada no histórico." onClose={()=>setCustoEditando(null)}><form onSubmit={salvarCusto} className="grid gap-4 sm:grid-cols-2"><Field label="Descrição"><Input required value={custoDescricao} onChange={e=>setCustoDescricao(e.target.value)}/></Field><Field label="Categoria"><Input required value={custoCategoria} onChange={e=>setCustoCategoria(e.target.value)}/></Field><Field label="Valor"><Input type="number" min="0" step="0.01" required value={custoValor} onChange={e=>setCustoValor(e.target.value)}/></Field><Field label="Data"><Input type="date" required value={custoData} onChange={e=>setCustoData(e.target.value)}/></Field><Field label="Motivo" className="sm:col-span-2"><Input required value={custoMotivo} onChange={e=>setCustoMotivo(e.target.value)}/></Field><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={()=>setCustoEditando(null)}>Voltar</Button><Button type="submit">Salvar</Button></div></form></Modal>
        <Modal aberto={Boolean(custoAcao)} titulo={custoAcao?.tipo==='pagar'?'Registrar pagamento':custoAcao?.tipo==='estornar'?'Estornar pagamento':custoAcao?.tipo==='cancelar'?'Cancelar custo':'Reativar custo'} onClose={()=>setCustoAcao(null)}><form onSubmit={confirmarCustoAcao} className="space-y-4"><Field label="Motivo"><Input required={custoAcao?.tipo!=='pagar'} value={custoMotivo} onChange={e=>setCustoMotivo(e.target.value)}/></Field><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setCustoAcao(null)}>Voltar</Button><Button type="submit">Confirmar</Button></div></form></Modal>
        <Modal aberto={custoHistorico!==null} titulo="Histórico do custo" onClose={()=>setCustoHistorico(null)}><div className="divide-y">{custoHistorico?.map(h=><div key={h.id} className="py-3 text-sm"><b className="capitalize">{h.acao.replace(/_/g,' ')}</b><span className="ml-2 text-xs text-slate-500">{new Date(h.executado_em).toLocaleString('pt-BR')}</span>{h.motivo&&<p>Motivo: {h.motivo}</p>}</div>)}{custoHistorico?.length===0&&<p className="text-sm text-slate-500">Nenhuma alteração registrada.</p>}</div></Modal>
      </Card>
    </div>
  );
};
