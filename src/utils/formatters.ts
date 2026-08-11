export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const hoje = (): string => new Date().toISOString().slice(0, 10);

export const mesAtual = (): string => new Date().toISOString().slice(0, 7);

export const primeiroDiaDoMes = (mesISO: string): string => `${mesISO}-01`;

export const ultimoDiaDoMes = (mesISO: string): string => {
  const [ano, mes] = mesISO.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${mesISO}-${String(ultimo).padStart(2, '0')}`;
};

export const nomeDoMes = (mesISO: string): string => {
  const [ano, mes] = mesISO.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};