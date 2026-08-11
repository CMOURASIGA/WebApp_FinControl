-- =====================================================================
-- Consult Services Finance 2027 — schema inicial
--
-- Implementa o storytelling funcional do sistema financeiro (ver
-- documentos/7 no repo webapppublicinsta, "storytelling sistema
-- financeiro consult services 2027"). Duas regras de ouro guiam todo
-- o desenho:
--
--   1. Nenhum valor recebido é considerado disponível para
--      distribuição antes de passar por tributo, custo, despesa e
--      reserva da empresa.
--   2. A distribuição é calculada por projeto/contrato, conforme a
--      regra de participação vigente daquele projeto — nunca sobre o
--      faturamento consolidado da empresa.
--
-- Consequência de desenho: alíquota, percentual de reserva da empresa,
-- split entre sócios e meta pessoal NUNCA são constantes de aplicação.
-- Vivem em tabelas com vigência (vigencia_inicio/vigencia_fim) e podem
-- ter escopo "default" (empresa) ou "projeto" (sobrescreve o default).
--
-- Cada receita, ao ser registrada, GRAVA UM SNAPSHOT dos parâmetros
-- vigentes na data do fato gerador (aliquota_aplicada,
-- percentual_empresa_aplicado, split_socios_aplicado). Isso garante
-- que uma mudança futura de parâmetro nunca altera, retroativamente,
-- um fechamento mensal já encerrado.
-- =====================================================================

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- 1. Usuários / sócios
--
-- A gestão de acesso é inteira do Supabase Auth. `profiles` é o
-- cadastro de negócio de cada usuário autenticado (1:1 com
-- auth.users) — é a tabela de usuários que guarda quem é sócio, o
-- papel e se está ativo. Sem uma linha aqui a pessoa tem login mas
-- não é reconhecida como parte da operação (ver policies abaixo).
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel text not null default 'socio' check (papel in ('socio', 'admin')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper de RLS: o usuário autenticado é um sócio ativo reconhecido?
create or replace function is_partner()
returns boolean as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ativo
  );
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 2. Clientes e projetos
-- ---------------------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  contato text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

create table projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes (id),
  nome text not null,
  tipo text not null default 'servico' check (tipo in ('servico', 'implantacao', 'recorrente', 'consultoria', 'conjunto')),
  origem_economica text not null default 'compartilhado',
  responsavel_comercial text,
  responsavel_execucao text,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'cancelado')),
  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_projetos_updated_at
  before update on projetos
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Parâmetros configuráveis (o núcleo do sistema)
-- ---------------------------------------------------------------------

-- 3.1 Tributação vigente. Nunca "imposto = 6%" fixo no código — é
-- sempre a regra vigente na data do fato gerador da receita.
create table parametros_tributarios (
  id uuid primary key default gen_random_uuid(),
  aliquota_percentual numeric(6, 3) not null check (aliquota_percentual >= 0 and aliquota_percentual <= 100),
  regime text not null default 'Simples Nacional',
  tipo_receita text not null default 'geral',
  vigencia_inicio date not null,
  vigencia_fim date,
  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint parametros_tributarios_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

-- Só pode existir uma regra "em aberto" (sem data de fim) por tipo de receita.
create unique index parametros_tributarios_vigente_unico
  on parametros_tributarios (tipo_receita)
  where vigencia_fim is null;

create index parametros_tributarios_vigencia_idx on parametros_tributarios (tipo_receita, vigencia_inicio);

-- 3.2 Regra de distribuição do resultado. Escopo "default" vale para
-- toda a empresa; escopo "projeto" sobrescreve o default apenas
-- naquele projeto. split_socios é um array
-- [{ "socio_id": uuid, "percentual": numeric }] onde o percentual de
-- cada entrada é sobre o RESULTADO LÍQUIDO do projeto (não sobre o
-- "distribuível"), então: percentual_empresa + soma(split_socios[].percentual) = 100.
create table regras_distribuicao (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('default', 'projeto')),
  projeto_id uuid references projetos (id) on delete cascade,
  percentual_empresa numeric(6, 3) not null check (percentual_empresa >= 0 and percentual_empresa <= 100),
  split_socios jsonb not null default '[]'::jsonb,
  vigencia_inicio date not null,
  vigencia_fim date,
  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint regras_distribuicao_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  constraint regras_distribuicao_escopo_projeto check (
    (escopo = 'default' and projeto_id is null) or
    (escopo = 'projeto' and projeto_id is not null)
  )
);

-- Só uma regra "default" em aberto, e só uma regra em aberto por projeto.
create unique index regras_distribuicao_default_vigente_unico
  on regras_distribuicao (escopo)
  where vigencia_fim is null and escopo = 'default';

create unique index regras_distribuicao_projeto_vigente_unico
  on regras_distribuicao (projeto_id)
  where vigencia_fim is null and escopo = 'projeto';

-- Garante percentual_empresa + soma(split_socios[].percentual) = 100 (±0.01).
create or replace function validar_regra_distribuicao()
returns trigger as $$
declare
  soma_split numeric;
begin
  select coalesce(sum((elem ->> 'percentual')::numeric), 0)
    into soma_split
    from jsonb_array_elements(new.split_socios) as elem;

  if abs((new.percentual_empresa + soma_split) - 100) > 0.01 then
    raise exception 'regra_distribuicao inválida: percentual_empresa (%) + soma(split_socios) (%) deve ser 100', new.percentual_empresa, soma_split;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_validar_regra_distribuicao
  before insert or update on regras_distribuicao
  for each row execute function validar_regra_distribuicao();

-- 3.3 Meta pessoal por sócio. Não gera obrigação de pagamento da
-- empresa — é referência de acompanhamento (ver seção 9 do
-- storytelling).
create table parametros_pessoais (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references profiles (id),
  meta_liquida_mensal numeric(12, 2) not null check (meta_liquida_mensal >= 0),
  vigencia_inicio date not null,
  vigencia_fim date,
  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint parametros_pessoais_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create unique index parametros_pessoais_vigente_unico
  on parametros_pessoais (socio_id)
  where vigencia_fim is null;

-- ---------------------------------------------------------------------
-- 4. Receitas, custos e despesas
-- ---------------------------------------------------------------------

-- Toda receita grava o snapshot do parâmetro tributário e da regra de
-- distribuição vigentes na data do fato gerador. É esse snapshot —
-- não a tabela de parâmetros — que o motor de cálculo usa para
-- apurar o resultado do projeto e a distribuição aos sócios.
create table receitas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos (id),
  descricao text not null,
  tipo text not null default 'pontual' check (tipo in ('pontual', 'recorrente')),
  valor_bruto numeric(12, 2) not null check (valor_bruto >= 0),
  status text not null default 'previsto' check (status in ('previsto', 'faturado', 'recebido', 'vencido', 'cancelado')),
  data_prevista date not null,
  data_fato_gerador date not null,
  data_recebimento date,

  parametro_tributario_id uuid references parametros_tributarios (id),
  aliquota_aplicada numeric(6, 3),

  regra_distribuicao_id uuid references regras_distribuicao (id),
  percentual_empresa_aplicado numeric(6, 3),
  split_socios_aplicado jsonb,

  tributo_status text not null default 'provisionado' check (tributo_status in ('provisionado', 'pago')),
  tributo_pago_em date,

  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_receitas_updated_at
  before update on receitas
  for each row execute function set_updated_at();

create index receitas_projeto_idx on receitas (projeto_id);
create index receitas_data_fato_gerador_idx on receitas (data_fato_gerador);
create index receitas_status_idx on receitas (status);

-- Custo diretamente relacionado ao projeto (pertence economicamente
-- ao projeto, é abatido antes da distribuição).
create table custos_projeto (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos (id),
  descricao text not null,
  categoria text not null default 'outros',
  valor numeric(12, 2) not null check (valor >= 0),
  data date not null,
  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index custos_projeto_projeto_idx on custos_projeto (projeto_id);
create index custos_projeto_data_idx on custos_projeto (data);

-- Despesa corporativa (pertence à empresa) ou atribuída a um projeto
-- específico. tipo='tributo' cobre pagamentos de DAS/impostos;
-- tipo='investimento' registra aporte de capital.
create table despesas (
  id uuid primary key default gen_random_uuid(),
  categoria text not null default 'outros',
  tipo text not null default 'fixa' check (tipo in ('fixa', 'variavel', 'projeto', 'tributo', 'investimento')),
  descricao text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  projeto_id uuid references projetos (id),
  competencia date not null,
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'provisionado' check (status in ('provisionado', 'pago')),
  observacao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_despesas_updated_at
  before update on despesas
  for each row execute function set_updated_at();

create index despesas_competencia_idx on despesas (competencia);
create index despesas_projeto_idx on despesas (projeto_id);
create index despesas_status_idx on despesas (status);

-- ---------------------------------------------------------------------
-- 5. Investimentos / aportes
-- ---------------------------------------------------------------------
create table investimentos (
  id uuid primary key default gen_random_uuid(),
  investidor_tipo text not null check (investidor_tipo in ('socio', 'empresa')),
  socio_id uuid references profiles (id),
  projeto_id uuid references projetos (id),
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  tipo text not null default 'aporte',
  descricao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint investimentos_socio_obrigatorio check (
    (investidor_tipo = 'socio' and socio_id is not null) or investidor_tipo = 'empresa'
  )
);

create index investimentos_projeto_idx on investimentos (projeto_id);
create index investimentos_socio_idx on investimentos (socio_id);

-- ---------------------------------------------------------------------
-- 6. Conta corrente dos sócios e reserva da empresa
-- ---------------------------------------------------------------------

-- Direito econômico calculado (crédito) ≠ valor efetivamente
-- transferido (retirada). Este é o extrato que reconcilia os dois.
create table socio_lancamentos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references profiles (id),
  tipo text not null check (tipo in ('credito_resultado', 'retirada', 'reembolso', 'ajuste', 'reserva_aporte', 'reserva_uso')),
  valor numeric(12, 2) not null,
  projeto_id uuid references projetos (id),
  receita_id uuid references receitas (id),
  data date not null,
  descricao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index socio_lancamentos_socio_idx on socio_lancamentos (socio_id, data);

-- Reserva da Consult Services (separada da reserva pessoal de cada sócio).
create table reserva_empresa_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aporte', 'uso')),
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  descricao text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index reserva_empresa_lancamentos_data_idx on reserva_empresa_lancamentos (data);

-- ---------------------------------------------------------------------
-- 7. Receita recorrente (MRR/ARR)
-- ---------------------------------------------------------------------
create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id),
  projeto_id uuid references projetos (id),
  nome text not null,
  valor_mensal numeric(12, 2) not null check (valor_mensal >= 0),
  dia_cobranca smallint check (dia_cobranca between 1 and 28),
  data_inicio date not null,
  data_fim date,
  status text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_assinaturas_updated_at
  before update on assinaturas
  for each row execute function set_updated_at();

create index assinaturas_status_idx on assinaturas (status);

-- ---------------------------------------------------------------------
-- 8. Fechamento mensal
-- ---------------------------------------------------------------------
create table fechamentos_mensais (
  id uuid primary key default gen_random_uuid(),
  competencia date not null unique, -- sempre dia 1 do mês
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  fechado_em timestamptz,
  fechado_por uuid references profiles (id),
  snapshot jsonb,
  observacao text,
  created_at timestamptz not null default now()
);

create index fechamentos_mensais_competencia_idx on fechamentos_mensais (competencia);

-- =====================================================================
-- Row Level Security
--
-- Consult Services é uma operação de poucos sócios administrando o
-- caixa em conjunto: qualquer sócio ativo (linha em `profiles`) pode
-- ler e lançar dados em qualquer módulo. O controle de acesso real
-- acontece na fronteira de autenticação (só quem tem login Supabase
-- E uma linha em profiles participa) — não há RLS por papel dentro
-- do MVP, mas a função is_partner() concentra essa checagem para
-- poder ser refinada depois sem tocar nas policies uma a uma.
-- =====================================================================

alter table profiles enable row level security;
alter table clientes enable row level security;
alter table projetos enable row level security;
alter table parametros_tributarios enable row level security;
alter table regras_distribuicao enable row level security;
alter table parametros_pessoais enable row level security;
alter table receitas enable row level security;
alter table custos_projeto enable row level security;
alter table despesas enable row level security;
alter table investimentos enable row level security;
alter table socio_lancamentos enable row level security;
alter table reserva_empresa_lancamentos enable row level security;
alter table assinaturas enable row level security;
alter table fechamentos_mensais enable row level security;

-- profiles: todo sócio autenticado enxerga o quadro societário; cada
-- um só edita o próprio registro.
create policy profiles_select on profiles for select using (is_partner());
create policy profiles_update_self on profiles for update using (id = auth.uid());

-- Demais tabelas: leitura e escrita liberadas para qualquer sócio ativo.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'clientes', 'projetos', 'parametros_tributarios', 'regras_distribuicao',
    'parametros_pessoais', 'receitas', 'custos_projeto', 'despesas',
    'investimentos', 'socio_lancamentos', 'reserva_empresa_lancamentos',
    'assinaturas', 'fechamentos_mensais'
  ]
  loop
    execute format('create policy %I_select on %I for select using (is_partner())', tabela, tabela);
    execute format('create policy %I_insert on %I for insert with check (is_partner())', tabela, tabela);
    execute format('create policy %I_update on %I for update using (is_partner())', tabela, tabela);
    execute format('create policy %I_delete on %I for delete using (is_partner())', tabela, tabela);
  end loop;
end $$;
