# Tasks

## Task 1: Scaffold do monorepo
**Description:** npm workspaces `server/` + `web/`, TypeScript, Vitest, ESLint/Prettier, `.gitignore`, `.env.example`, script `dev` subindo os dois, git init.
**Acceptance criteria:**
- [x] `npm run dev` → http://localhost:5173 mostra o layout com navegação das 4 telas
- [x] `GET /api/health` (via proxy do Vite) responde `{ ok: true }`
- [x] `.env` está no `.gitignore`
**Verification:** `npm test`, `npm run typecheck`, `curl localhost:5173/api/health`
**Dependencies:** None
**Files:** package.json, server/{package.json,tsconfig.json,src/index.ts}, web/* (vite scaffold), .gitignore, .env.example
**Scope:** M

## Task 2: Cliente Garmin (token + fetch autenticado)
**Description:** `garminClient.ts` troca a chave por token, guarda em memória até expirar, faz GET autenticado; renova uma vez em 401. Rota `/api/status` diz se a chave está configurada/válida.
**Acceptance criteria:**
- [x] Duas chamadas seguidas fazem 1 troca de token (teste com fetch mockado)
- [x] Token expirado ou 401 → nova troca
- [x] Sem `GARMIN_API_KEY` → erro tipado `missing_key`
**Verification:** `npm test -w server`; manual: `curl localhost:8787/api/status` com chave real
**Dependencies:** T1
**Files:** server/src/garminClient.ts, garminClient.test.ts, index.ts
**Scope:** S

## Checkpoint A
- [x] Chave real no `.env`, `/api/status` = ok, formato do token confirmado (JWT em `text/plain`, `exp` 24h, uso `Bearer`; pedir JSON no `Accept` dá 406)

## Task 3: Atividades
**Description:** `/api/activities?start&limit` → lista enxuta; tela com tabela paginada (data, tipo, nome, distância, duração, ritmo/velocidade, FC média, calorias).
**Acceptance criteria:**
- [ ] Tabela mostra 20 por página com "anterior/próxima"
- [ ] Corrida mostra ritmo min/km; pedal mostra km/h
**Verification:** testes de `format.ts` e do mapeamento; comparar 3 atividades com o app
**Dependencies:** T2
**Files:** server/src/routes/activities.ts, web/src/pages/Activities.tsx, web/src/lib/format.ts(+test), web/src/api/
**Scope:** M

## Task 4: Saúde diária
**Description:** `/api/daily?date` (dailysummaries v2 + body battery do dia) → passos, calorias, FC repouso, estresse médio, Body Battery mín/máx, minutos de intensidade; tela com seletor de data e stat tiles.
**Acceptance criteria:**
- [ ] Números batem com o app para um dia escolhido
- [ ] Dia sem dados mostra "—"
**Verification:** teste do mapeamento com fixture; comparação manual
**Dependencies:** T2
**Files:** server/src/routes/daily.ts(+test), web/src/pages/Daily.tsx, web/src/components/StatTile.tsx
**Scope:** M

## Task 5: Sono
**Description:** `dateRanges.ts` quebra períodos em blocos ≤ 31 dias; `/api/sleep?start&end`; tela com noites (duração, fases, pontuação).
**Acceptance criteria:**
- [ ] 90 dias → 3 chamadas à Garmin, resultado contínuo e ordenado
- [ ] Barra empilhada das fases por noite
**Verification:** testes de `dateRanges`; comparar 2 noites com o app
**Dependencies:** T2
**Files:** server/src/dateRanges.ts(+test), server/src/routes/sleep.ts, web/src/pages/Sleep.tsx
**Scope:** M

## Checkpoint B
- [ ] Testes e typecheck passam; 3 telas com dados reais

## Task 6: Tendências de saúde
**Description:** `/api/trends?days=7|30|90` junta resumo diário + sono + body battery; gráficos de passos, FC repouso, horas de sono, estresse, Body Battery.
**Acceptance criteria:**
- [ ] Troca 7/30/90 sem recarregar a página
- [ ] 90 dias funciona (blocos)
**Verification:** teste da junção por data; manual
**Dependencies:** T4, T5
**Files:** server/src/routes/trends.ts(+test), web/src/pages/Trends.tsx, web/src/components/charts/*
**Scope:** M

## Task 7: Volume semanal de atividades
**Description:** gráfico de distância/tempo por semana no período escolhido, na tela de Tendências.
**Acceptance criteria:**
- [ ] Semanas sem atividade aparecem como zero
**Verification:** teste do agrupamento por semana
**Dependencies:** T3, T6
**Files:** web/src/lib/weekly.ts(+test), web/src/pages/Trends.tsx
**Scope:** S

## Task 8: Estados de erro e README
**Description:** chave ausente/expirada/limite → banner claro; loading/skeleton; README com passo a passo para gerar a chave.
**Acceptance criteria:**
- [ ] Sem chave → mensagem com link para gerar, não tela branca
**Verification:** manual removendo a chave; testes
**Dependencies:** T3–T7
**Files:** web/src/components/ErrorBanner.tsx, README.md
**Scope:** S

## Checkpoint C
- [ ] Todos os critérios de sucesso do SPEC
