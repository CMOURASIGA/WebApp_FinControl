begin;

alter table public.investimentos
  add column if not exists retorno_esperado numeric(12,2),
  add column if not exists prazo_esperado_meses integer,
  add column if not exists roi_meta_percentual numeric(8,2),
  add column if not exists considerado_no_resultado boolean not null default false,
  add column if not exists data_encerramento date;

alter table public.investimentos drop constraint if exists investimentos_retorno_esperado_check;
alter table public.investimentos add constraint investimentos_retorno_esperado_check
  check (retorno_esperado is null or retorno_esperado >= 0);
alter table public.investimentos drop constraint if exists investimentos_prazo_esperado_check;
alter table public.investimentos add constraint investimentos_prazo_esperado_check
  check (prazo_esperado_meses is null or prazo_esperado_meses > 0);
alter table public.investimentos drop constraint if exists investimentos_roi_meta_check;
alter table public.investimentos add constraint investimentos_roi_meta_check
  check (roi_meta_percentual is null or roi_meta_percentual >= 0);
alter table public.investimentos drop constraint if exists investimentos_encerramento_check;
alter table public.investimentos add constraint investimentos_encerramento_check
  check (data_encerramento is null or data_encerramento >= data);

create index if not exists investimentos_data_idx on public.investimentos(data);
grant select, insert, update on public.investimentos to authenticated;

commit;
