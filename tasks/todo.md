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
- [x] Recordes só melhoram ao longo do tempo (curva em degraus) e o atual aparece destacado
- [x] VDOT de 5 km em 20:00 ≈ 49,8 (referência das tabelas de Daniels)
**Verification:** testes de `vdot` e `bests`
**Dependencies:** R1
**Files:** web/src/lib/vdot.ts(+test), web/src/lib/runStats.ts, RunningPage.tsx
**Scope:** M

## R4: Zonas + dinâmica + carga + calor
**Description:** tempo por zona de FC por semana (barras empilhadas, % leve vs forte); tendências de cadência, passada, oscilação, contato, razão vertical, potência (pequenos múltiplos); TE aeróbico/anaeróbico por corrida e distribuição de `trainingEffectLabel`; dispersão ritmo × temperatura.
**Acceptance criteria:**
- [x] Corridas sem o dado (ex.: esteira sem potência) ficam fora daquele gráfico, sem quebrar
- [x] Zonas somam o tempo total das corridas com FC
**Verification:** testes das agregações; manual
**Dependencies:** R1
**Files:** web/src/lib/runStats.ts, web/src/components/charts/*, RunningPage.tsx
**Scope:** M

## Checkpoint R
- [x] Aba Corrida com dados reais; km de uma semana e uma melhor marca conferidos com o app; testes + typecheck

# Fase Insights (decidido em 2026-11-05: "quero insights com base nos meus treinos")

## R6: Ritmos de treino e previsões de prova (Daniels)
**Description:** `daniels.ts`: a partir do VDOT estimado, ritmos de treino (Leve, Maratona, Limiar, Intervalado) pela fórmula de custo de O2 de Daniels/Gilbert, e previsões de 5 km / 10 km / 21 km / 42 km (resolvendo VDOT(d, t) = VDOT). Card "Ritmos sugeridos" na seção Melhores marcas, rotulado como estimativa.
**Acceptance criteria:**
- [x] VDOT 50 → Limiar ≈ 4:15/km e Intervalado ≈ 3:55/km; previsões ≈ 19:57 / 41:21 / 1:31:35 / 3:10:49 (tabelas de Daniels, ±1%)
- [x] Sem VDOT no período → card explica por quê (precisa de um esforço ≥ 5 km)
**Verification:** testes de `daniels.ts`; screenshot
**Dependencies:** R3
**Files:** web/src/lib/daniels.ts(+test), web/src/components/TrainingPaces.tsx, RunningPage.tsx
**Scope:** S

## R7: Motor de insights (regras puras)
**Description:** `insights.ts` gera observações a partir das agregações já existentes, cada uma com tom (positivo / atenção / info), título curto e detalhe com os números que a sustentam. Regras: distribuição de intensidade; monotonia de tipo de treino; tendência de eficiência; tendência de ritmo; recordes antigos e quão perto o mês atual chegou; aumento brusco de volume (últimas 4 semanas vs 4 anteriores e última semana vs média); lacunas de consistência; custo do calor; ritmo das corridas "leves" vs ritmo leve sugerido pelo VDOT. Linguagem de observação, nunca prescrição médica; cada regra só dispara com dados suficientes.
**Acceptance criteria:**
- [x] Cada regra tem teste com cenário que dispara e cenário que não dispara
- [x] Insights ordenados: atenção → positivo → info; no máximo 6 exibidos
**Verification:** testes de `insights.ts`
**Dependencies:** R2–R4, R6
**Files:** web/src/lib/insights.ts(+test)
**Scope:** M

## R8: Painel de insights na aba Corrida
**Description:** Painel "O que seus treinos mostram" logo abaixo dos tiles do período, cada insight com ícone + rótulo de tom (nunca só cor), título e detalhe; respeita o seletor de período.
**Acceptance criteria:**
- [x] Trocar o período recalcula os insights
- [x] Tom comunicado por ícone + texto, não só cor
**Verification:** teste de componente; screenshot com dados reais
**Dependencies:** R7
**Files:** web/src/components/InsightsPanel.tsx(+test), RunningPage.tsx, styles.css
**Scope:** S

## Checkpoint I
- [x] Insights com dados reais revisados pelo usuário (fazem sentido para os treinos dele?)

# Fase Perfil e distribuição (pedido em 2026-11-05)

## P1: Perfil no topo
**Description:** `/api/profile` devolve só `fullName`, `photoUrl` (da atividade mais recente) e preferências (`locale`, `measurementSystem`, `timeZone`, `firstDayOfWeek`) de `/userprofile-service/userprofile/settings`; cache 1 h. Topo mostra foto + "Olá, Nome".
**Acceptance criteria:**
- [x] Nenhum outro campo do dono sai do servidor (teste)
- [x] Sem atividades → topo sem nome, sem erro
**Dependencies:** T2 · **Scope:** S

## R9: Máximo de insights de corrida (pedido em 2026-11-05: "o máximo de insights possíveis, de tudo")
**Description:** novas regras sobre dados que já temos: manhã × noite, esteira × rua, progressão e peso do longão, treinos fortes em dias seguidos, pouco estímulo anaeróbico, relevo, melhor mês, frequência semanal, cadência e tempo de contato, VDOT vs período anterior. Painel mostra todos os insights agrupados (Atenção / Pontos positivos / Observações), não só 6.
**Acceptance criteria:**
- [x] Cada regra nova tem teste que dispara e teste que não dispara
- [x] Painel mostra todos os insights, agrupados por tom
**Dependencies:** R7, R8 · **Scope:** M

## D1: Tela de Configuração
**Description:** rota `#/configuracao`: status (chave configurada? válida?), campo para colar a chave → `POST /api/settings/key` troca a chave por token **antes** de gravar no `.env` (cria a partir do `.env.example` se faltar) e nunca devolve a chave. Sem chave, o app abre direto essa tela. Proteções: Host = 127.0.0.1/localhost, Origin do próprio app, `Content-Type: application/json`.
**Acceptance criteria:**
- [x] Chave inválida não é gravada e mostra erro claro
- [x] POST com Origin/Host estranhos → 403 (teste)
- [x] Resposta e logs nunca contêm a chave (teste)
**Dependencies:** T8 · **Scope:** M

## D2: Modo produção com um comando
**Description:** `npm run build` compila o web; `npm start` sobe o servidor servindo `web/dist` + `/api` em http://127.0.0.1:8787.
**Acceptance criteria:**
- [x] Após `npm install && npm run build && npm start`, abrir a URL mostra o app funcionando
**Dependencies:** D1 · **Scope:** S

## D3: README de instalação
**Description:** passo a passo para quem nunca viu o projeto: instalar Node LTS, baixar o projeto, `npm install`, `npm run build`, `npm start`, gerar a chave e colar na tela de Configuração; solução de problemas; privacidade (tudo local).
**Dependencies:** D1, D2 · **Scope:** S

## Checkpoint D
- [x] Instalação do zero seguindo só o README, numa pasta limpa

## R5: Detalhe km a km (opcional)
**Description:** clicar numa corrida → baixar `.FIT` (`/download-service/files/activity/{id}`), decodificar no servidor, ritmo/FC/cadência por km. **Perguntar antes** sobre a dependência de parser FIT.
**Dependencies:** R1
**Scope:** M

---

## Task 4: Saúde diária
**Description:** `/api/daily?date` (dailysummaries v2 + body battery do dia) → passos, calorias, FC repouso, estresse médio, Body Battery mín/máx, minutos de intensidade; tela com seletor de data e stat tiles.
**Acceptance criteria:**
- [x] Números batem com o app para um dia escolhido
- [x] Dia sem dados mostra "—"
**Verification:** teste do mapeamento com fixture; comparação manual
**Dependencies:** T2
**Files:** server/src/routes/daily.ts(+test), web/src/pages/Daily.tsx, web/src/components/StatTile.tsx
**Scope:** M

## H2: Histórico diário
**Description:** `/api/daily/range?from&to` busca `/usersummary-service/v2/dailysummaries` em blocos de ≤ 366 dias (limite medido na API real em 2026-11-05: 366 ok, 367 → 400; dias sem dados são omitidos pela Garmin e o servidor os preenche) (`dateRanges.ts`) e devolve uma lista enxuta por dia (passos, meta, FC repouso, estresse médio e % alto, Body Battery mín/máx/carregou/gastou, minutos moderados/vigorosos, calorias ativas). Cache 10 min por intervalo. Antes de mapear, conferir na API real o tamanho máximo do intervalo e gravar fixture anonimizada.
**Acceptance criteria:**
- [x] Até 366 dias → 1 chamada; 400 dias → 2 chamadas; resultado contínuo (um item por dia, lacunas preenchidas) e ordenado
- [x] Dias sem dados vêm com `hasData: false`, intervalo inválido ou > 400 dias → 400
- [x] Nenhum id de conta/dispositivo sai do servidor (teste)
**Verification:** testes de `dateRanges` e da rota; curl com a chave real
**Dependencies:** T4 · **Files:** server/src/dateRanges.ts(+test), server/src/routes/daily.ts(+test), fixtures · **Scope:** M

## H3: Insights do dia
**Description:** `healthInsights.ts` compara o dia escolhido com os 30 dias anteriores (vindos da H2): FC repouso acima/abaixo da sua linha de base; Body Battery máximo baixo/alto vs o típico; carregou menos do que gastou; estresse médio e tempo em estresse alto vs o típico; passos vs meta e vs a sua média, sequência de dias batendo a meta; minutos de intensidade da semana vs a meta semanal. Painel "O que o seu dia mostra" (reaproveita `InsightsPanel`). Linguagem de observação, nunca diagnóstico; cada regra exige um mínimo de dias de histórico.
**Acceptance criteria:**
- [x] Cada regra tem teste que dispara e teste que não dispara (inclui histórico insuficiente)
- [x] Trocar o dia recalcula os insights; tom por ícone + texto
**Verification:** testes; screenshot com dados reais; revisão do usuário
**Dependencies:** H2 · **Files:** web/src/lib/healthInsights.ts(+test), web/src/api/daily.ts, DailyPage.tsx(+test) · **Scope:** M

## Task 5: Sono
**Description:** `dateRanges.ts` quebra períodos em blocos ≤ 31 dias; `/api/sleep?start&end`; tela com noites (duração, fases, pontuação).
**Acceptance criteria:**
- [x] 90 dias → 3 chamadas de sono (+3 de VFC) à Garmin, resultado contínuo e ordenado
- [x] Barra empilhada das fases por noite
**Verification:** testes de `dateRanges`; comparar 2 noites com o app
**Dependencies:** T2
**Files:** server/src/dateRanges.ts(+test), server/src/routes/sleep.ts, web/src/pages/Sleep.tsx
**Scope:** M

## H4: Insights de sono
**Description:** `sleepInsights.ts` sobre as noites do período escolhido: sono médio vs a necessidade da Garmin; noites curtas (< 6 h); regularidade do horário de dormir; diferença de horário no fim de semana; proporção de profundo e REM vs referências comuns; VFC recente vs a sua faixa equilibrada; tendência da última semana vs o resto do período; horário de dormir × pontuação (as suas melhores noites); noites sem registro. Painel "O que o seu sono mostra" na tela de Sono.
**Acceptance criteria:**
- [x] Cada regra tem teste que dispara e teste que não dispara (inclui poucos dados)
- [x] Trocar o período recalcula; tom por ícone + texto
**Verification:** testes; varredura com dados reais; screenshot
**Dependencies:** T5 · **Files:** web/src/lib/sleepInsights.ts(+test), SleepPage.tsx(+test) · **Scope:** M

## Checkpoint B
- [x] Testes e typecheck passam; 3 telas com dados reais

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
- [x] Sem chave → mensagem com link para gerar, não tela branca
**Verification:** manual removendo a chave; testes
**Dependencies:** T3–T7
**Files:** web/src/components/ErrorBanner.tsx, README.md
**Scope:** S

## Checkpoint C
- [ ] Todos os critérios de sucesso do SPEC
