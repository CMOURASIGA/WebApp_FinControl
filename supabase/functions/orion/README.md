# Orion — Edge Function

IA financeira do 7Finance (V1: leitura, análise, comparação, recomendação, simulação — nunca escrita). Ver `docs/03-ai/ORION_SPEC.md` (branch `docs/7finance-specs`) para a especificação completa e `docs/AUTHORIZATION_VALIDATION.md` para o histórico de segurança que precedeu esta implementação.

## Arquitetura

```
7Finance Frontend
    ↓ supabase.functions.invoke('orion', { body: { mensagem, historico, competencia } })
    ↓ (Authorization: Bearer <JWT do usuário>, automático)
Edge Function orion (este diretório)
    ↓ autentica o JWT, carrega profile + capabilities
    ↓ checa capability 'use_orion'
    ↓ valida payload (tamanho de mensagem/histórico)
    ↓ checa rate limit (tabela orion_auditoria, service role)
    ↓ chama a OpenAI com as tools definidas em toolSchemas.ts
    ↓ quando a OpenAI pede uma tool, executa financeTools.ts
        usando um client Supabase autenticado como O PRÓPRIO USUÁRIO
        (não service role) — toda consulta passa pela RLS normal
    ↓ registra auditoria (service role, só metadados — nunca a mensagem)
    ↓ devolve { resposta, toolsUsadas } ao frontend
```

**Nunca** o browser chama a OpenAI diretamente. A chave da OpenAI só existe como secret deste projeto Supabase.

## Arquivos

- `index.ts` — handler HTTP (`Deno.serve`). Orquestra autenticação, rate limit, o loop de tool-calling e a auditoria. **Não é testável por Vitest** (usa `Deno.serve`/`Deno.env`/import `npm:`) — só validável rodando de verdade via `supabase functions serve` / deploy.
- `types.ts`, `validation.ts`, `promptSistema.ts`, `toolSchemas.ts`, `openai.ts`, `financeTools.ts` — módulos puros, sem `Deno.*` direto (exceto onde documentado), testados por Vitest em `*.test.ts` ao lado de cada um.
- `financeTools.ts` importa `../../../src/lib/motorCalculo.ts` e `../../../src/lib/capabilities.ts` por caminho relativo — **o cálculo financeiro não é duplicado aqui**, é o mesmo motor usado pelo frontend.

## Variáveis de ambiente (secrets do projeto Supabase)

| Nome | Obrigatória | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | Sim | Chave da OpenAI. **Nunca** commitar, nunca `VITE_OPENAI_API_KEY` (isso exporia no bundle do browser). Definir com `supabase secrets set OPENAI_API_KEY=sk-...`. |
| `OPENAI_MODEL` | Não | Modelo da OpenAI a usar. Default no código: `gpt-4o-mini`. Troque via secret se quiser outro modelo — nome definitivo documentado aqui, não hardcoded em mais de um lugar. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Já injetadas pelo runtime | Não precisam ser configuradas manualmente — o Supabase injeta essas três em toda Edge Function. |

## Deploy (quando o projeto Supabase existir)

```bash
supabase functions deploy orion
supabase secrets set OPENAI_API_KEY=sk-...
# opcional:
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

Pré-requisito: migrations `0001`–`0014` já aplicadas (a `0014` cria `orion_auditoria`).

## Limites e segurança implementados

- Autenticação obrigatória (JWT do Supabase Auth).
- Capability `use_orion` checada antes de qualquer chamada à OpenAI.
- Mensagem limitada a 2000 caracteres; histórico a 12 mensagens (`validation.ts`).
- Rate limit: 6 chamadas por usuário por minuto (contagem em `orion_auditoria`, ajustável em `index.ts`).
- Timeout de 20s na chamada à OpenAI.
- Só as 10 tools de `toolSchemas.ts` podem ser executadas — nome de tool vindo da OpenAI é validado contra uma allowlist (`validation.ts:assertToolPermitida`) antes de qualquer execução; qualquer nome fora disso é rejeitado sem executar nada.
- Nenhuma tool aceita SQL, nome de tabela/coluna livre nem qualquer verbo de escrita — só argumentos tipados do domínio (competência, projetoId, valores de simulação).
- Toda query de tool roda com o JWT do próprio usuário — a RLS do banco é a barreira real, não a Orion.
- Auditoria (`orion_auditoria`): usuário, papel, competência, tool usada, status, duração, tokens, erro (nunca a mensagem do usuário nem a resposta do modelo, nunca a API key).
- Heurística de detecção de tentativa de prompt injection (`validation.ts:pareceTentativaDeInjecao`) registra a suspeita na auditoria, mas não bloqueia sozinha (evita falso positivo em pergunta legítima); a defesa real é a instrução explícita no system prompt (`promptSistema.ts`) para nunca obedecer instrução embutida em mensagem do usuário ou em resultado de tool.

## Pendências de validação (aguardando infraestrutura)

Não há projeto Supabase próprio do 7Finance provisionado nesta data (ver `docs/AUTHORIZATION_VALIDATION.md`). Portanto:
- Esta função **nunca foi deployada nem executada de verdade** — só revisada estaticamente e testada por partes (módulos puros) via Vitest com mocks.
- **Nenhuma chamada real à OpenAI foi feita.** Antes de considerar a Fase 4B definitivamente concluída, é obrigatório: provisionar o projeto, aplicar as migrations, configurar `OPENAI_API_KEY` real, deployar esta função e validar pelo menos uma chamada ponta a ponta pelo `OrionPanel` no frontend.
