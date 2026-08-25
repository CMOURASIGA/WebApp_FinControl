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

## Atualização — gap de conta corrente fechado (migration 0012)

O gap #2 desta lista foi corrigido por
`supabase/migrations/0012_protecao_conta_corrente_socio.sql`:

- Modelagem confirmada antes de qualquer alteração: `profiles.id` é 1:1
  com `auth.users.id` (`auth.uid() = profiles.id`), e
  `socios.profile_id uuid unique references profiles(id)` já existia
  desde `0004_operacao_financeira_segura.sql` — vínculo por FK, nunca
  por nome/CPF/e-mail.
- Nova função `private.pode_ver_conta_corrente(p_socio_id uuid)` e nova
  policy `socio_lancamentos_select`: admin e financeiro continuam vendo
  tudo (mesma superfície que já tinham para gravar); um profile com
  `papel = 'socio'` só vê linhas do sócio ligado ao seu `profile_id`;
  `consulta` (e qualquer outro caso) não vê nada.
- Isolamento coberto por `supabase/tests/0012_conta_corrente_isolamento.sql`
  (5 cenários: admin, financeiro, sócio A próprio, sócio A bloqueado em
  dados do sócio B, consulta sem acesso). **Ainda não executado contra
  um banco real** — o 7Finance não tem projeto Supabase próprio
  provisionado nesta data; rodar assim que o projeto existir (ver
  checklist no README, seção "Configurando o Supabase").

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
2. ~~`view_partner_account` não tem contrapartida em RLS~~ — **resolvido**,
   ver "Atualização — gap de conta corrente fechado (migration 0012)"
   acima. Continua em aberto, e fora do escopo de 0012 por decisão
   deliberada, o mesmo tipo de exposição em `socios` (CPF/chave
   PIX/telefone legíveis por qualquer `usuario_ativo()`) e em
   `investimentos.socio_id` — se a operação quiser o mesmo isolamento
   ali, é uma migration separada, no mesmo padrão de
   `pode_ver_conta_corrente`.
3. **`reopen_period` sem RPC.** Não há função de reabertura de
   competência fechada. Antes de expor qualquer botão de "reabrir mês" no
   frontend, é obrigatório criar a RPC com auditoria e motivo, conforme
   `docs/00-product/PRODUCT_SPEC.md` §4.6.

Nenhuma migration antiga foi alterada — `0012` é aditiva. Os gaps
restantes acima são material para a próxima rodada de hardening (Fase
5) ou para o desenho de multiempresa (Fase 6); nenhum deles amplia
acesso além do que já existia antes desta implementação.
