import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { PermissionState } from '../components/ui/PermissionState';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../hooks/useCapabilities';
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

const formVazio = () => ({
  categoria: 'administrativo',
  tipo: 'fixa' as Despesa['tipo'],
  descricao: '',
  valor: '',
  projetoId: '',
  competencia: primeiroDiaDoMes(mesAtual()),
  vencimento: hoje(),
});

export const DespesasPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = useCapabilities();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [drawerAberto, setDrawerAberto] = useState<'nova' | 'editar' | null>(null);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [acao, setAcao] = useState<{despesa:Despesa;tipo:'pagar'|'estornar'|'cancelar'|'reativar'}|null>(null);
  const [motivo, setMotivo] = useState('');
  const [historico, setHistorico] = useState<FinanceiroHistorico[]|null>(null);
  const [form, setForm] = useState(formVazio());

  const carregar = async () => {
    const [d, p] = await Promise.all([despesasService.listar(), projetosService.listar()]);
    setDespesas(d);
    setProjetos(p);
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNova = () => { setForm(formVazio()); setErro(null); setDrawerAberto('nova'); };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    try {
      await despesasService.criar({
        categoria: form.categoria,
        tipo: form.tipo,
        descricao: form.descricao,
        valor: Number(form.valor),
        projetoId: form.tipo === 'projeto' ? form.projetoId || null : null,
        competencia: form.competencia,
        dataVencimento: form.vencimento,
        createdBy: user.id,
      });
      setDrawerAberto(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const abrirEdicao = (d: Despesa) => {
    setEditando(d);
    setForm({ categoria: d.categoria, tipo: d.tipo, descricao: d.descricao, valor: String(d.valor), projetoId: d.projeto_id ?? '', competencia: d.competencia, vencimento: d.data_vencimento });
    setMotivo('');
    setErro(null);
    setDrawerAberto('editar');
  };
  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editando) return;
    try {
      await despesasService.editar(editando, { categoria: form.categoria, tipo: form.tipo, descricao: form.descricao, valor: Number(form.valor), projetoId: form.tipo === 'projeto' ? form.projetoId || null : null, competencia: form.competencia, dataVencimento: form.vencimento, motivo });
      setDrawerAberto(null); setEditando(null); await carregar();
    } catch (e) { setErro((e as Error).message); }
  };
  const confirmarAcao = async (e: React.FormEvent) => { e.preventDefault(); if (!acao) return; try { await despesasService.alterarStatus(acao.despesa.id, acao.tipo, motivo); setAcao(null); await carregar(); } catch (e) { setErro((e as Error).message); } };
  const verHistorico = async (d: Despesa) => { try { setHistorico(await despesasService.listarHistorico(d.id)); } catch (e) { setErro((e as Error).message); } };

  const totalProvisionado = despesas.filter((d) => d.status === 'provisionado').reduce((acc, d) => acc + d.valor, 0);

  if (!can('view_expenses')) return <PermissionState />;

  const colunas: DataTableColumn<Despesa>[] = [
    {
      header: 'Despesa',
      render: (d) => (
        <div>
          <p className="font-medium text-slate-800">{d.descricao}</p>
          <p className="text-xs text-slate-500">
            {TIPO_LABEL[d.tipo]} · {d.categoria} · vence {formatDate(d.data_vencimento)}
            {d.projeto_id && ` · ${projetos.find((p) => p.id === d.projeto_id)?.nome ?? ''}`}
          </p>
        </div>
      ),
    },
    { header: 'Valor', className: 'text-right font-medium', render: (d) => formatCurrency(d.valor) },
    { header: 'Status', render: (d) => <Badge tone={d.status === 'pago' ? 'success' : d.status === 'cancelado' ? 'danger' : 'warning'}>{d.status}</Badge> },
    {
      header: 'Ações',
      render: (d) => (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {d.status === 'provisionado' && can('mark_expense_paid') && (
            <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => { setMotivo(''); setAcao({ despesa: d, tipo: 'pagar' }); }}>
              marcar paga
            </button>
          )}
          {d.status === 'provisionado' && can('manage_expenses') && <button className="text-xs font-medium text-blue-600" onClick={() => abrirEdicao(d)}>editar</button>}
          {d.status === 'provisionado' && can('manage_expenses') && <button className="text-xs font-medium text-red-600" onClick={() => { setMotivo(''); setAcao({ despesa: d, tipo: 'cancelar' }); }}>cancelar</button>}
          {d.status === 'pago' && can('reverse_expense_payment') && <button className="text-xs font-medium text-amber-600" onClick={() => { setMotivo(''); setAcao({ despesa: d, tipo: 'estornar' }); }}>estornar pagamento</button>}
          {d.status === 'cancelado' && can('manage_expenses') && <button className="text-xs font-medium text-blue-600" onClick={() => { setMotivo(''); setAcao({ despesa: d, tipo: 'reativar' }); }}>reativar</button>}
          <button className="text-xs font-medium text-slate-500" onClick={() => verHistorico(d)}>histórico</button>
        </div>
      ),
    },
  ];

  const camposFormulario = (
    <>
      <Field label="Descrição">
        <Input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Contador, domínio, freelancer..." />
      </Field>
      <Field label="Valor (R$)">
        <Input type="number" step="0.01" min="0" required value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
      </Field>
      <Field label="Categoria">
        <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
      </Field>
      <Field label="Tipo">
        <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Despesa['tipo'] })}>
          {Object.entries(TIPO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Field>
      {form.tipo === 'projeto' && (
        <Field label="Projeto">
          <Select value={form.projetoId} onChange={(e) => setForm({ ...form, projetoId: e.target.value })} required>
            <option value="">Selecione</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Competência">
        <Input type="date" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
      </Field>
      <Field label="Vencimento">
        <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
      </Field>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas / Contas a Pagar"
        description="Sem projeto = despesa corporativa (sai da reserva da empresa). Com projeto = atribuída àquele projeto (entra no resultado líquido antes da distribuição)."
        action={can('manage_expenses') && <Button onClick={abrirNova}>Nova despesa</Button>}
      />

      <Card className="p-4">
        <p className="text-sm text-slate-500">Total provisionado (a pagar)</p>
        <p className="text-xl font-bold text-red-600">{formatCurrency(totalProvisionado)}</p>
      </Card>

      {erro && !drawerAberto && <ErrorState message={erro} />}

      <DataTable
        columns={colunas}
        rows={despesas}
        rowKey={(d) => d.id}
        emptyTitle="Nenhuma despesa lançada"
        emptyDescription={can('manage_expenses') ? 'Use "Nova despesa" para lançar a primeira.' : undefined}
      />

      <Drawer
        aberto={drawerAberto === 'nova'}
        titulo="Nova despesa"
        descricao="Lançamentos ficam como 'provisionado' até você marcar como pago."
        onClose={() => setDrawerAberto(null)}
      >
        <form onSubmit={criar} className="space-y-4">
          {camposFormulario}
          {erro && <ErrorState message={erro} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setDrawerAberto(null)}>Cancelar</Button><Button type="submit">Lançar despesa</Button></div>
        </form>
      </Drawer>

      <Drawer
        aberto={drawerAberto === 'editar'}
        titulo="Editar despesa"
        descricao="A alteração será registrada no histórico."
        onClose={() => { setDrawerAberto(null); setEditando(null); }}
      >
        <form onSubmit={salvarEdicao} className="space-y-4">
          {camposFormulario}
          <Field label="Motivo"><Input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique por que este lançamento está sendo corrigido" /></Field>
          {erro && <ErrorState message={erro} />}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => { setDrawerAberto(null); setEditando(null); }}>Cancelar</Button><Button type="submit">Salvar</Button></div>
        </form>
      </Drawer>

      <Modal aberto={Boolean(acao)} titulo={acao?.tipo === 'pagar' ? 'Registrar pagamento' : acao?.tipo === 'estornar' ? 'Estornar pagamento' : acao?.tipo === 'cancelar' ? 'Cancelar despesa' : 'Reativar despesa'} onClose={() => setAcao(null)}>
        <form onSubmit={confirmarAcao} className="space-y-4">
          <Field label="Motivo" hint={acao?.tipo === 'pagar' ? 'Opcional para pagamento.' : 'Obrigatório para auditoria.'}>
            <Input required={acao?.tipo !== 'pagar'} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAcao(null)}>Voltar</Button><Button type="submit">Confirmar</Button></div>
        </form>
      </Modal>

      <Modal aberto={historico !== null} titulo="Histórico da despesa" onClose={() => setHistorico(null)}>
        <div className="divide-y">
          {historico?.map((h) => (
            <div key={h.id} className="py-3 text-sm">
              <b className="capitalize">{h.acao.replace(/_/g, ' ')}</b>
              <span className="ml-2 text-xs text-slate-500">{new Date(h.executado_em).toLocaleString('pt-BR')}</span>
              {h.motivo && <p className="text-slate-600">Motivo: {h.motivo}</p>}
            </div>
          ))}
          {historico?.length === 0 && <p className="text-sm text-slate-500">Nenhuma alteração registrada.</p>}
        </div>
      </Modal>
    </div>
  );
};
