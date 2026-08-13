import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { despesasService } from '../services/despesasService';
import { projetosService } from '../services/projetosService';
import { formatCurrency, formatDate, hoje, mesAtual, primeiroDiaDoMes } from '../utils/formatters';
import type { Despesa, FinanceiroHistorico, Projeto } from '../types/database';

const TIPO_LABEL: Record<Despesa['tipo'], string> = {
  fixa: 'Fixa (corporativa)',
  variavel: 'Variável (corporativa)',
  projeto: 'Atribuída a projeto',
  tributo: 'Tributo',
  investimento: 'Investimento',
};

export const DespesasPage: React.FC = () => {
  const { user } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [acao, setAcao] = useState<{despesa:Despesa;tipo:'pagar'|'estornar'|'cancelar'|'reativar'}|null>(null);
  const [motivo, setMotivo] = useState('');
  const [historico, setHistorico] = useState<FinanceiroHistorico[]|null>(null);

  const [categoria, setCategoria] = useState('administrativo');
  const [tipo, setTipo] = useState<Despesa['tipo']>('fixa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [competencia, setCompetencia] = useState(primeiroDiaDoMes(mesAtual()));
  const [vencimento, setVencimento] = useState(hoje());

  const carregar = async () => {
    const [d, p] = await Promise.all([despesasService.listar(), projetosService.listar()]);
    setDespesas(d);
    setProjetos(p);
  };

  useEffect(() => {
    carregar();
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    try {
      await despesasService.criar({
        categoria,
        tipo,
        descricao,
        valor: Number(valor),
        projetoId: tipo === 'projeto' ? projetoId || null : null,
        competencia,
        dataVencimento: vencimento,
        createdBy: user.id,
      });
      setDescricao('');
      setValor('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const abrirEdicao = (d:Despesa) => { setEditando(d); setCategoria(d.categoria); setTipo(d.tipo); setDescricao(d.descricao); setValor(String(d.valor)); setProjetoId(d.projeto_id??''); setCompetencia(d.competencia); setVencimento(d.data_vencimento); setMotivo(''); };
  const salvarEdicao = async(e:React.FormEvent)=>{e.preventDefault();if(!editando)return;try{await despesasService.editar(editando,{categoria,tipo,descricao,valor:Number(valor),projetoId:tipo==='projeto'?projetoId||null:null,competencia,dataVencimento:vencimento,motivo});setEditando(null);await carregar();}catch(e){setErro((e as Error).message);}};
  const confirmarAcao=async(e:React.FormEvent)=>{e.preventDefault();if(!acao)return;try{await despesasService.alterarStatus(acao.despesa.id,acao.tipo,motivo);setAcao(null);await carregar();}catch(e){setErro((e as Error).message);}};
  const verHistorico=async(d:Despesa)=>{try{setHistorico(await despesasService.listarHistorico(d.id));}catch(e){setErro((e as Error).message);}};

  const totalProvisionado = despesas.filter((d) => d.status === 'provisionado').reduce((acc, d) => acc + d.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Despesas / Contas a Pagar</h1>
        <p className="text-sm text-slate-500">
          Sem projeto = despesa corporativa (sai da reserva da empresa). Com projeto = atribuída àquele projeto (entra no
          resultado líquido antes da distribuição).
        </p>
      </div>

      <Card className="p-4">
        <p className="text-sm text-slate-500">Total provisionado (a pagar)</p>
        <p className="text-xl font-bold text-red-600">{formatCurrency(totalProvisionado)}</p>
      </Card>

      <Card className="p-6">
        <form onSubmit={criar} className="grid gap-3 sm:grid-cols-3">
          <Field label="Descrição" className="sm:col-span-2">
            <Input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Contador, domínio, freelancer..." />
          </Field>
          <Field label="Valor (R$)">
            <Input type="number" step="0.01" min="0" required value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
          <Field label="Categoria">
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as Despesa['tipo'])}>
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {tipo === 'projeto' && (
            <Field label="Projeto">
              <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required>
                <option value="">Selecione</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Competência">
            <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </Field>
          <Field label="Vencimento">
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </Field>
          {erro && <p className="text-sm text-red-600 sm:col-span-3">{erro}</p>}
          <Button type="submit" className="sm:col-span-3">Lançar despesa</Button>
        </form>
      </Card>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {despesas.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">{d.descricao}</p>
              <p className="text-xs text-slate-500">
                {TIPO_LABEL[d.tipo]} · {d.categoria} · vence {formatDate(d.data_vencimento)}
                {d.projeto_id && ` · ${projetos.find((p) => p.id === d.projeto_id)?.nome ?? ''}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatCurrency(d.valor)}</span>
              <Badge tone={d.status === 'pago' ? 'success' : d.status === 'cancelado' ? 'danger' : 'warning'}>{d.status}</Badge>
              {d.status === 'provisionado' && (
                <button
                  className="text-xs font-medium text-blue-600 hover:underline"
                  onClick={async () => {
                    setMotivo(''); setAcao({despesa:d,tipo:'pagar'});
                  }}
                >
                  marcar paga
                </button>
              )}
              {d.status === 'provisionado' && <button className="text-xs font-medium text-blue-600" onClick={()=>abrirEdicao(d)}>editar</button>}
              {d.status === 'provisionado' && <button className="text-xs font-medium text-red-600" onClick={()=>{setMotivo('');setAcao({despesa:d,tipo:'cancelar'});}}>cancelar</button>}
              {d.status === 'pago' && <button className="text-xs font-medium text-amber-600" onClick={()=>{setMotivo('');setAcao({despesa:d,tipo:'estornar'});}}>estornar pagamento</button>}
              {d.status === 'cancelado' && <button className="text-xs font-medium text-blue-600" onClick={()=>{setMotivo('');setAcao({despesa:d,tipo:'reativar'});}}>reativar</button>}
              <button className="text-xs font-medium text-slate-500" onClick={()=>verHistorico(d)}>histórico</button>
            </div>
          </div>
        ))}
        {despesas.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Nenhuma despesa lançada.</p>}
      </div>
      <Modal aberto={Boolean(editando)} titulo="Editar despesa" descricao="A alteração será registrada no histórico." onClose={()=>setEditando(null)} largura="lg"><form onSubmit={salvarEdicao} className="grid gap-4 sm:grid-cols-2"><Field label="Descrição"><Input required value={descricao} onChange={e=>setDescricao(e.target.value)}/></Field><Field label="Valor"><Input type="number" min="0" step="0.01" required value={valor} onChange={e=>setValor(e.target.value)}/></Field><Field label="Categoria"><Input value={categoria} onChange={e=>setCategoria(e.target.value)}/></Field><Field label="Tipo"><Select value={tipo} onChange={e=>setTipo(e.target.value as Despesa['tipo'])}>{Object.entries(TIPO_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field>{tipo==='projeto'&&<Field label="Projeto"><Select required value={projetoId} onChange={e=>setProjetoId(e.target.value)}><option value="">Selecione</option>{projetos.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>}<Field label="Competência"><Input type="date" required value={competencia} onChange={e=>setCompetencia(e.target.value)}/></Field><Field label="Vencimento"><Input type="date" required value={vencimento} onChange={e=>setVencimento(e.target.value)}/></Field><Field label="Motivo" className="sm:col-span-2"><Input required value={motivo} onChange={e=>setMotivo(e.target.value)}/></Field><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={()=>setEditando(null)}>Voltar</Button><Button type="submit">Salvar</Button></div></form></Modal>
      <Modal aberto={Boolean(acao)} titulo={acao?.tipo==='pagar'?'Registrar pagamento':acao?.tipo==='estornar'?'Estornar pagamento':acao?.tipo==='cancelar'?'Cancelar despesa':'Reativar despesa'} onClose={()=>setAcao(null)}><form onSubmit={confirmarAcao} className="space-y-4"><Field label="Motivo" hint={acao?.tipo==='pagar'?'Opcional para pagamento.':'Obrigatório para auditoria.'}><Input required={acao?.tipo!=='pagar'} autoFocus value={motivo} onChange={e=>setMotivo(e.target.value)}/></Field><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setAcao(null)}>Voltar</Button><Button type="submit">Confirmar</Button></div></form></Modal>
      <Modal aberto={historico!==null} titulo="Histórico da despesa" onClose={()=>setHistorico(null)}><div className="divide-y">{historico?.map(h=><div key={h.id} className="py-3 text-sm"><b className="capitalize">{h.acao.replace(/_/g,' ')}</b><span className="ml-2 text-xs text-slate-500">{new Date(h.executado_em).toLocaleString('pt-BR')}</span>{h.motivo&&<p className="text-slate-600">Motivo: {h.motivo}</p>}</div>)}{historico?.length===0&&<p className="text-sm text-slate-500">Nenhuma alteração registrada.</p>}</div></Modal>
    </div>
  );
};
