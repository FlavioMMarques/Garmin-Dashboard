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
- [x] Tabela mostra 20 por página com "anterior/próxima"
- [x] Corrida mostra ritmo min/km; pedal mostra km/h
**Verification:** testes de `format.ts` e do mapeamento; comparar 3 atividades com o app
**Dependencies:** T2
**Files:** server/src/routes/activities.ts, web/src/pages/Activities.tsx, web/src/lib/format.ts(+test), web/src/api/
**Scope:** M

---
# Fase Corrida (prioridade — decidido em 2026-11-05)

## R1: Corridas do período + aba Corrida
**Description:** `/api/runs?from=YYYY-MM-DD` busca na Garmin todas as corridas (`activityType=running`, inclui esteira) desde `from`, paginando de 100 em 100, e devolve lista enxuta com campos de corrida (distância, duração, velocidade, FC média/máx, cadência, passada, oscilação, contato, razão vertical, potência, TE aeróbico/anaeróbico, label, `fastestSplit_*`, `hrTimeInZone_*`, temperatura, elevação). Cache em memória 10 min por `from`. Aba "Corrida" vira a inicial, com seletor 3m / 6m (padrão) / 1 ano / tudo e stat tiles do período (corridas, km, tempo, ritmo médio).
**Acceptance criteria:**
- [x] Período "tudo" pagina até acabar; nenhum campo pessoal (nome do dono, GPS) sai do servidor
- [x] Segunda chamada igual em < 10 min não chama a Garmin
- [x] Trocar período não recarrega a página; tiles batem com a soma das corridas
**Verification:** testes de rota (paginação, cache, mapeamento) com fixture fictícia; manual
**Dependencies:** T3
**Files:** server/src/routes/runs.ts(+test), web/src/api/runs.ts, web/src/pages/RunningPage.tsx, web/src/components/StatTile.tsx
**Scope:** M

## R2: Volume + ritmo
**Description:** funções puras `weekly.ts` (semana ISO seg–dom, semanas vazias = 0), `monthly`, acumulado do ano vs ano anterior, média móvel; gráficos: km/semana (barras) com maior corrida, km/mês, acumulado YTD (2 linhas), ritmo por corrida (pontos) + média móvel por faixa de distância.
**Acceptance criteria:**
- [x] Semanas sem corrida aparecem como zero
- [x] Eixo de ritmo invertido (mais rápido em cima) e formatado em min:ss
**Verification:** testes de `weekly`/`rolling`; conferir km de uma semana com o app
**Dependencies:** R1
**Files:** web/src/lib/runStats.ts(+test), web/src/components/charts/*, RunningPage.tsx
**Scope:** M

## R3: Eficiência + melhores marcas + VDOT
**Description:** eficiência = velocidade (m/min) ÷ FC média por corrida + média móvel; melhor 1k/1mi/5k/10k/21k por mês e recorde acumulado (degraus); VDOT estimado (fórmula de Daniels/Gilbert) a partir das melhores marcas recentes, rotulado "estimativa".
**Acceptance criteria:**
- [ ] Recordes só melhoram ao longo do tempo (curva em degraus) e o atual aparece destacado
- [ ] VDOT de 5 km em 20:00 ≈ 49,8 (referência das tabelas de Daniels)
**Verification:** testes de `vdot` e `bests`
**Dependencies:** R1
**Files:** web/src/lib/vdot.ts(+test), web/src/lib/runStats.ts, RunningPage.tsx
**Scope:** M

## R4: Zonas + dinâmica + carga + calor
**Description:** tempo por zona de FC por semana (barras empilhadas, % leve vs forte); tendências de cadência, passada, oscilação, contato, razão vertical, potência (pequenos múltiplos); TE aeróbico/anaeróbico por corrida e distribuição de `trainingEffectLabel`; dispersão ritmo × temperatura.
**Acceptance criteria:**
- [ ] Corridas sem o dado (ex.: esteira sem potência) ficam fora daquele gráfico, sem quebrar
- [ ] Zonas somam o tempo total das corridas com FC
**Verification:** testes das agregações; manual
**Dependencies:** R1
**Files:** web/src/lib/runStats.ts, web/src/components/charts/*, RunningPage.tsx
**Scope:** M

## Checkpoint R
- [ ] Aba Corrida com dados reais; km de uma semana e uma melhor marca conferidos com o app; testes + typecheck

## R5: Detalhe km a km (opcional)
**Description:** clicar numa corrida → baixar `.FIT` (`/download-service/files/activity/{id}`), decodificar no servidor, ritmo/FC/cadência por km. **Perguntar antes** sobre a dependência de parser FIT.
**Dependencies:** R1
**Scope:** M

---

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

## ~~Task 7: Volume semanal de atividades~~ → absorvida pela R2
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
