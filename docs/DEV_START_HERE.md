# 7Finance - DEV START HERE

## Objetivo

Este documento orienta a próxima rodada de desenvolvimento do 7Finance a partir da auditoria de 21/08/2026.

## Ordem obrigatória

### Fase 1 - Segurança e autorização

1. Criar camada central de capabilities no frontend.
2. Mapear perfis atuais: admin, financeiro, socio, consulta.
3. Remover verificações de papel espalhadas e migrar para `can(capability)`.
4. Garantir que menu, botões, drawers e chamadas respeitem capabilities.
5. Revisar RLS/RPC para todas as ações críticas.
6. Criar testes de autorização.

Critério de saída: nenhuma operação financeira pode depender apenas de esconder botão.

### Fase 2 - Padronização frontend

1. Criar `Drawer` padrão.
2. Criar `ConfirmModal`.
3. Criar `PageHeader`.
4. Criar `DataTable` e `ResponsiveList`.
5. Criar componentes Loading, Empty, Error e PermissionState.
6. Migrar cadastros curtos abertos para Drawer.
7. Manter modal para ações, avisos, confirmações e histórico curto.
8. Usar página dedicada em fluxos extensos.

Prioridade de migração:

- Despesas.
- Investimentos.
- Sócios.
- Receitas.
- Cliente simples.

Novo Projeto pode permanecer em página dedicada ou drawer largo somente se o formulário não crescer. O detalhe do projeto permanece página.

### Fase 3 - Orion V1

1. Criar endpoint server-side via Supabase Edge Function ou API segura.
2. Nunca chamar provedor LLM diretamente do Vite/browser.
3. Criar `OrionLauncher` no AppLayout.
4. Criar `OrionPanel`.
5. Implementar ferramentas somente leitura.
6. Aplicar capabilities dentro de cada ferramenta.
7. Registrar auditoria/telemetria.
8. Criar fallback quando IA estiver indisponível.

A primeira versão não executa ações financeiras.

### Fase 4 - Qualidade financeira

Criar testes para:

- resolveVigente;
- tributação com e sem nota;
- retenção na fonte;
- resultado por projeto;
- split societário;
- MRR/ARR;
- break-even;
- ROI;
- payback;
- retirada sem saldo;
- fechamento duplicado;
- imutabilidade do snapshot.

### Fase 5 - SaaS / Multiempresa

Não migrar o banco às cegas.

Desenhar e aprovar antes:

- empresas/tenants;
- associação usuário-empresa;
- perfis por empresa;
- empresa_id nas entidades;
- RLS multiempresa;
- white label por empresa;
- integração futura com Identity/Licensing do Consult Hub.

## Arquivos de referência

- `docs/AUDIT_2026-08-21.md`
- `docs/00-product/PRODUCT_SPEC.md`
- `docs/01-architecture/AUTHORIZATION.md`
- `docs/02-design/DESIGN_SYSTEM.md`
- `docs/03-ai/ORION_SPEC.md`

## Regra de implementação

Não alterar regra financeira apenas para facilitar UI.

O motor determinístico e as regras do banco são a fonte de verdade. A Orion interpreta os dados e utiliza funções controladas, mas não substitui o motor de cálculo.

## Definição de pronto desta rodada

- frontend alinhado ao padrão da suíte;
- autorização refletida no frontend e no banco;
- Orion V1 funcional e segura;
- testes dos cálculos críticos;
- documentação atualizada;
- build e typecheck sem erros.