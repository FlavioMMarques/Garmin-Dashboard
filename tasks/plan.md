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
activities ─▶ runs route (R1) ─▶ volume/ritmo (R2), eficiência/marcas (R3), zonas/dinâmica (R4)
```
- Agregações de corrida (semana, mês, média móvel, VDOT) ficam em funções puras no `web/src/lib/`,
  testadas; o servidor só entrega a lista enxuta de corridas do período (cache 10 min em memória).

## Task List
### Phase 1: Foundation
- [x] T1 Scaffold do monorepo
- [x] T2 Cliente Garmin (token + fetch autenticado) — risco maior, fazer cedo
### Checkpoint A ✅ — token é JWT em text/plain (24h), `Authorization: Bearer`

### Phase 2: Corrida (prioridade do usuário, decidido em 2026-11-05)
- [x] T3 Atividades (rota + tela)
- [x] R1 `/api/runs` (todas as corridas do período, campos de corrida, cache) + aba Corrida com seletor de período
- [x] R2 Volume (semana/mês, ano vs ano anterior) + ritmo com média móvel por faixa de distância
- [x] R3 Eficiência aeróbica + melhores marcas + VDOT estimado
- [x] R4 Zonas de FC + dinâmica de corrida + carga/efeito de treino + calor
### Checkpoint R — aba Corrida com dados reais, números conferidos com o app
- [ ] R5 Detalhe km a km (download `.FIT`) — **perguntar antes** sobre dependência de parser FIT

### Phase 3: Saúde
- [ ] T4 Saúde diária (rota + tela)
- [ ] T5 Sono (blocos de datas + rota + tela)
- [ ] T6 Tendências de saúde (7/30/90 dias, gráficos)
- ~~T7 Volume semanal de atividades~~ → absorvida pela R2
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
- R5: qual parser `.FIT` usar (dependência nova) — perguntar quando chegar lá.
- API pessoal não expõe VO2max (fitnessage só traz FC repouso/minutos vigorosos/IMC) → VDOT estimado.
