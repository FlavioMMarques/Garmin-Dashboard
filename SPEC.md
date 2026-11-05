# Spec: Garmin Dashboard (local)

## Objetivo
Página React rodando só na máquina local para visualizar meus próprios dados do Garmin Connect
usando a **Garmin Connect Personal API** (chave pessoal, sem OAuth, sem aprovação comercial).

Usuário: eu mesmo (uso pessoal, um único usuário, nunca publicado na internet).

### Histórias / critérios de aceitação
1. **Atividades** — vejo as últimas atividades (data, tipo, nome, distância, duração, ritmo/velocidade, FC média, calorias), com paginação.
2. **Saúde diária** — para um dia escolhido vejo passos, calorias, FC de repouso, estresse médio, Body Battery (mín/máx) e minutos de intensidade.
3. **Sono** — vejo duração total, fases (profundo/leve/REM/acordado) e pontuação do sono por noite.
4. **Tendências** — gráficos para um período (7 / 30 / 90 dias) de: passos, FC de repouso, sono (horas + fases), estresse e Body Battery; e volume semanal de atividades.
5. A chave da API **nunca** chega ao navegador.

## Como a API funciona (pesquisado na doc oficial)
- Gerar chave em https://connect.garmin.com/app/settings/personalApiToken (validade 30/90/180/365 dias, mostrada uma única vez).
- Trocar a chave por token: `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`
  com header `Authorization: ApiKey <chave>`. O token vale **24h**.
- Endpoints que vamos usar (base `https://personal.connectapi.garmin.com`, todos GET):

| Uso | Endpoint | Limite de período |
|---|---|---|
| Atividades | `/activitylist-service/activities/search/activities?start&limit&startDate&endDate` | paginado (limit padrão 99) |
| Detalhe atividade | `/activity-service/activity/{activityId}` | — |
| Resumo diário | `/usersummary-service/v2/dailysummaries?startDate&endDate` | 1 ano |
| Sono | `/sleep-service/sleep/dailySleepSummariesByDate?startDate&endDate` | 31 dias |
| Body Battery | `/wellness-service/wellness/bodyBattery/reports/daily?startDate&endDate` | 31 dias |
| Passos | `/usersummary-service/stats/steps/daily/{start}/{end}` | — |
| Estresse | `/usersummary-service/stats/stress/daily/{start}/{end}` | — |
| HRV | `/hrv-service/hrv/daily/{from}/{to}` | — |

Cópia da spec OpenAPI extraída da página Swagger da Garmin fica em `docs/garmin-openapi.json`.

## Arquitetura
```
Navegador (React, :5173) ──/api/*──▶ Servidor local Node (:8787) ──▶ personal.connectapi.garmin.com
                                      • lê GARMIN_API_KEY do .env
                                      • troca chave → token, guarda em memória até expirar
                                      • só repassa endpoints de uma lista permitida
                                      • quebra períodos > 31 dias em blocos (sono / body battery)
```
O navegador não pode chamar a Garmin direto: a chave ficaria exposta e o CORS provavelmente bloqueia.

## Stack
- Node.js 26 LTS (instalado via `winget install OpenJS.NodeJS.LTS`)
- Frontend: Vite + React 19 + TypeScript, TanStack Query (cache/loading), Recharts (gráficos)
- Backend: Hono no Node (`@hono/node-server`), TypeScript rodando com `tsx`
- Testes: Vitest (+ Testing Library para componentes)
- Um repositório só, com npm workspaces (`web/` e `server/`)

## Comandos
```
npm install                 # instala tudo
npm run dev                 # sobe server (:8787) + web (:5173) juntos
npm test                    # vitest em todos os workspaces
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
```

## Estrutura
```
garmin-dashboard/
  .env.example              → GARMIN_API_KEY=
  SPEC.md
  docs/garmin-openapi.json
  server/src/
    garminClient.ts         → token + fetch autenticado
    routes.ts               → /api/activities, /api/daily, /api/sleep, /api/trends
    dateRanges.ts           → quebra de período em blocos de 31 dias
    *.test.ts
  web/src/
    api/                    → hooks TanStack Query
    pages/                  → Activities, Daily, Sleep, Trends
    components/             → StatTile, charts, tabelas
    lib/format.ts           → ritmo, duração, distância
```

## Estilo de código
```ts
// Funções pequenas, tipos explícitos nas fronteiras, nomes em inglês, UI em português.
export function formatPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60).toString().padStart(2, "0");
  return `${min}:${sec} /km`;
}
```
- Prettier padrão, aspas duplas, ponto e vírgula.
- Respostas da Garmin tipadas só com os campos que usamos (não importar o DTO inteiro).

## Testes
- Unitários (Vitest): formatação, quebra de períodos, cache/renovação do token (fetch mockado).
- Componentes: render de páginas com dados fixos (fixtures gravadas de respostas reais, **sem dados pessoais sensíveis no repo**).
- Manual: rodar com a chave real e conferir os números com o app Garmin Connect.

## Limites
- **Sempre:** manter a chave só no `.env` (no `.gitignore`); rodar testes e typecheck antes de dizer que terminou.
- **Perguntar antes:** instalar Node/dependências novas fora da stack acima; usar endpoints fora da tabela.
- **Nunca:** enviar a chave ou o token ao navegador; expor o servidor fora de `127.0.0.1`; commitar dados pessoais reais.

## Critérios de sucesso
- [ ] `npm run dev` abre http://localhost:5173 e as 4 telas carregam dados reais.
- [ ] Números de um dia escolhido batem com o app Garmin Connect.
- [ ] Tendências de 90 dias funcionam (prova da quebra em blocos de 31 dias).
- [ ] Token é reaproveitado (uma única troca de token a cada 24h, visível no log do servidor).
- [ ] Chave ausente/expirada mostra mensagem clara na tela, não tela branca.
- [ ] `npm test` e `npm run typecheck` passam.

## Perguntas em aberto
1. ~~**Formato da resposta do token**~~ — resolvido: o endpoint devolve o JWT cru em `text/plain` (validade no claim `exp`, 24h) e responde 406 se o `Accept` pedir JSON; chamadas usam `Authorization: Bearer <token>`.
2. **Rate limit**: não documentado. Vou usar cache no servidor (TanStack Query + cache em memória por dia) para não exagerar nas chamadas.
3. Unidades: km e min/km por padrão (ajustável depois).
