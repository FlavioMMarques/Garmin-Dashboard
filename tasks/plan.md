# Implementation Plan: Garmin Dashboard

## Overview
Monorepo local (npm workspaces): `server/` (Hono, guarda a chave e conversa com a Garmin Personal API)
e `web/` (Vite + React, 4 telas). Ver `SPEC.md`. Tarefas detalhadas em `tasks/todo.md`.

## Architecture Decisions
- Servidor proxy local com lista permitida de rotas próprias (`/api/activities`, `/api/daily`, ...),
  não um proxy genérico → o navegador nunca escolhe URL da Garmin e nunca vê a chave.
- Token em memória com expiração (24h, renova 5 min antes); em 401 renova uma vez e repete.
- Períodos longos quebrados em blocos de ≤ 31 dias no servidor (`dateRanges.ts`).
- Servidor devolve dados já "enxutos" (só os campos usados) → frontend tipado e simples.
- Vite faz proxy de `/api` → `127.0.0.1:8787` em dev.

## Dependency Graph
```
scaffold ─▶ garminClient (token) ─▶ activities slice
                                 ├▶ daily slice
                                 ├▶ dateRanges ─▶ sleep slice ─▶ trends ─▶ weekly volume
                                 └▶ error states / polish
```

## Task List
### Phase 1: Foundation
- [x] T1 Scaffold do monorepo
- [x] T2 Cliente Garmin (token + fetch autenticado) — risco maior, fazer cedo
### Checkpoint A — precisa da chave real no `.env` para confirmar formato do token

### Phase 2: Core slices
- [ ] T3 Atividades (rota + tela)
- [ ] T4 Saúde diária (rota + tela)
- [ ] T5 Sono (blocos de datas + rota + tela)
### Checkpoint B — 3 telas com dados reais

### Phase 3: Tendências e acabamento
- [ ] T6 Tendências de saúde (7/30/90 dias, gráficos)
- [ ] T7 Volume semanal de atividades
- [ ] T8 Estados de erro, README
### Checkpoint C — critérios de sucesso do SPEC

## Risks and Mitigations
| Risco | Impacto | Mitigação |
|---|---|---|
| Formato da resposta do token / header desconhecido | Alto | T2 aceita `access_token`/`accessToken`/`token`; testar com chave real no Checkpoint A |
| Rate limit não documentado | Médio | Cache em memória por (rota, período) no servidor + `staleTime` no TanStack Query |
| Campos dos DTOs nulos (sem relógio no dia) | Médio | Tipos com `?`/`null`, UI mostra "—" |
| Formato real de `dailysummaries` v2 difere do schema | Médio | Gravar fixture anonimizada da resposta real antes de mapear |

## Open Questions
- Nenhuma bloqueante; formato do token se resolve no Checkpoint A.
