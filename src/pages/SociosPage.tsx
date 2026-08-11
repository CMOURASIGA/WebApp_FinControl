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
  reserva_aporte: 'Aporte na reserva pessoal',
  reserva_uso: 'Uso da reserva pessoal',
};

export const SociosPage: React.FC = () => {
  const { user } = useAuth();
  const [socios, setSocios] = useState<Profile[]>([]);
  const [lancamentos, setLancamentos] = useState<SocioLancamento[]>([]);
  const [socioSelecionado, setSocioSelecionado] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    const [s, l] = await Promise.all([profilesService.listarSocios(), socioService.listarTodos()]);
    setSocios(s);
    setLancamentos(l);
    if (!socioSelecionado && s.length > 0) setSocioSelecionado(s[0].id);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lancamentosDoSocio = useMemo(
    () => lancamentos.filter((l) => l.socio_id === socioSelecionado).sort((a, b) => (a.data < b.data ? 1 : -1)),
    [lancamentos, socioSelecionado]
  );
  const saldoConta = socioService.calcularSaldo(lancamentosDoSocio);
  const saldoReserva = socioService.calcularSaldoReserva(lancamentosDoSocio);

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
      setErro(
        `Atenção: retirar ${formatCurrency(valor)} deixaria o saldo negativo (disponível: ${formatCurrency(saldoConta)}). Considere usar a reserva pessoal.`
      );
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

  // --- reserva pessoal ---
  const [valorReserva, setValorReserva] = useState('');
  const [modoReserva, setModoReserva] = useState<'aporte' | 'uso'>('aporte');

  const registrarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !socioSelecionado) return;
    setErro(null);
    try {
      await socioService.registrarReservaPessoal({
        socioId: socioSelecionado,
        valor: Number(valorReserva),
        data: hoje(),
        uso: modoReserva === 'uso',
        createdBy: user.id,
      });
      setValorReserva('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sócios — Conta Corrente</h1>
        <p className="text-sm text-slate-500">Direito econômico calculado ≠ valor efetivamente transferido.</p>
      </div>

      <div className="flex gap-2">
        {socios.map((s) => (
          <button
            key={s.id}
            onClick={() => setSocioSelecionado(s.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              socioSelecionado === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s.nome}
          </button>
        ))}
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase text-slate-500">Saldo disponível (conta corrente)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(saldoConta)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase text-slate-500">Reserva pessoal</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(saldoReserva)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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

        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Reserva pessoal</h2>
          <p className="mt-1 text-xs text-slate-500">
            Em mês acima da meta, aporte o excedente aqui. Em mês abaixo, use a reserva em vez de puxar caixa da empresa.
          </p>
          <form onSubmit={registrarReserva} className="mt-4 space-y-3">
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" min="0" required value={valorReserva} onChange={(e) => setValorReserva(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModoReserva('aporte')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${modoReserva === 'aporte' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300'}`}
              >
                Aportar
              </button>
              <button
                type="button"
                onClick={() => setModoReserva('uso')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${modoReserva === 'uso' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300'}`}
              >
                Usar
              </button>
            </div>
            <Button type="submit" size="sm">Confirmar</Button>
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
                <Badge tone={l.tipo === 'retirada' || l.tipo === 'reserva_aporte' ? 'danger' : 'success'}>{TIPO_LABEL[l.tipo]}</Badge>
                <span className="font-medium">{formatCurrency(l.valor)}</span>
              </div>
            </div>
          ))}
          {lancamentosDoSocio.length === 0 && <p className="py-2 text-sm text-slate-500">Nenhum lançamento ainda.</p>}
        </div>
      </Card>
    </div>
  );
};
