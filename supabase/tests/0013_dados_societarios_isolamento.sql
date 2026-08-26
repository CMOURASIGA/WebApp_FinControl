-- =====================================================================
-- Teste de isolamento de RLS: dados societários individuais
-- (supabase/migrations/0013_protecao_dados_societarios_individuais.sql)
--
-- COMO RODAR
-- Pré-requisito: migrations 0001..0013 já aplicadas.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0013_dados_societarios_isolamento.sql
-- Roda tudo em uma transação com ROLLBACK final — não deixa dado de
-- teste na base, mesmo em caso de falha (RAISE EXCEPTION desfaz tudo).
--
-- Cobre os cenários da Etapa 4A:
--   1. admin lê socios completo (CPF/PIX) de A e B;
--   2. financeiro idem;
--   3. socio A lê a própria linha completa em socios;
--   4. socio A NÃO lê CPF/PIX/e-mail/telefone da linha do socio B;
--   5. consulta NÃO lê nenhuma linha de socios diretamente;
--   6. qualquer perfil ativo lê nome/tipo/ativo de A e B via socios_diretorio;
--   7. socio A lê seus próprios investimentos e os do tipo 'empresa',
--      mas não os do socio B;
--   8. consulta não lê investimento de socio individual, só 'empresa'.
-- =====================================================================

begin;

do $$
declare
  v_admin       uuid := '00000000-0000-0000-0000-0000000000c1';
  v_financeiro  uuid := '00000000-0000-0000-0000-0000000000c2';
  v_socio_a_usr uuid := '00000000-0000-0000-0000-0000000000c3';
  v_socio_b_usr uuid := '00000000-0000-0000-0000-0000000000c4';
  v_consulta    uuid := '00000000-0000-0000-0000-0000000000c5';
  v_socio_a     uuid := '00000000-0000-0000-0000-0000000000d1';
  v_socio_b     uuid := '00000000-0000-0000-0000-0000000000d2';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values
    (v_admin,      'teste-admin-4a@rls.local',      '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_financeiro, 'teste-financeiro-4a@rls.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_socio_a_usr,'teste-socio-a-4a@rls.local',    '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_socio_b_usr,'teste-socio-b-4a@rls.local',    '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_consulta,   'teste-consulta-4a@rls.local',   '', now(), now(), now(), 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into public.profiles (id, nome, papel, ativo)
  values
    (v_admin,      'Teste Admin 4A',      'admin',      true),
    (v_financeiro, 'Teste Financeiro 4A', 'financeiro', true),
    (v_socio_a_usr,'Teste Socio A 4A',    'socio',      true),
    (v_socio_b_usr,'Teste Socio B 4A',    'socio',      true),
    (v_consulta,   'Teste Consulta 4A',   'consulta',   true)
  on conflict (id) do update set papel = excluded.papel, ativo = excluded.ativo;

  insert into public.socios (id, profile_id, nome, cpf, chave_pix, tipo, ativo)
  values
    (v_socio_a, v_socio_a_usr, 'Socio A (fixture 4A)', '111.111.111-11', 'pix-a@teste.local', 'socio', true),
    (v_socio_b, v_socio_b_usr, 'Socio B (fixture 4A)', '222.222.222-22', 'pix-b@teste.local', 'socio', true)
  on conflict (id) do update set profile_id = excluded.profile_id, cpf = excluded.cpf, chave_pix = excluded.chave_pix;

  insert into public.investimentos (investidor_tipo, socio_id, valor, data, tipo, considerado_no_resultado)
  values
    ('socio', v_socio_a, 5000, current_date, 'aporte', false),
    ('socio', v_socio_b, 7000, current_date, 'aporte', false),
    ('empresa', null, 20000, current_date, 'aporte', false);
end $$;

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

-- 1. admin -> le as duas linhas completas de socios (com CPF/PIX).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select pg_temp.assert_count(
  'admin le socios completo (A+B)', 2,
  (select count(*) from public.socios
     where id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2')
       and cpf is not null)
);
reset role;

-- 2. financeiro -> idem.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select pg_temp.assert_count(
  'financeiro le socios completo (A+B)', 2,
  (select count(*) from public.socios
     where id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2')
       and cpf is not null)
);
reset role;

-- 3 e 4. socio A -> le a propria linha completa, NAO le a linha de B.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select pg_temp.assert_count(
  'socio A le a propria linha completa em socios', 1,
  (select count(*) from public.socios where id = '00000000-0000-0000-0000-0000000000d1')
);
select pg_temp.assert_count(
  'socio A NAO le a linha do socio B em socios', 0,
  (select count(*) from public.socios where id = '00000000-0000-0000-0000-0000000000d2')
);
-- 7. socio A -> le o proprio investimento e o de 'empresa', nao o de B.
select pg_temp.assert_count(
  'socio A le o proprio investimento', 1,
  (select count(*) from public.investimentos where socio_id = '00000000-0000-0000-0000-0000000000d1')
);
select pg_temp.assert_count(
  'socio A NAO le o investimento do socio B', 0,
  (select count(*) from public.investimentos where socio_id = '00000000-0000-0000-0000-0000000000d2')
);
select pg_temp.assert_count(
  'socio A le o investimento tipo empresa', 1,
  (select count(*) from public.investimentos where investidor_tipo = 'empresa' and valor = 20000)
);
reset role;

-- 5. consulta -> nao le nenhuma linha de socios diretamente.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
select pg_temp.assert_count(
  'consulta NAO le nenhuma linha de socios', 0,
  (select count(*) from public.socios
     where id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2'))
);
-- 8. consulta -> nao le investimento individual, so 'empresa'.
select pg_temp.assert_count(
  'consulta NAO le investimento de socio individual', 0,
  (select count(*) from public.investimentos where socio_id is not null)
);
select pg_temp.assert_count(
  'consulta le investimento tipo empresa', 1,
  (select count(*) from public.investimentos where investidor_tipo = 'empresa' and valor = 20000)
);
reset role;

-- 6. qualquer perfil ativo (testando com 'consulta', o mais restrito)
-- le nome/tipo/ativo de A e B via socios_diretorio.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
select pg_temp.assert_count(
  'consulta le A e B via socios_diretorio (sem colunas sensiveis)', 2,
  (select count(*) from public.socios_diretorio
     where id in ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2'))
);
reset role;

rollback;
