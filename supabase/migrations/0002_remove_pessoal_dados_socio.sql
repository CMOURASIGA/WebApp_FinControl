-- =====================================================================
-- Ajuste: este é um sistema de controle da EMPRESA, não de vida
-- pessoal de nenhum sócio. Remove os dois conceitos que misturavam
-- necessidade pessoal com caixa da empresa:
--
--   - meta líquida mensal por sócio (parametros_pessoais)
--   - reserva pessoal (tipos 'reserva_aporte'/'reserva_uso' em
--     socio_lancamentos)
--
-- A conta corrente do sócio (crédito de resultado, retirada,
-- reembolso, ajuste) continua existindo — isso é controle societário
-- da empresa, não dado pessoal.
--
-- Também adiciona os dados cadastrais do sócio que faltavam: nome
-- completo (reaproveita a coluna `nome` já existente), CPF e chave
-- PIX, usados para identificar de quem é cada sócio numa regra de
-- distribuição e, no futuro, para pagamentos.
-- =====================================================================

-- Remove qualquer lançamento histórico de reserva pessoal antes de
-- apertar a constraint (não deve haver nenhum em uso normal, mas
-- protege contra erro de constraint em ambientes que já testaram).
delete from socio_lancamentos where tipo in ('reserva_aporte', 'reserva_uso');

alter table socio_lancamentos drop constraint if exists socio_lancamentos_tipo_check;
alter table socio_lancamentos
  add constraint socio_lancamentos_tipo_check
  check (tipo in ('credito_resultado', 'retirada', 'reembolso', 'ajuste'));

drop table if exists parametros_pessoais cascade;

alter table profiles add column if not exists cpf text;
alter table profiles add column if not exists chave_pix text;

comment on column profiles.nome is 'Nome completo do sócio.';
comment on column profiles.cpf is 'CPF do sócio (identificação, sem formatação obrigatória).';
comment on column profiles.chave_pix is 'Chave PIX do sócio, usada para referência de pagamento/transferência.';
