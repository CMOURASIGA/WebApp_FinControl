-- CRUD auditável de custos e despesas, sem exclusão física.
begin;

alter table public.custos_projeto add column if not exists status text not null default 'provisionado';
alter table public.custos_projeto add column if not exists data_pagamento date;
alter table public.custos_projeto add column if not exists updated_at timestamptz not null default now();
alter table public.custos_projeto drop constraint if exists custos_projeto_status_check;
alter table public.custos_projeto add constraint custos_projeto_status_check check(status in ('provisionado','pago','cancelado'));
alter table public.despesas drop constraint if exists despesas_status_check;
alter table public.despesas add constraint despesas_status_check check(status in ('provisionado','pago','cancelado'));

drop trigger if exists trg_custos_projeto_updated_at on public.custos_projeto;
create trigger trg_custos_projeto_updated_at before update on public.custos_projeto for each row execute function public.set_updated_at();

create table if not exists public.financeiro_historico(
 id uuid primary key default gen_random_uuid(), entidade text not null check(entidade in ('custo_projeto','despesa')),
 registro_id uuid not null, acao text not null check(acao in ('edicao','cancelamento','pagamento','estorno_pagamento','reativacao')),
 dados_anteriores jsonb, dados_novos jsonb, motivo text, executado_por uuid references public.profiles(id), executado_em timestamptz not null default now()
);
create index if not exists financeiro_historico_registro_idx on public.financeiro_historico(entidade,registro_id,executado_em desc);
alter table public.financeiro_historico enable row level security;
drop policy if exists financeiro_historico_select on public.financeiro_historico;
drop policy if exists financeiro_historico_insert on public.financeiro_historico;
create policy financeiro_historico_select on public.financeiro_historico for select to authenticated using((select private.usuario_ativo()));
create policy financeiro_historico_insert on public.financeiro_historico for insert to authenticated with check((select private.pode_operar_financeiro()));
grant select,insert on public.financeiro_historico to authenticated;

create or replace function public.bloquear_custo_despesa_fechada() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_data date;
begin
 if tg_table_name='despesas' then v_data:=old.competencia;
 elsif tg_table_name='custos_projeto' then v_data:=old.data;
 else raise exception 'Tabela não suportada pelo bloqueio de competência: %',tg_table_name;
 end if;
 if private.competencia_fechada(v_data) then raise exception 'Competência fechada: o lançamento não pode ser alterado.'; end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
drop trigger if exists trg_bloquear_custo_fechado on public.custos_projeto;
create trigger trg_bloquear_custo_fechado before update or delete on public.custos_projeto for each row execute function public.bloquear_custo_despesa_fechada();
drop trigger if exists trg_bloquear_despesa_fechada on public.despesas;
create trigger trg_bloquear_despesa_fechada before update or delete on public.despesas for each row execute function public.bloquear_custo_despesa_fechada();

create or replace function public.editar_custo_projeto(p_id uuid,p_descricao text,p_categoria text,p_valor numeric,p_data date,p_motivo text)
returns public.custos_projeto language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.custos_projeto;n public.custos_projeto;begin
 if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão';end if;
 select * into a from public.custos_projeto where id=p_id for update;if not found then raise exception 'Custo não encontrado';end if;
 if a.status<>'provisionado' then raise exception 'Somente custo provisionado pode ser editado';end if;
 if coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo';end if;
 if private.competencia_fechada(p_data) then raise exception 'A nova data pertence a competência fechada';end if;
 update public.custos_projeto set descricao=trim(p_descricao),categoria=trim(p_categoria),valor=p_valor,data=p_data where id=p_id returning * into n;
 insert into public.financeiro_historico(entidade,registro_id,acao,dados_anteriores,dados_novos,motivo,executado_por) values('custo_projeto',p_id,'edicao',to_jsonb(a),to_jsonb(n),p_motivo,auth.uid());return n;end;$$;

create or replace function public.editar_despesa(p_id uuid,p_categoria text,p_tipo text,p_descricao text,p_valor numeric,p_projeto_id uuid,p_competencia date,p_data_vencimento date,p_motivo text)
returns public.despesas language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.despesas;n public.despesas;begin
 if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão';end if;
 select * into a from public.despesas where id=p_id for update;if not found then raise exception 'Despesa não encontrada';end if;
 if a.status<>'provisionado' then raise exception 'Somente despesa provisionada pode ser editada';end if;
 if coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo';end if;
 if private.competencia_fechada(p_competencia) then raise exception 'A nova competência está fechada';end if;
 update public.despesas set categoria=trim(p_categoria),tipo=p_tipo,descricao=trim(p_descricao),valor=p_valor,projeto_id=p_projeto_id,competencia=p_competencia,data_vencimento=p_data_vencimento where id=p_id returning * into n;
 insert into public.financeiro_historico(entidade,registro_id,acao,dados_anteriores,dados_novos,motivo,executado_por) values('despesa',p_id,'edicao',to_jsonb(a),to_jsonb(n),p_motivo,auth.uid());return n;end;$$;

create or replace function public.alterar_status_custo(p_id uuid,p_acao text,p_data date,p_motivo text default null) returns public.custos_projeto language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.custos_projeto;n public.custos_projeto;s text;ac text;begin
 if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão';end if;select * into a from public.custos_projeto where id=p_id for update;if not found then raise exception 'Custo não encontrado';end if;
 if (p_acao='pagar' and a.status<>'provisionado') or (p_acao='estornar' and a.status<>'pago') or (p_acao='cancelar' and a.status<>'provisionado') or (p_acao='reativar' and a.status<>'cancelado') then raise exception 'Ação incompatível com o status atual do custo';end if;
 case p_acao when 'pagar' then s:='pago';ac:='pagamento';when 'estornar' then s:='provisionado';ac:='estorno_pagamento';when 'cancelar' then s:='cancelado';ac:='cancelamento';when 'reativar' then s:='provisionado';ac:='reativacao';else raise exception 'Ação inválida';end case;
 if p_acao<>'pagar' and coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo';end if;
 update public.custos_projeto set status=s,data_pagamento=case when p_acao='pagar' then p_data else null end where id=p_id returning * into n;
 insert into public.financeiro_historico(entidade,registro_id,acao,dados_anteriores,dados_novos,motivo,executado_por) values('custo_projeto',p_id,ac,to_jsonb(a),to_jsonb(n),p_motivo,auth.uid());return n;end;$$;

create or replace function public.alterar_status_despesa(p_id uuid,p_acao text,p_data date,p_motivo text default null) returns public.despesas language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.despesas;n public.despesas;s text;ac text;begin
 if not private.pode_operar_financeiro() then raise exception 'Usuário sem permissão';end if;select * into a from public.despesas where id=p_id for update;if not found then raise exception 'Despesa não encontrada';end if;
 if (p_acao='pagar' and a.status<>'provisionado') or (p_acao='estornar' and a.status<>'pago') or (p_acao='cancelar' and a.status<>'provisionado') or (p_acao='reativar' and a.status<>'cancelado') then raise exception 'Ação incompatível com o status atual da despesa';end if;
 case p_acao when 'pagar' then s:='pago';ac:='pagamento';when 'estornar' then s:='provisionado';ac:='estorno_pagamento';when 'cancelar' then s:='cancelado';ac:='cancelamento';when 'reativar' then s:='provisionado';ac:='reativacao';else raise exception 'Ação inválida';end case;
 if p_acao<>'pagar' and coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo';end if;
 update public.despesas set status=s,data_pagamento=case when p_acao='pagar' then p_data else null end where id=p_id returning * into n;
 insert into public.financeiro_historico(entidade,registro_id,acao,dados_anteriores,dados_novos,motivo,executado_por) values('despesa',p_id,ac,to_jsonb(a),to_jsonb(n),p_motivo,auth.uid());return n;end;$$;

revoke all on function public.editar_custo_projeto(uuid,text,text,numeric,date,text),public.editar_despesa(uuid,text,text,text,numeric,uuid,date,date,text),public.alterar_status_custo(uuid,text,date,text),public.alterar_status_despesa(uuid,text,date,text) from public,anon;
grant execute on function public.editar_custo_projeto(uuid,text,text,numeric,date,text),public.editar_despesa(uuid,text,text,text,numeric,uuid,date,date,text),public.alterar_status_custo(uuid,text,date,text),public.alterar_status_despesa(uuid,text,date,text) to authenticated;
revoke all on function public.bloquear_custo_despesa_fechada() from public,anon,authenticated;
commit;
