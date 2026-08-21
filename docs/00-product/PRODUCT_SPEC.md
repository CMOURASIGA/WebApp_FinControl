# 7Finance - Product Spec

## 1. Identidade do produto

7Finance é o sistema de gestão financeira empresarial da Consult Services, responsável por consolidar operação financeira, projetos, receitas, custos, despesas, sociedade, investimentos, indicadores, fechamento mensal e inteligência financeira.

O produto deve seguir a mesma família visual, operacional e de governança definida no 7Commander, preservando sua especialização financeira.

IA oficial do produto: **Orion**.

## 2. Objetivo

Permitir que uma empresa acompanhe, registre e analise sua operação financeira com rastreabilidade, regras econômicas parametrizadas e separação entre valores previstos, realizados, comprometidos e distribuíveis.

O sistema deve responder, no mínimo:

- quanto a empresa faturou;
- quanto efetivamente recebeu;
- quanto deve pagar;
- quanto já pagou;
- quanto foi destinado a tributos;
- quanto cada projeto gerou de resultado;
- quanto está retido pela empresa;
- quanto cada sócio possui em conta corrente;
- qual ROI de cada investimento e projeto;
- qual MRR, ARR, ticket médio e ponto de equilíbrio;
- se o mês pode ser fechado com segurança;
- quais riscos e desvios merecem atenção.

## 3. Escopo funcional atual validado

A base atual contém:

1. Dashboard executivo.
2. Projetos e receitas.
3. Custos e despesas.
4. Cadastro e conta corrente de sócios.
5. Investimentos e ROI.
6. Simulador tributário.
7. Fechamento mensal e DRE gerencial.
8. Parâmetros tributários e regras de distribuição por vigência.
9. Receita recorrente com MRR e ARR.
10. White label.
11. Histórico e auditoria de operações críticas em despesas e investimentos.
12. Autenticação Supabase e RLS.

## 4. Regras de negócio obrigatórias

### 4.1 Disponibilidade financeira

Nenhuma receita deve ser considerada distribuível antes de:

1. reconhecimento do recebimento;
2. apuração do tributo aplicável;
3. custos diretos;
4. despesas atribuídas ao projeto;
5. regra de retenção da empresa;
6. fechamento/apuração correspondente quando aplicável.

### 4.2 Distribuição por projeto

A distribuição econômica deve ser calculada por projeto/contrato, nunca diretamente sobre o faturamento consolidado.

### 4.3 Parâmetros por vigência

Alíquota, percentual da empresa e split de sócios não podem ser constantes de aplicação. Devem possuir vigência e histórico.

Cada receita deve preservar snapshot dos parâmetros utilizados no fato gerador.

### 4.4 Nota fiscal

Tributo somente incide sobre receita marcada como sujeita a nota fiscal conforme regra vigente. Retenção na fonte deve reduzir o valor tributário a quitar sem dupla dedução do resultado.

### 4.5 Conta corrente societária

Crédito de resultado é diferente de retirada. A retirada só pode ocorrer se existir saldo disponível e deve ser validada no banco.

### 4.6 Fechamento

Fechamento mensal deve ser transacional, idempotente e auditável. Após fechado, o snapshot financeiro do período não pode ser alterado silenciosamente.

Reabertura futura deve exigir permissão específica, motivo e trilha de auditoria.

## 5. Indicadores obrigatórios

### Dashboard

- Faturamento previsto.
- Faturamento realizado.
- Receita líquida.
- Tributos provisionados.
- Tributos pagos.
- Custos diretos.
- Despesas de projeto.
- Despesas corporativas.
- Resultado líquido.
- Margem líquida.
- Retido pela empresa.
- Reserva da empresa.
- MRR.
- ARR.
- Clientes recorrentes ativos.
- Ticket médio.
- Ponto de equilíbrio.
- Margem de segurança.
- Capital investido.
- ROI consolidado.
- Projetos com investimento.

### Comparações

Todo indicador monetário relevante deve diferenciar quando aplicável:

- previsto;
- realizado;
- vencido;
- comprometido;
- cancelado.

Evitar somas ou fallbacks que misturem conceitos diferentes.

## 6. Módulos

### 6.1 Visão Geral

Painel executivo com leitura rápida, filtros de competência e drill-down para origem dos números.

### 6.2 Projetos e Receitas

Cadastro de projeto/contrato, cliente, origem econômica, responsáveis, receitas previstas e realizadas, custos diretos e regra econômica específica.

### 6.3 Custos e Despesas

Gestão de contas a pagar e custos por projeto, incluindo edição, cancelamento, reativação, pagamento, estorno e histórico.

### 6.4 Sócios

Cadastro societário independente do usuário de acesso. Conta corrente, créditos, retiradas, reembolsos e ajustes.

### 6.5 Investimentos

Aportes da empresa ou sócios, vínculo opcional com projeto, retorno esperado, prazo, meta de ROI, payback, status e histórico.

### 6.6 Simulador

Simulação sem persistência de cenário de receita, tributos, custos, despesas e distribuição.

### 6.7 Fechamento e DRE

Apuração da competência, DRE gerencial, crédito societário, snapshot e histórico de fechamentos.

### 6.8 Parâmetros

Tributação, regras de distribuição, white label e configurações administrativas.

## 7. Não escopo

O 7Finance empresarial não deve armazenar finanças pessoais dos sócios. O produto financeiro pessoal é outro domínio.

## 8. Critérios para considerar o produto funcionalmente pronto

1. Todos os CRUDs essenciais persistem no Supabase.
2. Ações críticas possuem validação no banco, não apenas na interface.
3. Perfis não autorizados não conseguem escrever dados mesmo por chamada direta.
4. Indicadores possuem definição financeira documentada.
5. Fechamento gera resultado reproduzível.
6. White label funciona por cliente/tenant.
7. Orion possui acesso somente aos dados que o usuário pode visualizar.
8. Nenhuma chave de provedor de IA fica exposta no frontend.
9. Há estados de loading, vazio, erro e sucesso nas telas.
10. O produto passa por testes de regressão dos cálculos financeiros principais.
