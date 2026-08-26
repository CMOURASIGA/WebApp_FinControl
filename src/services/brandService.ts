import { supabase, demoDataMode } from '../lib/supabaseClient';
import { DEFAULT_BRAND, type BrandSettings } from '../lib/brand';

const LOCAL_BRAND_KEY = '7finance.brand.local.v1';

function normalizar(settings: BrandSettings): BrandSettings {
  return {
    ...DEFAULT_BRAND,
    ...settings,
    company_name: settings.company_name.trim(),
    product_name: settings.product_name.trim(),
    product_subtitle: settings.product_subtitle.trim(),
  };
}

function lerLocal(): BrandSettings | null {
  try {
    const raw = localStorage.getItem(LOCAL_BRAND_KEY);
    if (!raw) return null;
    return normalizar(JSON.parse(raw) as BrandSettings);
  } catch {
    return null;
  }
}

function salvarLocal(settings: BrandSettings): void {
  try {
    localStorage.setItem(LOCAL_BRAND_KEY, JSON.stringify(normalizar(settings)));
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'armazenamento local indisponível';
    throw new Error(`salvar identidade visual localmente: ${mensagem}`);
  }
}

function schemaIndisponivel(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01'
    || error.code === 'PGRST204'
    || error.code === 'PGRST205'
    || /white_label_settings|schema cache|relation .* does not exist/i.test(error.message ?? '');
}

function storageIndisponivel(error: { message?: string } | null | undefined): boolean {
  if (!error) return false;
  return /bucket.*not found|not found|does not exist|brand-assets/i.test(error.message ?? '');
}

async function arquivoComoDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler a logo.'));
    reader.readAsDataURL(file);
  });
}

export const brandService = {
  async obter(): Promise<BrandSettings> {
    const local = lerLocal();

    // Demo é deliberadamente independente de backend. A identidade deve sobreviver
    // a reloads no mesmo navegador para permitir apresentações completas.
    if (demoDataMode) return local ?? DEFAULT_BRAND;

    const { data, error } = await supabase.from('white_label_settings').select('*').eq('id', true).maybeSingle();
    if (error) {
      // Enquanto o banco ainda não estiver provisionado, main/develop continuam
      // utilizáveis e preservam a identidade apenas neste navegador.
      if (schemaIndisponivel(error)) return local ?? DEFAULT_BRAND;
      throw new Error(`carregar identidade visual: ${error.message}`);
    }

    const remoto = data ? normalizar({ ...DEFAULT_BRAND, ...(data as BrandSettings) }) : null;
    return remoto ?? local ?? DEFAULT_BRAND;
  },

  async salvar(settings: BrandSettings): Promise<void> {
    const normalizado = normalizar(settings);

    if (demoDataMode) {
      salvarLocal(normalizado);
      return;
    }

    const { data, error } = await supabase.from('white_label_settings').update({
      company_name: normalizado.company_name,
      product_name: normalizado.product_name,
      product_subtitle: normalizado.product_subtitle,
      logo_url: normalizado.logo_url,
      primary_color: normalizado.primary_color,
      highlight_color: normalizado.highlight_color,
      updated_at: new Date().toISOString(),
    }).eq('id', true).select('id').single();

    if (error) {
      if (schemaIndisponivel(error)) {
        salvarLocal(normalizado);
        return;
      }
      throw new Error(`salvar identidade visual: ${error.message}`);
    }

    if (!data) throw new Error('A identidade visual não foi atualizada. Confirme a permissão de administrador.');

    // Mantém um cache local para evitar flash da identidade padrão em recargas.
    salvarLocal(normalizado);
  },

  async enviarLogo(file: File): Promise<string> {
    const tiposPermitidos = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!tiposPermitidos.has(file.type)) throw new Error('Formato de logo não permitido. Use PNG, JPG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('A logo deve ter no máximo 5 MB.');

    if (demoDataMode) return arquivoComoDataUrl(file);

    const extensao = file.name.split('.').pop()?.toLowerCase() || 'png';
    const caminho = `white-label/logo-${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from('brand-assets').upload(caminho, file, { upsert: true, contentType: file.type });

    if (error) {
      // Sem bucket provisionado ainda, permite validar o white label em main/develop
      // usando persistência local. Quando o Storage existir, o fluxo volta ao remoto.
      if (storageIndisponivel(error)) return arquivoComoDataUrl(file);
      throw new Error(`enviar logo: ${error.message}`);
    }

    return supabase.storage.from('brand-assets').getPublicUrl(caminho).data.publicUrl;
  },
};
