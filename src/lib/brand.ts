export const COMPANY_NAME = 'Consult Services Tecnologia';
export const PRODUCT_NAME = '7Finance';
export const PRODUCT_SUBTITLE = 'Gestão financeira e societária';
export const PRODUCT_DESCRIPTION = 'Receitas, custos, despesas, reservas e distribuição entre sócios em um só lugar.';
export const COMPANY_LOGO_URL = 'https://i.imgur.com/gxXnYsA.png';

export interface BrandSettings {
  id: boolean;
  company_name: string;
  product_name: string;
  product_subtitle: string;
  logo_url: string;
  primary_color: string;
  highlight_color: string;
  updated_at?: string;
}

export const DEFAULT_BRAND: BrandSettings = {
  id: true,
  company_name: COMPANY_NAME,
  product_name: PRODUCT_NAME,
  product_subtitle: PRODUCT_SUBTITLE,
  logo_url: COMPANY_LOGO_URL,
  primary_color: '#003B73',
  highlight_color: '#00AEEF',
};
