-- Corrige a leitura da data no trigger compartilhado de custos e despesas.
begin;

create or replace function public.bloquear_custo_despesa_fechada()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_data date;
begin
  if tg_table_name = 'despesas' then
    v_data := old.competencia;
  elsif tg_table_name = 'custos_projeto' then
    v_data := old.data;
  else
    raise exception 'Tabela não suportada pelo bloqueio de competência: %', tg_table_name;
  end if;

  if private.competencia_fechada(v_data) then
    raise exception 'Competência fechada: o lançamento não pode ser alterado.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.bloquear_custo_despesa_fechada()
from public, anon, authenticated;

commit;
