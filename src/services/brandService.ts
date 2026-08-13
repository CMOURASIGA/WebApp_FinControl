import { supabase } from '../lib/supabaseClient';
import { DEFAULT_BRAND, type BrandSettings } from '../lib/brand';

export const brandService = {
  async obter(): Promise<BrandSettings> {
    const { data, error } = await supabase.from('white_label_settings').select('*').eq('id', true).maybeSingle();
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return DEFAULT_BRAND;
      throw new Error(`carregar identidade visual: ${error.message}`);
    }
    return data ? { ...DEFAULT_BRAND, ...(data as BrandSettings) } : DEFAULT_BRAND;
  },

  async salvar(settings: BrandSettings): Promise<void> {
    const { data, error } = await supabase.from('white_label_settings').update({
      company_name: settings.company_name.trim(),
      product_name: settings.product_name.trim(),
      product_subtitle: settings.product_subtitle.trim(),
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      highlight_color: settings.highlight_color,
      updated_at: new Date().toISOString(),
    }).eq('id', true).select('id').single();
    if (error) throw new Error(`salvar identidade visual: ${error.message}`);
    if (!data) throw new Error('A identidade visual não foi atualizada. Confirme a permissão de administrador.');
  },

  async enviarLogo(file: File): Promise<string> {
    const tiposPermitidos = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!tiposPermitidos.has(file.type)) throw new Error('Formato de logo não permitido. Use PNG, JPG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('A logo deve ter no máximo 5 MB.');
    const extensao = file.name.split('.').pop()?.toLowerCase() || 'png';
    const caminho = `white-label/logo-${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from('brand-assets').upload(caminho, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(`enviar logo: ${error.message}`);
    return supabase.storage.from('brand-assets').getPublicUrl(caminho).data.publicUrl;
  },
};
