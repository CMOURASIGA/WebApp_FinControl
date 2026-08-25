-- =====================================================================
-- Teste de isolamento de RLS: conta corrente societária
-- (supabase/migrations/0012_protecao_conta_corrente_socio.sql)
--
-- COMO RODAR
-- Pré-requisito: migrations 0001..0012 já aplicadas no projeto (local
-- via `supabase start` + `supabase db reset`, ou num projeto de
-- homologação real).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0012_conta_corrente_isolamento.sql
--
-- ou cole o conteúdo no SQL Editor do Supabase Studio.
--
-- O script roda tudo dentro de uma transação e termina com ROLLBACK:
-- não deixa nenhum dado de teste na base, mesmo que alguma asserção
-- falhe (falha = a transação levanta EXCEPTION, o que também desfaz
-- tudo).
--
-- Cobre os 5 cenários pedidos na validação da Fase 1:
--   1. admin acessando dados societários (todos);
--   2. financeiro acessando conforme regra definida (todos);
--   3. sócio A acessando seus próprios dados;
--   4. sócio A NÃO acessando dados do sócio B;
--   5. consulta sem acesso a conta corrente individual (nenhum).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Fixtures: 5 personas de auth.users/profiles + 2 sócios com conta
-- corrente. IDs fixos (não colidem com dados reais por serem UUIDs
-- fixos de teste).
-- ---------------------------------------------------------------------
do $$
declare
  v_admin       uuid := '00000000-0000-0000-0000-0000000000a1';
  v_financeiro  uuid := '00000000-0000-0000-0000-0000000000a2';
  v_socio_a_usr uuid := '00000000-0000-0000-0000-0000000000a3';
  v_socio_b_usr uuid := '00000000-0000-0000-0000-0000000000a4';
  v_consulta    uuid := '00000000-0000-0000-0000-0000000000a5';
  v_socio_a     uuid := '00000000-0000-0000-0000-0000000000b1';
  v_socio_b     uuid := '00000000-0000-0000-0000-0000000000b2';
begin
  -- auth.users mínimo (Supabase exige e-mail único e não nulo).
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values
    (v_admin,      'teste-admin@rls.local',      '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_financeiro, 'teste-financeiro@rls.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_socio_a_usr,'teste-socio-a@rls.local',    '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_socio_b_usr,'teste-socio-b@rls.local',    '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_consulta,   'teste-consulta@rls.local',   '', now(), now(), now(), 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  -- profiles (o trigger handle_new_user já teria criado como
  -- 'consulta'/inativo; sobrescrevemos explicitamente para o teste).
  insert into public.profiles (id, nome, papel, ativo)
  values
    (v_admin,      'Teste Admin',      'admin',      true),
    (v_financeiro, 'Teste Financeiro', 'financeiro', true),
    (v_socio_a_usr,'Teste Socio A',    'socio',      true),
    (v_socio_b_usr,'Teste Socio B',    'socio',      true),
    (v_consulta,   'Teste Consulta',   'consulta',   true)
  on conflict (id) do update set papel = excluded.papel, ativo = excluded.ativo;

  -- socios: A e B ligados aos respectivos logins via profile_id
  -- (o vínculo real usado pela nova policy).
  insert into public.socios (id, profile_id, nome, tipo, ativo)
  values
    (v_socio_a, v_socio_a_usr, 'Socio A (fixture)', 'socio', true),
    (v_socio_b, v_socio_b_usr, 'Socio B (fixture)', 'socio', true)
  on conflict (id) do update set profile_id = excluded.profile_id;

  -- conta corrente: 1 lançamento para cada sócio.
  insert into public.socio_lancamentos (socio_id, tipo, valor, data, descricao, created_by)
  values
    (v_socio_a, 'credito_resultado', 1000, current_date, 'fixture teste RLS - A', v_admin),
    (v_socio_b, 'credito_resultado', 2000, current_date, 'fixture teste RLS - B', v_admin);
end $$;

-- ---------------------------------------------------------------------
-- Helper de asserção: falha (RAISE EXCEPTION, desfazendo a transação)
-- se a contagem observada não bater com a esperada.
-- ---------------------------------------------------------------------
create or replace function pg_temp.assert_count(p_rotulo text, p_esperado bigint, p_obtido bigint)
returns void language plpgsql as $$
begin
  if p_obtido <> p_esperado then
    raise exception 'FALHOU: % — esperado %, obtido %', p_rotulo, p_esperado, p_obtido;
  else
    raise notice 'OK: % (% linha(s))', p_rotulo, p_obtido;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Cada bloco simula uma persona autenticada (role authenticated +
-- claim sub = id do profile) e consulta socio_lancamentos apenas dos
-- dois sócios de teste.
-- ---------------------------------------------------------------------

-- 1. admin -> vê os dois lançamentos de teste.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.assert_count(
  'admin ve todos os lancamentos de teste',
  2,
  (select count(*) from public.socio_lancamentos
     where socio_id in ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2'))
);
reset role;

-- 2. financeiro -> vê os dois (acesso operacional igual ao que já tem
--    para gravar retirada/fechamento de qualquer sócio).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.assert_count(
  'financeiro ve todos os lancamentos de teste',
  2,
  (select count(*) from public.socio_lancamentos
     where socio_id in ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2'))
);
reset role;

-- 3. socio A -> vê somente o próprio lançamento.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select pg_temp.assert_count(
  'socio A ve o proprio lancamento',
  1,
  (select count(*) from public.socio_lancamentos where socio_id = '00000000-0000-0000-0000-0000000000b1')
);

-- 4. socio A -> NÃO vê o lançamento do sócio B (mesma sessão/claim do bloco 3).
select pg_temp.assert_count(
  'socio A NAO ve o lancamento do socio B',
  0,
  (select count(*) from public.socio_lancamentos where socio_id = '00000000-0000-0000-0000-0000000000b2')
);
reset role;

-- 5. consulta -> não vê nenhum lançamento de conta corrente.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select pg_temp.assert_count(
  'consulta nao ve nenhuma conta corrente',
  0,
  (select count(*) from public.socio_lancamentos
     where socio_id in ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2'))
);
reset role;

-- Nada é persistido — os fixtures e o helper de asserção somem daqui.
rollback;
