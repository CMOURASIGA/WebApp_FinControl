import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { despesasService } from '../services/despesasService';
import { projetosService } from '../services/projetosService';
import { formatCurrency, formatDate, hoje, mesAtual, primeiroDiaDoMes } from '../utils/formatters';
import type { Despesa, Projeto } from '../types/database';

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
              <Badge tone={d.status === 'pago' ? 'success' : 'warning'}>{d.status}</Badge>
              {d.status === 'provisionado' && (
                <button
                  className="text-xs font-medium text-blue-600 hover:underline"
                  onClick={async () => {
                    await despesasService.marcarPaga(d.id, hoje());
                    carregar();
                  }}
                >
                  marcar paga
                </button>
              )}
            </div>
          </div>
        ))}
        {despesas.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Nenhuma despesa lançada.</p>}
      </div>
    </div>
  );
};
