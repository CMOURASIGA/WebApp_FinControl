-- =====================================================================
-- Protege a conta corrente societária (socio_lancamentos) por sócio,
-- fechando o gap identificado na Fase 1 do plano de evolução do
-- 7Finance (ver docs/AUTHORIZATION_VALIDATION.md).
--
-- Contexto/modelagem confirmada antes desta migration:
--   - public.profiles.id references auth.users(id) 1:1  => auth.uid() = profiles.id
--   - public.socios.profile_id uuid unique references public.profiles(id)
--     (nullable: um sócio pode não ter login; unique: um login nunca
--     aponta para mais de um sócio) — criado em
--     0004_operacao_financeira_segura.sql.
-- Não há suposição por nome/CPF/e-mail: o vínculo usuário -> sócio é
-- feito inteiramente por essa FK já existente.
--
-- Gap fechado: socio_lancamentos_select (criada no loop genérico de
-- 0004) liberava SELECT completo da tabela para qualquer
-- usuario_ativo(), ou seja, qualquer perfil ativo — inclusive
-- 'consulta' e um 'socio' olhando o extrato de outro sócio — conseguia
-- ler saldo/retiradas de qualquer sócio via API/Supabase direto,
-- contornando a capability 'view_partner_account' do frontend (que é
-- proteção de UX, não de dado).
--
-- Regra aplicada:
--   - admin           -> vê tudo;
--   - financeiro      -> vê tudo (mesma superfície que já tem hoje
--                        para GRAVAR em qualquer sócio via fechar_mes/
--                        registrar_retirada_socio; leitura equivalente
--                        não amplia permissão nenhuma, só alinha com a
--                        escrita que já existe);
--   - socio           -> vê somente o próprio extrato (socio_id
--                        precisa bater com o sócio ligado ao seu
--                        profile_id, E o papel do profile precisa ser
--                        literalmente 'socio' — um perfil 'consulta'
--                        eventualmente vinculado a um socios.profile_id
--                        não herda esse acesso);
--   - consulta/outros -> nada.
-- =====================================================================

begin;

create or replace function private.pode_ver_conta_corrente(p_socio_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    (select private.eh_admin())
    or (select private.pode_operar_financeiro())
    or exists (
      select 1
      from public.socios s
      join public.profiles pr on pr.id = s.profile_id
      where s.id = p_socio_id
        and pr.id = auth.uid()
        and pr.ativo
        and pr.papel = 'socio'
    );
$$;

revoke all on function private.pode_ver_conta_corrente(uuid) from public, anon, authenticated;
grant execute on function private.pode_ver_conta_corrente(uuid) to authenticated;

drop policy if exists socio_lancamentos_select on public.socio_lancamentos;
create policy socio_lancamentos_select on public.socio_lancamentos for select to authenticated
  using ((select private.pode_ver_conta_corrente(socio_id)));

-- insert/update de socio_lancamentos continuam exigindo
-- pode_operar_financeiro() (regra já criada em 0004, não alterada
-- aqui) — só a leitura ganhou granularidade por sócio.

commit;
