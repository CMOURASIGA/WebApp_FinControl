<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Consult Services — Finance 2027

Sistema financeiro da Consult Services: tributação, custos diretos de projeto, despesas corporativas, distribuição de resultado entre sócios, conta corrente, investimentos/ROI, receita recorrente (MRR/ARR), simulador tributário e fechamento mensal com DRE gerencial.

Este projeto substitui o antigo protótipo de controle financeiro pessoal (localStorage, single-user) por uma reconstrução completa alinhada ao storytelling funcional "Consult Services Finance 2027" — a lógica de negócio está descrita em detalhe lá; este README cobre como rodar e como o código está organizado.

## Duas regras de ouro (todo o desenho gira em torno delas)

1. **Nenhum valor recebido é considerado disponível para distribuição** antes de passar por tributo, custo direto do projeto, despesa e reserva da empresa.
2. **A distribuição é calculada por projeto**, conforme a regra de participação vigente daquele projeto — nunca sobre o faturamento consolidado da empresa.

Consequência direta: **alíquota tributária, percentual de reserva da empresa e split entre sócios nunca são constantes no código.** Vivem no banco como parâmetros configuráveis com vigência (`vigencia_inicio` / `vigencia_fim`) e podem ter escopo default (empresa) ou específico por projeto. Mudar um número é uma operação de configuração na tela **Parâmetros**, não um deploy.

Este é um sistema de controle da **empresa** — nenhuma tela ou tabela guarda finanças pessoais de um sócio (nada de meta de renda individual ou reserva pessoal). O que existe por sócio é estritamente societário: cadastro (nome completo, CPF, chave PIX), regra de participação no resultado e conta corrente (crédito de resultado ↔ retirada).

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + React Router.
- **Backend/dados**: Supabase (Postgres + Auth + Row Level Security). Não há backend próprio — o frontend fala direto com o Supabase usando a chave `anon` e RLS.
- **Gestão de acesso**: 100% Supabase Auth. Cada usuário autenticado ganha automaticamente uma linha em `public.profiles` (trigger `handle_new_user`) — essa é a "tabela de usuários" que registra quem é sócio da operação, com nome completo, CPF e chave PIX.

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor do projeto, rode **em ordem** o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e depois [`supabase/migrations/0002_remove_pessoal_dados_socio.sql`](supabase/migrations/0002_remove_pessoal_dados_socio.sql) (ou use `supabase db push` com a Supabase CLI, se preferir versionar as migrações localmente).
3. Em **Project Settings → API**, copie a `Project URL` e a chave `anon public`.
4. Copie `.env.example` para `.env.local` e preencha:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
5. Em **Authentication → Providers**, deixe e-mail/senha habilitado (é o método usado pela tela de login). Se quiser pular a confirmação por e-mail em desenvolvimento, desative "Confirm email" nas configurações de Auth.

## Rodando localmente

```bash
npm install
npm run dev
```

## Primeiro acesso (bootstrap dos parâmetros)

A migração cria as tabelas mas **não** popula `parametros_tributarios` / `regras_distribuicao` com os valores 6% / 30% / 70% — isso é proposital: a regra de distribuição referencia o `id` de sócios reais (`profiles`), que só existem depois do primeiro cadastro.

Não existe um fluxo de "criar sócio" fora do Supabase Auth: **cada sócio entra se cadastrando com o próprio e-mail na tela de login** — isso cria `auth.users` + `profiles` automaticamente. Depois de logado, cada um edita seu próprio nome completo, CPF e chave PIX em **Sócios** (RLS só permite editar o próprio registro).

Passo a passo:

1. Cadastre-se na tela de login.
2. Peça para o(s) outro(s) sócio(s) também se cadastrarem — a regra de distribuição só faz sentido depois que todos que vão participar dela já têm conta.
3. Vá em **Sócios** e complete CPF/chave PIX de cada um (cada sócio só edita o próprio).
4. Vá em **Parâmetros** e registre:
   - a alíquota tributária vigente (referência inicial: 6%);
   - a regra de distribuição default (referência inicial: 30% empresa / 70% dividido entre os sócios que participarem — a tela suporta 2 ou mais sócios na mesma regra, cada um escolhido por um seletor, não é um campo fixo por nome).

A partir daí, toda receita lançada em **Projetos** grava automaticamente um snapshot desses parâmetros na data do fato gerador — mudar o parâmetro depois não altera receitas já lançadas nem fechamentos já encerrados.

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
