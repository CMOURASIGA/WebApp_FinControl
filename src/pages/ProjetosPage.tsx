import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Field, Input, Select, Badge } from '../components/ui/Input';
import { PermissionState } from '../components/ui/PermissionState';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { clientesService, projetosService } from '../services/projetosService';
import { sociosService } from '../services/sociosService';
import type { Cliente, Projeto, Socio } from '../types/database';

const TIPO_LABEL: Record<Projeto['tipo'], string> = {
  servico: 'Serviço',
  implantacao: 'Implantação',
  recorrente: 'Recorrente',
  consultoria: 'Consultoria',
  conjunto: 'Conjunto',
};

export const ProjetosPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = useCapabilities();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<Projeto['tipo']>('servico');
  const [origem, setOrigem] = useState('compartilhado');
  const [clienteId, setClienteId] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [originadorSocioId, setOriginadorSocioId] = useState('');
  const [responsavelComercialSocioId, setResponsavelComercialSocioId] = useState('');
  const [responsavelExecucaoSocioId, setResponsavelExecucaoSocioId] = useState('');

  const carregar = async () => {
    const [p, c, s] = await Promise.all([projetosService.listar(), clientesService.listar(), sociosService.listarAtivos()]);
    setProjetos(p);
    setClientes(c);
    setSocios(s);
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = () => { setNome(''); setNovoClienteNome(''); setErro(null); setDrawerAberto(true); };

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
        originadorSocioId: originadorSocioId || undefined,
        responsavelComercialSocioId: responsavelComercialSocioId || undefined,
        responsavelExecucaoSocioId: responsavelExecucaoSocioId || undefined,
      });
      setNome('');
      setNovoClienteNome('');
      setDrawerAberto(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  if (!can('view_projects')) return <PermissionState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos & Receitas"
        description="Cada projeto carrega sua própria regra de distribuição."
        action={can('manage_projects') && <Button onClick={abrirNovo}>Novo projeto</Button>}
      />

      <Drawer aberto={drawerAberto} titulo="Novo projeto" descricao="Depois de criado, receitas e custos diretos são lançados na página do projeto." onClose={() => setDrawerAberto(false)} largura="lg">
        <form onSubmit={criar} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do projeto" className="sm:col-span-2">
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
          <Field label="Ou novo cliente" hint="Deixe em branco se selecionou um cliente acima" className="sm:col-span-2">
            <Input value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)} placeholder="Nome do cliente" />
          </Field>
          <Field label="Origem econômica" className="sm:col-span-2" hint="Descritivo: de quem é o negócio (ex.: Christian, Sócio, Compartilhado)">
            <Input value={origem} onChange={(e) => setOrigem(e.target.value)} />
          </Field>
          <Field label="Sócio originador">
            <Select value={originadorSocioId} onChange={(e) => setOriginadorSocioId(e.target.value)}><option value="">Não definido</option>{socios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
          </Field>
          <Field label="Responsável comercial">
            <Select value={responsavelComercialSocioId} onChange={(e) => setResponsavelComercialSocioId(e.target.value)}><option value="">Não definido</option>{socios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
          </Field>
          <Field label="Responsável pela execução" className="sm:col-span-2">
            <Select value={responsavelExecucaoSocioId} onChange={(e) => setResponsavelExecucaoSocioId(e.target.value)}><option value="">Não definido</option>{socios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
          </Field>
          {erro && <ErrorState message={erro} className="sm:col-span-2" />}
          <div className="flex justify-end gap-2 sm:col-span-2 pt-2"><Button type="button" variant="secondary" onClick={() => setDrawerAberto(false)}>Cancelar</Button><Button type="submit">Criar projeto</Button></div>
        </form>
      </Drawer>

      {projetos.length === 0 ? (
        <EmptyState title="Nenhum projeto cadastrado ainda" description={can('manage_projects') ? 'Use "Novo projeto" para começar.' : undefined} />
      ) : (
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
        </div>
      )}
    </div>
  );
};
