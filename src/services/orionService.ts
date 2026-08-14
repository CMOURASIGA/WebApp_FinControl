import { despesasService } from './despesasService';
import { investimentosService } from './investimentosService';
import { receitasService } from './receitasService';
import { reservaEmpresaService } from './socioService';

export interface OrionSnapshot {
  competencia: string;
  receitasPrevistas: number;
  receitasRealizadas: number;
  despesasPrevistas: number;
  despesasPagas: number;
  tributosProvisionados: number;
  reservaEmpresa: number;
  investimentosAtivos: number;
  saldoRealizado: number;
  saldoProjetado: number;
  quantidadeReceitas: number;
  quantidadeDespesas: number;
}

export interface OrionAnswer {
  texto: string;
  tipo: 'dado' | 'projecao' | 'orientacao';
  fontes: string[];
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function noMes(data: string | null, competencia: string) {
  return Boolean(data?.startsWith(competencia));
}

export const orionService = {
  async carregarSnapshot(): Promise<OrionSnapshot> {
    const competencia = new Date().toISOString().slice(0, 7);
    const [receitas, despesas, reserva, investimentos] = await Promise.all([
      receitasService.listar(),
      despesasService.listar(),
      reservaEmpresaService.listar(),
      investimentosService.listar(),
    ]);
    const receitasMes = receitas.filter((item) => noMes(item.data_fato_gerador, competencia) && item.status !== 'cancelado');
    const despesasMes = despesas.filter((item) => noMes(item.competencia, competencia) && item.status !== 'cancelado');
    const receitasPrevistas = receitasMes.reduce((soma, item) => soma + item.valor_bruto, 0);
    const receitasRealizadas = receitasMes.filter((item) => item.status === 'recebido').reduce((soma, item) => soma + item.valor_bruto, 0);
    const despesasPrevistas = despesasMes.reduce((soma, item) => soma + item.valor, 0);
    const despesasPagas = despesasMes.filter((item) => item.status === 'pago').reduce((soma, item) => soma + item.valor, 0);
    const tributosProvisionados = receitasMes.reduce((soma, item) => soma + (item.valor_bruto * (item.aliquota_aplicada ?? 0)) / 100, 0);
    const reservaEmpresa = reservaEmpresaService.calcularSaldo(reserva);
    const investimentosAtivos = investimentos.filter((item) => item.investidor_tipo === 'empresa' && item.status === 'ativo').reduce((soma, item) => soma + item.valor, 0);
    return {
      competencia,
      receitasPrevistas,
      receitasRealizadas,
      despesasPrevistas,
      despesasPagas,
      tributosProvisionados,
      reservaEmpresa,
      investimentosAtivos,
      saldoRealizado: receitasRealizadas - despesasPagas - tributosProvisionados,
      saldoProjetado: receitasPrevistas - despesasPrevistas - tributosProvisionados,
      quantidadeReceitas: receitasMes.length,
      quantidadeDespesas: despesasMes.length,
    };
  },

  responderLocal(pergunta: string, dados: OrionSnapshot): OrionAnswer {
    const texto = pergunta.toLocaleLowerCase('pt-BR');
    const fontes = [`${dados.quantidadeReceitas} receitas`, `${dados.quantidadeDespesas} despesas`, `competência ${dados.competencia}`];
    if (texto.includes('invest') || texto.includes('reserva') || texto.includes('aplicar')) {
      const comprometido = Math.max(0, dados.despesasPrevistas + dados.tributosProvisionados - dados.receitasRealizadas);
      const disponivel = Math.max(0, dados.reservaEmpresa - comprometido);
      return { tipo: 'orientacao', fontes: [...fontes, 'reserva da empresa'], texto: `A empresa possui ${moeda.format(dados.reservaEmpresa)} em reserva. Considerando ${moeda.format(comprometido)} de compromissos ainda não cobertos pelas receitas realizadas, o capital preliminarmente disponível é ${moeda.format(disponivel)}. Antes de aplicar, preserve caixa para impostos e operação. Para esse capital, compare alternativas empresariais pelo risco, liquidez, prazo de resgate e rentabilidade líquida. Esta é uma orientação de gestão de caixa, não uma recomendação de compra de ativo.` };
    }
    if (texto.includes('retir') || texto.includes('sócio') || texto.includes('socio')) {
      const margem = Math.max(0, dados.saldoProjetado);
      return { tipo: 'projecao', fontes, texto: `O resultado projetado do mês é ${moeda.format(dados.saldoProjetado)}. Uma retirada deve respeitar impostos, despesas pendentes e a reserva mínima da empresa. Como limite inicial de análise, há ${moeda.format(margem)} de resultado projetado positivo, mas a decisão precisa considerar o calendário de caixa dos próximos meses.` };
    }
    if (texto.includes('despesa') || texto.includes('custo') || texto.includes('gasto')) {
      return { tipo: 'dado', fontes, texto: `As despesas previstas no mês somam ${moeda.format(dados.despesasPrevistas)}, sendo ${moeda.format(dados.despesasPagas)} já realizadas. O valor ainda provisionado é ${moeda.format(Math.max(0, dados.despesasPrevistas - dados.despesasPagas))}.` };
    }
    if (texto.includes('imposto') || texto.includes('tribut')) {
      return { tipo: 'dado', fontes, texto: `Os tributos estimados sobre as receitas da competência somam ${moeda.format(dados.tributosProvisionados)}. Esse valor deve permanecer separado do capital considerado disponível.` };
    }
    return { tipo: 'dado', fontes, texto: `Na competência ${dados.competencia}, há ${moeda.format(dados.receitasPrevistas)} em receitas previstas e ${moeda.format(dados.despesasPrevistas)} em despesas. O resultado realizado é ${moeda.format(dados.saldoRealizado)} e o resultado projetado é ${moeda.format(dados.saldoProjetado)}. A reserva atual da empresa é ${moeda.format(dados.reservaEmpresa)}.` };
  },

  async perguntar(pergunta: string, dados: OrionSnapshot): Promise<OrionAnswer> {
    const local = this.responderLocal(pergunta, dados);
    try {
      const resposta = await fetch('/api/orion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pergunta, dados, respostaCalculada: local.texto }) });
      if (!resposta.ok) return local;
      const json = await resposta.json() as { texto?: string };
      return json.texto ? { ...local, texto: json.texto } : local;
    } catch {
      return local;
    }
  },
};
