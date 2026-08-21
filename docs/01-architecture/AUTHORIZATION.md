# 7Finance - Autorização e Perfis

## 1. Objetivo

A autorização deve existir em duas camadas:

1. banco/backend, como fonte definitiva de segurança;
2. frontend, para não exibir ações que o usuário não pode executar.

Ocultar botão não é autorização.

## 2. Perfis base

### admin

Pode administrar operação, parâmetros, usuários, perfis, white label e movimentações financeiras.

### financeiro

Pode operar receitas, custos, despesas, investimentos, retiradas e fechamento conforme capabilities atribuídas, mas não deve administrar identidade/white label ou elevar privilégios sem capability específica.

### socio

Acesso principalmente analítico e societário. O escopo de leitura deve ser definido pela empresa. Não deve herdar escrita financeira automaticamente.

### consulta

Somente leitura das áreas autorizadas.

## 3. Capabilities

A evolução deve abandonar decisões espalhadas como `profile.papel === 'admin'` e adotar capabilities centralizadas.

Capabilities sugeridas:

- `view_dashboard`
- `view_projects`
- `manage_projects`
- `view_revenues`
- `manage_revenues`
- `view_expenses`
- `manage_expenses`
- `mark_expense_paid`
- `reverse_expense_payment`
- `view_partners`
- `manage_partners`
- `view_partner_account`
- `register_partner_withdrawal`
- `view_investments`
- `manage_investments`
- `view_simulator`
- `view_closing`
- `close_period`
- `reopen_period`
- `view_parameters`
- `manage_financial_parameters`
- `manage_brand`
- `manage_users`
- `use_orion`
- `orion_write_actions`

## 4. Frontend

Criar função única:

`can(profile, capability)`

ou hook equivalente:

`useCapabilities()`

Menu, botões, drawers, modais e chamadas de serviço devem consultar essa camada.

Não realizar requests que serão descartados por falta de permissão quando a capability já for conhecida no cliente.

## 5. Banco

RLS e funções RPC devem continuar sendo a barreira definitiva.

A migration atual já cria helpers para usuário ativo, financeiro e admin. A próxima evolução deve mapear as capabilities para regras de banco de forma explícita e testável.

## 6. Multiempresa

Para SaaS/Consult Hub, todas as tabelas de negócio devem possuir tenant/empresa e RLS por tenant.

Nunca depender apenas do `auth.uid()` para isolamento entre empresas.

Modelo mínimo:

- `empresas`
- `usuarios_empresas`
- `perfil_empresa`
- `capabilities`
- `perfil_capabilities`
- `empresa_id` nas entidades financeiras

## 7. Orion

Orion deve obedecer exatamente às mesmas capabilities.

Exemplo: se o usuário não possui `view_expenses`, a ferramenta da Orion não pode retornar despesas mesmo que ele peça em linguagem natural.

## 8. Testes obrigatórios

Para cada capability crítica:

1. usuário autorizado consegue consultar/operar;
2. usuário não autorizado recebe bloqueio na UI;
3. chamada direta ao Supabase/RPC também é bloqueada;
4. usuário de outro tenant nunca obtém o registro;
5. Orion não contorna a permissão.
