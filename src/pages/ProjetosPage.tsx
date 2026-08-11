import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { clientesService, projetosService } from '../services/projetosService';
import type { Cliente, Projeto } from '../types/database';

const TIPO_LABEL: Record<Projeto['tipo'], string> = {
  servico: 'Serviço',
  implantacao: 'Implantação',
  recorrente: 'Recorrente',
  consultoria: 'Consultoria',
  conjunto: 'Conjunto',
};

export const ProjetosPage: React.FC = () => {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<Projeto['tipo']>('servico');
  const [origem, setOrigem] = useState('compartilhado');
  const [clienteId, setClienteId] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');

  const carregar = async () => {
    const [p, c] = await Promise.all([projetosService.listar(), clientesService.listar()]);
    setProjetos(p);
    setClientes(c);
  };

  useEffect(() => {
    carregar();
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    try {
      let clienteFinal = clienteId || undefined;
      if (!clienteFinal && novoClienteNome.trim()) {
        const c = await clientesService.criar({ nome: novoClienteNome.trim() });
        clienteFinal = c.id;
      }
      await projetosService.criar({
        clienteId: clienteFinal,
        nome,
        tipo,
        origemEconomica: origem,
        createdBy: user.id,
      });
      setNome('');
      setNovoClienteNome('');
      setMostrarForm(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projetos & Receitas</h1>
          <p className="text-sm text-slate-500">Cada projeto carrega sua própria regra de distribuição.</p>
        </div>
        <Button onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? 'Cancelar' : 'Novo projeto'}</Button>
      </div>

      {mostrarForm && (
        <Card className="p-6">
          <form onSubmit={criar} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do projeto">
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Implantação CRM — Taven" />
            </Field>
            <Field label="Tipo">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as Projeto['tipo'])}>
                {Object.entries(TIPO_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cliente existente">
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">— nenhum / novo abaixo —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ou novo cliente" hint="Deixe em branco se selecionou um cliente acima">
              <Input value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)} placeholder="Nome do cliente" />
            </Field>
            <Field label="Origem econômica" className="sm:col-span-2" hint="Descritivo: de quem é o negócio (ex.: Christian, Sócio, Compartilhado)">
              <Input value={origem} onChange={(e) => setOrigem(e.target.value)} />
            </Field>
            {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
            <Button type="submit" className="sm:col-span-2">Criar projeto</Button>
          </form>
        </Card>
      )}

      <div className="grid gap-3">
        {projetos.map((p) => (
          <Link key={p.id} to={`/projetos/${p.id}`}>
            <Card className="flex items-center justify-between p-4 transition-shadow hover:shadow-md">
              <div>
                <p className="font-semibold text-slate-900">{p.nome}</p>
                <p className="text-sm text-slate-500">{TIPO_LABEL[p.tipo]} · {p.origem_economica}</p>
              </div>
              <Badge tone={p.status === 'ativo' ? 'success' : p.status === 'cancelado' ? 'danger' : 'neutral'}>{p.status}</Badge>
            </Card>
          </Link>
        ))}
        {projetos.length === 0 && <p className="text-sm text-slate-500">Nenhum projeto cadastrado ainda.</p>}
      </div>
    </div>
  );
};
