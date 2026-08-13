import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Field, Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { investimentosService } from '../services/investimentosService';
import { projetosService } from '../services/projetosService';
import { sociosService } from '../services/sociosService';
import { receitasService } from '../services/receitasService';
import { custosProjetoService, despesasService } from '../services/despesasService';
import { calcularResultadoProjeto, calcularROI, calcularPaybackMeses } from '../lib/motorCalculo';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { Investimento, InvestimentoHistorico, Socio, Projeto } from '../types/database';

type EditorInvestimento = {
  investidorTipo: Investimento['investidor_tipo']; socioId: string; projetoId: string; valor: string; data: string;
  tipo: string; descricao: string; retornoEsperado: string; prazoEsperado: string; roiMeta: string;
  consideradoNoResultado: boolean; motivo: string;
};

export const InvestimentosPage: React.FC = () => {
  const { user } = useAuth();
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [roiPorProjeto, setRoiPorProjeto] = useState<Record<string, { investido: number; retorno: number; roi: number; payback: number | null; meta: number | null }>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [editor, setEditor] = useState<EditorInvestimento | null>(null);
  const [acao, setAcao] = useState<{ investimento: Investimento; tipo: 'cancelar' | 'reativar' } | null>(null);
  const [motivoAcao, setMotivoAcao] = useState('');
  const [historicoDe, setHistoricoDe] = useState<Investimento | null>(null);
  const [historico, setHistorico] = useState<InvestimentoHistorico[]>([]);

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

    const investimentosAtivos = inv.filter((i) => i.status !== 'cancelado');
    const projetosComInvestimento = [...new Set(investimentosAtivos.map((i) => i.projeto_id).filter((x): x is string => !!x))];
    const roi: Record<string, { investido: number; retorno: number; roi: number; payback: number | null; meta: number | null }> = {};
    for (const pid of projetosComInvestimento) {
      const [receitas, custos, despesasTodas] = await Promise.all([
        receitasService.listarPorProjeto(pid),
        custosProjetoService.listarPorProjeto(pid),
        despesasService.listar(),
      ]);
      const despesas = despesasTodas.filter((d) => d.projeto_id === pid);
      const investimentosProjeto = investimentosAtivos.filter((i) => i.projeto_id === pid);
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

  const abrirEdicao = (i: Investimento) => {
    setEditando(i); setEditor({ investidorTipo:i.investidor_tipo,socioId:i.socio_id??'',projetoId:i.projeto_id??'',valor:String(i.valor),data:i.data,tipo:i.tipo,descricao:i.descricao??'',retornoEsperado:i.retorno_esperado===null?'':String(i.retorno_esperado),prazoEsperado:i.prazo_esperado_meses===null?'':String(i.prazo_esperado_meses),roiMeta:i.roi_meta_percentual===null?'':String(i.roi_meta_percentual),consideradoNoResultado:i.considerado_no_resultado,motivo:'' });
  };
  const salvarEdicao = async (e: React.FormEvent) => { e.preventDefault(); if(!editando||!editor)return; setErro(null); try { await investimentosService.editar(editando.id,{investidorTipo:editor.investidorTipo,socioId:editor.investidorTipo==='socio'?editor.socioId:null,projetoId:editor.projetoId||null,valor:Number(editor.valor),data:editor.data,tipo:editor.tipo,descricao:editor.descricao,retornoEsperado:editor.retornoEsperado?Number(editor.retornoEsperado):null,prazoEsperadoMeses:editor.prazoEsperado?Number(editor.prazoEsperado):null,roiMetaPercentual:editor.roiMeta?Number(editor.roiMeta):null,consideradoNoResultado:editor.consideradoNoResultado,motivo:editor.motivo}); setEditando(null);setEditor(null);await carregar(); } catch(e){setErro((e as Error).message);} };
  const confirmarAcao = async (e: React.FormEvent) => { e.preventDefault(); if(!acao)return; setErro(null); try { await investimentosService.alterarStatus(acao.investimento.id,acao.tipo,motivoAcao);setAcao(null);setMotivoAcao('');await carregar(); } catch(e){setErro((e as Error).message);} };
  const abrirHistorico = async (i: Investimento) => { setHistoricoDe(i);setHistorico([]);try{setHistorico(await investimentosService.listarHistorico(i.id));}catch(e){setErro((e as Error).message);} };
  const mudarEditor = <K extends keyof EditorInvestimento>(campo: K, valor: EditorInvestimento[K]) => setEditor((atual)=>atual?{...atual,[campo]:valor}:atual);

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
                <span className="text-slate-500">investido {formatCurrency(r.investido)} · resultado operacional realizado {formatCurrency(r.retorno)} · payback {r.payback ? `${r.payback} ${r.payback === 1 ? 'mês' : 'meses'}` : 'ainda não atingido'}</span>
                <span className={`font-semibold sm:text-right ${r.roi >= (r.meta ?? 0) ? 'text-green-600' : 'text-amber-600'}`}>ROI {r.roi.toFixed(1)}%{r.meta !== null ? ` / meta ${r.meta.toFixed(1)}%` : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {investimentos.map((i) => (
          <div key={i.id} className={`flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${i.status==='cancelado'?'bg-slate-50 opacity-70':''}`}>
            <div>
              <div className="flex items-center gap-2"><p className="font-medium text-slate-800">{i.descricao || i.tipo}</p><Badge tone={i.status==='cancelado'?'neutral':'success'}>{i.status==='cancelado'?'Cancelado':'Ativo'}</Badge></div>
              <p className="text-xs text-slate-500">
                {i.investidor_tipo === 'socio' ? nomeDoSocio(i.socio_id) : 'Consult Services'} · {nomeDoProjeto(i.projeto_id)} ·{' '}
                {formatDate(i.data)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><span className="mr-2 font-medium">{formatCurrency(i.valor)}</span>{i.status!=='cancelado'&&<Button size="sm" variant="secondary" onClick={()=>abrirEdicao(i)}>Editar</Button>}<Button size="sm" variant="ghost" onClick={()=>abrirHistorico(i)}>Histórico</Button><Button size="sm" variant={i.status==='cancelado'?'secondary':'danger'} onClick={()=>{setAcao({investimento:i,tipo:i.status==='cancelado'?'reativar':'cancelar'});setMotivoAcao('');}}>{i.status==='cancelado'?'Reativar':'Cancelar'}</Button></div>
          </div>
        ))}
        {investimentos.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Nenhum investimento registrado.</p>}
      </div>

      <Modal aberto={Boolean(editando&&editor)} titulo="Editar investimento" descricao="A alteração será preservada no histórico." onClose={()=>{setEditando(null);setEditor(null);}} largura="lg">
        {editor&&<form onSubmit={salvarEdicao} className="grid gap-4 sm:grid-cols-2">
          <Field label="Investidor"><Select value={editor.investidorTipo} onChange={e=>mudarEditor('investidorTipo',e.target.value as Investimento['investidor_tipo'])}><option value="socio">Sócio</option><option value="empresa">Consult Services</option></Select></Field>
          {editor.investidorTipo==='socio'&&<Field label="Qual sócio"><Select required value={editor.socioId} onChange={e=>mudarEditor('socioId',e.target.value)}><option value="">Selecione</option>{socios.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</Select></Field>}
          <Field label="Projeto"><Select value={editor.projetoId} onChange={e=>mudarEditor('projetoId',e.target.value)}><option value="">— geral —</option>{projetos.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
          <Field label="Valor"><Input type="number" min="0.01" step="0.01" required value={editor.valor} onChange={e=>mudarEditor('valor',e.target.value)}/></Field>
          <Field label="Tipo"><Input required value={editor.tipo} onChange={e=>mudarEditor('tipo',e.target.value)}/></Field><Field label="Data"><Input type="date" required value={editor.data} onChange={e=>mudarEditor('data',e.target.value)}/></Field>
          <Field label="Descrição" className="sm:col-span-2"><Input value={editor.descricao} onChange={e=>mudarEditor('descricao',e.target.value)}/></Field>
          <Field label="Retorno esperado"><Input type="number" min="0" step="0.01" value={editor.retornoEsperado} onChange={e=>mudarEditor('retornoEsperado',e.target.value)}/></Field><Field label="Prazo esperado (meses)"><Input type="number" min="1" value={editor.prazoEsperado} onChange={e=>mudarEditor('prazoEsperado',e.target.value)}/></Field>
          <Field label="Meta de ROI (%)"><Input type="number" min="0" step="0.01" value={editor.roiMeta} onChange={e=>mudarEditor('roiMeta',e.target.value)}/></Field>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={editor.consideradoNoResultado} onChange={e=>mudarEditor('consideradoNoResultado',e.target.checked)}/>Já lançado como custo ou despesa</label>
          <Field label="Motivo da alteração" className="sm:col-span-2"><Input required value={editor.motivo} onChange={e=>mudarEditor('motivo',e.target.value)} placeholder="Explique por que este lançamento está sendo corrigido"/></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={()=>{setEditando(null);setEditor(null);}}>Voltar</Button><Button type="submit">Salvar alteração</Button></div>
        </form>}
      </Modal>
      <Modal aberto={Boolean(acao)} titulo={acao?.tipo==='cancelar'?'Cancelar investimento':'Reativar investimento'} descricao="O registro e seu histórico permanecerão preservados." onClose={()=>setAcao(null)}><form onSubmit={confirmarAcao} className="space-y-4"><Field label="Motivo"><Input autoFocus required value={motivoAcao} onChange={e=>setMotivoAcao(e.target.value)}/></Field><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setAcao(null)}>Voltar</Button><Button type="submit" variant={acao?.tipo==='cancelar'?'danger':'primary'}>Confirmar</Button></div></form></Modal>
      <Modal aberto={Boolean(historicoDe)} titulo="Histórico do investimento" descricao={historicoDe?.descricao||historicoDe?.tipo} onClose={()=>setHistoricoDe(null)}><div className="space-y-3">{historico.map(h=><div key={h.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex justify-between gap-3"><strong className="capitalize text-slate-800">{h.acao}</strong><span className="text-xs text-slate-500">{new Date(h.executado_em).toLocaleString('pt-BR')}</span></div><p className="mt-1 text-slate-600">{h.motivo}</p></div>)}{historico.length===0&&<p className="text-sm text-slate-500">Nenhuma alteração registrada ainda.</p>}</div></Modal>
    </div>
  );
};

function mesesEntre(inicio: string, fim: string): string[] {
  const atual = new Date(`${inicio.slice(0, 7)}-01T00:00:00Z`); const limite = new Date(`${fim.slice(0, 7)}-01T00:00:00Z`); const meses: string[] = [];
  while (atual <= limite && meses.length < 120) { meses.push(`${atual.getUTCFullYear()}-${String(atual.getUTCMonth()+1).padStart(2,'0')}`); atual.setUTCMonth(atual.getUTCMonth()+1); }
  return meses;
}
