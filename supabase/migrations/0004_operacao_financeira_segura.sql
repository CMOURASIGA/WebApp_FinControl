-- Consult Services Finance 2027
-- Consolida cadastro independente de socios, permissoes, fechamento
-- idempotente e retirada validada no banco.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  drop constraint if exists profiles_papel_check;
alter table public.profiles
  add constraint profiles_papel_check
  check (papel in ('admin', 'financeiro', 'socio', 'consulta'));

-- O ambiente auditado possui apenas o usuario inicial. Ele passa a
-- administrador para conseguir configurar a operacao.
update public.profiles set papel = 'admin', ativo = true;

create table if not exists public.socios (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  nome text not null check (length(trim(nome)) >= 2),
  cpf text,
  chave_pix text,
  email text,
  telefone text,
  tipo text not null default 'socio' check (tipo in ('socio', 'investidor')),
  data_entrada date not null default current_date,
  data_saida date,
  ativo boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint socios_periodo_valido check (data_saida is null or data_saida >= data_entrada)
);

create unique index if not exists socios_cpf_unico
  on public.socios (regexp_replace(cpf, '\\D', '', 'g'))
  where cpf is not null and trim(cpf) <> '';
create index if not exists socios_ativo_nome_idx on public.socios (ativo, nome);

drop trigger if exists trg_socios_updated_at on public.socios;
create trigger trg_socios_updated_at
before update on public.socios
for each row execute function public.set_updated_at();

-- Migra o unico cadastro atual. Novos socios passam a ser criados pela tela.
insert into public.socios (profile_id, nome, cpf, chave_pix, ativo, created_by)
select p.id, p.nome, p.cpf, p.chave_pix, p.ativo, p.id
from public.profiles p
where not exists (select 1 from public.socios s where s.profile_id = p.id);

-- Novos logins nao recebem acesso automaticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, papel, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    'consulta',
    false
  );
  return new;
end;
$$;

create or replace function private.usuario_ativo()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and ativo
  );
$$;

create or replace function private.pode_operar_financeiro()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and ativo
      and papel in ('admin', 'financeiro')
  );
$$;

create or replace function private.eh_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and ativo and papel = 'admin'
  );
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.usuario_ativo() to authenticated;
grant execute on function private.pode_operar_financeiro() to authenticated;
grant execute on function private.eh_admin() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Relacionamentos financeiros passam a apontar para socios, nao logins.
alter table public.investimentos drop constraint if exists investimentos_socio_id_fkey;
alter table public.investimentos
  add constraint investimentos_socio_id_fkey foreign key (socio_id) references public.socios(id);

alter table public.socio_lancamentos drop constraint if exists socio_lancamentos_socio_id_fkey;
alter table public.socio_lancamentos
  add constraint socio_lancamentos_socio_id_fkey foreign key (socio_id) references public.socios(id);
alter table public.socio_lancamentos
  add column if not exists fechamento_id uuid references public.fechamentos_mensais(id);
alter table public.socio_lancamentos
  add constraint socio_lancamentos_valor_positivo check (valor > 0) not valid;
alter table public.socio_lancamentos validate constraint socio_lancamentos_valor_positivo;
create unique index if not exists socio_credito_fechamento_unico
  on public.socio_lancamentos (fechamento_id, socio_id, tipo)
  where fechamento_id is not null and tipo = 'credito_resultado';

alter table public.projetos
  add column if not exists originador_socio_id uuid references public.socios(id),
  add column if not exists responsavel_comercial_socio_id uuid references public.socios(id),
  add column if not exists responsavel_execucao_socio_id uuid references public.socios(id);

-- Valida a estrutura JSON e a existencia/atividade de cada socio.
create or replace function public.validar_regra_distribuicao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  soma_split numeric := 0;
  quantidade integer := 0;
  distintos integer := 0;
  inexistentes integer := 0;
begin
  if jsonb_typeof(new.split_socios) <> 'array' then
    raise exception 'split_socios deve ser um array';
  end if;

  select
    coalesce(sum((item ->> 'percentual')::numeric), 0),
    count(*),
    count(distinct (item ->> 'socio_id')),
    count(*) filter (where s.id is null or not s.ativo)
  into soma_split, quantidade, distintos, inexistentes
  from jsonb_array_elements(new.split_socios) item
  left join public.socios s
    on s.id = (item ->> 'socio_id')::uuid
  where item ? 'socio_id' and item ? 'percentual';

  if quantidade <> jsonb_array_length(new.split_socios) then
    raise exception 'cada participante precisa de socio_id e percentual';
  end if;
  if quantidade <> distintos then
    raise exception 'um socio nao pode aparecer duas vezes na mesma regra';
  end if;
  if inexistentes > 0 then
    raise exception 'a regra contem socio inexistente ou inativo';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.split_socios) item
    where (item ->> 'percentual')::numeric < 0
       or (item ->> 'percentual')::numeric > 100
  ) then
    raise exception 'percentuais dos socios devem estar entre 0 e 100';
  end if;
  if abs((new.percentual_empresa + soma_split) - 100) > 0.01 then
    raise exception 'percentual da empresa mais socios deve totalizar 100';
  end if;
  return new;
exception when invalid_text_representation then
  raise exception 'socio_id ou percentual invalido na regra de distribuicao';
end;
$$;

-- Fechamento e creditos sao gravados na mesma transacao.
create or replace function public.fechar_mes(
  p_competencia date,
  p_snapshot jsonb,
  p_creditos jsonb,
  p_observacao text default null
)
returns public.fechamentos_mensais
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fechamento public.fechamentos_mensais;
  item jsonb;
begin
  if not private.pode_operar_financeiro() then
    raise exception 'usuario sem permissao para fechar competencia';
  end if;
  if date_trunc('month', p_competencia)::date <> p_competencia then
    raise exception 'competencia deve ser o primeiro dia do mes';
  end if;
  if jsonb_typeof(p_creditos) <> 'array' then
    raise exception 'creditos deve ser um array';
  end if;

  insert into public.fechamentos_mensais
    (competencia, status, fechado_em, fechado_por, snapshot, observacao)
  values
    (p_competencia, 'fechado', now(), auth.uid(), p_snapshot, p_observacao)
  returning * into v_fechamento;

  for item in select value from jsonb_array_elements(p_creditos)
  loop
    if (item ->> 'valor')::numeric <= 0 then
      raise exception 'credito de socio deve ser positivo';
    end if;
    if not exists (
      select 1 from public.socios
      where id = (item ->> 'socio_id')::uuid and ativo
    ) then
      raise exception 'socio inexistente ou inativo no fechamento';
    end if;
    insert into public.socio_lancamentos
      (socio_id, tipo, valor, fechamento_id, data, descricao, created_by)
    values
      ((item ->> 'socio_id')::uuid, 'credito_resultado',
       (item ->> 'valor')::numeric, v_fechamento.id,
       (p_competencia + interval '1 month - 1 day')::date,
       'Resultado apurado no fechamento de ' || to_char(p_competencia, 'YYYY-MM'),
       auth.uid());
  end loop;
  return v_fechamento;
end;
$$;

create or replace function public.registrar_retirada_socio(
  p_socio_id uuid,
  p_valor numeric,
  p_data date,
  p_descricao text default null
)
returns public.socio_lancamentos
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_saldo numeric;
  v_resultado public.socio_lancamentos;
begin
  if not private.pode_operar_financeiro() then
    raise exception 'usuario sem permissao para registrar retirada';
  end if;
  if p_valor <= 0 then raise exception 'valor deve ser maior que zero'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_socio_id::text, 0));
  select coalesce(sum(case when tipo = 'retirada' then -valor else valor end), 0)
    into v_saldo
  from public.socio_lancamentos where socio_id = p_socio_id;
  if p_valor > v_saldo then
    raise exception 'saldo insuficiente. Disponivel: %', v_saldo;
  end if;
  insert into public.socio_lancamentos
    (socio_id, tipo, valor, data, descricao, created_by)
  values (p_socio_id, 'retirada', p_valor, p_data, p_descricao, auth.uid())
  returning * into v_resultado;
  return v_resultado;
end;
$$;

revoke all on function public.fechar_mes(date, jsonb, jsonb, text) from public, anon;
grant execute on function public.fechar_mes(date, jsonb, jsonb, text) to authenticated;
revoke all on function public.registrar_retirada_socio(uuid, numeric, date, text) from public, anon;
grant execute on function public.registrar_retirada_socio(uuid, numeric, date, text) to authenticated;

-- RLS explicita por papel.
alter table public.socios enable row level security;
drop policy if exists socios_select on public.socios;
drop policy if exists socios_insert on public.socios;
drop policy if exists socios_update on public.socios;
create policy socios_select on public.socios for select to authenticated
  using ((select private.usuario_ativo()));
create policy socios_insert on public.socios for insert to authenticated
  with check ((select private.pode_operar_financeiro()));
create policy socios_update on public.socios for update to authenticated
  using ((select private.pode_operar_financeiro()))
  with check ((select private.pode_operar_financeiro()));

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select private.usuario_ativo()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.eh_admin()))
  with check ((select private.eh_admin()));

do $$
declare tabela text;
begin
  foreach tabela in array array[
    'clientes','projetos','parametros_tributarios','regras_distribuicao',
    'receitas','custos_projeto','despesas','investimentos','socio_lancamentos',
    'reserva_empresa_lancamentos','assinaturas','fechamentos_mensais'
  ] loop
    execute format('drop policy if exists %I_select on public.%I', tabela, tabela);
    execute format('drop policy if exists %I_insert on public.%I', tabela, tabela);
    execute format('drop policy if exists %I_update on public.%I', tabela, tabela);
    execute format('drop policy if exists %I_delete on public.%I', tabela, tabela);
    execute format('create policy %I_select on public.%I for select to authenticated using ((select private.usuario_ativo()))', tabela, tabela);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.pode_operar_financeiro()))', tabela, tabela);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.pode_operar_financeiro())) with check ((select private.pode_operar_financeiro()))', tabela, tabela);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update on public.socios to authenticated;
drop function if exists public.is_partner();

commit;
