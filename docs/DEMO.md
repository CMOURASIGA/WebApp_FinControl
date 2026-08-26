# Ambiente de Demonstração do 7Finance

## Objetivo

O ambiente `demo` deve funcionar sem projeto Supabase provisionado e sem banco real.

## Ativação

Defina no ambiente Vercel da branch `demo`:

```env
VITE_DEMO_MODE=true
```

Para compatibilidade, `VITE_SKIP_AUTH=true` também ativa o mesmo modo.

Com o modo demo ativo:

- autenticação real é dispensada;
- todas as consultas do frontend usam um client Supabase mockado em `localStorage`;
- `socios_diretorio` é simulado localmente;
- projetos, receitas, custos, despesas, sócios, investimentos, assinaturas, fechamento e white label usam dados fictícios;
- a Orion responde pelo mesmo `orionService`, mas `supabase.functions.invoke('orion')` é atendido localmente com respostas baseadas nos dados fictícios;
- nenhuma chamada ao Postgres/Supabase real é necessária.

## Segurança

Nunca habilitar `VITE_DEMO_MODE` ou `VITE_SKIP_AUTH` na produção.

A produção e o desenvolvimento com banco provisionado continuam usando Supabase real, RLS, migrations e Edge Function Orion.

## Reset

Os dados demo ficam no navegador. Para reiniciar a apresentação, limpe o Local Storage do domínio ou use `resetDemoData()` durante desenvolvimento.

## Orion

No demo, a Orion é uma simulação determinística de apresentação. Ela responde sobre margem, resultado, MRR, riscos e preparação do fechamento usando os dados fictícios locais. No ambiente real, a mesma interface chama a Edge Function `orion` e a OpenAI com segredo server-side.
