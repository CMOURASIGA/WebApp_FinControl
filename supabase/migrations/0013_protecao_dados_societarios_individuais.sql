-- =====================================================================
-- Fecha o gap de segurança societária identificado na Etapa 4A do plano
-- de evolução do 7Finance (ver docs/AUTHORIZATION_VALIDATION.md).
--
-- Contexto: nenhuma migration alterou a RLS de `socios` nem de
-- `investimentos` desde 0004_operacao_financeira_segura.sql. Ambas
-- liberavam SELECT completo a qualquer usuario_ativo(), ou seja,
-- CPF, chave PIX, e-mail e telefone de qualquer sócio — e o valor
-- investido por qualquer sócio — eram legíveis por API/Supabase direto
-- por perfis 'socio' (olhando dados de outro sócio) e 'consulta',
-- contornando as capabilities 'view_partners'/'view_investments' do
-- frontend (que são proteção de UX, não de dado).
--
-- Modelagem usada (mesma da migration 0012, sem suposição por
-- nome/CPF/e-mail): auth.uid() = profiles.id (FK 1:1 com auth.users);
-- socios.profile_id uuid unique references profiles(id).
--
-- Decisão registrada (opção "a" da análise apresentada ao responsável
-- pelo produto): ROI/capital agregados por projeto (Dashboard,
-- InvestimentosPage) passam a exigir 'admin'/'financeiro' quando o
-- cálculo depende de investimentos de sócios individuais — um 'socio'
-- ou 'consulta' sem pode_operar_financeiro() deixa de enxergar
-- investimentos de outros sócios (só os próprios e os do tipo
-- 'empresa'). Caso o produto decida no futuro que o ROI agregado deve
-- ficar visível a todos sem expor o investidor individual, a solução é
-- uma function agregadora (soma sem expor linha), não a reversão desta
-- migration.
--
-- Regra aplicada, por tabela:
--   socios          -> select: admin, financeiro ou o próprio sócio
--                      (linha inteira, inclusive CPF/PIX/e-mail/tel.).
--                      insert/update inalterados (pode_operar_financeiro()).
--   socios_diretorio (view nova)
--                   -> id/nome/tipo/ativo/datas de TODOS os sócios,
--                      sem nenhuma coluna sensível, para qualquer
--                      usuario_ativo() — mantém funcionando splits,
--                      seletores de sócio em projeto, "por sócio" na
--                      DRE etc., sem expor CPF/PIX/e-mail/telefone.
--   investimentos   -> select: admin, financeiro, investidor "empresa"
--                      (sempre visível), ou o próprio sócio investidor.
--   investimento_historico
--                   -> mesmo dono do investimento referenciado.
--
-- Aplicação: pendente de projeto Supabase provisionado (ver
-- README.md "Configurando o Supabase" e docs/AUTHORIZATION_VALIDATION.md).
-- Migration puramente aditiva — nenhuma migration antiga foi alterada,
-- nenhuma coluna ou linha existente é removida ou migrada.
-- =====================================================================

begin;

create or replace function private.e_o_proprio_socio(p_socio_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.socios s
    join public.profiles pr on pr.id = s.profile_id
    where s.id = p_socio_id
      and pr.id = auth.uid()
      and pr.ativo
      and pr.papel = 'socio'
  );
$$;

revoke all on function private.e_o_proprio_socio(uuid) from public, anon, authenticated;
grant execute on function private.e_o_proprio_socio(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- socios: aperta o select da tabela base.
-- ---------------------------------------------------------------------
drop policy if exists socios_select on public.socios;
create policy socios_select on public.socios for select to authenticated
  using (
    (select private.eh_admin())
    or (select private.pode_operar_financeiro())
    or (select private.e_o_proprio_socio(id))
  );
-- insert/update de socios continuam exigindo pode_operar_financeiro()
-- (regra já criada em 0004, não alterada aqui).

-- ---------------------------------------------------------------------
-- view segura de diretório: nome/tipo/status para toda a operação,
-- sem nenhuma coluna sensível. security_invoker=false (padrão) faz a
-- view rodar com o privilégio do dono (bypassa a RLS que acabamos de
-- apertar), mas o filtro usuario_ativo() abaixo preserva a mesma
-- barreira mínima de sempre: só quem está logado e ativo enxerga.
-- ---------------------------------------------------------------------
create or replace view public.socios_diretorio as
select id, nome, tipo, ativo, data_entrada, data_saida
from public.socios
where (select private.usuario_ativo());

revoke all on public.socios_diretorio from public, anon;
grant select on public.socios_diretorio to authenticated;

-- ---------------------------------------------------------------------
-- investimentos: aperta o select. Investimento de tipo 'empresa' é
-- capital corporativo, não individual de sócio — continua visível a
-- todo usuario_ativo(). Investimento de sócio só é visível a
-- admin/financeiro/o próprio investidor.
-- ---------------------------------------------------------------------
drop policy if exists investimentos_select on public.investimentos;
create policy investimentos_select on public.investimentos for select to authenticated
  using (
    (select private.eh_admin())
    or (select private.pode_operar_financeiro())
    or investidor_tipo = 'empresa'
    or (socio_id is not null and (select private.e_o_proprio_socio(socio_id)))
  );
-- insert/update de investimentos continuam exigindo pode_operar_financeiro().

drop policy if exists investimento_historico_select on public.investimento_historico;
create policy investimento_historico_select on public.investimento_historico for select to authenticated
  using (
    (select private.eh_admin())
    or (select private.pode_operar_financeiro())
    or exists (
      select 1 from public.investimentos i
      where i.id = investimento_historico.investimento_id
        and (i.investidor_tipo = 'empresa' or (select private.e_o_proprio_socio(i.socio_id)))
    )
  );
-- insert de investimento_historico continua exigindo pode_operar_financeiro().

commit;
