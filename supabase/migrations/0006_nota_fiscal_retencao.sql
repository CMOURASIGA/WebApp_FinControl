-- Nota fiscal controla a incidência tributária. Retenção é registrada sem duplicar o imposto.
begin;

alter table public.receitas add column if not exists emite_nota boolean not null default true;
alter table public.receitas add column if not exists tem_retencao boolean not null default false;
alter table public.receitas add column if not exists percentual_retencao numeric(6,3) not null default 0;
alter table public.receitas add column if not exists valor_retido numeric(14,2) not null default 0;

alter table public.receitas drop constraint if exists receitas_nota_fiscal_consistente;
alter table public.receitas add constraint receitas_nota_fiscal_consistente check (
  (emite_nota and percentual_retencao between 0 and 100 and valor_retido >= 0 and
    ((tem_retencao and percentual_retencao > 0) or (not tem_retencao and percentual_retencao = 0 and valor_retido = 0)))
  or
  (not emite_nota and not tem_retencao and percentual_retencao = 0 and valor_retido = 0 and aliquota_aplicada = 0 and parametro_tributario_id is null)
);

create or replace function public.normalizar_fiscal_receita()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not new.emite_nota then
    new.parametro_tributario_id := null;
    new.aliquota_aplicada := 0;
    new.tem_retencao := false;
    new.percentual_retencao := 0;
    new.valor_retido := 0;
  elsif not new.tem_retencao then
    new.percentual_retencao := 0;
    new.valor_retido := 0;
  else
    new.valor_retido := round(new.valor_bruto * new.percentual_retencao / 100, 2);
  end if;
  return new;
end; $$;

drop trigger if exists trg_normalizar_fiscal_receita on public.receitas;
create trigger trg_normalizar_fiscal_receita before insert or update on public.receitas
for each row execute function public.normalizar_fiscal_receita();

drop function if exists public.editar_receita(uuid,text,text,numeric,date,date,text,uuid,numeric,uuid,numeric,jsonb);
create function public.editar_receita(
  p_receita_id uuid, p_descricao text, p_tipo text, p_valor_bruto numeric,
  p_data_prevista date, p_data_fato_gerador date, p_motivo text,
  p_parametro_tributario_id uuid, p_aliquota_aplicada numeric,
  p_regra_distribuicao_id uuid, p_percentual_empresa_aplicado numeric,
  p_split_socios_aplicado jsonb, p_emite_nota boolean,
  p_tem_retencao boolean, p_percentual_retencao numeric
) returns public.receitas language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_antiga public.receitas; v_nova public.receitas;
begin
  if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão'; end if;
  select * into v_antiga from public.receitas where id = p_receita_id for update;
  if not found then raise exception 'Receita não encontrada'; end if;
  if private.competencia_fechada(v_antiga.data_fato_gerador) then raise exception 'Competência fechada. Use Corrigir valor para gerar ajuste no mês atual.'; end if;
  if v_antiga.status in ('recebido','cancelado') then raise exception 'Receita recebida ou cancelada não pode ser editada. Estorne ou reative primeiro.'; end if;
  if private.competencia_fechada(p_data_fato_gerador) then raise exception 'A nova data pertence a uma competência fechada'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Informe o motivo da correção'; end if;
  update public.receitas set descricao=trim(p_descricao), tipo=p_tipo, valor_bruto=p_valor_bruto,
    data_prevista=p_data_prevista, data_fato_gerador=p_data_fato_gerador,
    parametro_tributario_id=case when p_emite_nota then p_parametro_tributario_id else null end,
    aliquota_aplicada=case when p_emite_nota then p_aliquota_aplicada else 0 end,
    regra_distribuicao_id=p_regra_distribuicao_id, percentual_empresa_aplicado=p_percentual_empresa_aplicado,
    split_socios_aplicado=p_split_socios_aplicado, emite_nota=p_emite_nota,
    tem_retencao=p_emite_nota and p_tem_retencao,
    percentual_retencao=case when p_emite_nota and p_tem_retencao then p_percentual_retencao else 0 end
  where id=p_receita_id returning * into v_nova;
  insert into public.receita_historico(receita_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(p_receita_id,'edicao',to_jsonb(v_antiga),to_jsonb(v_nova),p_motivo,auth.uid());
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
    tributo_status,observacao,created_by,receita_origem_id,emite_nota,tem_retencao,percentual_retencao)
  values(v_original.projeto_id,'Ajuste de '||v_original.descricao,'ajuste',v_delta,'recebido',current_date,current_date,current_date,
    v_original.parametro_tributario_id,v_original.aliquota_aplicada,v_original.regra_distribuicao_id,
    v_original.percentual_empresa_aplicado,v_original.split_socios_aplicado,'provisionado',p_motivo,auth.uid(),v_original.id,
    v_original.emite_nota,v_original.tem_retencao,v_original.percentual_retencao)
  returning * into v_ajuste;
  insert into public.receita_historico(receita_id,acao,dados_anteriores,dados_novos,motivo,executado_por)
  values(v_original.id,'ajuste_fechado',to_jsonb(v_original),to_jsonb(v_ajuste),p_motivo,auth.uid());
  return v_ajuste;
end; $$;

revoke all on function public.editar_receita(uuid,text,text,numeric,date,date,text,uuid,numeric,uuid,numeric,jsonb,boolean,boolean,numeric) from public,anon;
grant execute on function public.editar_receita(uuid,text,text,numeric,date,date,text,uuid,numeric,uuid,numeric,jsonb,boolean,boolean,numeric) to authenticated;
revoke all on function public.normalizar_fiscal_receita() from public,anon,authenticated;

comment on column public.receitas.emite_nota is 'Define se a receita possui nota fiscal e, portanto, incidência tributária no sistema.';
comment on column public.receitas.valor_retido is 'Valor retido na fonte. Compõe a quitação do tributo, não uma segunda despesa.';

commit;
