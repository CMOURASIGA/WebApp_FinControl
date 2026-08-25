# Validação: capabilities (frontend) x RLS (banco) — Fase 1

Este documento registra a validação pedida na Fase 1 ("Validar se as
policies existentes no Supabase estão coerentes com os perfis e
capabilities documentados"). Referência oficial: `docs/01-architecture/AUTHORIZATION.md`
na branch `docs/7finance-specs`.

## O que existe hoje no banco

`supabase/migrations/0004_operacao_financeira_segura.sql` define três
helpers `security definer`:

- `private.usuario_ativo()` — true se o profile existe e está `ativo`.
- `private.pode_operar_financeiro()` — true se `ativo` e `papel in ('admin','financeiro')`.
- `private.eh_admin()` — true se `ativo` e `papel = 'admin'`.

E aplica, para **todas** as tabelas de negócio (`clientes`, `projetos`,
`parametros_tributarios`, `regras_distribuicao`, `receitas`,
`custos_projeto`, `despesas`, `investimentos`, `socio_lancamentos`,
`reserva_empresa_lancamentos`, `assinaturas`, `fechamentos_mensais`) o
mesmo padrão:

- `select` liberado a qualquer `usuario_ativo()`;
- `insert`/`update` liberados apenas a `pode_operar_financeiro()` (admin/financeiro).

`profiles` tem uma regra à parte: `update` só para `eh_admin()`.

As RPCs `fechar_mes` e `registrar_retirada_socio` também checam
`pode_operar_financeiro()` internamente antes de gravar.

## Coerência com o mapa de capabilities (`src/lib/capabilities.ts`)

| Capability (frontend)                              | Banco hoje                                   | Coerente? |
|-----------------------------------------------------|-----------------------------------------------|-----------|
| `view_*` (dashboard, projects, revenues, expenses, partners, investments, simulator, closing, parameters) | `select` liberado a qualquer `usuario_ativo()` | Sim — todo perfil ativo (admin/financeiro/socio/consulta) pode ler. |
| `manage_projects`, `manage_revenues`, `manage_expenses`, `mark_expense_paid`, `reverse_expense_payment`, `manage_partners`, `register_partner_withdrawal`, `manage_investments`, `close_period`, `manage_financial_parameters` | `insert`/`update` liberado a `pode_operar_financeiro()` (admin+financeiro) | Sim — o frontend concede exatamente a admin+financeiro. |
| `manage_brand` | Não modela `brand`/white label diretamente nesta migration (ver `0007_white_label.sql`); tela usava `papel === 'admin'` no código | Ajustado nesta fase para usar `can('manage_brand')`, hoje restrito a admin — igual ao comportamento anterior. |
| `manage_users` | Não existe tela nem RPC de gestão de usuários/perfis ainda; `profiles_update` já exige `eh_admin()` | Capability reservada para quando a tela existir; RLS já é compatível (admin-only). |
| `reopen_period` | Não existe RPC de reabertura de fechamento | Capability reservada; RLS/RPC de reabertura precisam ser criadas antes de qualquer tela usar isso (ver Fase 3/5). |
| `use_orion` | N/A (Orion não implementada) | Concedida a todos os perfis ativos; cada tool da Orion deverá repetir a checagem de capability granular na Fase 4 (ex.: `get_expense_summary` só roda se o usuário tiver `view_expenses`). |
| `orion_write_actions` | N/A | Não concedida a nenhum perfil nesta fase — Orion V1 é somente leitura. |

## Gaps identificados (não corrigidos nesta fase, por decisão de escopo)

1. **Granularidade única no banco.** A RLS atual não distingue
   `manage_expenses` de `manage_partners` de `manage_investments` — tudo
   cai em `pode_operar_financeiro()`. Ou seja, hoje o banco é *mais
   permissivo* internamente entre si do que a UI sugere (ex.: um usuário
   `financeiro` que só deveria mexer em despesas também consegue gravar em
   sócios via chamada direta, porque a policy é a mesma para as duas
   tabelas). Isso não é uma falha de segurança em si — financeiro já é um
   perfil de confiança operacional segundo o Product Spec — mas é uma
   oportunidade futura: criar uma tabela `perfil_capabilities` e funções
   RLS que leiam capability por capability, como o próprio
   `AUTHORIZATION.md` (seção 6) já aponta para o desenho multiempresa.
   Recomenda-se tratar isso junto da Fase 6 (multiempresa), quando as
   tabelas de capabilities por tenant forem desenhadas de qualquer forma.
2. **`view_partner_account` não tem contrapartida em RLS.** A UI esconde
   saldo/conta corrente de sócios para o perfil `consulta`, mas a RLS de
   `socio_lancamentos` permite `select` a qualquer `usuario_ativo()` —
   ou seja, um `consulta` que chame a tabela diretamente ainda consegue
   ler. Isso é aceitável como comportamento atual (nenhum dado é alterado,
   e o Product Spec não pede reserva estrita ali), mas deve ser
   resolvido com uma policy dedicada se a empresa quiser reservar conta
   corrente de sócios estritamente a admin/financeiro/socio.
3. **`reopen_period` sem RPC.** Não há função de reabertura de
   competência fechada. Antes de expor qualquer botão de "reabrir mês" no
   frontend, é obrigatório criar a RPC com auditoria e motivo, conforme
   `docs/00-product/PRODUCT_SPEC.md` §4.6.

Nenhuma migration foi alterada ou criada nesta fase — a base de dados
permanece exatamente como estava. Os gaps acima são material para a
próxima rodada de hardening (Fase 5) ou para o desenho de multiempresa
(Fase 6), não bloqueiam a entrega da Fase 1 porque nenhum deles amplia
acesso além do que já existia antes desta implementação.
