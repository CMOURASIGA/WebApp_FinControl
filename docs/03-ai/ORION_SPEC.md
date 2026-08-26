# Orion - Especificação da IA do 7Finance

## 1. Papel

Orion é a IA especialista financeira do 7Finance.

Ela deve atuar como camada de interpretação, análise e orientação sobre os dados financeiros já autorizados ao usuário. Orion não substitui regras financeiras determinísticas nem grava números por conta própria sem uma ação explícita e autorizada.

## 2. Diagnóstico atual

Na branch `main` auditada não existe implementação da Orion, serviço de IA, rota segura para provedor LLM, chat, armazenamento de conversas ou dependência de SDK de IA.

Portanto, Orion deve ser considerada **não implementada** no estado atual.

## 3. Objetivos

Orion deve conseguir:

- explicar indicadores do dashboard;
- responder perguntas sobre receitas, custos, despesas e resultado;
- comparar competências;
- identificar desvios entre previsto e realizado;
- explicar variação de margem;
- analisar MRR, ARR e ticket médio;
- identificar contas vencidas e riscos de caixa;
- analisar ROI e payback;
- apoiar fechamento mensal;
- explicar composição de DRE;
- simular cenários usando o motor determinístico do 7Finance;
- sugerir onde investigar, sem inventar dados.

## 4. Princípio de segurança

Orion deve receber somente dados que o usuário autenticado já tenha permissão para consultar.

Nunca enviar ao modelo:

- service role key;
- credenciais Supabase;
- dados de outro tenant;
- informações fora das capabilities do usuário;
- dumps completos desnecessários do banco.

## 5. Arquitetura recomendada

### Camada de UI

- `OrionLauncher`: botão persistente no shell.
- `OrionPanel`: painel lateral de conversa.
- contexto da rota atual;
- sugestões de perguntas por tela;
- histórico da conversa;
- indicação clara quando a resposta é análise e quando é cálculo determinístico.

### Backend seguro

Como o projeto atual é Vite SPA, a chamada ao provedor de IA não deve ocorrer diretamente do browser.

Usar uma das abordagens:

1. Supabase Edge Function, preferencial no stack atual; ou
2. API server-side dedicada futura.

A função deve:

- validar JWT Supabase;
- obter perfil e capabilities;
- resolver tenant;
- executar apenas ferramentas autorizadas;
- montar contexto mínimo;
- chamar o provedor LLM usando segredo server-side;
- registrar métricas/auditoria de uso.

## 6. Ferramentas da Orion

Orion não deve ganhar acesso SQL arbitrário.

Criar ferramentas controladas, por exemplo:

- `get_dashboard_summary(competencia)`
- `get_dre(competencia, modo)`
- `get_revenue_summary(periodo)`
- `get_expense_summary(periodo, filtros)`
- `get_overdue_items(data)`
- `get_project_financials(projeto_id, periodo)`
- `get_investment_roi(projeto_id)`
- `get_recurring_revenue_metrics(data)`
- `simulate_financial_scenario(input)`
- `get_close_readiness(competencia)`

Cada ferramenta deve aplicar autorização antes da consulta.

## 7. Operações de escrita

Fase inicial da Orion: somente leitura e simulação.

Escrita pode ser adicionada depois, sempre com fluxo:

1. Orion propõe ação.
2. Sistema mostra dados exatos que serão alterados.
3. Usuário confirma em modal central.
4. Backend repete autorização.
5. Operação é gravada.
6. Auditoria registra usuário, ação, antes/depois e origem `orion`.

Orion nunca deve fechar mês, pagar despesa, cancelar lançamento ou registrar retirada sem confirmação explícita.

## 8. Contexto por tela

### Dashboard

Orion deve conhecer a competência selecionada e principais KPIs.

Exemplos:

- Por que minha margem caiu?
- Quais despesas mais cresceram?
- Estamos acima do ponto de equilíbrio?

### Projeto

Contexto inclui projeto atual, receitas, custos, despesas, regra econômica e resultado.

### Investimentos

Contexto inclui capital, resultado, ROI, meta e payback.

### Fechamento

Orion pode apontar inconsistências, pendências e explicar a DRE antes do usuário executar o fechamento.

## 9. Memória

Separar:

- histórico conversacional temporário;
- preferências duráveis permitidas;
- dados financeiros, que sempre devem ser consultados novamente da fonte oficial.

A memória da IA nunca pode substituir o banco como fonte de verdade.

## 10. Respostas

Orion deve:

- indicar competência/período usado;
- diferenciar fatos de recomendações;
- informar quando não possui dados suficientes;
- evitar afirmações contábeis ou tributárias como aconselhamento profissional definitivo;
- preferir valores calculados pelas funções do sistema.

## 11. Observabilidade e custo

Registrar:

- usuário;
- tenant;
- timestamp;
- ferramenta usada;
- latência;
- modelo;
- tokens/custo quando disponível;
- sucesso/erro;
- ação de escrita confirmada, quando existir.

Definir limites por usuário/tenant e política de retenção das conversas.

## 12. Critérios de aceite da primeira versão

1. Orion abre globalmente no sistema.
2. Usuário autenticado consegue perguntar sobre dados financeiros autorizados.
3. Nenhuma chave de IA aparece no bundle frontend.
4. Orion consegue explicar os KPIs da competência atual.
5. Orion consulta dados via ferramentas controladas.
6. Simulações usam o `motorCalculo` ou equivalente server-side validado.
7. Não há escrita autônoma.
8. Erros do provedor não quebram o restante do sistema.
9. Existe fallback informando indisponibilidade da IA.
10. Uso é auditável.
