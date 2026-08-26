-- =====================================================================
-- Infraestrutura mínima da Orion V1 (ver docs/03-ai/ORION_SPEC.md):
-- tabela de auditoria de uso. Nenhuma tabela de conversa é criada
-- nesta migration — o histórico da conversa é mantido só no cliente
-- (estado do React), por decisão de escopo da V1: é "histórico
-- conversacional temporário", não dado que precise sobreviver a um
-- reload nem ser consultável pela própria Orion como fonte de verdade
-- (ela sempre relê os dados financeiros pelas tools, nunca da memória).
--
-- A auditoria é gravada pela Edge Function usando a service role key
-- (nunca pelo cliente autenticado) — por isso não há policy de insert
-- para 'authenticated': a única forma de gravar é o backend, que
-- ignora RLS. Consulta (select) é só para quem administra a operação.
-- =====================================================================

begin;

create table if not exists public.orion_auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  papel text,
  competencia date,
  tool text,
  status text not null check (status in ('sucesso', 'erro', 'bloqueado')),
  erro text,
  duracao_ms integer,
  tokens_entrada integer,
  tokens_saida integer,
  modelo text,
  criado_em timestamptz not null default now()
);

comment on table public.orion_auditoria is
  'Log de uso da Orion (Fase 4B). Nunca grava a mensagem do usuário nem a resposta do modelo — só metadados de uso, para auditoria e rate limit. Nenhum segredo (API key) é gravado aqui.';

create index if not exists orion_auditoria_user_criado_idx
  on public.orion_auditoria (user_id, criado_em desc);

alter table public.orion_auditoria enable row level security;

drop policy if exists orion_auditoria_select on public.orion_auditoria;
create policy orion_auditoria_select on public.orion_auditoria for select to authenticated
  using ((select private.eh_admin()));

-- Sem policy de insert/update/delete para authenticated/anon: só a
-- service role (usada exclusivamente pela Edge Function) grava aqui,
-- e service role sempre ignora RLS.
revoke all on public.orion_auditoria from anon;
grant select on public.orion_auditoria to authenticated;

commit;
