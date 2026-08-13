-- =====================================================================
-- Gestão de sócios: qualquer sócio ativo pode editar o cadastro de
-- qualquer outro sócio (nome completo, CPF, chave PIX) e
-- desativar/reativar um sócio — mesmo padrão de confiança usado em
-- todas as outras tabelas do sistema (é uma operação de poucos
-- sócios administrando o caixa em conjunto).
--
-- "Excluir" um sócio nunca é DELETE físico: profiles é referenciado
-- por receitas, custos, despesas, investimentos, lançamentos de
-- conta corrente e regras de distribuição — apagar a linha quebraria
-- o histórico. `ativo = false` remove o sócio das listas de seleção
-- para lançamentos novos, sem apagar nada do que já aconteceu.
-- =====================================================================

drop policy if exists profiles_update_self on profiles;
create policy profiles_update on profiles for update using (is_partner());
