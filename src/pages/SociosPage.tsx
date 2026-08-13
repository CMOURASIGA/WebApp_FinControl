import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Badge } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { profilesService } from '../services/profilesService';
import { socioService } from '../services/socioService';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { Profile, SocioLancamento } from '../types/database';

const TIPO_LABEL: Record<SocioLancamento['tipo'], string> = {
  credito_resultado: 'Crédito de resultado',
  retirada: 'Retirada',
  reembolso: 'Reembolso',
  ajuste: 'Ajuste',
};

export const SociosPage: React.FC = () => {
  const { user } = useAuth();
  const [socios, setSocios] = useState<Profile[]>([]);
  const [lancamentos, setLancamentos] = useState<SocioLancamento[]>([]);
  const [socioSelecionado, setSocioSelecionado] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = async () => {
    // listarTodos traz também os desativados — é a tela de gestão do
    // quadro societário, então precisa mostrar todo mundo que já
    // existiu, não só quem está ativo hoje.
    const [s, l] = await Promise.all([profilesService.listarTodos(), socioService.listarTodos()]);
    setSocios(s);
    setLancamentos(l);
    if (!socioSelecionado && s.length > 0) setSocioSelecionado(s[0].id);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const socio = socios.find((s) => s.id === socioSelecionado) ?? null;

  const lancamentosDoSocio = useMemo(
    () => lancamentos.filter((l) => l.socio_id === socioSelecionado).sort((a, b) => (a.data < b.data ? 1 : -1)),
    [lancamentos, socioSelecionado]
  );
  const saldoConta = socioService.calcularSaldo(lancamentosDoSocio);

  // --- dados cadastrais (qualquer sócio ativo pode editar qualquer cadastro) ---
  const [nomeEdit, setNomeEdit] = useState('');
  const [cpfEdit, setCpfEdit] = useState('');
  const [pixEdit, setPixEdit] = useState('');

  useEffect(() => {
    if (socio) {
      setNomeEdit(socio.nome);
      setCpfEdit(socio.cpf ?? '');
      setPixEdit(socio.chave_pix ?? '');
    }
  }, [socio]);

  const salvarDadosCadastrais = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !socio) return;
    setErro(null);
    setMsg(null);
    try {
      await profilesService.atualizarDadosCadastrais(socio.id, {
        nome: nomeEdit,
        cpf: cpfEdit || null,
        chavePix: pixEdit || null,
      });
      setMsg('Dados cadastrais atualizados.');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const alternarAtivo = async () => {
    if (!socio) return;
    setErro(null);
    setMsg(null);
    try {
      if (socio.ativo) await profilesService.desativar(socio.id);
      else await profilesService.reativar(socio.id);
      setMsg(socio.ativo ? `${socio.nome} foi desativado.` : `${socio.nome} foi reativado.`);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // --- retirada ---
  const [valorRetirada, setValorRetirada] = useState('');
  const [dataRetirada, setDataRetirada] = useState(hoje());
  const [descRetirada, setDescRetirada] = useState('');

  const registrarRetirada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !socioSelecionado) return;
    setErro(null);
    const valor = Number(valorRetirada);
    if (valor > saldoConta) {
      setErro(`Atenção: retirar ${formatCurrency(valor)} deixaria o saldo negativo (disponível: ${formatCurrency(saldoConta)}).`);
      return;
    }
    try {
      await socioService.registrarRetirada({
        socioId: socioSelecionado,
        valor,
        data: dataRetirada,
        descricao: descRetirada || undefined,
        createdBy: user.id,
      });
      setValorRetirada('');
      setDescRetirada('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sócios</h1>
        <p className="text-sm text-slate-500">Cadastro societário e conta corrente — direito econômico calculado ≠ valor efetivamente transferido.</p>
      </div>

      <p className="rounded-md bg-blue-50 px-4 py-2 text-xs text-blue-700">
        Um novo sócio entra no sistema se cadastrando pela tela de login com o e-mail dele — o registro aparece
        automaticamente aqui. Qualquer sócio ativo pode completar/editar o cadastro (nome, CPF, chave PIX) de qualquer
        outro. Não existe exclusão de sócio: para tirar alguém das regras de distribuição e lançamentos novos, use
        "Desativar" — o histórico dele continua preservado.
      </p>

      <div className="flex flex-wrap gap-2">
        {socios.map((s) => (
          <button
            key={s.id}
            onClick={() => setSocioSelecionado(s.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              socioSelecionado === s.id
                ? 'bg-blue-600 text-white'
                : s.ativo
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            {s.nome}
            {!s.ativo && ' (inativo)'}
          </button>
        ))}
        {socios.length === 0 && <p className="text-sm text-slate-500">Nenhum sócio cadastrado ainda.</p>}
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}
      {msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}

      {socio && (
        <>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Saldo disponível (conta corrente) — {socio.nome}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(saldoConta)}</p>
              </div>
              <Badge tone={socio.ativo ? 'success' : 'neutral'}>{socio.ativo ? 'Ativo' : 'Inativo'}</Badge>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Dados cadastrais</h2>
                <button
                  type="button"
                  onClick={alternarAtivo}
                  className={`text-xs font-medium hover:underline ${socio.ativo ? 'text-red-600' : 'text-blue-600'}`}
                >
                  {socio.ativo ? 'Desativar sócio' : 'Reativar sócio'}
                </button>
              </div>
              <form onSubmit={salvarDadosCadastrais} className="mt-4 space-y-3">
                <Field label="Nome completo">
                  <Input required value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} />
                </Field>
                <Field label="CPF">
                  <Input value={cpfEdit} onChange={(e) => setCpfEdit(e.target.value)} placeholder="000.000.000-00" />
                </Field>
                <Field label="Chave PIX">
                  <Input value={pixEdit} onChange={(e) => setPixEdit(e.target.value)} placeholder="e-mail, telefone, CPF ou aleatória" />
                </Field>
                <Button type="submit" size="sm">Salvar</Button>
              </form>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold text-slate-900">Registrar retirada</h2>
              <form onSubmit={registrarRetirada} className="mt-4 space-y-3">
                <Field label="Valor (R$)">
                  <Input type="number" step="0.01" min="0" required value={valorRetirada} onChange={(e) => setValorRetirada(e.target.value)} />
                </Field>
                <Field label="Data">
                  <Input type="date" value={dataRetirada} onChange={(e) => setDataRetirada(e.target.value)} />
                </Field>
                <Field label="Descrição (opcional)">
                  <Input value={descRetirada} onChange={(e) => setDescRetirada(e.target.value)} />
                </Field>
                <Button type="submit" size="sm">Registrar retirada</Button>
              </form>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Extrato</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {lancamentosDoSocio.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{l.descricao || TIPO_LABEL[l.tipo]}</p>
                    <p className="text-xs text-slate-500">{formatDate(l.data)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={l.tipo === 'retirada' ? 'danger' : 'success'}>{TIPO_LABEL[l.tipo]}</Badge>
                    <span className="font-medium">{formatCurrency(l.valor)}</span>
                  </div>
                </div>
              ))}
              {lancamentosDoSocio.length === 0 && <p className="py-2 text-sm text-slate-500">Nenhum lançamento ainda.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
