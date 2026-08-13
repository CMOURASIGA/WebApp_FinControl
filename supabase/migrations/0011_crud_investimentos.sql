-- CRUD auditável de investimentos, sem exclusão física.
begin;

alter table public.investimentos add column if not exists status text not null default 'ativo';
alter table public.investimentos add column if not exists updated_at timestamptz not null default now();
alter table public.investimentos drop constraint if exists investimentos_status_check;
alter table public.investimentos add constraint investimentos_status_check check(status in ('ativo','cancelado'));

drop trigger if exists trg_investimentos_updated_at on public.investimentos;
create trigger trg_investimentos_updated_at before update on public.investimentos
for each row execute function public.set_updated_at();

create table if not exists public.investimento_historico(
  id uuid primary key default gen_random_uuid(),
  investimento_id uuid not null references public.investimentos(id),
  acao text not null check(acao in ('edicao','cancelamento','reativacao')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  motivo text not null,
  executado_por uuid references public.profiles(id),
  executado_em timestamptz not null default now()
);
create index if not exists investimento_historico_registro_idx
  on public.investimento_historico(investimento_id,executado_em desc);
alter table public.investimento_historico enable row level security;
drop policy if exists investimento_historico_select on public.investimento_historico;
drop policy if exists investimento_historico_insert on public.investimento_historico;
create policy investimento_historico_select on public.investimento_historico for select to authenticated
  using((select private.usuario_ativo()));
create policy investimento_historico_insert on public.investimento_historico for insert to authenticated
  with check((select private.pode_operar_financeiro()));
grant select,insert on public.investimento_historico to authenticated;

create or replace function public.editar_investimento(
  p_id uuid,p_investidor_tipo text,p_socio_id uuid,p_projeto_id uuid,p_valor numeric,p_data date,p_tipo text,
  p_descricao text,p_retorno_esperado numeric,p_prazo_esperado_meses integer,p_roi_meta_percentual numeric,
  p_considerado_no_resultado boolean,p_motivo text
) returns public.investimentos language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.investimentos;n public.investimentos;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão'; end if;
  if coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo da alteração'; end if;
  if p_investidor_tipo not in ('socio','empresa') then raise exception 'Tipo de investidor inválido'; end if;
  if p_investidor_tipo='socio' and p_socio_id is null then raise exception 'Selecione o sócio investidor'; end if;
  select * into a from public.investimentos where id=p_id for update;
  if not found then raise exception 'Investimento não encontrado'; end if;
  if a.status<>'ativo' then raise exception 'Somente investimento ativo pode ser editado'; end if;
  update public.investimentos set investidor_tipo=p_investidor_tipo,
    socio_id=case when p_investidor_tipo='socio' then p_socio_id else null end,
    projeto_id=p_projeto_id,valor=p_valor,data=p_data,tipo=trim(p_tipo),descricao=nullif(trim(p_descricao),''),
    retorno_esperado=p_retorno_esperado,prazo_esperado_meses=p_prazo_esperado_meses,
    roi_meta_percentual=p_roi_meta_percentual,considerado_no_resultado=p_considerado_no_resultado
  where id=p_id returning * into n;
  insert into public.investimento_historico(investimento_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(p_id,'edicao',to_jsonb(a),to_jsonb(n),trim(p_motivo),auth.uid());
  return n;
end;$$;

create or replace function public.alterar_status_investimento(p_id uuid,p_acao text,p_motivo text)
returns public.investimentos language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.investimentos;n public.investimentos;s text;ac text;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão'; end if;
  if coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo'; end if;
  select * into a from public.investimentos where id=p_id for update;
  if not found then raise exception 'Investimento não encontrado'; end if;
  if p_acao='cancelar' and a.status='ativo' then s:='cancelado';ac:='cancelamento';
  elsif p_acao='reativar' and a.status='cancelado' then s:='ativo';ac:='reativacao';
  else raise exception 'Ação incompatível com o status atual'; end if;
  update public.investimentos set status=s where id=p_id returning * into n;
  insert into public.investimento_historico(investimento_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(p_id,ac,to_jsonb(a),to_jsonb(n),trim(p_motivo),auth.uid());
  return n;
end;$$;

create or replace function public.bloquear_exclusao_investimento() returns trigger language plpgsql
set search_path=public,pg_temp as $$ begin raise exception 'Investimentos não podem ser excluídos. Utilize o cancelamento auditável.'; end;$$;
drop trigger if exists trg_bloquear_exclusao_investimento on public.investimentos;
create trigger trg_bloquear_exclusao_investimento before delete on public.investimentos
for each row execute function public.bloquear_exclusao_investimento();

revoke all on function public.editar_investimento(uuid,text,uuid,uuid,numeric,date,text,text,numeric,integer,numeric,boolean,text),
  public.alterar_status_investimento(uuid,text,text) from public,anon;
grant execute on function public.editar_investimento(uuid,text,uuid,uuid,numeric,date,text,text,numeric,integer,numeric,boolean,text),
  public.alterar_status_investimento(uuid,text,text) to authenticated;
revoke all on function public.bloquear_exclusao_investimento() from public,anon,authenticated;

commit;
