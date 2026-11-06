import { useMemo } from "react";
import { useDailyRange } from "../api/daily";
import type { RunSummary } from "../api/runs";
import { useSleep } from "../api/sleep";
import { generateCrossInsights } from "../lib/crossInsights";
import { shiftDate } from "../lib/health";
import { InsightsPanel } from "./InsightsPanel";

/** The health routes accept up to 400 days; "Tudo" uses the most recent ones. */
const MAX_HEALTH_DAYS = 400;

/** "Saúde × treino": the period's runs against sleep, HRV, Body Battery and resting HR. */
export function CrossInsights({
  runs,
  from,
  today,
}: {
  runs: RunSummary[];
  /** Period start (YYYY-MM-DD); undefined = whole history. */
  from: string | undefined;
  /** YYYY-MM-DD. */
  today: string;
}) {
  const earliest = shiftDate(today, -(MAX_HEALTH_DAYS - 1));
  const healthFrom = from && from > earliest ? from : earliest;
  const daily = useDailyRange(healthFrom, today);
  const sleep = useSleep(healthFrom, today);

  const insights = useMemo(
    () =>
      generateCrossInsights({
        runs: runs.filter((r) => r.startLocal.slice(0, 10) >= healthFrom),
        days: daily.data ?? [],
        nights: sleep.data ?? [],
      }),
    [runs, healthFrom, daily.data, sleep.data],
  );

  return (
    <section
      aria-labelledby="cross-insights-title"
      aria-busy={daily.isFetching || sleep.isFetching}
    >
      <h2 id="cross-insights-title" className="section-title">
        Saúde × treino
      </h2>
      {daily.error || sleep.error ? (
        <p className="panel muted">
          Não foi possível carregar sono e saúde para cruzar com os treinos.
        </p>
      ) : daily.isPending || sleep.isPending ? (
        <div className="panel skeleton" style={{ height: "6rem" }} />
      ) : (
        <InsightsPanel
          insights={insights}
          emptyMessage={`Ainda não há corridas suficientes com dados de sono e saúde para comparar (cada observação precisa de pelo menos 4 corridas em cada situação).${from ? "" : " Em “Tudo”, o cruzamento usa os últimos 400 dias."}`}
        />
      )}
    </section>
  );
}
