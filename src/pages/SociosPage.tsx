import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Field, Input, Select } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { sociosService } from '../services/sociosService';
import { socioService } from '../services/socioService';
import { formatCurrency, formatDate, hoje } from '../utils/formatters';
import type { Socio, SocioLancamento } from '../types/database';

const novoSocio = () => ({ nome: '', cpf: '', chavePix: '', email: '', telefone: '', tipo: 'socio' as Socio['tipo'], dataEntrada: hoje() });
const TIPO_LABEL: Record<SocioLancamento['tipo'], string> = { credito_resultado: 'Crédito de resultado', retirada: 'Retirada', reembolso: 'Reembolso', ajuste: 'Ajuste', debito_ajuste: 'Débito de correção' };

export const SociosPage: React.FC = () => {
  const { user } = useAuth();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [lancamentos, setLancamentos] = useState<SocioLancamento[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [form, setForm] = useState(novoSocio());
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [valorRetirada, setValorRetirada] = useState('');
  const [dataRetirada, setDataRetirada] = useState(hoje());
  const [descRetirada, setDescRetirada] = useState('');

  const carregar = async () => {
    const [s, l] = await Promise.all([sociosService.listarTodos(), socioService.listarTodos()]);
    setSocios(s); setLancamentos(l);
    if (!selecionado && s.length) setSelecionado(s[0].id);
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const socio = socios.find((s) => s.id === selecionado) ?? null;
  useEffect(() => {
    if (criando) { setForm(novoSocio()); return; }
    if (socio) setForm({ nome: socio.nome, cpf: socio.cpf ?? '', chavePix: socio.chave_pix ?? '', email: socio.email ?? '', telefone: socio.telefone ?? '', tipo: socio.tipo, dataEntrada: socio.data_entrada });
  }, [socio, criando]);
  const extrato = useMemo(() => lancamentos.filter((l) => l.socio_id === selecionado), [lancamentos, selecionado]);
  const saldo = socioService.calcularSaldo(extrato);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; setErro(null); setMsg(null);
    try {
      if (criando) { const criado = await sociosService.criar({ ...form, createdBy: user.id }); setCriando(false); setSelecionado(criado.id); setMsg('Sócio cadastrado.'); }
      else if (socio) { await sociosService.atualizar(socio.id, form); setMsg('Cadastro atualizado.'); }
      await carregar();
    } catch (e) { setErro((e as Error).message); }
  };
  const alternarAtivo = async () => { if (!socio) return; try { await sociosService.definirAtivo(socio.id, !socio.ativo); await carregar(); } catch (e) { setErro((e as Error).message); } };
  const retirar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!socio) return; setErro(null);
    try { await socioService.registrarRetirada({ socioId: socio.id, valor: Number(valorRetirada), data: dataRetirada, descricao: descRetirada || undefined, createdBy: user?.id ?? '' }); setValorRetirada(''); setDescRetirada(''); await carregar(); setMsg('Retirada registrada.'); }
    catch (e) { setErro((e as Error).message); }
  };

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Sócios</h1><p className="text-sm text-slate-500">Cadastro societário, participação e conta corrente.</p></div><Button onClick={() => { setCriando(true); setSelecionado(''); }}>Novo sócio</Button></div>
    <p className="rounded-md bg-blue-50 px-4 py-2 text-xs text-blue-700">Sócio é um cadastro financeiro e não precisa ter login. Desativar remove das novas escolhas e preserva o histórico.</p>
    <div className="flex flex-wrap gap-2">{socios.map((s) => <button key={s.id} onClick={() => { setCriando(false); setSelecionado(s.id); }} className={`rounded-full px-4 py-1.5 text-sm ${selecionado === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{s.nome}{!s.ativo && ' (inativo)'}</button>)}</div>
    {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}{msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}
    {(criando || socio) && <div className="grid gap-6 lg:grid-cols-2"><Card className="p-6"><div className="flex justify-between"><h2 className="font-semibold">{criando ? 'Cadastrar sócio' : 'Dados cadastrais'}</h2>{socio && !criando && <button onClick={alternarAtivo} className="text-xs font-medium text-blue-600">{socio.ativo ? 'Desativar' : 'Reativar'}</button>}</div>
      <form onSubmit={salvar} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Nome completo" className="sm:col-span-2"><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}/></Field><Field label="CPF"><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })}/></Field><Field label="Chave PIX"><Input value={form.chavePix} onChange={(e) => setForm({ ...form, chavePix: e.target.value })}/></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></Field><Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })}/></Field><Field label="Tipo"><Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Socio['tipo'] })}><option value="socio">Sócio</option><option value="investidor">Investidor</option></Select></Field><Field label="Entrada"><Input type="date" value={form.dataEntrada} onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })}/></Field><Button type="submit" className="sm:col-span-2">Salvar cadastro</Button></form></Card>
      {socio && !criando && <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-slate-500">Disponível para retirada</p><p className="text-2xl font-bold">{formatCurrency(saldo)}</p></div><Badge tone={socio.ativo ? 'success' : 'neutral'}>{socio.ativo ? 'Ativo' : 'Inativo'}</Badge></div><form onSubmit={retirar} className="mt-4 space-y-3"><Field label="Valor"><Input type="number" min="0.01" step="0.01" required value={valorRetirada} onChange={(e) => setValorRetirada(e.target.value)}/></Field><Field label="Data"><Input type="date" value={dataRetirada} onChange={(e) => setDataRetirada(e.target.value)}/></Field><Field label="Descrição"><Input value={descRetirada} onChange={(e) => setDescRetirada(e.target.value)}/></Field><Button type="submit" disabled={!socio.ativo}>Registrar retirada</Button></form></Card>}</div>}
    {socio && !criando && <Card className="p-6"><h2 className="font-semibold">Extrato societário</h2><div className="mt-3 divide-y">{extrato.map((l) => <div key={l.id} className="flex justify-between py-2 text-sm"><span>{l.descricao || TIPO_LABEL[l.tipo]} <small className="text-slate-400">{formatDate(l.data)}</small></span><span className={l.tipo === 'retirada' || l.tipo === 'debito_ajuste' ? 'text-red-600' : 'text-green-700'}>{l.tipo === 'retirada' || l.tipo === 'debito_ajuste' ? '-' : '+'}{formatCurrency(l.valor)}</span></div>)}{!extrato.length && <p className="py-2 text-sm text-slate-500">Nenhuma movimentação.</p>}</div></Card>}
  </div>;
};
