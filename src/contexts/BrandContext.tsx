import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_BRAND, type BrandSettings } from '../lib/brand';
import { brandService } from '../services/brandService';

interface BrandContextValue {
  brand: BrandSettings;
  loading: boolean;
  refreshBrand: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

function applyBrand(settings: BrandSettings) {
  const root = document.documentElement.style;
  root.setProperty('--primary-brand', settings.primary_color);
  root.setProperty('--highlight-brand', settings.highlight_color);
  root.setProperty('--sidebar', settings.primary_color);
  document.title = `${settings.product_name} | ${settings.company_name}`;
}

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);

  const refreshBrand = useCallback(async () => {
    try {
      const settings = await brandService.obter();
      setBrand(settings);
      applyBrand(settings);
    } catch {
      setBrand(DEFAULT_BRAND);
      applyBrand(DEFAULT_BRAND);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshBrand(); }, [refreshBrand]);

  return <BrandContext.Provider value={{ brand, loading, refreshBrand }}>{children}</BrandContext.Provider>;
};

export function useBrand(): BrandContextValue {
  const context = useContext(BrandContext);
  if (!context) throw new Error('useBrand deve ser usado dentro de <BrandProvider>');
  return context;
}
