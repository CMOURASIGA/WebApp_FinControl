# 7Finance

Gestão financeira e societária, uma plataforma da Consult Services Tecnologia.

Sistema financeiro da Consult Services: tributação, custos diretos de projeto, despesas corporativas, distribuição de resultado entre sócios, conta corrente, investimentos/ROI, receita recorrente (MRR/ARR), simulador tributário e fechamento mensal com DRE gerencial.

Este projeto substitui o antigo protótipo de controle financeiro pessoal (localStorage, single-user) por uma reconstrução completa alinhada ao storytelling funcional "Consult Services Finance 2027" — a lógica de negócio está descrita em detalhe lá; este README cobre como rodar e como o código está organizado.

## Duas regras de ouro (todo o desenho gira em torno delas)

1. **Nenhum valor recebido é considerado disponível para distribuição** antes de passar por tributo, custo direto do projeto, despesa e reserva da empresa.
2. **A distribuição é calculada por projeto**, conforme a regra de participação vigente daquele projeto — nunca sobre o faturamento consolidado da empresa.
3. **Imposto só incide sobre receita com nota fiscal.** Receita sem nota tem alíquota, provisão e retenção zeradas. A retenção na fonte é registrada como quitação parcial do tributo, sem ser descontada duas vezes do resultado.

Consequência direta: **alíquota tributária, percentual de reserva da empresa e split entre sócios nunca são constantes no código.** Vivem no banco como parâmetros configuráveis com vigência (`vigencia_inicio` / `vigencia_fim`) e podem ter escopo default (empresa) ou específico por projeto. Mudar um número é uma operação de configuração na tela **Parâmetros**, não um deploy.

Este é um sistema de controle da **empresa** — nenhuma tela ou tabela guarda finanças pessoais de um sócio (nada de meta de renda individual ou reserva pessoal). O que existe por sócio é estritamente societário: cadastro (nome completo, CPF, chave PIX), regra de participação no resultado e conta corrente (crédito de resultado ↔ retirada).

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + React Router.
- **Backend/dados**: Supabase (Postgres + Auth + Row Level Security). Não há backend próprio — o frontend fala direto com o Supabase usando a chave `anon` e RLS.
- **Gestão de acesso**: 100% Supabase Auth. Cada usuário autenticado ganha automaticamente uma linha em `public.profiles` (trigger `handle_new_user`) — essa é a "tabela de usuários" que registra quem é sócio da operação, com nome completo, CPF e chave PIX.

## Configurando o Supabase

> **Status atual (2026-08):** o 7Finance ainda não tem um projeto Supabase
> próprio provisionado. O ambiente de apresentação/validação roda com dados
> mocados. As migrations abaixo já estão todas no repositório e prontas
> para aplicar assim que o projeto for criado — nenhuma delas depende de
> nada além da ordem numérica.

1. Crie um projeto em [supabase.com](https://supabase.com) — dedicado ao 7Finance (não reaproveitar projeto de outro produto da suíte).
2. No SQL Editor do projeto (ou via `supabase db push` com a CLI), rode **em ordem numérica, todas** as migrations de [`supabase/migrations`](supabase/migrations) — hoje `0001` até `0013`. Cada uma parte de onde a anterior parou; não pule nenhuma.
3. Rode os dois scripts de isolamento em [`supabase/tests`](supabase/tests) no mesmo projeto:
   - [`0012_conta_corrente_isolamento.sql`](supabase/tests/0012_conta_corrente_isolamento.sql) — conta corrente societária (admin/financeiro veem tudo, cada sócio só vê o próprio extrato, consulta não vê nenhum).
   - [`0013_dados_societarios_isolamento.sql`](supabase/tests/0013_dados_societarios_isolamento.sql) — CPF/chave PIX/e-mail/telefone em `socios` e valor investido em `investimentos` (mesma regra: admin/financeiro veem tudo, cada sócio só o próprio, consulta não vê nada individual — mas todo perfil ativo continua lendo nome/tipo/status de todos via a view `socios_diretorio`).
   
   Ambos criam fixtures, validam e desfazem tudo com `ROLLBACK` — não precisa limpar nada depois.
4. Em **Project Settings → API**, copie a `Project URL` e a chave `anon public`.
5. Copie `.env.example` para `.env.local` e preencha:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
6. Em **Authentication → Providers**, deixe e-mail/senha habilitado (é o método usado pela tela de login). Se quiser pular a confirmação por e-mail em desenvolvimento, desative "Confirm email" nas configurações de Auth.

## Rodando localmente

```bash
npm install
npm run dev
```

## Primeiro acesso (bootstrap dos parâmetros)

A migração cria as tabelas mas **não** popula `parametros_tributarios` / `regras_distribuicao` com os valores 6% / 30% / 70% — isso é proposital: a regra de distribuição referencia o `id` de sócios reais (`profiles`), que só existem depois do primeiro cadastro.

Usuário e sócio são cadastros diferentes. `profiles` controla quem acessa o sistema; `socios` controla quem participa financeiramente. Um administrador ou financeiro cadastra os sócios na tela **Sócios**, mesmo que eles nunca tenham login.

Passo a passo:

1. Acesse com o usuário administrador inicial.
2. Vá em **Sócios** e cadastre todas as pessoas que participam financeiramente.
3. Cadastre nome, CPF, chave PIX e data de entrada. Login é opcional e separado.
4. Vá em **Parâmetros** e registre:
   - a alíquota tributária vigente (referência inicial: 6%);
   - a regra de distribuição default (referência inicial: 30% empresa / 70% dividido entre os sócios que participarem — a tela suporta 2 ou mais sócios na mesma regra, cada um escolhido por um seletor, não é um campo fixo por nome).

A partir daí, toda receita lançada em **Projetos** grava automaticamente um snapshot desses parâmetros na data do fato gerador — mudar o parâmetro depois não altera receitas já lançadas nem fechamentos já encerrados.

### Começando com uma receita de R$ 200

1. Cadastre os sócios.
2. Em **Parâmetros**, informe a alíquota e a divisão, por exemplo 30% empresa e 70% sócio.
3. Crie um projeto para a atividade executada.
4. Lance R$ 200 como receita e marque como recebida quando o dinheiro entrar.
5. Lance custos e despesas diretamente ligados à atividade.
6. No fechamento do mês, somente receitas recebidas entram na apuração. O crédito do sócio e o valor retido pela empresa são calculados a partir do resultado líquido.
7. A retirada do sócio só é aceita se houver saldo disponível. Despesas corporativas gerais são pagas pela parcela retida da empresa; despesas que devem reduzir o resultado antes da divisão precisam ser vinculadas ao projeto.

## Estrutura do banco (`supabase/migrations/`)

| Tabela | Papel |
|---|---|
| `profiles` | Sócios/usuários (1:1 com `auth.users`): nome completo, CPF, chave PIX |
| `clientes`, `projetos` | Quem contrata, o que está sendo entregue e sua regra econômica |
| `parametros_tributarios` | Alíquota vigente, com histórico |
| `regras_distribuicao` | % empresa + split entre 1 ou mais sócios, escopo default ou por projeto, com histórico |
| `receitas` | Cada entrada de caixa, com snapshot do tributo e da regra aplicados |
| `custos_projeto` | Custo que pertence economicamente a um projeto |
| `despesas` | Despesa corporativa (sem projeto) ou atribuída a um projeto |
| `investimentos` | Aportes de sócio ou da empresa, por projeto |
| `socio_lancamentos` | Conta corrente societária: créditos de resultado, retiradas, reembolsos, ajustes |
| `reserva_empresa_lancamentos` | Reserva da Consult Services (da empresa, não de um sócio) |
| `assinaturas` | Contratos recorrentes → alimenta MRR/ARR |
| `fechamentos_mensais` | Snapshot imutável do mês fechado |

RLS está habilitado em todas as tabelas: qualquer usuário autenticado com uma linha ativa em `profiles` pode ler e lançar dados (é uma operação de poucos sócios administrando o caixa em conjunto).

## Estrutura do frontend

```
src/
  lib/
    supabaseClient.ts     # client do Supabase
    motorCalculo.ts       # ÚNICO lugar que aplica a cascata receita→tributo→custo→despesa→resultado→distribuição
  services/                # um arquivo por domínio, todos falando com o Supabase
  contexts/AuthContext.tsx # sessão + profile do usuário logado
  pages/                   # uma tela por módulo do menu
  components/layout/       # AppLayout (sidebar) e ProtectedRoute
```

O `motorCalculo.ts` é o núcleo do sistema: resolve qual parâmetro vale em uma data (`resolveVigente`), monta o snapshot gravado em cada receita nova, calcula o resultado de um projeto (rateando custos/despesas entre as receitas e aplicando a regra de distribuição de cada uma) e roda o simulador tributário — tudo com os mesmos parâmetros passados por fora, nunca lidos de uma constante.

## Escopo desta versão (MVP)

Implementado: Dashboard executivo, Parâmetros Configuráveis, Cadastro de Sócios, Projetos + Receitas + Custos diretos, Despesas/Contas a Pagar, Conta Corrente dos Sócios, Investimentos + ROI, Simulador Tributário, Fechamento Mensal + DRE gerencial, MRR/ARR.

Deixado para uma fase seguinte: integrações bancárias automáticas, projeção de caixa de 12 meses, simulador de novo negócio com scoring automático, alertas proativos, reabertura de fechamento. Deliberadamente fora de escopo: qualquer financeiro pessoal de sócio (meta de renda, reserva pessoal) — este é um sistema de controle da empresa.
