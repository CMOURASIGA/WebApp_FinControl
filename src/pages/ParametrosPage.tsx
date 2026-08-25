import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { SplitSociosEditor, splitValido } from '../components/SplitSociosEditor';
import { PermissionState } from '../components/ui/PermissionState';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { brandService } from '../services/brandService';
import { parametrosService } from '../services/parametrosService';
import { sociosService } from '../services/sociosService';
import { resolveVigente } from '../lib/motorCalculo';
import { formatDate, hoje } from '../utils/formatters';
import type { ParametroTributario, Socio, RegraDistribuicao, SplitSocio } from '../types/database';
import { DEFAULT_BRAND } from '../lib/brand';
import { extrairCoresLogo } from '../lib/extrairCoresLogo';

export const ParametrosPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = useCapabilities();
  const { brand, refreshBrand } = useBrand();
  const [tributarios, setTributarios] = useState<ParametroTributario[]>([]);
  const [regras, setRegras] = useState<RegraDistribuicao[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [whiteLabelAberto, setWhiteLabelAberto] = useState(false);
  const [brandForm, setBrandForm] = useState(brand);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [salvandoBrand, setSalvandoBrand] = useState(false);
  const [analisandoLogo, setAnalisandoLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => { setBrandForm(brand); }, [brand]);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  const selecionarLogo = async (file: File | null) => {
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (!file) { setLogoPreview(null); return; }
    setLogoPreview(URL.createObjectURL(file)); setAnalisandoLogo(true); setErro(null);
    try {
      const paleta = await extrairCoresLogo(file);
      setBrandForm((atual) => ({ ...atual, primary_color: paleta.principal, highlight_color: paleta.destaque }));
    } catch (e) { setErro((e as Error).message); }
    finally { setAnalisandoLogo(false); }
  };

  const salvarWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !can('manage_brand')) return;
    setErro(null); setMsg(null); setSalvandoBrand(true);
    try {
      const logoUrl = logoFile ? await brandService.enviarLogo(logoFile) : brandForm.logo_url;
      await brandService.salvar({ ...brandForm, logo_url: logoUrl });
      await refreshBrand();
      setLogoFile(null); setWhiteLabelAberto(false); setMsg('Identidade visual atualizada.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoBrand(false);
    }
  };

  const recarregar = async () => {
    const [t, r, s] = await Promise.all([
      parametrosService.listarTodosTributarios(),
      parametrosService.listarRegrasDistribuicao(),
      sociosService.listarAtivos(),
    ]);
    setTributarios(t);
    setRegras(r);
    setSocios(s);
  };

  useEffect(() => {
    recarregar();
  }, []);

  const tributoVigente = useMemo(() => resolveVigente(tributarios, hoje()), [tributarios]);
  const regraDefaultVigente = useMemo(
    () => resolveVigente(regras.filter((r) => r.escopo === 'default'), hoje()),
    [regras]
  );

  // ---- formulário: nova alíquota ----
  const [novaAliquota, setNovaAliquota] = useState('');
  const [novaVigenciaTributo, setNovaVigenciaTributo] = useState(hoje());

  const salvarAliquota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    setMsg(null);
    try {
      await parametrosService.definirNovaAliquota({
        aliquotaPercentual: Number(novaAliquota),
        regime: 'Simples Nacional',
        vigenciaInicio: novaVigenciaTributo,
        createdBy: user.id,
      });
      setNovaAliquota('');
      setMsg('Nova alíquota registrada.');
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // ---- formulário: nova regra de distribuição default ----
  const [percentualEmpresa, setPercentualEmpresa] = useState(30);
  const [splits, setSplits] = useState<SplitSocio[]>([]);
  const [novaVigenciaRegra, setNovaVigenciaRegra] = useState(hoje());

  useEffect(() => {
    if (socios.length > 0 && splits.length === 0) {
      const percentualIgual = Math.round((70 / socios.length) * 100) / 100;
      setSplits(socios.map((s) => ({ socio_id: s.id, percentual: percentualIgual })));
    }
  }, [socios]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarRegraDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    setMsg(null);
    try {
      await parametrosService.definirNovaRegraDistribuicao({
        escopo: 'default',
        percentualEmpresa,
        splitSocios: splits,
        vigenciaInicio: novaVigenciaRegra,
        createdBy: user.id,
      });
      setMsg('Nova regra de distribuição default registrada.');
      recarregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const nomeDoSocio = (id: string) => socios.find((s) => s.id === id)?.nome ?? id;

  if (!can('view_parameters')) return <PermissionState />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parâmetros Configuráveis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nada aqui é fixo no código: alíquota e regra de distribuição valem por vigência. Ao salvar um novo valor, o
          anterior é encerrado automaticamente e o histórico é preservado.
        </p>
      </div>

      {msg && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</p>}
      {erro && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      {socios.length === 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Nenhum sócio cadastrado ainda — cadastre-se ou peça para o(s) outro(s) sócio(s) se cadastrarem na tela de login
          antes de definir a regra de distribuição.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5"><div className="brand-logo-frame h-24 w-48 p-3"><img src={brand.logo_url} alt={brand.company_name} className="brand-logo-preview" /></div><div><p className="brand-highlight-text text-[10px] font-black uppercase tracking-[0.2em]">White label</p><h2 className="mt-1 font-semibold text-slate-900">{brand.product_name}</h2><p className="mt-1 text-sm text-slate-500">{brand.company_name} · {brand.product_subtitle}</p><div className="mt-3 flex gap-2"><span className="h-5 w-5 rounded-full border border-white shadow" style={{ backgroundColor: brand.primary_color }} /><span className="h-5 w-5 rounded-full border border-white shadow" style={{ backgroundColor: brand.highlight_color }} /></div></div></div>
            {can('manage_brand') && <Button type="button" onClick={() => setWhiteLabelAberto(true)}>Personalizar identidade</Button>}
            {!can('manage_brand') && <Button type="button" disabled>Somente administrador</Button>}
          </div>
        </Card>
        {/* Tributação */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Tributação vigente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hoje: {tributoVigente ? `${tributoVigente.aliquota_percentual}% (desde ${formatDate(tributoVigente.vigencia_inicio)})` : 'nenhuma regra cadastrada'}
          </p>
          {can('manage_financial_parameters') ? (
            <form onSubmit={salvarAliquota} className="mt-4 space-y-3">
              <Field label="Nova alíquota (%)">
                <Input type="number" step="0.001" min="0" max="100" required value={novaAliquota} onChange={(e) => setNovaAliquota(e.target.value)} />
              </Field>
              <Field label="Vigente a partir de">
                <Input type="date" required value={novaVigenciaTributo} onChange={(e) => setNovaVigenciaTributo(e.target.value)} />
              </Field>
              <Button type="submit" size="sm">Registrar nova alíquota</Button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-slate-400">Seu perfil não pode alterar a tributação vigente.</p>
          )}
          <ul className="mt-4 space-y-1 text-xs text-slate-500">
            {tributarios.slice(0, 5).map((t) => (
              <li key={t.id}>
                {t.aliquota_percentual}% — {formatDate(t.vigencia_inicio)} a {t.vigencia_fim ? formatDate(t.vigencia_fim) : 'atual'}
              </li>
            ))}
          </ul>
        </Card>

        {/* Distribuição default */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Regra de distribuição (default)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hoje: {regraDefaultVigente
              ? `${regraDefaultVigente.percentual_empresa}% empresa / ${regraDefaultVigente.split_socios
                  .map((s) => `${nomeDoSocio(s.socio_id)} ${s.percentual}%`)
                  .join(' + ')}`
              : 'nenhuma regra cadastrada'}
          </p>
          {can('manage_financial_parameters') ? (
            <form onSubmit={salvarRegraDefault} className="mt-4 space-y-3">
              <SplitSociosEditor
                socios={socios}
                percentualEmpresa={percentualEmpresa}
                onChangePercentualEmpresa={setPercentualEmpresa}
                splits={splits}
                onChangeSplits={setSplits}
              />
              <Field label="Vigente a partir de">
                <Input type="date" required value={novaVigenciaRegra} onChange={(e) => setNovaVigenciaRegra(e.target.value)} />
              </Field>
              <Button type="submit" size="sm" disabled={!splitValido(percentualEmpresa, splits) || socios.length === 0}>
                Registrar nova regra
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-slate-400">Seu perfil não pode alterar a regra de distribuição.</p>
          )}
        </Card>
      </div>

      <Modal aberto={whiteLabelAberto} titulo="Personalizar identidade" descricao="Essas informações serão aplicadas no login, menu e cabeçalho do sistema." onClose={() => setWhiteLabelAberto(false)} largura="lg">
        <form onSubmit={salvarWhiteLabel} className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa cliente"><Input required value={brandForm.company_name} onChange={(e) => setBrandForm((atual) => ({ ...atual, company_name: e.target.value }))} /></Field>
          <Field label="Nome do produto"><Input required value={brandForm.product_name} onChange={(e) => setBrandForm((atual) => ({ ...atual, product_name: e.target.value }))} /></Field>
          <Field label="Subtítulo" className="sm:col-span-2"><Input required value={brandForm.product_subtitle} onChange={(e) => setBrandForm((atual) => ({ ...atual, product_subtitle: e.target.value }))} /></Field>
          <Field label="Logo" hint="PNG, JPG ou WEBP, com até 5 MB. As cores serão sugeridas automaticamente." className="sm:col-span-2"><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void selecionarLogo(e.target.files?.[0] ?? null)} /></Field>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2"><div className="brand-logo-frame h-24 w-44 p-2"><img src={logoPreview ?? brandForm.logo_url} alt="Prévia da logo no menu lateral" className="brand-logo-preview" /></div><div><p className="text-sm font-semibold text-slate-800">Prévia no menu lateral</p><p className="mt-1 text-xs text-slate-500">{analisandoLogo ? 'Analisando as cores da imagem...' : logoFile ? 'Esta é a proporção e o arredondamento aplicados no canto superior esquerdo.' : 'Selecione uma logo para visualizar o enquadramento no menu.'}</p><div className="mt-3 flex gap-2"><span className="h-7 w-7 rounded-full border-2 border-white shadow" style={{backgroundColor:brandForm.primary_color}}/><span className="h-7 w-7 rounded-full border-2 border-white shadow" style={{backgroundColor:brandForm.highlight_color}}/></div></div></div>
          <Field label="Cor principal"><div className="flex gap-2"><Input type="color" className="h-11 w-16 p-1" value={brandForm.primary_color} onChange={(e) => setBrandForm((atual) => ({ ...atual, primary_color: e.target.value }))} /><Input pattern="^#[0-9A-Fa-f]{6}$" required value={brandForm.primary_color} onChange={(e) => setBrandForm((atual) => ({ ...atual, primary_color: e.target.value }))} /></div></Field>
          <Field label="Cor de destaque"><div className="flex gap-2"><Input type="color" className="h-11 w-16 p-1" value={brandForm.highlight_color} onChange={(e) => setBrandForm((atual) => ({ ...atual, highlight_color: e.target.value }))} /><Input pattern="^#[0-9A-Fa-f]{6}$" required value={brandForm.highlight_color} onChange={(e) => setBrandForm((atual) => ({ ...atual, highlight_color: e.target.value }))} /></div></Field>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" onClick={() => { setBrandForm(DEFAULT_BRAND); setLogoFile(null); setLogoPreview(null); }}>Restaurar padrão Consult Services</Button><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setWhiteLabelAberto(false)}>Voltar</Button><Button type="submit" disabled={salvandoBrand||analisandoLogo}>{salvandoBrand ? 'Salvando...' : analisandoLogo ? 'Analisando...' : 'Aplicar identidade'}</Button></div></div>
        </form>
      </Modal>
    </div>
  );
};
