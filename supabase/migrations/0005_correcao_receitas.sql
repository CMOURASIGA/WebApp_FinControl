-- Correção segura de receitas, sem exclusão física e com histórico.
begin;

alter table public.receitas drop constraint if exists receitas_tipo_check;
alter table public.receitas add constraint receitas_tipo_check
  check (tipo in ('pontual', 'recorrente', 'ajuste'));
alter table public.receitas drop constraint if exists receitas_valor_bruto_check;
alter table public.receitas add constraint receitas_valor_bruto_check
  check ((tipo = 'ajuste' and valor_bruto <> 0) or (tipo <> 'ajuste' and valor_bruto >= 0));
alter table public.receitas add column if not exists receita_origem_id uuid references public.receitas(id);

create table if not exists public.receita_historico (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references public.receitas(id),
  acao text not null check (acao in ('edicao','cancelamento','recebimento','estorno_recebimento','ajuste_fechado')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  motivo text,
  executado_por uuid references public.profiles(id),
  executado_em timestamptz not null default now()
);
create index if not exists receita_historico_receita_idx on public.receita_historico(receita_id, executado_em desc);
alter table public.receita_historico enable row level security;
drop policy if exists receita_historico_select on public.receita_historico;
drop policy if exists receita_historico_insert on public.receita_historico;
create policy receita_historico_select on public.receita_historico for select to authenticated using ((select private.usuario_ativo()));
create policy receita_historico_insert on public.receita_historico for insert to authenticated with check ((select private.pode_operar_financeiro()));
grant select, insert on public.receita_historico to authenticated;

alter table public.socio_lancamentos drop constraint if exists socio_lancamentos_tipo_check;
alter table public.socio_lancamentos add constraint socio_lancamentos_tipo_check
  check (tipo in ('credito_resultado','retirada','reembolso','ajuste','debito_ajuste'));

create or replace function private.competencia_fechada(p_data date)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.fechamentos_mensais
    where competencia = date_trunc('month', p_data)::date and status = 'fechado'
  );
$$;
revoke all on function private.competencia_fechada(date) from public, anon;
grant execute on function private.competencia_fechada(date) to authenticated;

create or replace function public.bloquear_receita_fechada()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if private.competencia_fechada(old.data_fato_gerador) then
    if tg_op = 'DELETE' or
       (to_jsonb(new) - array['tributo_status','tributo_pago_em','updated_at']) is distinct from
       (to_jsonb(old) - array['tributo_status','tributo_pago_em','updated_at']) then
      raise exception 'Competência fechada: a receita original é imutável. Gere um ajuste no mês atual.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

create or replace function public.fechar_mes(p_competencia date,p_snapshot jsonb,p_creditos jsonb,p_observacao text default null)
returns public.fechamentos_mensais language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_f public.fechamentos_mensais; item jsonb; v_valor numeric;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão para fechar competência'; end if;
  if date_trunc('month',p_competencia)::date<>p_competencia then raise exception 'Competência deve ser o primeiro dia do mês'; end if;
  insert into public.fechamentos_mensais(competencia,status,fechado_em,fechado_por,snapshot,observacao)
  values(p_competencia,'fechado',now(),auth.uid(),p_snapshot,p_observacao) returning * into v_f;
  for item in select value from jsonb_array_elements(p_creditos) loop
    v_valor := (item->>'valor')::numeric;
    if v_valor=0 then continue; end if;
    insert into public.socio_lancamentos(socio_id,tipo,valor,fechamento_id,data,descricao,created_by)
    values((item->>'socio_id')::uuid,case when v_valor>0 then 'credito_resultado' else 'debito_ajuste' end,
      abs(v_valor),v_f.id,(p_competencia+interval '1 month - 1 day')::date,
      case when v_valor>0 then 'Resultado apurado no fechamento de ' else 'Débito de correção apurado no fechamento de ' end||to_char(p_competencia,'YYYY-MM'),auth.uid());
  end loop;
  return v_f;
end; $$;
drop trigger if exists trg_bloquear_receita_fechada on public.receitas;
create trigger trg_bloquear_receita_fechada before update or delete on public.receitas
for each row execute function public.bloquear_receita_fechada();

create or replace function public.editar_receita(
  p_receita_id uuid, p_descricao text, p_tipo text, p_valor_bruto numeric,
  p_data_prevista date, p_data_fato_gerador date, p_motivo text,
  p_parametro_tributario_id uuid, p_aliquota_aplicada numeric,
  p_regra_distribuicao_id uuid, p_percentual_empresa_aplicado numeric,
  p_split_socios_aplicado jsonb
) returns public.receitas language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_antiga public.receitas; v_nova public.receitas;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão'; end if;
  select * into v_antiga from public.receitas where id = p_receita_id for update;
  if not found then raise exception 'Receita não encontrada'; end if;
  if private.competencia_fechada(v_antiga.data_fato_gerador) then raise exception 'Competência fechada. Use Corrigir valor para gerar ajuste no mês atual.'; end if;
  if v_antiga.status in ('recebido','cancelado') then raise exception 'Receita recebida ou cancelada não pode ser editada. Estorne ou reative primeiro.'; end if;
  if private.competencia_fechada(p_data_fato_gerador) then raise exception 'A nova data pertence a uma competência fechada'; end if;
  update public.receitas set descricao=trim(p_descricao), tipo=p_tipo, valor_bruto=p_valor_bruto,
    data_prevista=p_data_prevista, data_fato_gerador=p_data_fato_gerador,
    parametro_tributario_id=p_parametro_tributario_id, aliquota_aplicada=p_aliquota_aplicada,
    regra_distribuicao_id=p_regra_distribuicao_id, percentual_empresa_aplicado=p_percentual_empresa_aplicado,
    split_socios_aplicado=p_split_socios_aplicado
  where id=p_receita_id returning * into v_nova;
  insert into public.receita_historico(receita_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(p_receita_id,'edicao',to_jsonb(v_antiga),to_jsonb(v_nova),p_motivo,auth.uid());
  return v_nova;
end; $$;

create or replace function public.alterar_status_receita(p_receita_id uuid, p_acao text, p_data date, p_motivo text default null)
returns public.receitas language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_antiga public.receitas; v_nova public.receitas; v_status text; v_acao text;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão'; end if;
  select * into v_antiga from public.receitas where id=p_receita_id for update;
  if not found then raise exception 'Receita não encontrada'; end if;
  if private.competencia_fechada(v_antiga.data_fato_gerador) then raise exception 'Competência fechada. Use Corrigir valor para gerar ajuste.'; end if;
  case p_acao
    when 'receber' then
      if v_antiga.status in ('recebido','cancelado') then raise exception 'Somente receita pendente pode ser recebida'; end if;
      v_status:='recebido'; v_acao:='recebimento';
    when 'estornar_recebimento' then
      if v_antiga.status <> 'recebido' then raise exception 'Somente receita recebida pode ter o recebimento estornado'; end if;
      v_status:='faturado'; v_acao:='estorno_recebimento';
    when 'cancelar' then
      if v_antiga.status in ('recebido','cancelado') then raise exception 'Estorne o recebimento antes de cancelar'; end if;
      v_status:='cancelado'; v_acao:='cancelamento';
    when 'reativar' then
      if v_antiga.status <> 'cancelado' then raise exception 'Somente receita cancelada pode ser reativada'; end if;
      v_status:='previsto'; v_acao:='edicao';
    else raise exception 'Ação inválida';
  end case;
  update public.receitas set status=v_status,
    data_recebimento=case when p_acao='receber' then p_data else null end
  where id=p_receita_id returning * into v_nova;
  insert into public.receita_historico(receita_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(p_receita_id,v_acao,to_jsonb(v_antiga),to_jsonb(v_nova),p_motivo,auth.uid());
  return v_nova;
end; $$;

create or replace function public.corrigir_receita_fechada(p_receita_id uuid, p_valor_correto numeric, p_motivo text)
returns public.receitas language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_original public.receitas; v_ajuste public.receitas; v_delta numeric;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão'; end if;
  select * into v_original from public.receitas where id=p_receita_id;
  if not found then raise exception 'Receita não encontrada'; end if;
  if not private.competencia_fechada(v_original.data_fato_gerador) then raise exception 'A competência está aberta. Edite ou cancele a receita original.'; end if;
  if private.competencia_fechada(current_date) then raise exception 'A competência atual também está fechada. Abra a competência corrente antes de lançar o ajuste.'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Informe o motivo da correção'; end if;
  v_delta := p_valor_correto - v_original.valor_bruto;
  if v_delta = 0 then raise exception 'O valor correto é igual ao valor original'; end if;
  insert into public.receitas(projeto_id,descricao,tipo,valor_bruto,status,data_prevista,data_fato_gerador,data_recebimento,
    parametro_tributario_id,aliquota_aplicada,regra_distribuicao_id,percentual_empresa_aplicado,split_socios_aplicado,
    tributo_status,observacao,created_by,receita_origem_id)
  values(v_original.projeto_id,'Ajuste de '||v_original.descricao,'ajuste',v_delta,'recebido',current_date,current_date,current_date,
    v_original.parametro_tributario_id,v_original.aliquota_aplicada,v_original.regra_distribuicao_id,
    v_original.percentual_empresa_aplicado,v_original.split_socios_aplicado,'provisionado',p_motivo,auth.uid(),v_original.id)
  returning * into v_ajuste;
  insert into public.receita_historico(receita_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(v_original.id,'ajuste_fechado',to_jsonb(v_original),to_jsonb(v_ajuste),p_motivo,auth.uid());
  return v_ajuste;
end; $$;

revoke all on function public.editar_receita(uuid,text,text,numeric,date,date,text,uuid,numeric,uuid,numeric,jsonb) from public,anon;
revoke all on function public.alterar_status_receita(uuid,text,date,text) from public,anon;
revoke all on function public.corrigir_receita_fechada(uuid,numeric,text) from public,anon;
grant execute on function public.editar_receita(uuid,text,text,numeric,date,date,text,uuid,numeric,uuid,numeric,jsonb) to authenticated;
grant execute on function public.alterar_status_receita(uuid,text,date,text) to authenticated;
grant execute on function public.corrigir_receita_fechada(uuid,numeric,text) to authenticated;
grant execute on function public.fechar_mes(date,jsonb,jsonb,text) to authenticated;
revoke all on function public.bloquear_receita_fechada() from public,anon,authenticated;

commit;
